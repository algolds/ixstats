/**
 * inbound-log-events.ts — MediaWiki log events that change WikiOS state: deletes, moves, protections,
 * blocks and rights changes.
 *
 * A page edited in classic MediaWiki arrives through recent changes (inbound-revision-sync.ts); what
 * is done TO a page or a user (delete, move, protect, block, rights) only appears in the log. Each event
 * is applied once (its MediaWiki log id is kept in the `wiki_logs` row it writes), every applied event
 * writes that row, and anything WikiOS's own mirror account did is ignored: it is WikiOS's own act coming
 * back. Events that are WikiOS's to ignore (uploads, imports, new accounts, patrols) never reach a handler.
 * Callers hold the inbound-sync lock.
 */

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { canonicalizeTitle, type CanonicalTitle } from "../core/title";
import type { JsonValue, LogEvent } from "./inbound-mediawiki";
import {
  evictCaches,
  isMirrorUser,
  syncLatestRevision,
  verifiedWikiUserId,
} from "./inbound-revision-sync";
import { enqueueRender } from "./render-service";

const SOURCE = "ixwiki";
/** `wiki_logs.comment` and `wiki_restrictions.reason` are VarChar columns. */
const LOG_COMMENT_LIMIT = 1000;
const REASON_LIMIT = 500;

/** applied: acted on and logged; ignored: not ours to act on; skipped: could not be applied, and never will be. */
export type LogOutcome = "applied" | "ignored" | "skipped";

type Tx = Prisma.TransactionClient;

/** One log event with its page, and who did it. */
interface EventContext {
  event: LogEvent;
  /** The page (or `User:` page) the event is about, canonical; null when the title is not one. */
  canon: CanonicalTitle | null;
  /** The WikiOS user behind the acting MediaWiki account, when it has a verified link. */
  actorUserId: string | null;
}

/** What a handler decided: its outcome, and what to do once the transaction has committed. */
interface Applied {
  outcome: LogOutcome;
  /** The article the event is about (its log row points at it). */
  articleId?: string | null;
  afterCommit?: () => Promise<void>;
}

const IGNORED: Applied = { outcome: "ignored" };
const SKIPPED: Applied = { outcome: "skipped" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Loaded on demand: page-management-service reaches the article view cache, which imports this sync, so
 * a static import would be a cycle at load time.
 */
const pageManagement = () => import("../core/page-management-service");

const infinity = new Set(["infinity", "infinite", "indefinite", "never"]);

/** An expiry as MediaWiki reports it ("infinity" or a timestamp): null is "never expires". */
function parseExpiry(value: string | undefined): Date | null {
  if (value === undefined || infinity.has(value.toLowerCase())) return null;
  const date = new Date(value);
  // A value nobody can read stays as strict as can be: it never expires.
  return Number.isNaN(date.getTime()) ? null : date;
}

const stringList = z.array(z.string());

/** The strings of a JSON value that should be a list of strings; [] for anything else. */
function stringsOf(value: JsonValue | undefined): string[] {
  const parsed = stringList.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** A wiki username: the base of a `User:` title; null for any other page, and for an IP address. */
function usernameOf(canon: CanonicalTitle | null): string | null {
  if (!canon || canon.namespaceId !== 2) return null;
  const isIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d+)?$/.test(canon.base);
  const isIpv6 = /^[0-9a-f]*:[0-9a-f:]*(?:\/\d+)?$/i.test(canon.base);
  return isIpv4 || isIpv6 ? null : normalizeWikiUsername(canon.base);
}

async function alreadyApplied(logid: number): Promise<boolean> {
  const row = await db.wikiLog.findFirst({
    where: { params: { path: ["mwLogId"], equals: logid } },
    select: { id: true },
  });
  return row !== null;
}

/** Import what MediaWiki has at `title` (the redirect a move left, the page a restore brought back). */
async function bringOver(title: string): Promise<void> {
  await syncLatestRevision(title);
}

/** The public log row of an applied event; its `mwLogId` is what stops the event from being applied twice. */
async function writeLog(
  { event, canon, actorUserId }: EventContext,
  articleId: string | null
): Promise<void> {
  const at = new Date(event.timestamp);
  await db.wikiLog.create({
    data: {
      logType: event.type,
      action: event.action,
      title: canon?.title ?? event.title,
      actorName: event.user ?? "(hidden)",
      userId: actorUserId,
      comment: event.comment.slice(0, LOG_COMMENT_LIMIT) || null,
      params: { ...event.params, mwLogId: event.logid },
      articleId,
      ...(Number.isNaN(at.getTime()) ? {} : { createdAt: at }),
    },
  });
}

// ---------------------------------------------------------------------------
// delete: delete and restore
// ---------------------------------------------------------------------------

const DELETE_ACTIONS: ReadonlySet<string> = new Set(["delete", "delete_redir", "delete_redir2"]);

async function applyDelete(tx: Tx, { event, canon }: EventContext): Promise<Applied> {
  if (!canon) return SKIPPED;
  const restoring = event.action === "restore";
  if (!restoring && !DELETE_ACTIONS.has(event.action)) return IGNORED;

  const article = await tx.wikiArticle.findUnique({
    where: { source_title: { source: SOURCE, title: canon.title } },
    select: { id: true, status: true },
  });
  if (restoring) {
    if (article?.status === "ARCHIVED") {
      await tx.wikiArticle.update({ where: { id: article.id }, data: { status: "PUBLISHED" } });
    }
    return {
      outcome: "applied",
      articleId: article?.id ?? null,
      afterCommit: async () => {
        // The page that came back has its latest revision from MediaWiki (a new page id, maybe new text).
        await bringOver(canon.title);
        await evictCaches(canon.title, article?.id);
      },
    };
  }
  if (article && article.status !== "ARCHIVED") {
    await tx.wikiArticle.update({ where: { id: article.id }, data: { status: "ARCHIVED" } });
  }
  return {
    outcome: "applied",
    articleId: article?.id ?? null,
    afterCommit: () => evictCaches(canon.title, article?.id),
  };
}

// ---------------------------------------------------------------------------
// move: rename the article (its revisions, categories and watchers stay attached)
// ---------------------------------------------------------------------------

/** MediaWiki's `target_title` of a move; null when it is absent or not a title. */
function moveTarget(event: LogEvent): CanonicalTitle | null {
  const raw = event.params.target_title;
  return typeof raw === "string" ? canonicalizeTitle(raw) : null;
}

/** Whether MediaWiki left a redirect at the old title (`suppressredirect` is present when it did not). */
function leftRedirect(event: LogEvent): boolean {
  return !("suppressredirect" in event.params) || event.params.suppressredirect === false;
}

/**
 * Free `target` for the moved page when MediaWiki moved it over a redirect (the page that sat there
 * was deleted by the move). Anything else at the title is a real clash.
 */
async function clearRedirectAt(
  tx: Tx,
  clash: { id: string; redirectTargetSlug: string | null }
): Promise<boolean> {
  if (clash.redirectTargetSlug === null) return false;
  await tx.wikiArticle.delete({ where: { id: clash.id } });
  return true;
}

async function applyMove(tx: Tx, { event, canon }: EventContext): Promise<Applied> {
  if (event.action !== "move" && event.action !== "move_redir") return IGNORED;
  const target = moveTarget(event);
  if (!canon || !target) return SKIPPED;

  const moved = await tx.wikiArticle.findUnique({
    where: { source_title: { source: SOURCE, title: canon.title } },
    select: { id: true },
  });
  if (!moved) {
    // A page WikiOS never held, or one already at its new name (an earlier try renamed it, or WikiOS
    // moved it first): nothing to rename; the redirect MediaWiki left is still to be brought over.
    const renamed = await tx.wikiArticle.findUnique({
      where: { source_title: { source: SOURCE, title: target.title } },
      select: { id: true },
    });
    return {
      outcome: "applied",
      articleId: renamed?.id ?? null,
      afterCommit:
        renamed && leftRedirect(event) ? () => bringOver(canon.title) : undefined,
    };
  }

  const clash = await tx.wikiArticle.findUnique({
    where: { source_title: { source: SOURCE, title: target.title } },
    select: { id: true, redirectTargetSlug: true },
  });
  if (clash && !(await clearRedirectAt(tx, clash))) {
    console.warn(`[WikiAutoSync] Not renaming "${canon.title}": "${target.title}" exists in WikiOS.`);
    return SKIPPED;
  }

  const { legacyProtectionLevel, PageManagementService } = await pageManagement();
  const edit = await PageManagementService.moveRestrictions(tx, SOURCE, canon.title, target.title);
  await tx.wikiArticle.update({
    where: { id: moved.id },
    data: {
      title: target.title,
      slug: target.slug,
      namespace: target.namespaceId,
      namespacePrefix: target.namespacePrefix,
      protectionLevel: legacyProtectionLevel(edit?.level),
      protectionExpiry: edit?.expiresAt ?? null,
      // The page's name is part of how it renders ({{PAGENAME}}, the display title): stale.
      htmlSyncedAt: null,
    },
  });
  return {
    outcome: "applied",
    articleId: moved.id,
    afterCommit: async () => {
      enqueueRender(moved.id, { background: true });
      // MediaWiki left a redirect at the old title: that page is new to WikiOS.
      if (leftRedirect(event)) await bringOver(canon.title);
      await evictCaches(canon.title, moved.id);
      await evictCaches(target.title, moved.id);
    },
  };
}

// ---------------------------------------------------------------------------
// protect: restrictions per action
// ---------------------------------------------------------------------------

const RESTRICTION_ACTIONS = ["edit", "move", "create", "upload"] as const;

const protectDetailSchema = z.looseObject({
  type: z.string(),
  level: z.string(),
  expiry: z.string().optional(),
  cascade: z.boolean().optional(),
});

interface ParsedRestriction {
  action: (typeof RESTRICTION_ACTIONS)[number];
  level: "autoconfirmed" | "sysop";
  expiresAt: Date | null;
  cascade: boolean;
}

/**
 * The restrictions a protect event sets: `params.details` is a list of `{type, level, expiry, cascade}`.
 * An entry that is not that shape, or names an action WikiOS has no rule for, is dropped; a level WikiOS
 * does not know becomes `sysop` (as strict as it goes).
 */
function restrictionsOf(event: LogEvent): ParsedRestriction[] {
  const details = Array.isArray(event.params.details) ? event.params.details : [];
  const topCascade = event.params.cascade === true;
  return details.flatMap((entry) => {
    const detail = protectDetailSchema.safeParse(entry);
    if (!detail.success) return [];
    const action = RESTRICTION_ACTIONS.find((candidate) => candidate === detail.data.type);
    if (!action) return [];
    return [
      {
        action,
        level: detail.data.level === "autoconfirmed" ? ("autoconfirmed" as const) : ("sysop" as const),
        expiresAt: parseExpiry(detail.data.expiry),
        cascade: detail.data.cascade ?? topCascade,
      },
    ];
  });
}

async function applyProtect(tx: Tx, { event, canon }: EventContext): Promise<Applied> {
  const setting = event.action === "protect" || event.action === "modify";
  if (!canon || (!setting && event.action !== "unprotect")) return canon ? IGNORED : SKIPPED;

  const restrictions = setting ? restrictionsOf(event) : [];
  if (setting && restrictions.length === 0) {
    console.warn(`[WikiAutoSync] Protect event ${event.logid} on "${canon.title}" names no restriction WikiOS can read.`);
    return SKIPPED;
  }

  // The event states every restriction the page has now: the rest are gone.
  for (const action of RESTRICTION_ACTIONS) {
    const key = { source: SOURCE, title: canon.title, action };
    const set = restrictions.find((restriction) => restriction.action === action);
    if (!set) {
      await tx.wikiRestriction.deleteMany({ where: key });
      continue;
    }
    const data = {
      level: set.level,
      expiresAt: set.expiresAt,
      cascade: set.cascade,
      reason: event.comment.slice(0, REASON_LIMIT) || null,
    };
    await tx.wikiRestriction.upsert({
      where: { source_title_action: key },
      create: { ...key, ...data },
      update: data,
    });
  }

  const article = await tx.wikiArticle.findUnique({
    where: { source_title: { source: SOURCE, title: canon.title } },
    select: { id: true },
  });
  if (article) {
    const { legacyProtectionLevel } = await pageManagement();
    const edit = restrictions.find((restriction) => restriction.action === "edit");
    await tx.wikiArticle.update({
      where: { id: article.id },
      data: {
        protectionLevel: legacyProtectionLevel(edit?.level),
        protectionExpiry: edit?.expiresAt ?? null,
      },
    });
  }
  return { outcome: "applied", articleId: article?.id ?? null };
}

// ---------------------------------------------------------------------------
// block: sitewide blocks of a wiki account
// ---------------------------------------------------------------------------

/** A block's expiry: `params.expiry`, else what `params.duration` says about "forever". */
function blockExpiry(event: LogEvent): Date | null {
  const { expiry, duration } = event.params;
  if (typeof expiry === "string") return parseExpiry(expiry);
  return typeof duration === "string" ? parseExpiry(duration) : null;
}

async function applyBlock(tx: Tx, { event, canon }: EventContext): Promise<Applied> {
  const wikiUsername = usernameOf(canon);
  const known = ["block", "reblock", "unblock"].includes(event.action);
  if (!known || !wikiUsername) return IGNORED;

  const mine = { wikiUsername, source: "mw-import" };
  if (event.action === "unblock") {
    await tx.wikiBlock.deleteMany({ where: mine });
    return { outcome: "applied" };
  }
  // A partial block (some pages only) is not a block on the wiki: WikiOS has no counterpart.
  if (event.params.sitewide === false) return IGNORED;

  const data = {
    reason: event.comment.slice(0, REASON_LIMIT) || null,
    expiresAt: blockExpiry(event),
    allowUserTalk: !stringsOf(event.params.flags).includes("nousertalk"),
  };
  const existing = await tx.wikiBlock.findFirst({ where: mine, select: { id: true } });
  if (existing) await tx.wikiBlock.update({ where: { id: existing.id }, data });
  else await tx.wikiBlock.create({ data: { ...mine, ...data } });
  return { outcome: "applied" };
}

// ---------------------------------------------------------------------------
// rights: the groups WikiOS knows (sysop, bureaucrat, interface-admin, bot)
// ---------------------------------------------------------------------------

const MAPPED_GROUPS: ReadonlySet<string> = new Set(["sysop", "bureaucrat", "interface-admin", "bot"]);

const groupMetadataSchema = z.array(z.looseObject({ group: z.string(), expiry: z.string().nullish() }));

/** The groups of a rights change that WikiOS maps, and when each membership ends. */
function newMemberships(event: LogEvent): Array<{ group: string; expiresAt: Date | null }> {
  const metadata = groupMetadataSchema.safeParse(event.params.newmetadata);
  const expiries = new Map<string, Date | null>();
  for (const entry of metadata.success ? metadata.data : []) {
    expiries.set(entry.group, parseExpiry(entry.expiry ?? undefined));
  }
  return stringsOf(event.params.newgroups)
    .filter((group) => MAPPED_GROUPS.has(group))
    .map((group) => ({ group, expiresAt: expiries.get(group) ?? null }));
}

async function applyRights(tx: Tx, { event, canon }: EventContext): Promise<Applied> {
  const wikiUsername = usernameOf(canon);
  if (event.action !== "rights" || !wikiUsername) return IGNORED;

  const memberships = newMemberships(event);
  const kept = new Set(stringsOf(event.params.newgroups));
  for (const { group, expiresAt } of memberships) {
    const existing = await tx.wikiUserGroup.findUnique({
      where: { wikiUsername_group: { wikiUsername, group } },
      select: { id: true, source: true },
    });
    if (!existing) {
      await tx.wikiUserGroup.create({ data: { wikiUsername, group, expiresAt, source: "mw-import" } });
    } else if (existing.source === "mw-import") {
      await tx.wikiUserGroup.update({ where: { id: existing.id }, data: { expiresAt } });
    }
  }
  // Only memberships this sync granted are taken away: a group a WikiOS administrator gave stays.
  const removed = stringsOf(event.params.oldgroups).filter(
    (group) => MAPPED_GROUPS.has(group) && !kept.has(group)
  );
  if (removed.length > 0) {
    await tx.wikiUserGroup.deleteMany({
      where: { wikiUsername, group: { in: removed }, source: "mw-import" },
    });
  }
  return { outcome: "applied" };
}

// ---------------------------------------------------------------------------
// The entry point
// ---------------------------------------------------------------------------

const HANDLERS: Record<string, (tx: Tx, context: EventContext) => Promise<Applied>> = {
  delete: applyDelete,
  move: applyMove,
  protect: applyProtect,
  block: applyBlock,
  rights: applyRights,
};

/**
 * Apply one log event: its state change in one transaction, then what has to follow it (the redirect a
 * move left, the caches), then its log row. The state changes are idempotent and the row comes last, so
 * an event that fails midway is simply applied again. Rejects on a database or MediaWiki failure (the
 * cycle retries it); resolves `ignored` for what WikiOS does not mirror (and the mirror's own acts),
 * `skipped` for what cannot be applied.
 */
export async function applyLogEvent(event: LogEvent): Promise<LogOutcome> {
  const handler = HANDLERS[event.type];
  if (!handler || isMirrorUser(event.user)) return "ignored";
  if (await alreadyApplied(event.logid)) return "ignored";

  const context: EventContext = {
    event,
    canon: canonicalizeTitle(event.title),
    actorUserId: await verifiedWikiUserId(event.user),
  };
  const applied = await db.$transaction((tx) => handler(tx, context));
  if (applied.outcome !== "applied") return applied.outcome;

  await applied.afterCommit?.();
  await writeLog(context, applied.articleId ?? null);
  return "applied";
}
