/**
 * Settling the conflict log: every author a collision overwrote is told, once per channel, and a collision classic
 * MediaWiki won gets its trail. The channels (conflict-rule.ts decides who gets which):
 *   - in-app: a WikiOS notification with the diff of the winner against their text;
 *   - discord: the same as a Discord DM, when the account has Discord linked;
 *   - talk-page: a section on their classic user talk page.
 * The talk note and the trail are written in WikiOS and mirrored out like any edit; nothing here writes to MediaWiki.
 * The talk page is brought over from classic first, so the note is appended to its text, never to a page WikiOS lacks.
 *
 * Every delivery is marked in the row (`markNotified`), so a channel that failed is tried again by the next run and a
 * delivered one never twice. The caller holds the inbound-sync lock (auto-sync-service.ts).
 */
import { db } from "~/server/db";
import { notificationAPI } from "~/lib/notifications/api";
import { sendDiscordDm } from "~/lib/discord/user-dm";
import { APP_URL, CLEAN_BASE_PATH } from "~/lib/discord/site-url";
import { ArticleRepository } from "../core/article-repository";
import { toRevisionRef } from "../core/domain-types";
import { EditConflictError } from "../core/edit-conflict-error";
import { canonicalizeTitle } from "../core/title";
import {
  trailSummary,
  type CollisionVerdict,
  type NoticeChannel,
  type NoticeRecipient,
} from "./conflict-rule";
import {
  markNotified,
  pendingRecipients,
  toConflictEntry,
  type ConflictLogEntry,
  type ConflictRow,
} from "./conflict-log";
import { CONFLICT_NOTICE_AUTHOR, talkPageTitle, wikiName } from "./conflict-sides";
import { syncLatestRevision } from "./inbound-revision-sync";

const SOURCE = "ixwiki";
/** Rows read per query while looking for rows with work left. */
const SCAN_BATCH = 200;
/** A DM that fails is tried again by later runs for this long after the collision, then given up (in-app stands). */
const DM_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** A link to a page of these namespaces needs a leading colon, or it files the talk page in a category or shows a file. */
const COLON_NAMESPACES = new Set([6, 14]);
const CLASSIC_REVISION = /^\d+$/;

/** sent: delivered; skipped: nothing to deliver on this channel (settled all the same); open: try again next run. */
type Delivery = "sent" | "skipped" | "open";

export interface SettleResult {
  /** Notices delivered by this run. */
  notified: number;
  /** Trail revisions written by this run. */
  trails: number;
  /** Rows with work left after this run (failed, or beyond `limit`). */
  pending: number;
}

/** What every notice of one conflict says. */
interface NoticeContext {
  entry: ConflictLogEntry;
  /** The wiki the winner was saved on. */
  wiki: string;
  urlPath: string;
  pageLink: string;
}

function contextOf(row: ConflictRow): NoticeContext {
  const entry = toConflictEntry(row);
  const canon = canonicalizeTitle(entry.title, { source: entry.source });
  const colon = canon && COLON_NAMESPACES.has(canon.namespaceId) ? ":" : "";
  return {
    entry,
    wiki: wikiName(entry.winner.side),
    urlPath: canon?.urlPath ?? entry.title.replace(/ /g, "_"),
    pageLink: `[[${colon}${entry.title}]]`,
  };
}

/** A collision classic won whose trail is not written yet. Only an edit's winner (a revision) can carry one. */
function needsTrail(row: ConflictRow): boolean {
  return (
    !row.legacyPark &&
    row.winnerSide === "classic" &&
    row.trailRevisionId === null &&
    row.articleId !== null &&
    CLASSIC_REVISION.test(row.winnerRef)
  );
}

function hasWork(row: ConflictRow): boolean {
  return needsTrail(row) || pendingRecipients(row).length > 0;
}

/** Every row with someone left to tell or a trail left to write, oldest first. */
async function rowsWithWork(): Promise<ConflictRow[]> {
  const found: ConflictRow[] = [];
  let cursor: string | null = null;
  let batch: ConflictRow[];
  do {
    batch = await db.wikiConflict.findMany({
      where: { legacyPark: false },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: SCAN_BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    found.push(...batch.filter(hasWork));
    cursor = batch.at(-1)?.id ?? null;
  } while (batch.length === SCAN_BATCH);
  return found;
}

// --- the notices ----------------------------------------------------------------------------------------------------

function noticeMessage({ entry, wiki }: NoticeContext): string {
  return `Your edit to "${entry.title}" was replaced by a later edit on ${wiki}. Your text is kept in the page history.`;
}

/** WikiOS's diff of the winner against the recipient's newest overwritten change. */
function diffHref({ entry, urlPath }: NoticeContext, recipient: NoticeRecipient): string {
  const oldid = recipient.refs.at(-1) ?? entry.winner.ref;
  const query = [
    `diff=${encodeURIComponent(entry.winner.ref)}`,
    `oldid=${encodeURIComponent(oldid)}`,
    `conflict=${encodeURIComponent(entry.id)}`,
  ].join("&");
  return `/wiki/${urlPath}?${query}`;
}

async function tellInApp(context: NoticeContext, recipient: NoticeRecipient): Promise<Delivery> {
  if (!recipient.userId) return "skipped";
  await notificationAPI.create({
    userId: recipient.userId,
    title: "Your edit was overwritten",
    message: noticeMessage(context),
    href: diffHref(context, recipient),
    category: "wiki",
    type: "warning",
    source: "wikiConflict",
  });
  return "sent";
}

async function tellOnDiscord(
  context: NoticeContext,
  recipient: NoticeRecipient
): Promise<Delivery> {
  const user = recipient.userId
    ? await db.user.findUnique({
        where: { id: recipient.userId },
        select: { discordUserId: true },
      })
    : null;
  if (!user?.discordUserId) return "skipped";
  const link = `${APP_URL}${CLEAN_BASE_PATH}${diffHref(context, recipient)}`;
  if (await sendDiscordDm(user.discordUserId, `${noticeMessage(context)}\n${link}`)) return "sent";
  const age = Date.now() - context.entry.createdAt.getTime();
  return age > DM_RETRY_WINDOW_MS ? "skipped" : "open";
}

/** A ref of the winner MediaWiki knows: a classic revision id as it is, a WikiOS revision's once mirrored. */
async function classicRefOf(ref: string): Promise<string | null> {
  if (CLASSIC_REVISION.test(ref)) return ref;
  const revision = await db.wikiRevision.findUnique({
    where: { id: ref },
    select: { mwRevId: true },
  });
  return revision?.mwRevId ? String(revision.mwRevId) : null;
}

/** The note: a link to each of the recipient's revisions, and the diff when MediaWiki knows the winner. */
async function talkSection(context: NoticeContext, recipient: NoticeRecipient): Promise<string> {
  const revisions = recipient.refs.filter((ref) => CLASSIC_REVISION.test(ref));
  const links = revisions.map((ref) => `[[Special:PermanentLink/${ref}|revision ${ref}]]`);
  const winner = await classicRefOf(context.entry.winner.ref);
  const newest = revisions.at(-1);
  if (winner && newest) links.push(`[[Special:Diff/${newest}/${winner}|diff]]`);
  const which = links.length > 0 ? ` (${links.join(", ")})` : "";
  return [
    `== Your edit to ${context.pageLink} was replaced ==`,
    `A later edit on ${context.wiki} replaced your edit${which}. ` +
      "Your text is still in the page history; edit the page again to bring it back.",
  ].join("\n");
}

/** The talk page as WikiOS has it: its text and the head a save must still find (null: no revision yet). */
async function readTalkPage(title: string): Promise<{ wikitext: string; headRef: string | null }> {
  const page = await db.wikiArticle.findUnique({
    where: { source_title: { source: SOURCE, title } },
    select: { id: true, wikitext: true },
  });
  if (!page) return { wikitext: "", headRef: null };
  const head = await db.wikiRevision.findFirst({
    where: { articleId: page.id, parked: false },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, mwRevId: true },
  });
  return { wikitext: page.wikitext, headRef: head ? toRevisionRef(head) : null };
}

function appendSection(text: string, section: string): string {
  return text.trim() ? `${text.trimEnd()}\n\n${section}` : section;
}

async function writeTalkNote(
  context: NoticeContext,
  recipient: NoticeRecipient
): Promise<Delivery> {
  const canon = canonicalizeTitle(talkPageTitle(recipient) ?? "", { source: SOURCE });
  if (!canon) return "skipped";
  // Classic's talk page first: a revision WikiOS cannot fit on its head yet is the cycle's, and the note waits for it.
  if ((await syncLatestRevision(canon.title)) === "deferred") return "open";
  const page = await readTalkPage(canon.title);
  await ArticleRepository.saveArticle(
    {
      slug: canon.slug,
      title: canon.title,
      source: SOURCE,
      wikitext: appendSection(page.wikitext, await talkSection(context, recipient)),
      editSummary: `Your edit to ${context.entry.title} was replaced`,
      expectedHeadRef: page.headRef,
    },
    undefined,
    CONFLICT_NOTICE_AUTHOR
  );
  return "sent";
}

const CHANNELS: Record<
  NoticeChannel,
  (context: NoticeContext, recipient: NoticeRecipient) => Promise<Delivery>
> = {
  "in-app": tellInApp,
  discord: tellOnDiscord,
  "talk-page": writeTalkNote,
};

/** One attempt; a failure (a talk page saved meanwhile included) is left for the next run. */
async function attempt(what: string, context: NoticeContext, work: () => Promise<Delivery>) {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof EditConflictError)) {
      console.warn(
        `[WikiConflicts] The ${what} of conflict ${context.entry.id} failed; the next run tries again:`,
        error
      );
    }
    return "open";
  }
}

// --- the trail ------------------------------------------------------------------------------------------------------

const NO_AUTHOR = { userId: null, classicName: null, ip: null, label: null };

function verdictOf(entry: ConflictLogEntry): CollisionVerdict {
  return {
    winner: { ...entry.winner, author: NO_AUTHOR },
    overwritten: entry.overwritten,
    incomingWins: true,
    key: entry.key,
  };
}

/**
 * The dummy edit that names the overwrite, once the classic winner is in WikiOS's history: before that, WikiOS's head
 * is older than the winner, and copying it would put the old text back on classic.
 */
async function writeTrail({ entry }: NoticeContext): Promise<Delivery> {
  if (!entry.articleId) return "skipped";
  const landed = await db.wikiRevision.count({
    where: { articleId: entry.articleId, mwRevId: Number(entry.winner.ref), parked: false },
  });
  if (landed === 0) return "open";
  const trail = await ArticleRepository.recordTrailRevision({
    articleId: entry.articleId,
    summary: trailSummary(verdictOf(entry), entry.id),
    conflictId: entry.id,
  });
  return trail ? "sent" : "skipped";
}

// --- settling -------------------------------------------------------------------------------------------------------

async function settleRow(
  row: ConflictRow
): Promise<{ notified: number; trails: number; settled: boolean }> {
  const context = contextOf(row);
  let notified = 0;
  let open = false;
  for (const recipient of pendingRecipients(row)) {
    for (const channel of recipient.channels) {
      const delivery = await attempt(`${channel} notice`, context, () =>
        CHANNELS[channel](context, recipient)
      );
      if (delivery === "open") {
        open = true;
        continue;
      }
      await markNotified(row.id, recipient.key, channel);
      if (delivery === "sent") notified += 1;
    }
  }
  const trail = needsTrail(row)
    ? await attempt("trail", context, () => writeTrail(context))
    : "skipped";
  return { notified, trails: trail === "sent" ? 1 : 0, settled: !open && trail !== "open" };
}

/**
 * Tells everyone the conflict log still owes a notice and writes the trails classic winners still lack, for at most
 * `limit` rows, oldest first. The caller holds the inbound-sync lock.
 */
export async function settleConflicts(limit = 50): Promise<SettleResult> {
  const rows = await rowsWithWork();
  const result: SettleResult = {
    notified: 0,
    trails: 0,
    pending: Math.max(0, rows.length - limit),
  };
  for (const row of rows.slice(0, limit)) {
    const settled = await settleRow(row);
    result.notified += settled.notified;
    result.trails += settled.trails;
    if (!settled.settled) result.pending += 1;
  }
  return result;
}
