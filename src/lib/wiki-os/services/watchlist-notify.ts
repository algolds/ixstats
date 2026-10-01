// src/lib/wiki-os/services/watchlist-notify.ts
// Tell the people watching a page that its head changed (plan 416, WK-19), with MediaWiki's
// semantics: a watcher is told ONCE about a page until they visit it again. `WikiWatchlist.
// notificationTime` is the mark: set when the watcher is notified (no further notice while it is
// set), cleared by `markWatchedVisited` when they view the page. Whoever made the change is never
// told about their own change.
//
// Every event source calls `notifyWatchers` once, after its commit, without waiting for it: a WikiOS
// save (`ArticleRepository.saveArticle`), an XML import that moves a head, the inbound MediaWiki
// sync, and a move, delete or restore (`PageManagementService`). It never throws: a notification must
// not fail the edit.
//
// The work is batched: per chunk of watchers, one `updateMany` claims their rows and one `createMany`
// writes their notifications. Notifications belong to the person's Clerk id (that is what the bell
// and the notification list read), while `WikiWatchlist.userId` is the internal user id.

import { db } from "~/server/db";
import { notificationAPI } from "~/lib/notifications/api";
import { isNotificationEventEnabled } from "~/lib/notifications/guard";
import { wikiReaderPath } from "~/lib/wiki-os/config";

export type HeadChangeKind = "edited" | "moved" | "deleted" | "restored";

export interface HeadChange {
  kind: HeadChangeKind;
  articleId: string;
  /** The page's title (after a move, its new one). */
  title: string;
  /** Who made the change, as the page history shows them. */
  editor: string;
  /** The WikiOS user who made it, when known: not notified of their own change. */
  editorUserId?: string | null;
  /** The MediaWiki account that made it: left out the same way when it is linked to a WikiOS user. */
  editorWikiUsername?: string | null;
  /** The edit summary, or the reason of a move, delete or restore. */
  summary?: string | null;
  /** For an edit: the revision references (history `revid`s) before and after it, which the diff link needs (without both, the link goes to the page). */
  previousRef?: string | null;
  currentRef?: string | null;
  /** For a move: the title the page had. */
  fromTitle?: string | null;
}

/** The event switch (`notificationEventConfig`) of the notifications written here: `<source>Notification`. */
const NOTIFICATION_SOURCE = "wikiWatchlist";
const EVENT_KEY = `${NOTIFICATION_SOURCE}Notification`;
/** Watchers handled per claim and per notification write: well inside PostgreSQL's bind-parameter limit. */
const WATCHER_CHUNK = 1000;
const MAX_SUMMARY_CHARS = 200;

interface NotificationText {
  title: string;
  message: string;
  href: string;
}

interface Watcher {
  id: string;
  /** Their Clerk id, or null for an account that has none (it cannot receive notifications). */
  user: { clerkUserId: string | null } | null;
}

function clip(text: string): string {
  return text.length > MAX_SUMMARY_CHARS ? `${text.slice(0, MAX_SUMMARY_CHARS - 1)}…` : text;
}

function describeChange(change: HeadChange): NotificationText {
  const summary = change.summary?.trim() ? clip(change.summary.trim()) : null;
  const page = wikiReaderPath(change.title);
  if (change.kind === "moved") {
    const from = change.fromTitle ? ` from "${change.fromTitle}"` : "";
    return {
      title: `${change.title} was moved`,
      message: `${change.editor} moved it${from}${summary ? `: ${summary}` : ""}`,
      href: page,
    };
  }
  if (change.kind === "deleted") {
    return {
      title: `${change.title} was deleted`,
      message: summary ? `${change.editor}: ${summary}` : `${change.editor} deleted this page`,
      href: page,
    };
  }
  if (change.kind === "restored") {
    return {
      title: `${change.title} was restored`,
      message: summary ? `${change.editor}: ${summary}` : `${change.editor} restored this page`,
      href: page,
    };
  }
  const diff =
    change.previousRef && change.currentRef
      ? `/util/diff?oldid=${encodeURIComponent(change.previousRef)}&diff=${encodeURIComponent(change.currentRef)}`
      : page;
  return {
    title: `${change.title} was edited`,
    message: summary ? `${change.editor}: ${summary}` : `${change.editor} edited this page`,
    href: diff,
  };
}

/** The WikiOS users who made the change: not to be told about it. */
async function actorUserIds(change: HeadChange): Promise<string[]> {
  const ids: string[] = change.editorUserId ? [change.editorUserId] : [];
  if (change.editorWikiUsername) {
    const link = await db.wikiAccountLink.findFirst({
      where: { source: "ixwiki", username: change.editorWikiUsername, verifiedAt: { not: null } },
      select: { userId: true },
    });
    if (link) ids.push(link.userId);
  }
  return ids;
}

/**
 * A timestamp no other claim made by this process shares, so the rows one claim set can be told from
 * the rows a concurrent claim set (two changes in the same millisecond must not both own a row).
 */
let lastClaimMs = 0;
function nextClaimStamp(): Date {
  lastClaimMs = Math.max(Date.now(), lastClaimMs + 1);
  return new Date(lastClaimMs);
}

/** The next chunk of the page's watchers who have not been told since they last visited, after `afterId`. */
function findWatchers(
  change: HeadChange,
  excluded: string[],
  afterId: string | null
): Promise<Watcher[]> {
  return db.wikiWatchlist.findMany({
    where: {
      articleId: change.articleId,
      notificationTime: null,
      ...(excluded.length > 0 ? { userId: { notIn: excluded } } : {}),
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    orderBy: { id: "asc" },
    select: { id: true, user: { select: { clerkUserId: true } } },
    take: WATCHER_CHUNK,
  });
}

/**
 * Notify one chunk of watchers, once each. Their rows are claimed first (`notificationTime` was still
 * empty) with one `updateMany`, so two changes arriving together send one notification per watcher; the
 * notifications are then written with one `createMany`. Notifications that cannot be written (the
 * database hiccups) hand the claims back: the next change tries again.
 */
async function notifyChunk(
  watchers: Watcher[],
  change: HeadChange,
  text: NotificationText
): Promise<number> {
  const recipients = watchers.flatMap((watcher) =>
    watcher.user?.clerkUserId ? [{ id: watcher.id, clerkUserId: watcher.user.clerkUserId }] : []
  );
  if (recipients.length === 0) return 0;

  const claimedAt = nextClaimStamp();
  const claim = await db.wikiWatchlist.updateMany({
    where: { id: { in: recipients.map((r) => r.id) }, notificationTime: null },
    data: { notificationTime: claimedAt },
  });
  if (claim.count === 0) return 0;

  // A shortfall means a concurrent change claimed some rows first: ours are the ones carrying our stamp.
  const owned =
    claim.count === recipients.length ? recipients : await ownedBy(claimedAt, recipients);
  try {
    await notificationAPI.createMany(
      owned.map((watcher) => ({
        userId: watcher.clerkUserId,
        title: text.title,
        message: text.message,
        href: text.href,
        category: "wiki" as const,
        priority: "low" as const,
        source: NOTIFICATION_SOURCE,
        metadata: { articleId: change.articleId, kind: change.kind },
      }))
    );
    return owned.length;
  } catch {
    await db.wikiWatchlist.updateMany({
      where: { id: { in: owned.map((r) => r.id) }, notificationTime: claimedAt },
      data: { notificationTime: null },
    });
    return 0;
  }
}

/** Of `recipients`, the ones whose row carries `claimedAt`. */
async function ownedBy<T extends { id: string }>(claimedAt: Date, recipients: T[]): Promise<T[]> {
  const rows = await db.wikiWatchlist.findMany({
    where: { id: { in: recipients.map((r) => r.id) }, notificationTime: claimedAt },
    select: { id: true },
  });
  const ids = new Set(rows.map((row) => row.id));
  return recipients.filter((r) => ids.has(r.id));
}

/**
 * Notify the watchers of `change.articleId` who have not been told since they last visited, every one
 * of them (chunk by chunk). Returns how many were. Does nothing when the event is switched off.
 */
export async function notifyWatchers(change: HeadChange): Promise<number> {
  try {
    // `createMany` has no event guard of its own (`create` does), so the switch is read here, once.
    if (!(await isNotificationEventEnabled(EVENT_KEY))) return 0;
    const excluded = await actorUserIds(change);
    const text = describeChange(change);
    let notified = 0;
    let afterId: string | null = null;
    for (;;) {
      const chunk = await findWatchers(change, excluded, afterId);
      notified += await notifyChunk(chunk, change, text);
      const last = chunk.at(-1);
      if (!last || chunk.length < WATCHER_CHUNK) return notified;
      afterId = last.id;
    }
  } catch (error) {
    console.warn("[WatchlistNotify] Could not notify watchers:", error);
    return 0;
  }
}

/**
 * The watcher viewed the page: the next change notifies them again. Does nothing for a page they do
 * not watch.
 */
export async function markWatchedVisited(userId: string, pageTitle: string): Promise<void> {
  const article = await db.wikiArticle.findFirst({
    where: {
      source: "ixwiki",
      OR: [{ title: pageTitle }, { title: pageTitle.replace(/_/g, " ") }],
    },
    select: { id: true },
  });
  if (!article) return;
  await db.wikiWatchlist.updateMany({
    where: { userId, articleId: article.id },
    data: { lastViewedTime: new Date(), notificationTime: null },
  });
}
