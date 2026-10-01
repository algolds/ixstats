/**
 * prop-revisions.ts — `action=query&prop=revisions` (plan 410).
 *
 * The module bots read most. With a single page it answers the newest revision, or, when asked
 * (`rvlimit`, `rvstart`, `rvdir`, ...), a page of history; with several pages (or `revids`) each
 * page's newest revision (or exactly the revisions asked for). `rvslots` picks MediaWiki's slot
 * shape for the content. Revision text counts against the response's size budget: past 8 MB the
 * module stops and answers a continuation.
 */

import { encodeCursor, optionalCursor } from "../continuation";
import { ApiError, badContinue, badValues } from "../errors";
import { TRUNCATED_WARNING } from "../budget";
import { mwTimestamp, sha1Hex, type JsonObject } from "../format";
import type { PageEntry } from "../pages";
import type { RevisionBound, RevisionCursor, RevisionRow } from "../store-types";
import type { ApiContext } from "../types";
import { escapeHtml, existingEntries, fieldsOf, type PropContext } from "./prop-common";
import { contentModelFor } from "~/lib/wiki-os/xml/content-model";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";

/** Revisions read from the database (with their text) per round trip: the text of 50 revisions is never in memory at once. */
const CONTENT_BATCH = 10;
/** What a revision's fields (not its text) add to the response, for the size budget. */
const REVISION_OVERHEAD_BYTES = 400;

const REV_PROPS = [
  "ids",
  "flags",
  "timestamp",
  "user",
  "userid",
  "size",
  "slotsize",
  "sha1",
  "slotsha1",
  "contentmodel",
  "comment",
  "parsedcomment",
  "content",
  "tags",
  "roles",
] as const;
type RevProp = (typeof REV_PROPS)[number];
const DEFAULT_REV_PROPS: readonly RevProp[] = ["ids", "flags", "timestamp", "comment", "user"];

/**
 * Params that ask for a page's history rather than its newest revision. Without any of them a
 * single page answers its newest revision and no continuation (as MediaWiki does); with several
 * pages they are refused, except `continue`, which resumes a listing that was cut short.
 */
const HISTORY_PARAMS = ["limit", "startid", "endid", "start", "end", "user", "excludeuser", "dir", "continue"] as const;

const IP_NAME = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]+:[0-9a-f:]*)$/i;
const isAnonymousName = (name: string) => IP_NAME.test(name);

const LEGACY_SLOTS_WARNING =
  'Because "rvslots" was not specified, a legacy format has been used for the output. This has been deprecated, and in the future, the default will change so the "rvslots" parameter will always be used.';

interface RevisionOptions {
  props: ReadonlySet<RevProp>;
  slots: boolean;
  version: ApiContext["version"];
}

function slotJson(rev: RevisionRow, { props, version }: RevisionOptions): JsonObject | undefined {
  const wantsModel = props.has("contentmodel") || props.has("content");
  if (!wantsModel && !props.has("slotsize") && !props.has("slotsha1")) return undefined;
  const { model, format } = contentModelFor(rev.title);
  const slot: JsonObject = {};
  if (wantsModel) {
    slot.contentmodel = model;
    slot.contentformat = format;
  }
  if (props.has("slotsize")) slot.size = rev.size;
  if (props.has("slotsha1") && !rev.textHidden) slot.sha1 = sha1Hex(rev.sha1);
  if (props.has("content")) {
    if (rev.textHidden) slot.texthidden = true;
    else Object.assign(slot, version === 1 ? { "*": rev.content ?? "" } : { content: rev.content ?? "" });
  }
  return slot;
}

function revisionIds(rev: RevisionRow, props: ReadonlySet<RevProp>): JsonObject {
  const out: JsonObject = {};
  if (props.has("ids")) {
    out.revid = rev.revId;
    out.parentid = rev.parentId;
  }
  if (props.has("flags")) out.minor = rev.minor;
  if (props.has("timestamp")) out.timestamp = mwTimestamp(rev.timestamp);
  if (props.has("size")) out.size = rev.size;
  if (props.has("tags")) out.tags = [];
  return out;
}

/** The revision's author, honouring a revision deletion of the user name. */
function revisionAuthor(rev: RevisionRow, props: ReadonlySet<RevProp>): JsonObject {
  const out: JsonObject = {};
  if (props.has("user")) {
    if (rev.userHidden) out.userhidden = true;
    else {
      out.user = rev.user ?? "";
      if (rev.user && isAnonymousName(rev.user)) out.anon = true;
    }
  }
  if (props.has("userid") && !rev.userHidden) out.userid = rev.userId;
  return out;
}

/** The comment and the hash, honouring revision deletion of the comment and of the text. */
function revisionDescribed(rev: RevisionRow, props: ReadonlySet<RevProp>): JsonObject {
  const out: JsonObject = {};
  if (props.has("sha1")) {
    if (rev.textHidden) out.sha1hidden = true;
    else out.sha1 = sha1Hex(rev.sha1);
  }
  if (props.has("comment") || props.has("parsedcomment")) {
    if (rev.commentHidden) out.commenthidden = true;
    else {
      if (props.has("comment")) out.comment = rev.comment ?? "";
      if (props.has("parsedcomment")) out.parsedcomment = escapeHtml(rev.comment ?? "");
    }
  }
  return out;
}

/** The text as the revision itself carries it (no `rvslots`): MediaWiki's legacy shape. */
function legacyContent(rev: RevisionRow, { props, version }: RevisionOptions): JsonObject {
  const out: JsonObject = {};
  const { model, format } = contentModelFor(rev.title);
  if (props.has("contentmodel") || props.has("content")) out.contentmodel = model;
  if (props.has("content")) {
    out.contentformat = format;
    if (rev.textHidden) out.texthidden = true;
    else if (version === 1) out["*"] = rev.content ?? "";
    else out.content = rev.content ?? "";
  }
  return out;
}

export function revisionJson(rev: RevisionRow, options: RevisionOptions): JsonObject {
  const { props, slots } = options;
  const slot = slots ? slotJson(rev, options) : undefined;
  return {
    ...revisionIds(rev, props),
    ...revisionAuthor(rev, props),
    ...revisionDescribed(rev, props),
    ...(slots ? (slot ? { slots: { main: slot } } : {}) : legacyContent(rev, options)),
  };
}

function decodeRevisionCursor(raw: string | undefined): RevisionCursor | undefined {
  const parts = optionalCursor(raw, ["s", "n"] as const);
  if (!parts) return undefined;
  const timestamp = new Date(parts[0]);
  if (Number.isNaN(timestamp.getTime())) throw badContinue();
  return { timestamp, revId: parts[1] };
}

/** A start/end bound given as a timestamp or as a revision id (the id wins). */
async function revisionBound(
  rc: ApiContext,
  p: ApiContext["params"],
  which: "start" | "end"
): Promise<RevisionBound | undefined> {
  const id = p.optionalInteger(`${which}id`, 1);
  if (id !== undefined) {
    const [rev] = await rc.deps.store.revisionsById([id], false);
    if (!rev) throw new ApiError("nosuchrevid", `There is no revision with ID ${id}.`);
    return { timestamp: rev.timestamp, revId: rev.revId };
  }
  const timestamp = p.timestamp(which, rc.now);
  return timestamp ? { timestamp } : undefined;
}

/** The bytes a revision adds to the response. */
const revisionBytes = (rev: RevisionRow, withContent: boolean) =>
  REVISION_OVERHEAD_BYTES + (withContent && !rev.textHidden ? rev.size : 0);

export async function propRevisions(pc: PropContext): Promise<void> {
  const { rc, pageSet } = pc;
  const p = rc.params.scope("rv", "revisions");
  const props = new Set<RevProp>(p.listOf("prop", REV_PROPS, DEFAULT_REV_PROPS));
  const slotValues = p.has("slots") ? p.list("slots") : null;
  if (slotValues?.some((slot) => slot !== "main" && slot !== "*")) {
    throw badValues(p.fullName("slots"), slotValues.filter((slot) => slot !== "main" && slot !== "*"));
  }
  const slots = slotValues !== null;
  const withContent = props.has("content");
  if (withContent && !slots) p.addWarning(LEGACY_SLOTS_WARNING);
  const options: RevisionOptions = { props, slots, version: rc.version };

  const pages = existingEntries(pageSet);
  const byRevisionId = pages.some((entry) => entry.revisionIds.length > 0);
  const singlePage = pages.length === 1 && !byRevisionId;
  const history: string[] = HISTORY_PARAMS.filter((name) => p.has(name) && !(name === "dir" && p.raw("dir") !== "newer"));
  if (singlePage) {
    await singlePageRevisions(pc, pages[0]!, p, options, history.length > 0);
    return;
  }
  const refused = history.filter((name) => name !== "continue");
  if (refused.length > 0) {
    throw new ApiError(
      "multpages",
      `titles, pageids or a generator was used to supply multiple pages, but the parameters ${refused.map((n) => p.fullName(n)).join(", ")} can only be used on a single page.`
    );
  }
  await latestRevisions(pc, pages, byRevisionId, p, options);
}

/** One revision to answer: which page it is listed under, and its id. */
interface WantedRevision {
  entry: PageEntry;
  revId: number;
}

/** The revisions asked for, in the order they are answered: each page's newest, or exactly the `revids`. */
function wantedRevisions(pages: readonly PageEntry[], byRevisionId: boolean): WantedRevision[] {
  return pages.flatMap((entry) => {
    const ids = byRevisionId ? entry.revisionIds : entry.row?.headRevId ? [entry.row.headRevId] : [];
    return ids.map((revId) => ({ entry, revId }));
  });
}

/** Where a resumed request starts in `wanted`: at the revision `rvcontinue` names (`pageid|revid`). */
function resumeIndex(wanted: readonly WantedRevision[], raw: string | undefined): number {
  const cursor = optionalCursor(raw, ["n", "n"] as const);
  if (!cursor) return 0;
  const [pageId, revId] = cursor;
  const exact = wanted.findIndex((item) => item.entry.key === pageId && item.revId === revId);
  if (exact !== -1) return exact;
  const page = wanted.findIndex((item) => item.entry.key >= pageId);
  return page === -1 ? wanted.length : page;
}

/**
 * Several pages (or `revids`): each page's newest revision, or exactly the revisions asked for, within
 * the size budget. The budget is taken revision by revision (not page by page, as one page may be
 * asked for 50 revisions of 2 MB): the first revision of a request is always answered, and once
 * the budget is spent the rest is left to a continuation naming the revision it stops at.
 */
async function latestRevisions(
  pc: PropContext,
  pages: PageEntry[],
  byRevisionId: boolean,
  p: ApiContext["params"],
  options: RevisionOptions
): Promise<void> {
  const { rc, continuation } = pc;
  const withContent = options.props.has("content");
  const wanted = wantedRevisions(pages, byRevisionId);
  const first = resumeIndex(wanted, p.raw("continue"));
  // Every page this request answers shows its `revisions`, empty when it has none to show; a page
  // whose revisions were all answered before the continuation is left out.
  const done = new Set(wanted.slice(0, first).map((item) => item.entry));
  for (const item of wanted.slice(first)) done.delete(item.entry);
  for (const entry of pages) if (!done.has(entry)) fieldsOf(pc, entry).revisions = [];
  const step = withContent ? CONTENT_BATCH : Math.max(wanted.length - first, 1);

  for (let start = first; start < wanted.length; start += step) {
    const batch = wanted.slice(start, start + step);
    const found = new Map(
      (await rc.deps.store.revisionsById(batch.map((item) => item.revId), withContent)).map((rev) => [rev.revId, rev])
    );
    for (const { entry, revId } of batch) {
      const rev = found.get(revId);
      if (!rev || rev.pageId !== entry.key) continue;
      if (!rc.budget.tryAdd(revisionBytes(rev, withContent))) {
        p.addWarning(TRUNCATED_WARNING);
        continuation.addProp(p.fullName("continue"), encodeCursor([entry.key, revId]));
        return;
      }
      (fieldsOf(pc, entry).revisions as JsonObject[]).push(revisionJson(rev, options));
    }
  }
}

/** One page: its newest revision, or (when history is asked for) a page of its history within the size budget. */
async function singlePageRevisions(
  pc: PropContext,
  entry: PageEntry,
  p: ApiContext["params"],
  options: RevisionOptions,
  history: boolean
): Promise<void> {
  const { rc, continuation } = pc;
  const { store } = rc.deps;
  const withContent = options.props.has("content");
  // Revisions with their text are limited to 50 per request (500 with apihighlimits).
  const contentCap = rc.highLimits ? 500 : 50;
  const asked = p.limit("limit", { fallback: 1, high: rc.highLimits });
  const limit = withContent ? Math.min(contentCap, asked) : asked;
  const dir = p.oneOf("dir", ["older", "newer"], "older");
  const user = p.string("user");
  const excludeUser = p.string("excludeuser");
  const filter = {
    articleId: entry.row!.articleId,
    dir,
    from: await revisionBound(rc, p, "start"),
    to: await revisionBound(rc, p, "end"),
    users: user === undefined ? undefined : [normalizeWikiUsername(user)],
    excludeUser: excludeUser === undefined ? undefined : normalizeWikiUsername(excludeUser),
    withContent,
  };

  const listed: RevisionRow[] = [];
  let cursor = decodeRevisionCursor(p.raw("continue"));
  let next: RevisionRow | undefined;
  while (!next && listed.length < limit) {
    const size = withContent ? Math.min(CONTENT_BATCH, limit - listed.length) : limit - listed.length;
    const rows = await store.findRevisions({ ...filter, cursor, limit: size });
    for (const rev of rows.slice(0, size)) {
      if (!rc.budget.tryAdd(revisionBytes(rev, withContent))) {
        p.addWarning(TRUNCATED_WARNING);
        next = rev;
        break;
      }
      listed.push(rev);
    }
    const extra = rows[size];
    if (next || !extra) break;
    cursor = { timestamp: extra.timestamp, revId: extra.revId };
    if (listed.length >= limit) next = extra;
  }
  fieldsOf(pc, entry).revisions = listed.map((rev) => revisionJson(rev, options));
  // Without a history parameter MediaWiki answers the newest revision and nothing to continue.
  if (next && history) {
    continuation.addProp(p.fullName("continue"), encodeCursor([next.timestamp.toISOString(), next.revId]));
  }
}
