/**
 * inbound-log-events.ts — MediaWiki log events that change WikiOS state: deletes, moves, protections,
 * blocks and rights changes.
 *
 * A page edited in classic MediaWiki arrives through recent changes (inbound-revision-sync.ts); what
 * is done TO a page or a user (delete, move, protect, block, rights) only appears in the log. Each event
 * is applied once (its MediaWiki log id is kept in the `wiki_logs` row it writes), every applied event
 * writes that row, and anything WikiOS's own mirror account did is ignored: it is WikiOS's own act coming
 * back. Events that are WikiOS's to ignore (uploads, imports, new accounts, patrols) never reach a handler.
 *
 * A delete, restore or move goes through the conflict rule (conflict-rule.ts) against what WikiOS changed and MediaWiki
 * has not seen yet: the later change wins whatever its kind, the loser is recorded in the conflict log (whose settling
 * tells its author), and an event that loses is still applied, so its log row is written and it is never judged again.
 * Moves are applied in inbound-page-moves.ts; the rule's shared pieces are in inbound-event-rule.ts. Callers hold the
 * inbound-sync lock.
 */

import { z } from "zod";
import { ConflictError } from "~/lib/app-error";
import { db } from "~/server/db";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { repointArticleHead } from "../core/article-head";
import { canonicalizeTitle, type CanonicalTitle } from "../core/title";
import type { CollisionVerdict } from "./conflict-rule";
import { parkOverwritten } from "./conflict-log";
import {
  articleClassicHasAt,
  CLASSIC_DELETE_ACTIONS,
  classicEventApplied,
  contestingWikiosMove,
  judgeClassicDelete,
  moveChain,
  type HeldElsewhere,
  type WikiosMove,
} from "./conflict-page-ops";
import { unmirroredWikiosChanges } from "./conflict-sides";
import {
  IGNORED,
  judgeEvent,
  keepWikios,
  pageManagement,
  recordVerdict,
  SKIPPED,
  SOURCE,
  type Applied,
  type EventContext,
  type JudgedPage,
  type LogOutcome,
  type Tx,
} from "./inbound-event-rule";
import type { JsonValue, LogEvent } from "./inbound-mediawiki";
import { applyMove, archiveMoveRedirects } from "./inbound-page-moves";
import {
  claimedWikiUserId,
  evictCaches,
  isMirrorUser,
  syncLatestRevision,
} from "./inbound-revision-sync";
import { enqueueRender, invalidateTemplateDependents } from "./render-service";

export type { LogOutcome } from "./inbound-event-rule";

/** `wiki_logs.comment` and `wiki_restrictions.reason` are VarChar columns. */
const LOG_COMMENT_LIMIT = 1000;
const REASON_LIMIT = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Import the revision a restore brought back, counting at the restore's time. The cycle applies the restore, so a
 * collision is judged here: the revision never comes through the recent changes again.
 */
async function bringBackRestored(title: string, event: LogEvent): Promise<void> {
  await syncLatestRevision(title, {
    effectiveAt: new Date(event.timestamp),
    judgeCollisions: true,
  });
}

/**
 * The public log row of an applied event. Its `mwLogId` column (unique) is what stops the event from being
 * applied twice; a second writer that loses the race has found it already applied.
 */
async function writeLog(
  { event, canon, actorUserId }: EventContext,
  articleId: string | null
): Promise<void> {
  const at = new Date(event.timestamp);
  try {
    await db.wikiLog.create({
      data: {
        logType: event.type,
        action: event.action,
        title: canon?.title ?? event.title,
        actorName: event.user ?? "(hidden)",
        userId: actorUserId,
        comment: event.comment.slice(0, LOG_COMMENT_LIMIT) || null,
        params: event.params,
        mwLogId: event.logid,
        articleId,
        ...(Number.isNaN(at.getTime()) ? {} : { createdAt: at }),
      },
    });
  } catch (error) {
    // `db` turns the database's unique-constraint error into a ConflictError (see ~/lib/prisma-error), so that
    // is what a lost race for `mwLogId` looks like here, never a PrismaClientKnownRequestError.
    if (!(error instanceof ConflictError)) throw error;
  }
}

// ---------------------------------------------------------------------------
// delete: delete and restore
// ---------------------------------------------------------------------------

type StoredPage = {
  id: string;
  title: string;
  status: string;
  redirectTargetSlug: string | null;
} | null;

async function applyDelete(tx: Tx, { event, canon }: EventContext): Promise<Applied> {
  if (!canon) return SKIPPED;
  const restoring = event.action === "restore";
  if (!restoring && !CLASSIC_DELETE_ACTIONS.has(event.action)) return IGNORED;

  const article = await tx.wikiArticle.findUnique({
    where: { source_title: { source: SOURCE, title: canon.title } },
    select: { id: true, title: true, status: true, redirectTargetSlug: true },
  });
  return restoring
    ? applyRestore(tx, event, canon, article)
    : applyRemoval(tx, event, canon, article);
}

/** What follows a classic delete once committed; `elsewhere`: other titles the deleted page had in WikiOS. */
function afterRemoval(
  canon: CanonicalTitle,
  articleId: string | null,
  elsewhere: readonly string[] = []
): Applied {
  const titles = [...new Set([canon.title, ...elsewhere])];
  return {
    outcome: "applied",
    articleId,
    afterCommit: async () => {
      for (const title of titles) await evictCaches(title, articleId);
      // A deleted template or module: the pages that use it render without it.
      for (const title of titles) void invalidateTemplateDependents(title);
    },
  };
}

/**
 * The page goes, as a classic delete that won (or met nothing) leaves it: archived, and, after a collision, what the
 * delete overwrote is history only and recorded.
 */
async function archiveJudged(
  tx: Tx,
  page: JudgedPage,
  verdict: CollisionVerdict | null
): Promise<void> {
  await tx.wikiArticle.update({ where: { id: page.id }, data: { status: "ARCHIVED" } });
  if (!verdict) return;
  await parkOverwritten(tx, page.id, verdict);
  // the page's text is the newest revision left live, never a parked loser's (a restore renders from it)
  await repointArticleHead(tx, page.id);
  await recordVerdict(tx, page, verdict);
}

/**
 * A classic delete of a page WikiOS has under another title, its changes that put it there ones the deleter never saw: a
 * move away from the deleted title, or a move that beat classic's move to it. The delete is judged against the page (and
 * those changes), not against what WikiOS has at the title. A delete that wins removes the page wherever WikiOS put it,
 * and the redirects WikiOS's moves left with it.
 */
async function removePageElsewhere(
  tx: Tx,
  event: LogEvent,
  canon: CanonicalTitle,
  held: HeldElsewhere,
  first?: WikiosMove
): Promise<Applied> {
  const page = await tx.wikiArticle.findUnique({
    where: { id: held.articleId },
    select: { id: true, title: true, status: true },
  });
  if (!page || page.status === "ARCHIVED") return afterRemoval(canon, page?.id ?? null);
  const verdict = await judgeClassicDelete(page.id, event, held.changes);
  if (verdict && !verdict.incomingWins) return keepWikios(tx, page, verdict);
  await archiveJudged(tx, page, verdict);
  const since = held.changes[0]?.at ?? new Date(event.timestamp);
  const redirects = await archiveMoveRedirects(tx, page.id, since, first);
  return afterRemoval(canon, page.id, [page.title, ...redirects]);
}

/**
 * A classic delete. A page WikiOS has live is judged against its changes the deleter never saw: a later one keeps it
 * (the delete is recorded as overwritten); otherwise it is archived, and what it overwrote is recorded. A title WikiOS
 * moved the page away from, or one classic has a page at that WikiOS has elsewhere, is judged against that page
 * (`removePageElsewhere`).
 */
async function applyRemoval(
  tx: Tx,
  event: LogEvent,
  canon: CanonicalTitle,
  article: StoredPage
): Promise<Applied> {
  const move = await contestingWikiosMove(canon.title, event);
  // at the title: nothing, or the redirect WikiOS's move left there
  if (move && (!article || article.redirectTargetSlug === move.to)) {
    const held = { articleId: move.articleId, changes: await moveChain(move) };
    return removePageElsewhere(tx, event, canon, held, move);
  }
  const held = article ? null : await articleClassicHasAt(canon.title, event);
  if (held) return removePageElsewhere(tx, event, canon, held);
  if (!article || article.status === "ARCHIVED") return afterRemoval(canon, article?.id ?? null);
  const verdict = await judgeClassicDelete(article.id, event);
  if (verdict && !verdict.incomingWins) return keepWikios(tx, article, verdict);
  await archiveJudged(tx, article, verdict);
  return afterRemoval(canon, article.id);
}

/**
 * A classic restore. A page WikiOS deleted itself, the delete not yet in MediaWiki, is judged against that delete: a
 * later delete keeps it deleted (the restore is recorded as overwritten). A page that comes back has its latest revision
 * brought over, counting at the restore's time.
 */
async function applyRestore(
  tx: Tx,
  event: LogEvent,
  canon: CanonicalTitle,
  article: StoredPage
): Promise<Applied> {
  const deleted = article?.status === "ARCHIVED" ? article : null;
  if (deleted) {
    const unseen = await unmirroredWikiosChanges(deleted.id);
    const deletes = unseen.filter((change) => change.action === "delete");
    const verdict = await judgeEvent(event, "undelete", deleted.id, deletes);
    if (verdict && !verdict.incomingWins) return keepWikios(tx, deleted, verdict);
    // Its view was built for a page that was out of the link graph and the category lists: stale.
    await tx.wikiArticle.update({
      where: { id: deleted.id },
      data: { status: "PUBLISHED", htmlSyncedAt: null },
    });
    // a restored revision WikiOS already has is "known" and not imported again: render from the live head
    await repointArticleHead(tx, deleted.id);
    if (verdict) await recordVerdict(tx, deleted, verdict);
  }
  return {
    outcome: "applied",
    articleId: article?.id ?? null,
    afterCommit: async () => {
      if (deleted) enqueueRender(deleted.id, { background: true });
      // The page that came back has its latest revision from MediaWiki (a new page id, maybe new text).
      await bringBackRestored(canon.title, event);
      await evictCaches(canon.title, article?.id);
      // A restored template or module: the pages that use it render with it again.
      void invalidateTemplateDependents(canon.title);
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
        level:
          detail.data.level === "autoconfirmed" ? ("autoconfirmed" as const) : ("sysop" as const),
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
    console.warn(
      `[WikiAutoSync] Protect event ${event.logid} on "${canon.title}" names no restriction WikiOS can read.`
    );
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

const MAPPED_GROUPS: ReadonlySet<string> = new Set([
  "sysop",
  "bureaucrat",
  "interface-admin",
  "bot",
]);

const groupMetadataSchema = z.array(
  z.looseObject({ group: z.string(), expiry: z.string().nullish() })
);

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
      await tx.wikiUserGroup.create({
        data: { wikiUsername, group, expiresAt, source: "mw-import" },
      });
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
  if (await classicEventApplied(event.logid)) return "ignored";

  const context: EventContext = {
    event,
    canon: canonicalizeTitle(event.title),
    actorUserId: await claimedWikiUserId(event.user),
  };
  const applied = await db.$transaction((tx) => handler(tx, context));
  if (applied.outcome !== "applied") return applied.outcome;

  await applied.afterCommit?.();
  await writeLog(context, applied.articleId ?? null);
  return "applied";
}
