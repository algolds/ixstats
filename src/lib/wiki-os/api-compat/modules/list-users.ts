/**
 * list-users.ts — `list=allusers|blocks|protectedtitles` (plan 410).
 *
 * Users are the accounts with a verified wiki link; their groups are the explicit memberships
 * (`wiki_user_groups`), plus the implicit `*` and `user` that every listed account has.
 */

import { encodeCursor, optionalCursor, takePage } from "../continuation";
import { ApiError, badContinue } from "../errors";
import { mwTimestamp, type JsonObject } from "../format";
import type { ApiParams } from "../params";
import type { ApiContext } from "../types";
import { directionParam, namespacesParam } from "./list-common";
import type { ListModule, ListResult } from "./query-list";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { EXPLICIT_GROUPS, rightsForGroups, type Group } from "~/lib/wiki-os/rights";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------------------
// allusers
// ---------------------------------------------------------------------------

const AU_PROPS = ["blockinfo", "groups", "implicitgroups", "rights", "editcount", "registration"] as const;

async function runAllUsers(rc: ApiContext, p: ApiParams): Promise<ListResult> {
  const props = new Set(p.listOf("prop", AU_PROPS));
  const limit = p.limit("limit", { fallback: 10, high: rc.highLimits });
  const group = p.oneOf("group", EXPLICIT_GROUPS);
  const excludeGroup = p.oneOf("excludegroup", EXPLICIT_GROUPS);
  const from = p.string("continue") ?? p.string("from");
  const to = p.string("to");
  const prefix = p.string("prefix");

  const rows = await rc.deps.store.listUsers({
    start: from ? normalizeWikiUsername(from) : undefined,
    end: to ? normalizeWikiUsername(to) : undefined,
    prefix: prefix ? normalizeWikiUsername(prefix) : undefined,
    group,
    excludeGroup,
    dir: directionParam(p, ["ascending", "descending"], "ascending"),
    limit,
    withEditCount: props.has("editcount"),
  });
  const { page, more } = takePage(rows, limit);
  const next = more ? rows[limit] : undefined;
  return {
    items: page.map((user) => {
      const explicit = user.groups.filter((candidate): candidate is Group =>
        (EXPLICIT_GROUPS as readonly string[]).includes(candidate)
      );
      const item: JsonObject = { userid: user.userId, name: user.name };
      if (props.has("editcount")) item.editcount = user.editCount;
      if (props.has("registration")) item.registration = user.registration ? mwTimestamp(user.registration) : null;
      if (props.has("groups")) item.groups = ["*", "user", ...explicit];
      if (props.has("implicitgroups")) item.implicitgroups = ["*", "user"];
      if (props.has("rights")) item.rights = [...rightsForGroups(["*", "user", ...explicit])];
      return item;
    }),
    next: next ? next.name.replace(/ /g, "_") : null,
  };
}

export const allUsers: ListModule = { prefix: "au", resultKey: "allusers", generator: false, run: runAllUsers };

// ---------------------------------------------------------------------------
// blocks
// ---------------------------------------------------------------------------

const BK_PROPS = ["id", "user", "userid", "by", "byid", "timestamp", "expiry", "reason", "range", "flags"] as const;

async function runBlocks(rc: ApiContext, p: ApiParams): Promise<ListResult> {
  const props = new Set(p.listOf("prop", BK_PROPS, ["id", "user", "by", "timestamp", "expiry", "reason", "flags"]));
  const limit = p.limit("limit", { fallback: 10, high: rc.highLimits });
  // The log of blocks lists the newest first; WikiOS keeps no other order.
  p.oneOf("dir", ["older"], "older");
  const cursor = p.string("continue");
  if (cursor !== undefined && cursor !== "" && !/^[\w-]{8,64}$/.test(cursor)) throw badContinue();
  const { blocks, nextCursor } = await rc.deps.store.listBlocks(limit, cursor || undefined);
  return {
    items: blocks.map((block) => ({
      ...(props.has("user") ? { user: block.target } : {}),
      ...(props.has("by") ? { by: block.blockedBy ?? "" } : {}),
      ...(props.has("timestamp") ? { timestamp: mwTimestamp(block.createdAt) } : {}),
      ...(props.has("expiry") ? { expiry: block.expiresAt ? mwTimestamp(block.expiresAt) : "infinity" } : {}),
      ...(props.has("reason") ? { reason: block.reason ?? "" } : {}),
      ...(props.has("flags") ? { automatic: false, anononly: false, nocreate: false, autoblock: false, noemail: false, hidden: false, allowusertalk: block.allowUserTalk, partial: false } : {}),
    })),
    next: nextCursor,
  };
}

export const blocks: ListModule = { prefix: "bk", resultKey: "blocks", generator: false, run: runBlocks };

// ---------------------------------------------------------------------------
// protectedtitles
// ---------------------------------------------------------------------------

const PT_PROPS = ["timestamp", "user", "userid", "comment", "parsedcomment", "expiry", "level"] as const;

async function runProtectedTitles(rc: ApiContext, p: ApiParams): Promise<ListResult> {
  const props = new Set(p.listOf("prop", PT_PROPS, ["timestamp", "level"]));
  const limit = p.limit("limit", { fallback: 10, high: rc.highLimits });
  const dir = directionParam(p, ["newer", "older"], "older");
  const levels = p.list("level");
  const cursor = optionalCursor(p.raw("continue"), ["s", "s"] as const);
  const cursorTime = cursor ? new Date(cursor[0]) : undefined;
  if (cursorTime && Number.isNaN(cursorTime.getTime())) throw badContinue();
  if (levels.length > 1) throw new ApiError("badvalue", "WikiOS lists one protection level at a time.");

  const rows = await rc.deps.store.listProtectedTitles({
    namespaces: namespacesParam(p),
    level: levels[0],
    dir: dir === "ascending" ? "newer" : "older",
    from: p.timestamp("start", rc.now),
    to: p.timestamp("end", rc.now),
    cursor: cursor && cursorTime ? { timestamp: cursorTime, id: cursor[1] } : undefined,
    limit,
  });
  const { page, more } = takePage(rows, limit);
  const next = more ? rows[limit] : undefined;
  return {
    items: page.map((row) => ({
      ns: row.namespace,
      title: canonicalizeTitle(row.title)?.title ?? row.title,
      ...(props.has("timestamp") ? { timestamp: mwTimestamp(row.timestamp) } : {}),
      ...(props.has("user") ? { user: row.user ?? "" } : {}),
      ...(props.has("comment") ? { comment: row.comment ?? "" } : {}),
      ...(props.has("parsedcomment") ? { parsedcomment: escapeHtml(row.comment ?? "") } : {}),
      ...(props.has("expiry") ? { expiry: row.expiresAt ? mwTimestamp(row.expiresAt) : "infinity" } : {}),
      ...(props.has("level") ? { level: row.level } : {}),
    })),
    next: next ? encodeCursor([next.timestamp.toISOString(), next.id]) : null,
  };
}

export const protectedTitles: ListModule = {
  prefix: "pt",
  resultKey: "protectedtitles",
  generator: false,
  run: runProtectedTitles,
};
