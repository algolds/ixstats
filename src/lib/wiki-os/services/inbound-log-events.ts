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
 * Callers hold the inbound-sync lock.
 */

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ConflictError } from "~/lib/app-error";
import { db } from "~/server/db";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { repointArticleHead } from "../core/article-head";
import { toArticleSlug } from "../core/domain-types";
import { canonicalizeTitle, type CanonicalTitle } from "../core/title";
import {
  decideCollision,
  type ChangeAction,
  type CollisionVerdict,
  type PageChange,
} from "./conflict-rule";
import { recordConflict } from "./conflict-log";
import {
  classicChangeOfEvent,
  unmirroredWikiosChanges,
  unsentWikiosMove,
  type UnsentWikiosMove,
} from "./conflict-sides";
import type { JsonValue, LogEvent } from "./inbound-mediawiki";
import {
  claimedWikiUserId,
  evictCaches,
  isMirrorUser,
  syncLatestRevision,
} from "./inbound-revision-sync";
import { enqueueRender, invalidateTemplateDependents } from "./render-service";

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
  /** The account holding the approved claim of the acting MediaWiki name, if anyone. */
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
  const row = await db.wikiLog.findUnique({ where: { mwLogId: logid }, select: { id: true } });
  return row !== null;
}

/** Import what MediaWiki has at `title` (the redirect a move left). */
async function bringOver(title: string): Promise<void> {
  await syncLatestRevision(title);
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
// The conflict rule: a classic event against what MediaWiki has not seen of WikiOS's changes
// ---------------------------------------------------------------------------

/** A page as a verdict is recorded against it. */
interface JudgedPage {
  id: string;
  title: string;
}

/** The rule's verdict on the classic event against WikiOS's `standing` change, `standingBranch` its changes since. */
async function collide(
  event: LogEvent,
  action: ChangeAction,
  articleId: string,
  standing: PageChange,
  standingBranch: readonly PageChange[]
): Promise<CollisionVerdict> {
  const incoming = await classicChangeOfEvent(event, action);
  return decideCollision(SOURCE, articleId, {
    incoming,
    standing,
    incomingBranch: [incoming],
    standingBranch,
  });
}

/** The verdict against WikiOS's unseen changes (oldest first, the newest standing); null when there are none. */
async function judgeEvent(
  event: LogEvent,
  action: ChangeAction,
  articleId: string,
  unseen: readonly PageChange[]
): Promise<CollisionVerdict | null> {
  const standing = unseen.at(-1);
  return standing ? collide(event, action, articleId, standing, unseen) : null;
}

async function recordVerdict(tx: Tx, page: JudgedPage, verdict: CollisionVerdict): Promise<void> {
  await recordConflict(tx, {
    source: SOURCE,
    articleId: page.id,
    title: page.title,
    verdict,
    baseRef: null,
  });
}

/** The classic event lost: WikiOS keeps what it has, and the event counts as applied, recorded with its author overwritten. */
async function keepWikios(tx: Tx, page: JudgedPage, verdict: CollisionVerdict): Promise<Applied> {
  await recordVerdict(tx, page, verdict);
  return { outcome: "applied", articleId: page.id };
}

// ---------------------------------------------------------------------------
// delete: delete and restore
// ---------------------------------------------------------------------------

const DELETE_ACTIONS: ReadonlySet<string> = new Set(["delete", "delete_redir", "delete_redir2"]);

type StoredPage = { id: string; title: string; status: string } | null;

async function applyDelete(tx: Tx, { event, canon }: EventContext): Promise<Applied> {
  if (!canon) return SKIPPED;
  const restoring = event.action === "restore";
  if (!restoring && !DELETE_ACTIONS.has(event.action)) return IGNORED;

  const article = await tx.wikiArticle.findUnique({
    where: { source_title: { source: SOURCE, title: canon.title } },
    select: { id: true, title: true, status: true },
  });
  return restoring
    ? applyRestore(tx, event, canon, article)
    : applyRemoval(tx, event, canon, article);
}

/**
 * A delete that won: the WikiOS revisions it overwrote become history only, under its ref, so a page that comes back
 * has the text MediaWiki kept.
 */
async function parkOverwritten(
  tx: Tx,
  articleId: string,
  verdict: CollisionVerdict
): Promise<void> {
  const revisions = verdict.overwritten
    .filter((change) => change.side === "wikios" && change.action === "edit")
    .map((change) => change.ref);
  if (revisions.length === 0) return;
  await tx.wikiRevision.updateMany({
    where: { articleId, id: { in: revisions }, parked: false },
    data: { parked: true, parkReason: `overwritten:${verdict.winner.ref}` },
  });
}

function afterRemoval(canon: CanonicalTitle, articleId: string | null): Applied {
  return {
    outcome: "applied",
    articleId,
    afterCommit: async () => {
      await evictCaches(canon.title, articleId);
      // A deleted template or module: the pages that use it render without it.
      void invalidateTemplateDependents(canon.title);
    },
  };
}

/**
 * A classic delete. A page WikiOS has live is judged against its changes MediaWiki has not seen: a later one keeps it
 * (the delete is recorded as overwritten); otherwise it is archived, and what it overwrote is recorded.
 */
async function applyRemoval(
  tx: Tx,
  event: LogEvent,
  canon: CanonicalTitle,
  article: StoredPage
): Promise<Applied> {
  if (!article || article.status === "ARCHIVED") return afterRemoval(canon, article?.id ?? null);
  const verdict = await judgeEvent(
    event,
    "delete",
    article.id,
    await unmirroredWikiosChanges(article.id)
  );
  if (verdict && !verdict.incomingWins) return keepWikios(tx, article, verdict);

  await tx.wikiArticle.update({ where: { id: article.id }, data: { status: "ARCHIVED" } });
  if (verdict) {
    await parkOverwritten(tx, article.id, verdict);
    // the page's text is the newest revision left live, never a parked loser's (a restore renders from it)
    await repointArticleHead(tx, article.id);
    await recordVerdict(tx, article, verdict);
  }
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
 * Free `target` for the moved page: the page that sits there is deleted in MediaWiki (a title swap, the
 * move over a redirect), so WikiOS archives it and renames it out of the way, keeping its revisions and
 * watchers (nothing is deleted); it stays ARCHIVED under an internal title naming the log event. A page
 * that is neither deleted nor a redirect is a real clash, and false.
 */
async function archiveOutOfTheWay(
  tx: Tx,
  clash: { id: string; status: string; redirectTargetSlug: string | null },
  target: CanonicalTitle,
  logid: number
): Promise<boolean> {
  if (clash.status !== "ARCHIVED" && clash.redirectTargetSlug === null) return false;
  const title = `${target.title} (deleted ${logid})`;
  await tx.wikiArticle.update({
    where: { id: clash.id },
    data: { title, slug: toArticleSlug(title), status: "ARCHIVED", htmlSyncedAt: null },
  });
  return true;
}

/**
 * Rename `page` to `target`, its protections with it, after freeing the title (`archiveOutOfTheWay`). Returns the page
 * that was moved out of the way, if any; null when a page WikiOS has holds the title (nothing is renamed).
 */
async function renameTo(
  tx: Tx,
  page: JudgedPage,
  target: CanonicalTitle,
  logid: number
): Promise<{ clash: { id: string } | null } | null> {
  const clash = await tx.wikiArticle.findUnique({
    where: { source_title: { source: SOURCE, title: target.title } },
    select: { id: true, status: true, redirectTargetSlug: true },
  });
  if (clash && !(await archiveOutOfTheWay(tx, clash, target, logid))) {
    console.warn(
      `[WikiAutoSync] Not renaming "${page.title}": "${target.title}" exists in WikiOS.`
    );
    return null;
  }

  const { legacyProtectionLevel, PageManagementService } = await pageManagement();
  const edit = await PageManagementService.moveRestrictions(tx, SOURCE, page.title, target.title);
  await tx.wikiArticle.update({
    where: { id: page.id },
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
  return { clash };
}

/**
 * A page renamed from the event's title `from` to `target`: what follows once the move is committed. `elsewhere`: the
 * title WikiOS had moved it to, when a classic move won over WikiOS's.
 */
function renamed(
  event: LogEvent,
  movedId: string,
  from: string,
  target: CanonicalTitle,
  clash: { id: string } | null,
  elsewhere: string | null = null
): Applied {
  const oldTitles = elsewhere ? [from, elsewhere] : [from];
  return {
    outcome: "applied",
    articleId: movedId,
    afterCommit: async () => {
      enqueueRender(movedId, { background: true });
      // MediaWiki left a redirect at the old title: that page is new to WikiOS.
      if (leftRedirect(event)) await bringOver(from);
      for (const title of oldTitles) await evictCaches(title, movedId);
      await evictCaches(target.title, movedId);
      if (clash) await evictCaches(target.title, clash.id);
      // A moved template or module: its users render with the new name, or find the old one a redirect.
      for (const title of oldTitles) void invalidateTemplateDependents(title);
      void invalidateTemplateDependents(target.title);
    },
  };
}

/**
 * A classic move of a page WikiOS moved elsewhere, its move not yet in MediaWiki: the later move wins. A classic move
 * that wins renames the page from where WikiOS put it, and the redirect WikiOS left at the old title (pointing at a name
 * the page no longer has) goes, so MediaWiki's redirect is brought over in its place; one that loses leaves the page
 * where WikiOS has it.
 */
async function applyContestedMove(
  tx: Tx,
  event: LogEvent,
  canon: CanonicalTitle,
  target: CanonicalTitle,
  wikios: UnsentWikiosMove
): Promise<Applied> {
  const page = await tx.wikiArticle.findUnique({
    where: { id: wikios.articleId },
    select: { id: true, title: true },
  });
  if (!page) return SKIPPED;
  const verdict = await collide(event, "move", page.id, wikios.change, [wikios.change]);
  if (!verdict.incomingWins) return keepWikios(tx, page, verdict);

  // an event applied again finds the page already at its new name
  const moved =
    page.title === target.title ? { clash: null } : await renameTo(tx, page, target, event.logid);
  if (!moved) return SKIPPED;
  await tx.wikiArticle.updateMany({
    where: {
      source: SOURCE,
      title: canon.title,
      redirectTargetSlug: wikios.to,
      status: { not: "ARCHIVED" },
    },
    data: { status: "ARCHIVED", htmlSyncedAt: null },
  });
  await recordVerdict(tx, { id: page.id, title: target.title }, verdict);
  return renamed(event, page.id, canon.title, target, moved.clash, wikios.to);
}

async function applyMove(tx: Tx, { event, canon }: EventContext): Promise<Applied> {
  if (event.action !== "move" && event.action !== "move_redir") return IGNORED;
  // A `File:` page that moves in MediaWiki is renamed here like any page, but its `wiki_assets` row (name, hash key,
  // slug, URL) is NOT re-keyed in v1: the asset keeps its old name until it is registered again under the new one.
  // (WikiOS refuses to move files itself; both are post-v1, see the follow-ups, F37.)
  const target = moveTarget(event);
  if (!canon || !target) return SKIPPED;

  const wikios = await unsentWikiosMove(canon.title);
  if (wikios?.to === target.title) {
    // WikiOS moved the page to the same title: both wikis agree, and there is nothing to rename
    return {
      outcome: "applied",
      articleId: wikios.articleId,
      afterCommit: leftRedirect(event) ? () => bringOver(canon.title) : undefined,
    };
  }
  if (wikios) return applyContestedMove(tx, event, canon, target, wikios);

  const moved = await tx.wikiArticle.findUnique({
    where: { source_title: { source: SOURCE, title: canon.title } },
    select: { id: true },
  });
  if (!moved) {
    // A page WikiOS never held, or one already at its new name (an earlier try renamed it): nothing to rename; the
    // redirect MediaWiki left is still to be brought over.
    const already = await tx.wikiArticle.findUnique({
      where: { source_title: { source: SOURCE, title: target.title } },
      select: { id: true },
    });
    return {
      outcome: "applied",
      articleId: already?.id ?? null,
      afterCommit: already && leftRedirect(event) ? () => bringOver(canon.title) : undefined,
    };
  }

  const result = await renameTo(tx, { id: moved.id, title: canon.title }, target, event.logid);
  if (!result) return SKIPPED;
  return renamed(event, moved.id, canon.title, target, result.clash);
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
  if (await alreadyApplied(event.logid)) return "ignored";

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
