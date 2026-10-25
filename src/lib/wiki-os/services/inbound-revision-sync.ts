/**
 * inbound-revision-sync.ts — import one MediaWiki revision into WikiOS, revision-exact.
 *
 * How the revision relates to WikiOS's head (`decideInbound`, pure) decides what is written:
 *   - echo: WikiOS's own text coming back; it only gives the head its MediaWiki id;
 *   - older: a revision older than the classic revision that is WikiOS's head (a replay after a newer one): stored
 *     as history, dated at its own time and never the head;
 *   - fast-forward: made on top of WikiOS's head: imported as the page's next revision (through
 *     `ArticleRepository.importPageRevisions`, the same write the XML importer makes);
 *   - collision: both wikis changed the page from the same base, and the conflict rule (`decideCollision`) judges the
 *     two saves by time: a classic edit that won becomes the head; one that lost is kept as an overwritten revision
 *     (history only). Either way the collision gets its conflict-log row, and the settling (conflict-notices.ts) tells
 *     whoever was overwritten. Nothing is pushed back to MediaWiki from here.
 * Every stored revision is written with no WikiOS author; the approved name claim of its MediaWiki editor then tags it
 * (claim-tags.ts), so a revoked claim takes back exactly what it gave.
 *
 * Callers hold the inbound-sync lock (auto-sync-service.ts): revisions of a page must be applied one at a time,
 * oldest first.
 */

import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { tagRevisionsOfName } from "~/lib/identity/claim-tags";
import { ownerOfName } from "~/lib/identity/wiki-names";
import { isMirrorAccount } from "../adapters/mediawiki/csrf-cache";
import { ArticleRepository } from "../core/article-repository";
import type { ImportedHead, ImportPageInput } from "../core/article-import";
import { toRevisionRef } from "../core/domain-types";
import { fillRevisionParents } from "../core/revision-parents";
import { parseRedirect } from "../core/redirect";
import { canonicalizeTitle, storedNamespace, type CanonicalTitle } from "../core/title";
import { extractLeadImagePath } from "../transformers/image-url";
import { cleanWikitextExcerpt } from "../transformers/wikitext-parser";
import { mwSha1Base36 } from "../xml/sha1";
import { decideCollision, type CollisionVerdict } from "./conflict-rule";
import { recordConflict } from "./conflict-log";
import {
  classicChangeOfRevision,
  wikiosBranchSince,
  wikiosDeletion,
  wikiosHead,
} from "./conflict-sides";
import {
  decideInbound,
  isOlder,
  matchesHead,
  type InboundHead,
  type InboundRelation,
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
 *   would refuse);  echo: WikiOS's own text coming back;  older: stored as history (a revision older than the head's);
 *   fast-forward: imported as the page's new head;  won: a collision the classic edit won, imported as the head;
 *   overwritten: a collision it lost, kept as history only;  deferred: a collision, left to the ordered cycle.
 */
export type RevisionOutcome =
  "known" | "skipped" | "echo" | "older" | "fast-forward" | "won" | "overwritten" | "deferred";

/**
 * Forget what every cache holds about `title` (a page that came back, was renamed or deleted). Loaded on
 * demand: the eviction module reaches the article view cache, which imports this sync, so a static
 * import would be a cycle at load time.
 */
export async function evictCaches(title: string, articleId?: string | null): Promise<void> {
  const { evictWikiTitleCaches } = await import("./title-cache-eviction");
  await evictWikiTitleCaches(title, SOURCE, articleId);
}

/** Whether `user` is WikiOS's own mirror account: what it writes to MediaWiki is WikiOS's, not news. */
export function isMirrorUser(user: string | null): boolean {
  return isMirrorAccount(user);
}

/** The account holding the approved claim of the MediaWiki name `username` (shown or not), if anyone. */
export async function claimedWikiUserId(username: string | null): Promise<string | null> {
  return username ? ownerOfName(db, SOURCE, username) : null;
}

/**
 * Puts the claimed account on the revisions of `rev`'s editor that were just committed. Best effort: the revision is
 * stored either way, and one left untagged keeps no author, never a wrong one.
 */
async function tagEditor(rev: MediaWikiRevision): Promise<void> {
  try {
    await tagRevisionsOfName(db, SOURCE, rev.user);
  } catch (error) {
    console.warn(
      `[WikiAutoSync] Revision ${rev.revid} could not be tagged for its editor's claim:`,
      error
    );
  }
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
  origin: string;
}

const HEAD_SELECT = {
  id: true,
  mwRevId: true,
  sha1: true,
  byteSize: true,
  createdAt: true,
  origin: true,
} as const;

/** Where a revision this sync writes was saved: MediaWiki, always. */
const CLASSIC_ORIGIN = "classic";

/** The page's current revision: the newest one that is not parked (overwritten). */
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
  if (headRev) {
    return {
      mwRevId: headRev.mwRevId,
      sha1: headRev.sha1,
      wikitext: article.wikitext,
      fromClassic: headRev.origin === CLASSIC_ORIGIN,
    };
  }
  if (article.wikitext.trim() === "") return null;
  // text kept from before revisions were: it came from classic, the revision it was synced from its stamp
  return {
    mwRevId: article.mwLatestRevId,
    sha1: null,
    wikitext: article.wikitext,
    fromClassic: true,
  };
}

const BASELINE_SUMMARY = "The page's text before its first recorded revision";

/**
 * Give a page that has text but no revision row one, holding that text, so that overwriting it or judging a
 * collision against it loses nothing: the page's history starts with what WikiOS had. `mwRevId` stamps it when the
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
      origin: CLASSIC_ORIGIN,
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
  const createdAt = beforeHead(rev.timestamp, headRev);
  await db.wikiRevision.createMany({
    data: [
      {
        articleId: article.id,
        source: SOURCE,
        mwRevId: rev.revid,
        author: rev.user ?? DELETED_AUTHOR,
        authorId: null,
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
        origin: CLASSIC_ORIGIN,
      },
    ],
    skipDuplicates: true,
  });
  // The echo is a live revision dated before the head: it records the live revision before it.
  await fillRevisionParents(db, article.id);
  await tagEditor(rev);
}

// ---------------------------------------------------------------------------
// Importing: the importer's write, as the head or as history
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
    leadImageUrl: extractLeadImagePath(rev.wikitext),
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

/** What one inbound revision meets in WikiOS. */
interface PageState {
  rev: MediaWikiRevision;
  canon: CanonicalTitle;
  article: StoredArticle | null;
  headRev: HeadRevision | null;
  head: InboundHead | null;
  /** `rev_sha1` of the revision's parent, when the decision had to fetch it. */
  parentSha1: string | null;
}

/** The importer's input for `rev`, dated `createdAt`; `head` null stores it as history and leaves the head alone. */
function importInput(page: PageState, createdAt: Date, head: ImportedHead | null): ImportPageInput {
  const { rev, canon, article, headRev } = page;
  const byteSize = Buffer.byteLength(rev.wikitext, "utf8");
  // A page created anew has no earlier size to be measured against.
  const previousSize = article?.status === "ARCHIVED" ? 0 : (headRev?.byteSize ?? 0);
  return {
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
        authorId: null,
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
    head,
    // watchlist: importPageRevisions tells the page's watchers (once each until they visit) that its head
    // moved, leaving the editor out; the previous head's reference makes their notification a diff link.
    previousRef: headRev ? toRevisionRef(headRev) : null,
    dryRun: false,
  };
}

/**
 * Import `rev` as the page's new head, counting at `at` (never before the head it replaces). `onHeadApplied`: written
 * in the import's transaction once the revision is the head; with it, a newer save that landed meanwhile makes the
 * import write nothing and throw (`HeadNotAppliedError`).
 */
async function importAsHead(
  page: PageState,
  at: Date,
  onHeadApplied?: ImportPageInput["onHeadApplied"]
): Promise<boolean> {
  const { rev, article, headRev } = page;
  const createdAt = laterThan(at, headRev?.createdAt);
  const input = { ...importInput(page, createdAt, buildHead(rev, createdAt)), onHeadApplied };
  const result = await ArticleRepository.importPageRevisions(input);
  await tagEditor(rev);
  if (result.inserted === 0 && !result.headUpdated) return false;
  if (article?.status === "ARCHIVED") await restoreRecreatedPage(article);
  // The page has new text: the caches that serve its intro and wikitext must not keep the old one.
  await evictCaches(input.title, article?.id);
  return true;
}

/** A page deleted in WikiOS and created again (or edited later) in MediaWiki is back. */
async function restoreRecreatedPage(article: StoredArticle): Promise<void> {
  await db.wikiArticle.update({ where: { id: article.id }, data: { status: "PUBLISHED" } });
}

/** `time`, or just before the head when `time` is not before it: a history entry never sorts as the head. */
function beforeHead(time: Date, headRev: HeadRevision | null): Date {
  return headRev ? new Date(Math.min(time.getTime(), headRev.createdAt.getTime() - 1)) : time;
}

/** An older revision: stored at its own time, as history (never the head, and the head is left as it is). */
async function applyOlder(page: PageState): Promise<RevisionOutcome> {
  const based = await withBaseline(page);
  const input = importInput(based, beforeHead(based.rev.timestamp, based.headRev), null);
  const result = await ArticleRepository.importPageRevisions(input);
  await tagEditor(based.rev);
  return result.inserted === 0 ? "known" : "older";
}

// ---------------------------------------------------------------------------
// Collisions: the conflict rule judges the two saves
// ---------------------------------------------------------------------------

/** The revision the classic edit started from, as the conflict log names a base; null for a page it created. */
function baseRefOf(rev: MediaWikiRevision): string | null {
  return rev.parentid > 0 ? String(rev.parentid) : null;
}

/**
 * The rule's verdict on the classic edit against what WikiOS holds: its head and the revisions since the edit's base,
 * or, for a page WikiOS deleted, that delete. Null when WikiOS holds nothing to judge against.
 */
async function judge(
  page: PageState,
  article: StoredArticle,
  effectiveAt: Date | undefined
): Promise<CollisionVerdict | null> {
  const deletion = article.status === "ARCHIVED" ? await wikiosDeletion(article.id) : null;
  const standing = deletion ?? (await wikiosHead(article.id));
  if (!standing) return null;
  const incoming = await classicChangeOfRevision(page.rev, effectiveAt);
  const standingBranch = deletion
    ? [deletion]
    : await wikiosBranchSince(article.id, page.rev.parentid, page.parentSha1);
  return decideCollision(SOURCE, article.id, {
    incoming,
    standing,
    incomingBranch: [incoming],
    standingBranch,
  });
}

/**
 * The classic edit won: it becomes the page's head (bringing back a page WikiOS had deleted) and its conflict row is
 * written in the same transaction, so nobody is told of an overwrite that did not happen. A WikiOS save that landed
 * after the verdict was read makes the import write nothing and fail (`HeadNotAppliedError`): the cycle holds the
 * revision back and judges it again, against that save, next time.
 */
async function importWinner(
  page: PageState,
  article: StoredArticle,
  verdict: CollisionVerdict
): Promise<RevisionOutcome> {
  const record = async (tx: Prisma.TransactionClient) => {
    await recordConflict(tx, {
      source: SOURCE,
      articleId: article.id,
      title: article.title,
      verdict,
      baseRef: baseRefOf(page.rev),
    });
  };
  return (await importAsHead(page, verdict.winner.at, record)) ? "won" : "known";
}

/**
 * The classic edit lost: kept in the page's history as overwritten (never the head) together with its conflict row,
 * in one transaction. Nothing is queued for MediaWiki: the winner reaches it through its own mirror job.
 */
async function keepOverwritten(
  page: PageState,
  article: StoredArticle,
  verdict: CollisionVerdict
): Promise<RevisionOutcome> {
  const { rev, headRev } = page;
  const byteSize = Buffer.byteLength(rev.wikitext, "utf8");
  const inserted = await db.$transaction(async (tx) => {
    const { count } = await tx.wikiRevision.createMany({
      data: [
        {
          articleId: article.id,
          source: SOURCE,
          mwRevId: rev.revid,
          author: rev.user ?? DELETED_AUTHOR,
          authorId: null,
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
          // An overwritten revision is never a live one's parent; it records the head it did not fit on.
          parentRevisionId: headRev?.id ?? null,
          parked: true,
          parkReason: `overwritten:${verdict.winner.ref}`,
          origin: CLASSIC_ORIGIN,
        },
      ],
      skipDuplicates: true,
    });
    if (count > 0) {
      await recordConflict(tx, {
        source: SOURCE,
        articleId: article.id,
        title: article.title,
        verdict,
        baseRef: baseRefOf(rev),
      });
    }
    return count > 0;
  });
  await tagEditor(rev);
  return inserted ? "overwritten" : "known";
}

// ---------------------------------------------------------------------------
// The decision around one revision
// ---------------------------------------------------------------------------

interface ApplyOptions {
  /** false: a collision is left to the ordered cycle (the webhook and the reader never judge one). */
  judgeCollisions: boolean;
  /** When the revision counts, if not at its own save time (a restore that brought it back). */
  effectiveAt?: Date;
}

/**
 * How the revision relates to a page WikiOS deleted: the mirror's own edit is an echo, an older one history, and a
 * page MediaWiki creates anew comes back; any other edit meets the delete.
 */
function relationOnDeleted(rev: MediaWikiRevision, head: InboundHead | null): InboundRelation {
  if (isMirrorUser(rev.user)) return "echo";
  if (isOlder(head, rev.revid)) return "older";
  return rev.parentid === 0 ? "fast-forward" : "collision";
}

/** What MediaWiki's page was when the edit was made, as far as the inbound rule can tell; with the parent's hash when fetched. */
async function relationFor(
  rev: MediaWikiRevision,
  article: StoredArticle | null,
  head: InboundHead | null
): Promise<{ relation: InboundRelation; parentSha1: string | null }> {
  if (article?.status === "ARCHIVED") {
    return { relation: relationOnDeleted(rev, head), parentSha1: null };
  }
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
  const relation = decideInbound(input);
  // The parent's hash is only worth a request when the cheap checks find a collision.
  if (relation !== "collision" || rev.parentid <= 0) return { relation, parentSha1: null };
  const parentSha1 = await fetchRevisionSha1(rev.parentid);
  return { relation: decideInbound({ ...input, parentSha1 }), parentSha1 };
}

/**
 * The page's text is about to be overwritten, or judged against: a page that has text but no revision row first gets
 * one holding that text, so nothing is lost.
 */
async function withBaseline(page: PageState): Promise<PageState> {
  if (!page.article || !page.head || page.headRev) return page;
  return { ...page, headRev: await insertBaselineRevision(page.article, null) };
}

async function applyCollision(page: PageState, options: ApplyOptions): Promise<RevisionOutcome> {
  const { article } = page;
  if (!options.judgeCollisions || !article) return "deferred";
  const based = await withBaseline(page);
  const verdict = await judge(based, article, options.effectiveAt);
  // Nothing in WikiOS to judge against (a deleted page with no revision and no delete of its own): MediaWiki's stands.
  if (!verdict) return applyFastForward(based, options);
  return verdict.incomingWins
    ? importWinner(based, article, verdict)
    : keepOverwritten(based, article, verdict);
}

async function applyFastForward(page: PageState, options: ApplyOptions): Promise<RevisionOutcome> {
  const based = await withBaseline(page);
  const imported = await importAsHead(based, options.effectiveAt ?? page.rev.timestamp);
  return imported ? "fast-forward" : "known";
}

async function applyEcho(page: PageState): Promise<RevisionOutcome> {
  if (page.article && page.head) await recordEcho(page.article, page.head, page.headRev, page.rev);
  return "echo";
}

const APPLY: Record<
  InboundRelation,
  (page: PageState, options: ApplyOptions) => Promise<RevisionOutcome>
> = {
  echo: applyEcho,
  older: applyOlder,
  "fast-forward": applyFastForward,
  collision: applyCollision,
};

/** Apply a fetched revision that WikiOS does not have yet. */
async function applyRevision(
  rev: MediaWikiRevision,
  options: ApplyOptions
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
  const { relation, parentSha1 } = await relationFor(rev, article, head);
  return APPLY[relation]({ rev, canon, article, headRev, head, parentSha1 }, options);
}

/** Import MediaWiki revision `revid` (a recent-changes entry), unless WikiOS already has it. */
export async function syncRevisionById(revid: number): Promise<RevisionOutcome> {
  if (await isRevisionKnown(revid)) return "known";
  const rev = await fetchRevision(revid);
  if (!rev) return "skipped";
  return applyRevision(rev, { judgeCollisions: true });
}

/**
 * Import the newest revision of a page (the webhook, the reader's import of a missing page, a restore). A collision,
 * or a revision whose parent WikiOS has not seen, is left to the cycle, which applies revisions oldest first and can
 * tell the two apart; only a caller inside the cycle (a restore it applies) passes `judgeCollisions`, since a restored
 * revision never comes through the recent changes again. `effectiveAt`: when the revision counts (a restore's time),
 * if not at its own save time.
 */
export async function syncLatestRevision(
  title: string,
  options: { effectiveAt?: Date; judgeCollisions?: boolean } = {}
): Promise<RevisionOutcome> {
  const rev = await fetchLatestRevision(plainTitle(title));
  if (!rev) return "skipped";
  if (await isRevisionKnown(rev.revid)) return "known";
  return applyRevision(rev, {
    judgeCollisions: options.judgeCollisions ?? false,
    effectiveAt: options.effectiveAt,
  });
}
