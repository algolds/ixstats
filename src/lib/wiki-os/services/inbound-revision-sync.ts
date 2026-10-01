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

/** The page's current revision: the newest one that is not parked. */
function loadHeadRevision(articleId: string): Promise<HeadRevision | null> {
  return db.wikiRevision.findFirst({
    where: { articleId, parked: false },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, mwRevId: true, sha1: true, byteSize: true, createdAt: true },
  });
}

/** What the page's head is, for the decision: its stamp, hash and the text the page has now. */
function toInboundHead(article: StoredArticle, headRev: HeadRevision | null): InboundHead | null {
  return headRev
    ? { mwRevId: headRev.mwRevId, sha1: headRev.sha1, wikitext: article.wikitext }
    : null;
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
 * The head gets the MediaWiki id of the revision the mirror made of it (the mirror stamps it too, but the
 * webhook can arrive first), and the article remembers the revision that holds its text in MediaWiki.
 */
async function recordEcho(
  article: StoredArticle,
  head: InboundHead,
  headRev: HeadRevision,
  rev: MediaWikiRevision
): Promise<void> {
  if (!matchesHead(head, rev.sha1)) return; // the mirror's push of other text: nothing is learned from it
  if (headRev.mwRevId === null) {
    await db.wikiRevision.updateMany({
      where: { id: headRev.id, mwRevId: null },
      data: { mwRevId: rev.revid },
    });
  }
  await db.wikiArticle.update({
    where: { id: article.id },
    data: {
      mwLatestRevId: rev.revid,
      lastMwSyncAt: new Date(),
      ...(article.mwPageId === null ? { mwPageId: rev.pageId } : {}),
    },
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
        byteDelta: byteSize - (headRev?.byteSize ?? 0),
        sha1: rev.sha1,
        wikitext: rev.wikitext,
      },
    ],
    head: buildHead(rev, createdAt),
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
    href: `/wiki/${canon.urlPath}?diff=${rev.revid}&oldid=${headRef}`,
    category: "wiki",
    type: "warning",
    source: "wikiSync",
  });
}

/** What a park does after the revision is stored. Best effort: the park itself already happened. */
async function afterPark(
  rev: MediaWikiRevision,
  canon: CanonicalTitle,
  article: StoredArticle,
  headRev: HeadRevision | null,
  headRef: string
): Promise<void> {
  MediaWikiExportWorker.enqueue({
    slug: article.slug,
    title: article.title,
    wikitext: article.wikitext,
    summary: `Restoring WikiOS revision ${headRef}; your edit (rev ${rev.revid}) was kept in WikiOS history as a conflict`,
    minor: false,
    revisionId: headRev?.id,
  });
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
  const headRev = article ? await loadHeadRevision(article.id) : null;
  const head = article ? toInboundHead(article, headRev) : null;

  // A page WikiOS deleted comes back only when MediaWiki creates it anew; an edit of the old page is a conflict.
  const deletedHere = article?.status === "ARCHIVED";
  const decision = deletedHere
    ? rev.parentid === 0
      ? "fast-forward"
      : "park"
    : await decideFor(rev, head);

  if (decision === "echo") {
    if (article && head && headRev) await recordEcho(article, head, headRev, rev);
    return "echo";
  }
  if (decision === "fast-forward") {
    return fastForward(rev, canon, article, deletedHere ? null : headRev);
  }
  if (!parkConflicts || !article) return "deferred";
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
