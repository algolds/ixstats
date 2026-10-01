// src/lib/wiki-os/services/watchlist-notify.ts
// Tell the people watching a page that its head changed (plan 416, WK-19), with MediaWiki's
// semantics: a watcher is told ONCE about a page until they visit it again. `WikiWatchlist.
// notificationTime` is the mark: set when the watcher is notified (no further notice while it is
// set), cleared by `markWatchedVisited` when they view the page. Whoever made the change is never
// told about their own change.
//
// Every event source calls `notifyWatchers` once, after its commit: a WikiOS save
// (`ArticleRepository.saveArticle`), the inbound MediaWiki sync, a move and a delete
// (`PageManagementService`). It never throws: a notification must not fail the edit.

import { db } from "~/server/db";
import { notificationAPI } from "~/lib/notifications/api";
import { wikiReaderPath } from "~/lib/wiki-os/config";

export type HeadChangeKind = "edited" | "moved" | "deleted";

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
  /** The edit summary, or the reason of a move or delete. */
  summary?: string | null;
  /** For an edit: the revision references (history `revid`s) before and after it, which the diff link needs. */
  previousRef?: string | null;
  currentRef?: string | null;
  /** For a move: the title the page had. */
  fromTitle?: string | null;
}

/** Watchers notified per event, bounding the work one change on a very popular page can cause. */
const MAX_WATCHERS_PER_EVENT = 1000;
/** Notifications written at once. */
const CLAIM_BATCH = 25;
const MAX_SUMMARY_CHARS = 200;

interface NotificationText {
  title: string;
  message: string;
  href: string;
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
 * Notify one watcher, once: the row is claimed first (`notificationTime` was still empty), so two
 * changes arriving together send one notification. A notification that cannot be written (the event
 * is switched off, the database hiccups) hands the claim back: the next change tries again.
 */
async function notifyWatcher(
  watcher: { id: string; userId: string },
  change: HeadChange,
  text: NotificationText
): Promise<boolean> {
  const claimed = await db.wikiWatchlist.updateMany({
    where: { id: watcher.id, notificationTime: null },
    data: { notificationTime: new Date() },
  });
  if (claimed.count === 0) return false;
  try {
    await notificationAPI.create({
      userId: watcher.userId,
      title: text.title,
      message: text.message,
      href: text.href,
      category: "wiki",
      priority: "low",
      source: "wikiWatchlist",
      metadata: { articleId: change.articleId, kind: change.kind },
    });
    return true;
  } catch {
    await db.wikiWatchlist.updateMany({
      where: { id: watcher.id },
      data: { notificationTime: null },
    });
    return false;
  }
}

/** Notify the watchers of `change.articleId` who have not been told since they last visited. Returns how many were. */
export async function notifyWatchers(change: HeadChange): Promise<number> {
  try {
    const excluded = await actorUserIds(change);
    const watchers = await db.wikiWatchlist.findMany({
      where: {
        articleId: change.articleId,
        notificationTime: null,
        ...(excluded.length > 0 ? { userId: { notIn: excluded } } : {}),
      },
      select: { id: true, userId: true },
      take: MAX_WATCHERS_PER_EVENT,
    });
    const text = describeChange(change);
    let notified = 0;
    for (let i = 0; i < watchers.length; i += CLAIM_BATCH) {
      const batch = watchers.slice(i, i + CLAIM_BATCH);
      const sent = await Promise.all(batch.map((watcher) => notifyWatcher(watcher, change, text)));
      notified += sent.filter(Boolean).length;
    }
    return notified;
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
