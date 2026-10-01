/**
 * inbound-revision-sync.ts — import one MediaWiki revision into WikiOS, revision-exact.
 *
 * The inbound rule (plan 406, "fast-forward or park"): a revision whose parent is WikiOS's head is
 * imported as a normal revision (through `ArticleRepository.importPageRevisions`, the same write the
 * XML importer makes); a revision that is WikiOS's own text coming back is an echo (it only gives the
 * head its MediaWiki id); anything else is parked: stored in the page's history as a non-current
 * revision, WikiOS's head pushed back to MediaWiki, and the editor notified when we know who they are.
 * `decideInbound` is the pure rule; this file reads and writes around it.
 *
 * Callers hold the inbound-sync lock (auto-sync-service.ts): revisions of a page must be applied one
 * at a time, oldest first.
 */

import { z } from "zod";
import { db } from "~/server/db";
import { notificationAPI } from "~/lib/notifications/api";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { MediaWikiExportWorker } from "../adapters/mediawiki/sync-worker";
import {
  ArticleRepository,
  type ImportedHead,
  type ImportPageInput,
} from "../core/article-repository";
import { toRevisionRef } from "../core/domain-types";
import { parseRedirect } from "../core/redirect";
import { canonicalizeTitle, storedNamespace, type CanonicalTitle } from "../core/title";
import { extractLeadImageFromWikitext } from "../transformers/image-url";
import { cleanWikitextExcerpt } from "../transformers/wikitext-parser";
import { mwSha1Base36 } from "../xml/sha1";
import {
  decideInbound,
  matchesHead,
  type InboundDecision,
  type InboundHead,
} from "./inbound-decision";
import {
  fetchLatestRevision,
  fetchRevision,
  fetchRevisionSha1,
  plainTitle,
  type MediaWikiRevision,
} from "./inbound-mediawiki";

const SOURCE = "ixwiki";
const SUMMARY_COLUMN_LIMIT = 480;
/** The excerpt is the lead of the article: cleaning more than this is wasted work on a 2 MB page. */
const EXCERPT_SOURCE_LENGTH = 20_000;
const DELETED_AUTHOR = "(deleted)";

/**
 * What came of one revision:
 *   known: WikiOS already has it;  skipped: nothing to import (revision or page gone, text hidden, title MediaWiki
 *   would refuse);  echo: WikiOS's own text coming back;  fast-forward: imported as the page's new head;
 *   parked: stored as a conflict;  deferred: would be parked, and the caller leaves that to the ordered cycle.
 */
export type RevisionOutcome = "known" | "skipped" | "echo" | "fast-forward" | "parked" | "deferred";

/**
 * Forget what every cache holds about `title` (a page that came back, was renamed or deleted). Loaded on
 * demand: the eviction module reaches the article view cache, which imports this sync, so a static
 * import would be a cycle at load time.
 */
export async function evictCaches(title: string, articleId?: string | null): Promise<void> {
  const { evictWikiTitleCaches } = await import("./title-cache-eviction");
  await evictWikiTitleCaches(title, SOURCE, articleId);
}

/** The MediaWiki account the mirror edits as: the bot-password login without its "@appname". */
function mirrorBotName(): string | null {
  const login = process.env.WIKIOS_MEDIAWIKI_BOT_USER?.split("@")[0]?.trim();
  return login ? normalizeWikiUsername(login) : null;
}

/** Whether `user` is WikiOS's own mirror account: what it writes to MediaWiki is WikiOS's, not news. */
export function isMirrorUser(user: string | null): boolean {
  const bot = mirrorBotName();
  return bot !== null && user !== null && normalizeWikiUsername(user) === bot;
}

/** The WikiOS user who verified the MediaWiki account `username`, if anyone. */
export async function verifiedWikiUserId(username: string | null): Promise<string | null> {
  if (!username) return null;
  const link = await db.wikiAccountLink.findFirst({
    where: { source: SOURCE, username: normalizeWikiUsername(username), verifiedAt: { not: null } },
    select: { userId: true },
  });
  return link?.userId ?? null;
}

const ARTICLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  wikitext: true,
  namespace: true,
  namespacePrefix: true,
  mwPageId: true,
  mwLatestRevId: true,
  updatedAt: true,
} as const;

type StoredArticle = NonNullable<Awaited<ReturnType<typeof findStoredArticle>>>;

/**
 * The article a revision belongs to: by its title, else by its MediaWiki page id (a page moved in MediaWiki
 * keeps its id; the move event that renames the article follows in the same cycle).
 */
async function findStoredArticle(rev: MediaWikiRevision, canon: CanonicalTitle) {
  const byTitle = await db.wikiArticle.findUnique({
    where: { source_title: { source: SOURCE, title: canon.title } },
    select: ARTICLE_SELECT,
  });
  if (byTitle || rev.pageId <= 0) return byTitle;
  return db.wikiArticle.findFirst({
    where: { source: SOURCE, mwPageId: rev.pageId },
    select: ARTICLE_SELECT,
  });
}

interface HeadRevision {
  id: string;
  mwRevId: number | null;
  sha1: string | null;
  byteSize: number;
  createdAt: Date;
}

const HEAD_SELECT = {
  id: true,
  mwRevId: true,
  sha1: true,
  byteSize: true,
  createdAt: true,
} as const;

/** The page's current revision: the newest one that is not parked. */
function loadHeadRevision(articleId: string): Promise<HeadRevision | null> {
  return db.wikiRevision.findFirst({
    where: { articleId, parked: false },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: HEAD_SELECT,
  });
}

/**
 * What the page's head is, for the decision: its stamp, hash and the text the page has now. A page with
 * text but no revision row (written before revisions were kept) is not free to overwrite: its text is its
 * head, and the MediaWiki revision it was last synced from, if known, its stamp. Only a page with no text
 * at all has nothing to protect.
 */
function toInboundHead(article: StoredArticle, headRev: HeadRevision | null): InboundHead | null {
  if (headRev) return { mwRevId: headRev.mwRevId, sha1: headRev.sha1, wikitext: article.wikitext };
  if (article.wikitext.trim() === "") return null;
  return { mwRevId: article.mwLatestRevId, sha1: null, wikitext: article.wikitext };
}

const BASELINE_SUMMARY = "The page's text before its first recorded revision";

/**
 * Give a page that has text but no revision row one, holding that text, so that overwriting or parking
 * against it loses nothing: the page's history starts with what WikiOS had. `mwRevId` stamps it when the
 * MediaWiki revision that came in IS that text.
 */
async function insertBaselineRevision(
  article: StoredArticle,
  mwRevId: number | null
): Promise<HeadRevision> {
  const byteSize = Buffer.byteLength(article.wikitext, "utf8");
  return db.wikiRevision.create({
    data: {
      articleId: article.id,
      source: SOURCE,
      mwRevId,
      summary: BASELINE_SUMMARY,
      byteSize,
      byteDelta: byteSize,
      sha1: mwSha1Base36(article.wikitext),
      createdAt: article.updatedAt,
      wikitext: article.wikitext,
      format: "WIKITEXT",
    },
    select: HEAD_SELECT,
  });
}

async function isRevisionKnown(revid: number): Promise<boolean> {
  const row = await db.wikiRevision.findUnique({
    where: { source_mwRevId: { source: SOURCE, mwRevId: revid } },
    select: { id: true },
  });
  return row !== null;
}

// ---------------------------------------------------------------------------
// Echo: WikiOS's own text coming back from MediaWiki
// ---------------------------------------------------------------------------

/**
 * An echo is a MediaWiki revision WikiOS already has the text of: its own export coming back, or an
 * edit that left the text as it was. It is recorded, so that a replay of the recent changes never judges
 * it again against a head that has moved on, and never changes the page's head:
 *   - the head, if the mirror has not stamped it yet (the webhook can arrive first), gets the revision's
 *     MediaWiki id; a page with text but no revision row gets one holding that text, stamped;
 *   - any other echo is stored as a non-parked revision stamped with its MediaWiki id, dated just before
 *     the head so that it is never the newest one.
 * The article remembers the MediaWiki revision that holds its text.
 */
async function recordEcho(
  article: StoredArticle,
  head: InboundHead,
  headRev: HeadRevision | null,
  rev: MediaWikiRevision
): Promise<void> {
  const sameText = matchesHead(head, rev.sha1);
  const stamped = sameText && (await stampHead(article, headRev, rev));
  if (!stamped) await insertEchoRevision(article, headRev, rev);
  if (!sameText) return; // the mirror's push of other text: nothing is learned about the page
  await db.wikiArticle.update({
    where: { id: article.id },
    data: {
      mwLatestRevId: rev.revid,
      lastMwSyncAt: new Date(),
      ...(article.mwPageId === null ? { mwPageId: rev.pageId } : {}),
    },
  });
}

/** Stamp the head with the revision it is the same text as; false when the head already has a MediaWiki id. */
async function stampHead(
  article: StoredArticle,
  headRev: HeadRevision | null,
  rev: MediaWikiRevision
): Promise<boolean> {
  if (!headRev) {
    await insertBaselineRevision(article, rev.revid);
    return true;
  }
  if (headRev.mwRevId !== null) return false;
  await db.wikiRevision.updateMany({
    where: { id: headRev.id, mwRevId: null },
    data: { mwRevId: rev.revid },
  });
  return true;
}

async function insertEchoRevision(
  article: StoredArticle,
  headRev: HeadRevision | null,
  rev: MediaWikiRevision
): Promise<void> {
  const byteSize = Buffer.byteLength(rev.wikitext, "utf8");
  const createdAt = headRev
    ? new Date(Math.min(rev.timestamp.getTime(), headRev.createdAt.getTime() - 1))
    : rev.timestamp;
  await db.wikiRevision.createMany({
    data: [
      {
        articleId: article.id,
        source: SOURCE,
        mwRevId: rev.revid,
        author: rev.user ?? DELETED_AUTHOR,
        authorId: await verifiedWikiUserId(rev.user),
        summary: rev.comment || null,
        minor: rev.minor,
        commentDeleted: rev.commentHidden,
        userDeleted: rev.user === null,
        byteSize,
        byteDelta: 0,
        sha1: rev.sha1,
        createdAt,
        wikitext: rev.wikitext,
        format: "WIKITEXT",
      },
    ],
    skipDuplicates: true,
  });
}

// ---------------------------------------------------------------------------
// Fast-forward: import the revision through the importer's write
// ---------------------------------------------------------------------------

/** The page's head columns for `wikitext`, derived exactly as a save derives them. */
function buildHead(rev: MediaWikiRevision, createdAt: Date): ImportedHead {
  const words = rev.wikitext.split(/\s+/).filter(Boolean).length;
  const redirect = parseRedirect(rev.wikitext);
  return {
    createdAt,
    mwRevId: rev.revid,
    wikitext: rev.wikitext,
    summary:
      cleanWikitextExcerpt(rev.wikitext.slice(0, EXCERPT_SOURCE_LENGTH), 300).slice(
        0,
        SUMMARY_COLUMN_LIMIT
      ) || null,
    wordCount: words,
    readingTime: Math.max(1, Math.ceil(words / 200)),
    redirectTargetSlug: redirect?.title ?? null,
    redirectTargetFragment: redirect?.fragment ?? null,
    leadImageUrl: extractLeadImageFromWikitext(rev.wikitext),
  };
}

/** The page's identity: the stored row's own (a moved page is renamed by its move event), else the canonical title's. */
function identityOf(article: StoredArticle | null, canon: CanonicalTitle, rev: MediaWikiRevision) {
  if (article) {
    return {
      title: article.title,
      slug: article.slug,
      namespace: article.namespace,
      namespacePrefix: article.namespacePrefix,
    };
  }
  const { namespaceId, namespacePrefix } = storedNamespace(canon, rev.namespace);
  return { title: canon.title, slug: canon.slug, namespace: namespaceId, namespacePrefix };
}

/** A revision never sorts before its parent, whatever MediaWiki's clock says: the head is the newest one. */
function laterThan(time: Date, parentTime: Date | undefined): Date {
  return parentTime && time.getTime() <= parentTime.getTime()
    ? new Date(parentTime.getTime() + 1)
    : time;
}

async function fastForward(
  rev: MediaWikiRevision,
  canon: CanonicalTitle,
  article: StoredArticle | null,
  headRev: HeadRevision | null
): Promise<RevisionOutcome> {
  const createdAt = laterThan(rev.timestamp, headRev?.createdAt);
  const byteSize = Buffer.byteLength(rev.wikitext, "utf8");
  // A page created anew has no earlier size to be measured against.
  const previousSize = article?.status === "ARCHIVED" ? 0 : (headRev?.byteSize ?? 0);
  const input: ImportPageInput = {
    source: SOURCE,
    ...identityOf(article, canon, rev),
    mwPageId: rev.pageId,
    protectionLevel: null,
    restrictions: [],
    revisions: [
      {
        mwRevId: rev.revid,
        createdAt,
        author: rev.user ?? DELETED_AUTHOR,
        authorId: await verifiedWikiUserId(rev.user),
        summary: rev.comment || null,
        commentDeleted: rev.commentHidden,
        textDeleted: false,
        userDeleted: rev.user === null,
        minor: rev.minor,
        byteSize,
        byteDelta: byteSize - previousSize,
        sha1: rev.sha1,
        wikitext: rev.wikitext,
      },
    ],
    head: buildHead(rev, createdAt),
    // watchlist: importPageRevisions tells the page's watchers (once each until they visit) that its head
    // moved, leaving the editor out; the previous head's reference makes their notification a diff link.
    previousRef: headRev ? toRevisionRef(headRev) : null,
    dryRun: false,
  };

  const result = await ArticleRepository.importPageRevisions(input);
  if (result.inserted === 0 && !result.headUpdated) return "known";
  if (article?.status === "ARCHIVED") await restoreRecreatedPage(article);
  return "fast-forward";
}

/** A page deleted in WikiOS and created again in MediaWiki is back. */
async function restoreRecreatedPage(article: StoredArticle): Promise<void> {
  await db.wikiArticle.update({ where: { id: article.id }, data: { status: "PUBLISHED" } });
  await evictCaches(article.title, article.id);
}

// ---------------------------------------------------------------------------
// Park: keep the edit, push WikiOS's head back, tell the editor
// ---------------------------------------------------------------------------

/** Insert the revision as parked, or return false when WikiOS already has it. */
async function insertParked(
  rev: MediaWikiRevision,
  article: StoredArticle,
  headRev: HeadRevision | null,
  reason: string
): Promise<boolean> {
  const byteSize = Buffer.byteLength(rev.wikitext, "utf8");
  const { count } = await db.wikiRevision.createMany({
    data: [
      {
        articleId: article.id,
        source: SOURCE,
        mwRevId: rev.revid,
        author: rev.user ?? DELETED_AUTHOR,
        authorId: await verifiedWikiUserId(rev.user),
        summary: rev.comment || null,
        minor: rev.minor,
        commentDeleted: rev.commentHidden,
        userDeleted: rev.user === null,
        byteSize,
        byteDelta: byteSize - (headRev?.byteSize ?? 0),
        sha1: rev.sha1,
        createdAt: rev.timestamp,
        wikitext: rev.wikitext,
        format: "WIKITEXT",
        parked: true,
        parkReason: reason,
      },
    ],
    skipDuplicates: true,
  });
  return count > 0;
}

/** Tell the MediaWiki account's WikiOS owner (a verified link) that their edit did not go live. */
async function notifyParkedEditor(
  rev: MediaWikiRevision,
  canon: CanonicalTitle,
  headRef: string
): Promise<void> {
  const userId = await verifiedWikiUserId(rev.user);
  if (!userId) return;
  await notificationAPI.create({
    userId,
    title: "Your MediaWiki edit was not applied",
    message:
      `Your edit to "${canon.title}" (revision ${rev.revid}) was not made on the current WikiOS revision. ` +
      "It was kept in the page history as a conflict, and WikiOS's current text was restored in MediaWiki.",
    // The reader's own diff view (plan 412): this edit against the head it conflicted with.
    href: `/wiki/${canon.urlPath}?diff=${rev.revid}&oldid=${headRef}`,
    category: "wiki",
    type: "warning",
    source: "wikiSync",
  });
}

// ---------------------------------------------------------------------------
// Re-pushes the mirror cannot make (no mirror account configured)
// ---------------------------------------------------------------------------

/** SystemConfig key: the titles of articles whose park was not followed by a re-push, for the telemetry. */
const REPUSH_SKIPPED_KEY = "wikiAutoSync.repushSkipped";
const MAX_REPUSH_SKIPPED = 50;
const titleListSchema = z.array(z.string());

/**
 * Titles of parked articles whose WikiOS head was NOT pushed back to MediaWiki because no mirror account
 * is configured. Without one the push would come back as an edit by an unknown account that the sync
 * cannot tell from a human's: a conflict again, pushed again, forever. The inbound sync status reports
 * the list, so the missing configuration is seen.
 */
export async function readRepushSkipped(): Promise<string[]> {
  const row = await db.systemConfig.findUnique({
    where: { key: REPUSH_SKIPPED_KEY },
    select: { value: true },
  });
  if (!row) return [];
  try {
    return titleListSchema.parse(JSON.parse(row.value));
  } catch {
    return [];
  }
}

async function writeRepushSkipped(titles: string[]): Promise<void> {
  const value = JSON.stringify(titles);
  await db.systemConfig.upsert({
    where: { key: REPUSH_SKIPPED_KEY },
    create: { key: REPUSH_SKIPPED_KEY, value },
    update: { value },
  });
}

async function markRepushSkipped(title: string): Promise<void> {
  const titles = await readRepushSkipped();
  if (!titles.includes(title))
    await writeRepushSkipped([...titles, title].slice(-MAX_REPUSH_SKIPPED));
}

/**
 * Once a mirror account is configured, push the head of every article that was parked without a
 * re-push, and clear the list. Resolves to the number of articles pushed.
 */
export async function repushSkippedParks(): Promise<number> {
  if (mirrorBotName() === null) return 0;
  const titles = await readRepushSkipped();
  if (titles.length === 0) return 0;

  let pushed = 0;
  for (const title of titles) {
    const article = await db.wikiArticle.findUnique({
      where: { source_title: { source: SOURCE, title } },
      select: { slug: true, title: true, wikitext: true, status: true },
    });
    if (!article || article.status === "ARCHIVED") continue;
    MediaWikiExportWorker.enqueue({
      slug: article.slug,
      title: article.title,
      wikitext: article.wikitext,
      summary: "Restoring the current WikiOS revision (an edit made here conflicted with it)",
      minor: false,
    });
    pushed++;
  }
  await writeRepushSkipped([]);
  return pushed;
}

/** What a park does after the revision is stored. Best effort: the park itself already happened. */
async function afterPark(
  rev: MediaWikiRevision,
  canon: CanonicalTitle,
  article: StoredArticle,
  headRev: HeadRevision | null,
  headRef: string
): Promise<void> {
  if (mirrorBotName() === null) {
    // Never push without a mirror account: its edit could not be told from a human's and would be parked
    // and pushed again, one edit per cycle, for as long as the page is left alone.
    console.error(
      `[WikiAutoSync] WIKIOS_MEDIAWIKI_BOT_USER is not set: the edit ${rev.revid} to "${article.title}" was parked, but WikiOS's text was NOT pushed back to MediaWiki.`
    );
    await markRepushSkipped(article.title).catch((error) =>
      console.warn("[WikiAutoSync] Could not record the skipped re-push:", error)
    );
  } else {
    MediaWikiExportWorker.enqueue({
      slug: article.slug,
      title: article.title,
      wikitext: article.wikitext,
      summary: `Restoring WikiOS revision ${headRef}; your edit (rev ${rev.revid}) was kept in WikiOS history as a conflict`,
      minor: false,
      revisionId: headRev?.id,
    });
  }
  try {
    await notifyParkedEditor(rev, canon, headRef);
  } catch (error) {
    console.warn(`[WikiAutoSync] Notifying the editor of a parked edit failed:`, error);
  }
}

async function parkRevision(
  rev: MediaWikiRevision,
  canon: CanonicalTitle,
  article: StoredArticle,
  headRev: HeadRevision | null
): Promise<RevisionOutcome> {
  const deleted = article.status === "ARCHIVED";
  const headRef = headRev ? toRevisionRef(headRev) : "none";
  if (
    !(await insertParked(
      rev,
      article,
      headRev,
      deleted ? "conflict:deleted" : `conflict:${headRef}`
    ))
  ) {
    return "known";
  }
  // A page WikiOS deleted has no head to push back (that would bring it back to life in MediaWiki).
  if (!deleted) await afterPark(rev, canon, article, headRev, headRef);
  return "parked";
}

// ---------------------------------------------------------------------------
// The decision around one revision
// ---------------------------------------------------------------------------

/** What MediaWiki's page was when the edit was made, as far as the inbound rule can tell. */
async function decideFor(
  rev: MediaWikiRevision,
  head: InboundHead | null
): Promise<InboundDecision> {
  const input = {
    head,
    rev: {
      revid: rev.revid,
      parentid: rev.parentid,
      sha1: rev.sha1,
      byMirrorBot: isMirrorUser(rev.user),
    },
    parentSha1: null,
  };
  const first = decideInbound(input);
  // The parent's hash is only worth a request when the cheap checks would park the edit.
  if (first !== "park" || rev.parentid <= 0) return first;
  return decideInbound({ ...input, parentSha1: await fetchRevisionSha1(rev.parentid) });
}

interface ApplyOptions {
  /** false: a conflict is left to the ordered cycle (the webhook and the reader never park). */
  parkConflicts: boolean;
}

/** Apply a fetched revision that WikiOS does not have yet. */
async function applyRevision(
  rev: MediaWikiRevision,
  { parkConflicts }: ApplyOptions
): Promise<RevisionOutcome> {
  const canon = canonicalizeTitle(rev.title);
  if (!canon) {
    console.warn(
      `[WikiAutoSync] Skipping revision ${rev.revid}: "${rev.title}" is not a valid title.`
    );
    return "skipped";
  }

  const article = await findStoredArticle(rev, canon);
  let headRev = article ? await loadHeadRevision(article.id) : null;
  const head = article ? toInboundHead(article, headRev) : null;

  // A page WikiOS deleted comes back only when MediaWiki creates it anew; an edit of the old page is a conflict.
  const deletedHere = article?.status === "ARCHIVED";
  const decision = deletedHere
    ? rev.parentid === 0
      ? "fast-forward"
      : "park"
    : await decideFor(rev, head);

  if (decision === "echo") {
    if (article && head) await recordEcho(article, head, headRev, rev);
    return "echo";
  }
  // The page's text is about to be overwritten, or an edit parked against it: a page that has text but
  // no revision row first gets one holding that text, so nothing is lost.
  const needsBaseline = article !== null && head !== null && headRev === null;
  if (decision === "fast-forward") {
    if (article && needsBaseline) headRev = await insertBaselineRevision(article, null);
    return fastForward(rev, canon, article, headRev);
  }
  if (!parkConflicts || !article) return "deferred";
  // A page WikiOS deleted has no head to hold anything against (and none is pushed back).
  if (needsBaseline && !deletedHere) headRev = await insertBaselineRevision(article, null);
  return parkRevision(rev, canon, article, headRev);
}

/** Import MediaWiki revision `revid` (a recent-changes entry), unless WikiOS already has it. */
export async function syncRevisionById(revid: number): Promise<RevisionOutcome> {
  if (await isRevisionKnown(revid)) return "known";
  const rev = await fetchRevision(revid);
  if (!rev) return "skipped";
  return applyRevision(rev, { parkConflicts: true });
}

/**
 * Import the newest revision of a page (the webhook, the reader's import of a missing page). Never
 * parks: a conflict, or a revision whose parent WikiOS has not seen, is left to the cycle, which applies
 * revisions oldest first and can tell the two apart.
 */
export async function syncLatestRevision(title: string): Promise<RevisionOutcome> {
  const rev = await fetchLatestRevision(plainTitle(title));
  if (!rev) return "skipped";
  if (await isRevisionKnown(rev.revid)) return "known";
  return applyRevision(rev, { parkConflicts: false });
}
