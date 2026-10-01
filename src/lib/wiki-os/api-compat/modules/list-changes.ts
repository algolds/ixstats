/**
 * list-changes.ts — `list=recentchanges|usercontribs|logevents` (plan 410).
 *
 * Recent changes merge two streams: edits (every non-deleted revision) and WikiOS log entries. The
 * merge keeps one total order, (time, kind, id), and a continuation names the first entry of the
 * next page; a source that was cut short bounds how far the merge can be trusted (the "horizon").
 */

import { encodeCursor, optionalCursor } from "../continuation";
import { ApiError, badContinue } from "../errors";
import { mwTimestamp, sha1Hex, type JsonObject } from "../format";
import type { ApiParams } from "../params";
import type { LogRow, RevisionRow } from "../store-types";
import type { ApiContext } from "../types";
import { directionParam, namespacesParam } from "./list-common";
import type { ListModule, ListResult } from "./query-list";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { LOG_TYPES } from "~/lib/wiki-os/core/rights-admin-service";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";

const IP_NAME = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]+:[0-9a-f:]*)$/i;
const isAnonymousName = (name: string | null) => name !== null && IP_NAME.test(name);
const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Larger than any log id: a cursor at "after every log entry of this moment". */
const MAX_INT = 2_147_483_647;
/** A log entry's `rcid` is its log id plus this, which keeps it clear of revision ids (and so of other `rcid`s). */
const LOG_RCID_OFFSET = 2_000_000_000;

// ---------------------------------------------------------------------------
// recentchanges
// ---------------------------------------------------------------------------

const RC_PROPS = ["user", "userid", "comment", "parsedcomment", "flags", "timestamp", "title", "ids", "sizes", "loginfo", "tags", "sha1"] as const;
type RcProp = (typeof RC_PROPS)[number];
const RC_SHOW = ["minor", "!minor", "bot", "!bot", "anon", "!anon"] as const;
type RcShow = (typeof RC_SHOW)[number];
const RC_TYPES = ["edit", "new", "log"] as const;
type RcType = (typeof RC_TYPES)[number];

/** One entry of the merged stream, positioned by (time, kind, id). */
interface RcEntry {
  time: number;
  /** A log entry sorts before an edit made at the same moment (rank 0 < 1). */
  rank: 0 | 1;
  id: number;
  item: JsonObject;
}

const compareEntries = (a: RcEntry, b: RcEntry): number => a.time - b.time || a.rank - b.rank || a.id - b.id;

interface RcFilter {
  types: ReadonlySet<RcType>;
  show: ReadonlySet<RcShow>;
  props: ReadonlySet<RcProp>;
}

function editWho(rev: RevisionRow, props: ReadonlySet<RcProp>): JsonObject {
  const out: JsonObject = {};
  if (props.has("user")) {
    if (rev.userHidden) out.userhidden = true;
    else {
      out.user = rev.user ?? "";
      if (isAnonymousName(rev.user)) out.anon = true;
    }
  }
  if (props.has("userid") && !rev.userHidden) out.userid = rev.userId;
  return out;
}

function editComment(rev: RevisionRow, props: ReadonlySet<RcProp>): JsonObject {
  if (!props.has("comment") && !props.has("parsedcomment")) return {};
  if (rev.commentHidden) return { commenthidden: true };
  return {
    ...(props.has("comment") ? { comment: rev.comment ?? "" } : {}),
    ...(props.has("parsedcomment") ? { parsedcomment: escapeHtml(rev.comment ?? "") } : {}),
  };
}

function editItem(rev: RevisionRow, { props }: RcFilter): JsonObject {
  const isNew = rev.parentId === 0;
  return {
    type: isNew ? "new" : "edit",
    ...(props.has("title") ? { ns: rev.namespace, title: rev.title } : {}),
    ...(props.has("ids") ? { pageid: rev.pageId, revid: rev.revId, old_revid: rev.parentId, rcid: rev.revId } : {}),
    ...editWho(rev, props),
    ...(props.has("flags") ? { bot: false, new: isNew, minor: rev.minor } : {}),
    ...(props.has("sizes") ? { oldlen: rev.size - rev.sizeDiff, newlen: rev.size } : {}),
    ...(props.has("timestamp") ? { timestamp: mwTimestamp(rev.timestamp) } : {}),
    ...editComment(rev, props),
    ...(props.has("sha1") ? { sha1: sha1Hex(rev.sha1) } : {}),
    ...(props.has("tags") ? { tags: [] } : {}),
  };
}

function logItem(row: LogRow, { props }: RcFilter): JsonObject {
  return {
    type: "log",
    logid: row.logId,
    logtype: row.type,
    logaction: row.action,
    ...(props.has("title") ? { ns: row.namespace, title: row.title } : {}),
    ...(props.has("ids") ? { pageid: row.pageId, revid: 0, old_revid: 0, rcid: LOG_RCID_OFFSET + row.logId } : {}),
    ...(props.has("user") ? { user: row.actor, ...(isAnonymousName(row.actor) ? { anon: true } : {}) } : {}),
    ...(props.has("flags") ? { bot: false, new: false, minor: false } : {}),
    ...(props.has("timestamp") ? { timestamp: mwTimestamp(row.timestamp) } : {}),
    ...(props.has("comment") ? { comment: row.comment ?? "" } : {}),
    ...(props.has("parsedcomment") ? { parsedcomment: escapeHtml(row.comment ?? "") } : {}),
    ...(props.has("loginfo") ? { logparams: row.params } : {}),
    ...(props.has("tags") ? { tags: [] } : {}),
  };
}

/** The edit and the log source an `rccontinue` position leaves to read (see the module comment). */
function sourceCursors(cursor: { time: number; kind: string; id: number } | undefined) {
  if (!cursor) return { edit: undefined, log: undefined };
  const timestamp = new Date(cursor.time);
  return {
    edit: { timestamp, revId: cursor.kind === "e" ? cursor.id : 0 },
    log: { timestamp, logId: cursor.kind === "l" ? cursor.id : MAX_INT },
  };
}

function checkShow(show: readonly RcShow[]): void {
  for (const flag of ["minor", "bot", "anon"] as const) {
    if (show.includes(flag) && show.includes(`!${flag}` as RcShow)) {
      throw new ApiError("show", "Incorrect parameter - mutually exclusive values may not be supplied.");
    }
  }
}

/** Whether an edit passes the filters the store cannot apply (type split, anon, bot). */
function keepEdit(rev: RevisionRow, { types, show }: RcFilter): boolean {
  const type: RcType = rev.parentId === 0 ? "new" : "edit";
  if (!types.has(type)) return false;
  const anon = isAnonymousName(rev.user);
  return !(
    (show.has("anon") && !anon) ||
    (show.has("!anon") && anon) ||
    show.has("bot") // no revision is flagged as a bot edit
  );
}

function keepLog(row: LogRow, { show }: RcFilter, namespaces: readonly number[] | undefined): boolean {
  const anon = isAnonymousName(row.actor);
  return !(
    (namespaces && !namespaces.includes(row.namespace)) ||
    show.has("minor") ||
    show.has("bot") ||
    (show.has("anon") && !anon) ||
    (show.has("!anon") && anon)
  );
}

interface RcRequest {
  filter: RcFilter;
  limit: number;
  newer: boolean;
  namespaces: number[] | undefined;
  cursor: { time: number; kind: string; id: number } | undefined;
  user: string | undefined;
  excludeUser: string | undefined;
  from: Date | undefined;
  to: Date | undefined;
}

function readRcRequest(rc: ApiContext, p: ApiParams): RcRequest {
  const filter: RcFilter = {
    props: new Set(p.listOf("prop", RC_PROPS, ["title", "timestamp", "ids"])),
    types: new Set(p.listOf("type", RC_TYPES, RC_TYPES)),
    show: new Set(p.listOf("show", RC_SHOW)),
  };
  checkShow([...filter.show]);
  const parts = optionalCursor(p.raw("continue"), ["s", "s", "n"] as const);
  const cursor = parts ? { time: new Date(parts[0]).getTime(), kind: parts[1], id: parts[2] } : undefined;
  if (cursor && (Number.isNaN(cursor.time) || !["e", "l"].includes(cursor.kind))) throw badContinue();
  const user = p.string("user");
  const excludeUser = p.string("excludeuser");
  return {
    filter,
    limit: p.limit("limit", { fallback: 10, high: rc.highLimits }),
    newer: directionParam(p, ["newer", "older"], "older") === "ascending",
    namespaces: namespacesParam(p),
    cursor,
    user: user ? normalizeWikiUsername(user) : undefined,
    excludeUser: excludeUser ? normalizeWikiUsername(excludeUser) : undefined,
    from: p.timestamp("start", rc.now),
    to: p.timestamp("end", rc.now),
  };
}

/** Up to a window of rows from each source the request asks for (the stores answer `window + 1` rows each). */
async function readRcSources(rc: ApiContext, request: RcRequest, window: number) {
  const { filter, newer, cursor } = request;
  const cursors = sourceCursors(cursor);
  const wantsEdits = filter.types.has("edit") || filter.types.has("new");
  const dir = newer ? "newer" : "older";
  const [revisions, logs] = await Promise.all([
    wantsEdits
      ? rc.deps.store.findRevisions({
          dir,
          namespaces: request.namespaces,
          users: request.user ? [request.user] : undefined,
          excludeUser: request.excludeUser,
          minor: filter.show.has("minor") ? true : filter.show.has("!minor") ? false : undefined,
          from: request.from ? { timestamp: request.from } : undefined,
          to: request.to ? { timestamp: request.to } : undefined,
          cursor: cursors.edit,
          limit: window,
          withContent: false,
        })
      : [],
    filter.types.has("log")
      ? rc.deps.store.findLogs({
          dir,
          user: request.user,
          excludeUser: request.excludeUser,
          from: request.from,
          to: request.to,
          cursor: cursors.log,
          limit: window,
        })
      : [],
  ]);
  return { revisions, logs };
}

const rcEntry = (kind: "e" | "l", time: Date, id: number, item: JsonObject): RcEntry => ({
  time: time.getTime(),
  rank: kind === "e" ? 1 : 0,
  id,
  item,
});

async function runRecentChanges(rc: ApiContext, p: ApiParams): Promise<ListResult> {
  const request = readRcRequest(rc, p);
  const { filter, limit, newer, namespaces } = request;
  // The stores answer up to `limit + 1` rows; an in-memory filter may leave fewer, so read a window.
  const window = limit * 3;
  const { revisions, logs } = await readRcSources(rc, request, window);
  const order = (a: RcEntry, b: RcEntry) => (newer ? 1 : -1) * compareEntries(a, b);

  const entries = [
    ...revisions
      .slice(0, window)
      .filter((rev) => keepEdit(rev, filter))
      .map((rev) => rcEntry("e", rev.timestamp, rev.revId, editItem(rev, filter))),
    ...logs
      .slice(0, window)
      .filter((row) => keepLog(row, filter, namespaces))
      .map((row) => rcEntry("l", row.timestamp, row.logId, logItem(row, filter))),
  ].sort(order);

  // A source cut short hides rows beyond its last one: nothing past the earliest such row can be trusted.
  const extraRevision = revisions[window];
  const extraLog = logs[window];
  const horizon = [
    ...(extraRevision ? [rcEntry("e", extraRevision.timestamp, extraRevision.revId, {})] : []),
    ...(extraLog ? [rcEntry("l", extraLog.timestamp, extraLog.logId, {})] : []),
  ].sort(order)[0];
  const trusted = horizon ? entries.filter((candidate) => order(candidate, horizon) < 0) : entries;

  const nextEntry = trusted[limit] ?? horizon;
  return {
    items: trusted.slice(0, limit).map((candidate) => candidate.item),
    next: nextEntry
      ? encodeCursor([new Date(nextEntry.time).toISOString(), nextEntry.rank === 1 ? "e" : "l", nextEntry.id])
      : null,
  };
}

export const recentChanges: ListModule = {
  prefix: "rc",
  resultKey: "recentchanges",
  generator: true,
  run: runRecentChanges,
};

// ---------------------------------------------------------------------------
// usercontribs
// ---------------------------------------------------------------------------

const UC_PROPS = ["ids", "title", "timestamp", "comment", "parsedcomment", "size", "sizediff", "flags", "tags"] as const;
const UC_SHOW = ["minor", "!minor", "new", "!new", "top", "!top"] as const;

async function runUserContribs(rc: ApiContext, p: ApiParams): Promise<ListResult> {
  const names = p.list("user").map(normalizeWikiUsername);
  const props = new Set(p.listOf("prop", UC_PROPS, ["ids", "title", "timestamp", "comment", "size", "flags"]));
  const show = new Set(p.listOf("show", UC_SHOW));
  const limit = p.limit("limit", { fallback: 10, high: rc.highLimits });
  const dir = directionParam(p, ["newer", "older"], "older");
  const cursor = optionalCursor(p.raw("continue"), ["s", "n"] as const);
  const cursorTime = cursor ? new Date(cursor[0]) : undefined;
  if (cursorTime && Number.isNaN(cursorTime.getTime())) throw badContinue();

  const start = p.timestamp("start", rc.now);
  const end = p.timestamp("end", rc.now);
  const namespaces = namespacesParam(p);
  if (names.length === 0) {
    throw new ApiError("missingparam", "One of the parameters ucuser, ucuserids, ucuserprefix, uciprange is required.");
  }
  const rows = await rc.deps.store.findRevisions({
    dir: dir === "ascending" ? "newer" : "older",
    namespaces,
    users: names,
    minor: show.has("minor") ? true : show.has("!minor") ? false : undefined,
    from: start ? { timestamp: start } : undefined,
    to: end ? { timestamp: end } : undefined,
    cursor: cursor && cursorTime ? { timestamp: cursorTime, revId: cursor[1] } : undefined,
    limit,
    withContent: false,
  });
  const page = rows.slice(0, limit).filter((rev) => {
    const isNew = rev.parentId === 0;
    return !((show.has("new") && !isNew) || (show.has("!new") && isNew) || (show.has("top") && !rev.isHead) || (show.has("!top") && rev.isHead));
  });
  const next = rows[limit];
  return {
    items: page.map((rev) => ({
      userid: rev.userId,
      user: rev.user ?? "",
      ...(props.has("ids") ? { pageid: rev.pageId, revid: rev.revId, parentid: rev.parentId } : {}),
      ...(props.has("title") ? { ns: rev.namespace, title: rev.title } : {}),
      ...(props.has("timestamp") ? { timestamp: mwTimestamp(rev.timestamp) } : {}),
      ...(props.has("comment") ? (rev.commentHidden ? { commenthidden: true } : { comment: rev.comment ?? "" }) : {}),
      ...(props.has("parsedcomment") && !rev.commentHidden ? { parsedcomment: escapeHtml(rev.comment ?? "") } : {}),
      ...(props.has("size") ? { size: rev.size } : {}),
      ...(props.has("sizediff") ? { sizediff: rev.sizeDiff } : {}),
      ...(props.has("flags") ? { new: rev.parentId === 0, minor: rev.minor, top: rev.isHead } : {}),
      ...(props.has("tags") ? { tags: [] } : {}),
    })),
    next: next ? encodeCursor([next.timestamp.toISOString(), next.revId]) : null,
  };
}

export const userContribs: ListModule = {
  prefix: "uc",
  resultKey: "usercontribs",
  generator: false,
  run: runUserContribs,
};

// ---------------------------------------------------------------------------
// logevents
// ---------------------------------------------------------------------------

const LE_PROPS = ["ids", "title", "type", "user", "userid", "timestamp", "comment", "parsedcomment", "details", "tags"] as const;

async function runLogEvents(rc: ApiContext, p: ApiParams): Promise<ListResult> {
  const props = new Set(p.listOf("prop", LE_PROPS, ["ids", "title", "type", "user", "timestamp", "comment", "details"]));
  const type = p.oneOf("type", LOG_TYPES);
  const action = p.string("action");
  const limit = p.limit("limit", { fallback: 10, high: rc.highLimits });
  const dir = directionParam(p, ["newer", "older"], "older");
  const cursor = optionalCursor(p.raw("continue"), ["s", "n"] as const);
  const cursorTime = cursor ? new Date(cursor[0]) : undefined;
  if (cursorTime && Number.isNaN(cursorTime.getTime())) throw badContinue();
  const title = p.string("title");
  const namespaces = namespacesParam(p);
  const user = p.string("user");

  const [actionType, actionName] = action?.split("/") ?? [];
  const rows = await rc.deps.store.findLogs({
    type: type ?? (actionName ? actionType : undefined),
    action: actionName ?? undefined,
    title: title ? canonicalizeTitle(title)?.title : undefined,
    user: user ? normalizeWikiUsername(user) : undefined,
    dir: dir === "ascending" ? "newer" : "older",
    from: p.timestamp("start", rc.now),
    to: p.timestamp("end", rc.now),
    cursor: cursor && cursorTime ? { timestamp: cursorTime, logId: cursor[1] } : undefined,
    limit,
  });
  const next = rows[limit];
  const page = rows.slice(0, limit).filter((row) => !namespaces || namespaces.includes(row.namespace));
  return {
    items: page.map((row) => ({
      ...(props.has("ids") ? { logid: row.logId } : {}),
      ...(props.has("title") ? { ns: row.namespace, title: row.title, pageid: row.pageId, logpage: row.pageId } : {}),
      ...(props.has("details") ? { params: row.params } : {}),
      ...(props.has("type") ? { type: row.type, action: row.action } : {}),
      ...(props.has("user") ? { user: row.actor } : {}),
      ...(props.has("timestamp") ? { timestamp: mwTimestamp(row.timestamp) } : {}),
      ...(props.has("comment") ? { comment: row.comment ?? "" } : {}),
      ...(props.has("parsedcomment") ? { parsedcomment: escapeHtml(row.comment ?? "") } : {}),
      ...(props.has("tags") ? { tags: [] } : {}),
    })),
    next: next ? encodeCursor([next.timestamp.toISOString(), next.logId]) : null,
  };
}

export const logEvents: ListModule = {
  prefix: "le",
  resultKey: "logevents",
  generator: false,
  run: runLogEvents,
};
