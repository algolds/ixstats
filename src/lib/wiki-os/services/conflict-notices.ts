/**
 * Settling the conflict log: every author a collision overwrote is told, once per channel, and a collision classic
 * MediaWiki won gets its trail (a delete, which leaves no page, gets none). The channels (conflict-rule.ts decides who
 * gets which):
 *   - in-app: a WikiOS notification with the diff of the winner against their text (the page's log or history when the
 *     winner was a delete, move or undelete);
 *   - discord: the same as a Discord DM, when the account has Discord linked;
 *   - talk-page: a section on their classic user talk page.
 * The talk note and the trail are written in WikiOS and mirrored out like any edit; nothing here writes to MediaWiki.
 * The talk page is brought over from classic first, so the note is appended to its text, never to a page WikiOS lacks.
 *
 * Every delivery is marked in the row (`markNotified`), so a channel that failed is tried again by the next run and a
 * delivered one never twice. A row with nobody left to tell and its trail written (or given up) is settled
 * (`settledAt`) and not read again until a merge adds a loser. The caller holds the inbound-sync lock
 * (auto-sync-service.ts).
 */
import { db } from "~/server/db";
import { notificationAPI } from "~/lib/notifications/api";
import { sendDiscordDm } from "~/lib/discord/user-dm";
import { APP_URL, CLEAN_BASE_PATH } from "~/lib/discord/site-url";
import { ArticleRepository } from "../core/article-repository";
import { toRevisionRef } from "../core/domain-types";
import { DeletedPageError, EditConflictError } from "../core/edit-conflict-error";
import { canonicalizeTitle } from "../core/title";
import { trailSummary, type NoticeChannel, type NoticeRecipient } from "./conflict-rule";
import {
  markNotified,
  markSettled,
  pendingRecipients,
  toConflictEntry,
  verdictOfEntry,
  type ConflictLogEntry,
  type ConflictRow,
} from "./conflict-log";
import { lossOf, noticeCopy } from "./conflict-notice-copy";
import {
  CONFLICT_NOTICE_AUTHOR,
  shownRefs,
  talkPageTitle,
  verdictAsShown,
  wikiName,
} from "./conflict-sides";
import { syncLatestRevision } from "./inbound-revision-sync";

const SOURCE = "ixwiki";
const DAY_MS = 24 * 60 * 60 * 1000;
/** A DM that fails is tried again by later runs for this long after the collision, then given up (in-app stands). */
const DM_RETRY_WINDOW_MS = DAY_MS;
/**
 * A trail that cannot be written (its winner not in WikiOS yet, an error) is tried again for this long after the row's
 * first settle attempt, then given up: a sync that was down meanwhile does not eat the window.
 */
const TRAIL_RETRY_WINDOW_MS = DAY_MS;
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
  /** Rows not settled after this run (work left, or beyond `limit`). */
  pending: number;
}

/** What every notice of one conflict says. */
interface NoticeContext {
  entry: ConflictLogEntry;
  /** When the settling first tried this row. */
  firstAttemptAt: Date;
  /** The wiki the winner was saved on. */
  wiki: string;
  urlPath: string;
  pageLink: string;
}

function contextOf(row: ConflictRow, firstAttemptAt: Date): NoticeContext {
  const entry = toConflictEntry(row);
  const canon = canonicalizeTitle(entry.title, { source: entry.source });
  const colon = canon && COLON_NAMESPACES.has(canon.namespaceId) ? ":" : "";
  return {
    entry,
    firstAttemptAt,
    wiki: wikiName(entry.winner.side),
    urlPath: canon?.urlPath ?? entry.title.replace(/ /g, "_"),
    pageLink: `[[${colon}${entry.title}]]`,
  };
}

/** The classic winners that leave a page behind to carry a trail: an edit, a move, an undelete (never a delete). */
const TRAIL_ACTIONS: ReadonlySet<string> = new Set(["edit", "move", "undelete"]);

/** A collision classic won whose trail is not written yet. */
function needsTrail(row: ConflictRow): boolean {
  return (
    row.winnerSide === "classic" &&
    row.trailRevisionId === null &&
    row.articleId !== null &&
    TRAIL_ACTIONS.has(row.winnerAction)
  );
}

/** Whether `since` is more than `windowMs` ago. */
function olderThan(since: Date, windowMs: number): boolean {
  return Date.now() - since.getTime() > windowMs;
}

/** When the settling first tried the row: stamped by the first attempt, kept by every later one. */
async function firstAttemptOf(row: ConflictRow): Promise<Date> {
  if (row.firstSettleAt) return row.firstSettleAt;
  const now = new Date();
  await db.wikiConflict.updateMany({
    where: { id: row.id, firstSettleAt: null },
    data: { firstSettleAt: now },
  });
  return now;
}

/** The rows the settling still owes something: not settled, not legacy (history only). */
const UNSETTLED = { legacyPark: false, settledAt: null } as const;

/** The account behind a recipient: the Clerk id the notification API takes, and the linked Discord account. */
function accountOf(userId: string | null) {
  return userId
    ? db.user.findUnique({
        where: { id: userId },
        select: { clerkUserId: true, discordUserId: true },
      })
    : null;
}

// --- the notices ----------------------------------------------------------------------------------------------------

/** The words of `recipient`'s notice (conflict-notice-copy.ts). */
function copyOf({ entry, wiki, pageLink }: NoticeContext, recipient: NoticeRecipient) {
  return noticeCopy({
    title: entry.title,
    pageLink,
    wiki,
    winner: entry.winner.action,
    loss: lossOf(entry.overwritten, recipient),
  });
}

/**
 * Where the notice sends the recipient in WikiOS: the page's log when the winner was a deletion (the page is gone); the
 * diff of an edit winner against the recipient's newest edit; otherwise the page's history (no two revisions to diff).
 */
function noticeHref({ entry, urlPath }: NoticeContext, recipient: NoticeRecipient): string {
  const conflict = `conflict=${encodeURIComponent(entry.id)}`;
  const { action, ref } = entry.winner;
  if (action === "delete") return `/util/log?title=${encodeURIComponent(entry.title)}&${conflict}`;
  const newest = recipient.refs.at(-1);
  if (action !== "edit" || !newest || lossOf(entry.overwritten, recipient) !== "edit") {
    return `/wiki/${urlPath}?action=history&${conflict}`;
  }
  return `/wiki/${urlPath}?diff=${encodeURIComponent(ref)}&oldid=${encodeURIComponent(newest)}&${conflict}`;
}

async function tellInApp(context: NoticeContext, recipient: NoticeRecipient): Promise<Delivery> {
  const account = await accountOf(recipient.userId);
  if (!account?.clerkUserId) return "skipped";
  // the Clerk id, as every notifier passes it: the recipient's preferences and push apply
  await notificationAPI.create({
    userId: account.clerkUserId,
    title: copyOf(context, recipient).title,
    message: copyOf(context, recipient).message,
    href: noticeHref(context, recipient),
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
  const user = await accountOf(recipient.userId);
  if (!user?.discordUserId) return "skipped";
  const link = `${APP_URL}${CLEAN_BASE_PATH}${noticeHref(context, recipient)}`;
  const { message } = copyOf(context, recipient);
  if (await sendDiscordDm(user.discordUserId, `${message}\n${link}`)) return "sent";
  return olderThan(context.entry.createdAt, DM_RETRY_WINDOW_MS) ? "skipped" : "open";
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

/** A classic wikitext link to the page's log (its deletions, moves and restores). */
function logLink(title: string): string {
  return `[{{fullurl:Special:Log|page=${encodeURIComponent(title)}}} log]`;
}

/**
 * The note's link to the winner: the page's log for a deletion; the diff from `newest` (the recipient's newest
 * revision) when MediaWiki knows an edit winner; otherwise the page's history.
 */
async function winnerLink({ entry }: NoticeContext, newest: string | undefined): Promise<string> {
  const { action, ref } = entry.winner;
  if (action === "delete") return logLink(entry.title);
  const winner = action === "edit" && newest ? await classicRefOf(ref) : null;
  if (winner) return `[[Special:Diff/${newest}/${winner}|diff]]`;
  return `[{{fullurl:${entry.title}|action=history}} history]`;
}

/**
 * The note: a link to each of the recipient's revisions, to the log when what they lost was a deletion, move or
 * restore, and to the winner (see `winnerLink`).
 */
async function talkSection(context: NoticeContext, recipient: NoticeRecipient): Promise<string> {
  const copy = copyOf(context, recipient);
  // their WikiOS revisions MediaWiki has are linked by their MediaWiki ids
  const revisions = (await shownRefs(recipient.refs)).filter((ref) => CLASSIC_REVISION.test(ref));
  const links = revisions.map((ref) => `[[Special:PermanentLink/${ref}|revision ${ref}]]`);
  // what they lost was a deletion, move or restore: it is in the log
  if (lossOf(context.entry.overwritten, recipient) !== "edit") {
    links.push(logLink(context.entry.title));
  }
  const winner = await winnerLink(context, revisions.at(-1));
  if (!links.includes(winner)) links.push(winner);
  return [copy.heading, copy.body(` (${links.join(", ")})`)].join("\n");
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
  try {
    await ArticleRepository.saveArticle(
      {
        slug: canon.slug,
        title: canon.title,
        source: SOURCE,
        wikitext: appendSection(page.wikitext, await talkSection(context, recipient)),
        editSummary: copyOf(context, recipient).summary,
        expectedHeadRef: page.headRef,
      },
      undefined,
      CONFLICT_NOTICE_AUTHOR
    );
  } catch (error) {
    // a deleted talk page takes no note: the note would bring the page back on classic, and it stays deleted
    if (error instanceof DeletedPageError) return "skipped";
    throw error;
  }
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

/** A trail that will never be written: the row settles without it, and the log says why. */
function giveUpTrail({ entry }: NoticeContext, why: string): Delivery {
  console.warn(`[WikiConflicts] No trail for conflict ${entry.id}: ${why}.`);
  return "skipped";
}

/** Whether the classic winner is in WikiOS: an edit's revision (live, or overwritten since), a move's or undelete's event. */
async function winnerLanded(
  articleId: string,
  winner: ConflictLogEntry["winner"]
): Promise<boolean> {
  if (winner.action === "edit") {
    return (await db.wikiRevision.count({ where: { articleId, mwRevId: Number(winner.ref) } })) > 0;
  }
  const mwLogId = Number(winner.ref.replace(/^mwlog:/, ""));
  return (await db.wikiLog.count({ where: { mwLogId } })) > 0;
}

/**
 * The dummy edit that names the overwrite, once the classic winner is in WikiOS (`winnerLanded`): before that, WikiOS's
 * head is older than the winner, and copying it would put the old text back on classic. A page deleted since takes no
 * trail: its mirror job would bring the page back on classic.
 */
async function writeTrail(context: NoticeContext): Promise<Delivery> {
  const { entry } = context;
  const page = entry.articleId
    ? await db.wikiArticle.findUnique({
        where: { id: entry.articleId },
        select: { id: true, status: true },
      })
    : null;
  if (!page) return giveUpTrail(context, "its page is gone");
  if (page.status === "ARCHIVED") return giveUpTrail(context, "its page is deleted");
  if (!(await winnerLanded(page.id, entry.winner))) return "open";
  const trail = await ArticleRepository.recordTrailRevision({
    articleId: page.id,
    summary: trailSummary(await verdictAsShown(verdictOfEntry(entry)), entry.id),
    conflictId: entry.id,
  });
  return trail ? "sent" : "skipped";
}

/** The trail, tried again by later runs for a day after the first attempt, then given up. */
async function settleTrail(context: NoticeContext): Promise<Delivery> {
  const trail = await attempt("trail", context, () => writeTrail(context));
  if (trail !== "open" || !olderThan(context.firstAttemptAt, TRAIL_RETRY_WINDOW_MS)) return trail;
  return giveUpTrail(context, "it could not be written for a day after the first attempt");
}

// --- settling -------------------------------------------------------------------------------------------------------

interface RowOutcome {
  notified: number;
  trails: number;
}

/** Tells each pending recipient on each pending channel; `open` when a delivery is left for the next run. */
async function tellRecipients(
  row: ConflictRow,
  context: NoticeContext
): Promise<{ notified: number; open: boolean }> {
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
  return { notified, open };
}

async function settleRow(row: ConflictRow): Promise<RowOutcome> {
  const context = contextOf(row, await firstAttemptOf(row));
  const told = await tellRecipients(row, context);
  const trail = needsTrail(row) ? await settleTrail(context) : "skipped";
  // a loser merged in meanwhile keeps the row open (markSettled judges the row as it is then)
  if (!told.open && trail !== "open") await markSettled(row.id);
  return {
    notified: told.notified,
    trails: trail === "sent" ? 1 : 0,
  };
}

/** One row; a failure (a database error in the bookkeeping too) leaves it for the next run and the others go on. */
async function settleIsolated(row: ConflictRow): Promise<RowOutcome> {
  try {
    return await settleRow(row);
  } catch (error) {
    console.warn(
      `[WikiConflicts] Settling conflict ${row.id} failed; the next run tries again:`,
      error
    );
    return { notified: 0, trails: 0 };
  }
}

/**
 * Tells everyone the conflict log still owes a notice and writes the trails classic winners still lack, for at most
 * `limit` unsettled rows, oldest first; a row with nothing left is settled and not read again. The caller holds the
 * inbound-sync lock.
 */
export async function settleConflicts(limit = 50): Promise<SettleResult> {
  const rows = await db.wikiConflict.findMany({
    where: UNSETTLED,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
  });
  const result: SettleResult = { notified: 0, trails: 0, pending: 0 };
  for (const row of rows) {
    const outcome = await settleIsolated(row);
    result.notified += outcome.notified;
    result.trails += outcome.trails;
  }
  // what is still open after the run: rows with work left, and those past `limit`
  result.pending = await db.wikiConflict.count({ where: UNSETTLED });
  return result;
}
