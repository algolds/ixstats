/**
 * page-ops.ts — `action=move|delete|undelete|protect|rollback` (plan 410).
 *
 * Each action authorizes through the same functions as the tRPC page-admin router
 * (`authorizeMove`, `authorizeAction`, `authorizeProtection`) and writes through the same services
 * (`PageManagementService`, `RightsAdminService`, the edit service); this module reads parameters and
 * shapes MediaWiki's answer.
 */

import { ApiError, badValue, invalidTitle, missingParam } from "../errors";
import { mwTimestamp, type JsonObject } from "../format";
import type { ApiParams } from "../params";
import type { ApiContext } from "../types";
import { actorOf, beginWrite, namedPage, withPageCodes } from "./write-common";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { parseMWDateObject } from "~/lib/wiki-os/adapters/mediawiki/timestamp";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import type { RestrictionChange } from "~/lib/wiki-os/core/rights-admin-service";

// ---------------------------------------------------------------------------
// delete, undelete
// ---------------------------------------------------------------------------

export async function runDelete(rc: ApiContext): Promise<JsonObject> {
  beginWrite(rc);
  const p = rc.params.scope("", "delete");
  const { title } = await namedPage(rc, p, { title: "title", id: "pageid" });
  const reason = p.string("reason", "");
  await rc.deps.services.authorize(rc.session.ctx, "delete", title);
  // A page that is already deleted does not exist as far as MediaWiki's callers are concerned.
  await withPageCodes(rc.deps.services.archivePage(title, reason, actorOf(rc)), {
    NOT_FOUND: "missingtitle",
    CONFLICT: "missingtitle",
  });
  return { delete: { title, reason } };
}

export async function runUndelete(rc: ApiContext): Promise<JsonObject> {
  beginWrite(rc);
  const p = rc.params.scope("", "undelete");
  const raw = p.required("title");
  const canon = canonicalizeTitle(raw);
  if (!canon) throw invalidTitle(raw);
  const reason = p.string("reason", "");
  await rc.deps.services.authorize(rc.session.ctx, "undelete", canon.title);
  const revisions = await rc.deps.store.revisionCountOf(canon.title);
  await withPageCodes(rc.deps.services.restorePage(canon.title, reason, actorOf(rc)), {
    NOT_FOUND: "cantundelete",
    CONFLICT: "cantundelete",
  });
  return { undelete: { title: canon.title, revisions, fileversions: 0, reason } };
}

// ---------------------------------------------------------------------------
// move
// ---------------------------------------------------------------------------

export async function runMove(rc: ApiContext): Promise<JsonObject> {
  beginWrite(rc);
  const p = rc.params.scope("", "move");
  const from = await namedPage(rc, p, { title: "from", id: "fromid" });
  const rawTo = p.required("to");
  const to = canonicalizeTitle(rawTo);
  if (!to) throw invalidTitle(rawTo);
  const reason = p.string("reason", "");
  const leaveRedirect = !p.flag("noredirect");
  const moveTalk = p.flag("movetalk");
  if (p.flag("movesubpages")) p.addWarning("WikiOS does not move subpages; only the page itself moves.");

  const { services } = rc.deps;
  // Moving without a redirect is a right of its own (MediaWiki's suppressredirect).
  if (!leaveRedirect) await services.requireRight(rc.session.ctx, "suppressredirect");
  await services.authorizeMove(rc.session.ctx, from.title, to.title, { moveTalk, leaveRedirect });
  const { rights } = rc.session.permissions;
  const moved = await withPageCodes(
    services.movePage(from.title, to.title, reason, actorOf(rc), {
      leaveRedirect,
      moveTalk,
      includeArchived: rights.has("deletedhistory") && rights.has("undelete"),
    }),
    { NOT_FOUND: "missingtitle", CONFLICT: "articleexists", BAD_REQUEST: "selfmove" }
  );
  return {
    move: {
      from: from.title,
      to: to.title,
      reason,
      redirectcreated: moved.redirectArticleId !== null,
      ...(moved.talk ? { talkfrom: moved.talk.oldTitle, talkto: moved.talk.newTitle } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// protect
// ---------------------------------------------------------------------------

const PROTECTION_TYPES = ["edit", "move", "create", "upload"] as const;
type ProtectionType = (typeof PROTECTION_TYPES)[number];
const INFINITE_WORDS = new Set(["infinite", "indefinite", "infinity", "never", ""]);
const UNIT_MS: Readonly<Record<string, number>> = {
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000,
  year: 31_536_000_000,
};

/** An expiry as MediaWiki takes it: `infinite`, a timestamp, or a span such as `1 week`; null = never. */
function expiryOf(raw: string, now: Date): Date | null {
  if (INFINITE_WORDS.has(raw.toLowerCase())) return null;
  const span = /^(\d+)\s*(second|minute|hour|day|week|month|year)s?$/i.exec(raw.trim());
  const at = span
    ? new Date(now.getTime() + Number(span[1]) * UNIT_MS[span[2]!.toLowerCase()]!)
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$|^\d{14}$/.test(raw)
      ? parseMWDateObject(raw)
      : undefined;
  if (!at || Number.isNaN(at.getTime())) throw new ApiError("invalidexpiry", `Invalid expiry time "${raw}".`);
  if (at <= now) throw new ApiError("pastexpiry", `Expiry time "${raw}" is in the past.`);
  return at;
}

/** `edit=sysop|move=autoconfirmed`, with one expiry for all or one each. */
function protectionChanges(p: ApiParams, now: Date): RestrictionChange[] {
  const protections = p.list("protections");
  if (protections.length === 0) throw missingParam("protections");
  const expiries = p.has("expiry") ? p.list("expiry") : ["infinite"];
  if (expiries.length !== 1 && expiries.length !== protections.length) {
    throw new ApiError("toofewexpiries", `${expiries.length} expiry timestamps were provided where ${protections.length} were needed.`);
  }
  return protections.map((entry, index) => {
    const [type, level] = entry.split("=");
    if (!PROTECTION_TYPES.includes(type as ProtectionType) || level === undefined) {
      throw badValue("protections", entry);
    }
    if (level !== "all" && level !== "autoconfirmed" && level !== "sysop") {
      throw new ApiError("badvalue", `Unrecognized protection level: ${level}.`);
    }
    return {
      action: type as ProtectionType,
      level: level === "all" ? null : level,
      expiresAt: level === "all" ? null : expiryOf(expiries[expiries.length === 1 ? 0 : index]!, now),
    };
  });
}

export async function runProtect(rc: ApiContext): Promise<JsonObject> {
  beginWrite(rc);
  const p = rc.params.scope("", "protect");
  const { title } = await namedPage(rc, p, { title: "title", id: "pageid" });
  if (p.flag("cascade")) {
    throw new ApiError("cantcascade", "Cascading protection is not supported yet.");
  }
  const reason = p.string("reason", "");
  const changes = protectionChanges(p, rc.now);
  await rc.deps.services.authorizeProtection(
    rc.session.ctx,
    title,
    changes.map((change) => change.level)
  );
  await rc.deps.services.protectPage({ title, changes, reason, actor: actorOf(rc) });
  return {
    protect: {
      title,
      reason,
      protections: changes.map((change) => ({
        [change.action]: change.level ?? "",
        expiry: change.expiresAt ? mwTimestamp(change.expiresAt) : "infinity",
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// rollback
// ---------------------------------------------------------------------------

/** Revisions read when looking for the last edit by someone else. */
const ROLLBACK_WINDOW = 50;

export async function runRollback(rc: ApiContext): Promise<JsonObject> {
  beginWrite(rc, "rollback");
  const p = rc.params.scope("", "rollback");
  const { title, row } = await namedPage(rc, p, { title: "title", id: "pageid" });
  const user = normalizeWikiUsername(p.required("user"));
  if (!row) throw new ApiError("missingtitle", "The page you specified doesn't exist.");
  const { services, store } = rc.deps;
  await services.authorize(rc.session.ctx, "rollback", title);

  const history = await store.findRevisions({ articleId: row.articleId, dir: "older", limit: ROLLBACK_WINDOW, withContent: false });
  const head = history[0];
  if (!head || head.user !== user) {
    throw new ApiError("alreadyrolled", `The edit(s) by ${user} to ${title} were already rolled back or the page has changed.`);
  }
  const target = history.slice(0, ROLLBACK_WINDOW).find((rev) => rev.user !== user);
  if (!target) throw new ApiError("onlyauthor", "The page you tried to rollback has only one author.");

  const [source] = await store.revisionsById([target.revId], true);
  if (!source || source.content === null) {
    throw new ApiError("missingcontent", "The revision to roll back to has no text WikiOS can restore.");
  }
  const wikitext = await services.requireRestorableWikitext(rc.session.ctx, title, {
    wikitext: source.content,
    title: source.title,
  });
  const summary =
    p.string("summary") ?? `Reverted edits by ${user} to last revision by ${target.user ?? "an unknown user"}`;
  const { revisionRowId } = await services.saveWikitext(rc.session.ctx, { title, wikitext, summary, minor: false });
  const saved = await store.revisionByRowId(revisionRowId);
  return {
    rollback: {
      title,
      pageid: row.pageId,
      summary,
      revid: saved?.revId ?? 0,
      old_revid: head.revId,
      last_revid: target.revId,
    },
  };
}
