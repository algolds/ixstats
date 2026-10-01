/**
 * store.ts — the Prisma implementation of `ApiStore` (plan 410): read-only queries over the WikiOS
 * tables, shaped as the plain rows the api.php modules work with (`store-types.ts`).
 *
 * Nothing here writes: edits, moves, deletions and protections go through the existing services.
 * A deleted (ARCHIVED) page does not exist to api.php.
 *
 * Every page has a `pageId` and every revision a `revId` (prisma/manual-migrations/2026-09-30-wikios-api.sql);
 * a row without one means that SQL has not been applied, which is an error, never a quiet gap.
 */

import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { toRevisionRef } from "~/lib/wiki-os/core/domain-types";
import { isActive } from "~/lib/wiki-os/rights";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import { syntheticUserId } from "./auth-store";
import {
  findLogs,
  listBacklinks,
  listBlocks,
  listEmbeddedIn,
  listImageUsage,
  listCategories,
  listCategoryMembers,
  listPages,
  listProtectedTitles,
  listUsers,
  randomPages,
} from "./store-lists";
import type {
  ApiStore,
  CategoryRow,
  LinkRow,
  PageRestrictionRow,
  PageRow,
  PerPageQuery,
  PerPageResult,
  RevisionBound,
  RevisionQuery,
  RevisionRow,
  SiteStatistics,
} from "./store-types";

const SOURCE = "ixwiki";
const ACTIVE_USER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Pages a bot can see: the ones that are not deleted. A blanked page is still a page (MediaWiki lists it). */
const LIVE_PAGE = { source: SOURCE, status: { not: "ARCHIVED" } } as const;

function missingIds(column: string): Error {
  return new Error(
    `${column} is not populated: apply prisma/manual-migrations/2026-09-30-wikios-api.sql before serving api.php`
  );
}

// ---------------------------------------------------------------------------
// Site and user statistics
// ---------------------------------------------------------------------------

async function statistics(): Promise<SiteStatistics> {
  const since = new Date(Date.now() - ACTIVE_USER_WINDOW_MS);
  const [pages, articles, edits, images, users, active, admins] = await Promise.all([
    db.wikiArticle.count({ where: LIVE_PAGE }),
    db.wikiArticle.count({ where: { ...LIVE_PAGE, namespace: 0, redirectTargetSlug: null } }),
    db.wikiRevision.count({ where: { source: SOURCE, parked: false } }),
    db.wikiArticle.count({ where: { ...LIVE_PAGE, namespace: 6 } }),
    db.wikiAccountLink.count({ where: { source: SOURCE, verifiedAt: { not: null } } }),
    db.wikiRevision.groupBy({ by: ["author"], where: { source: SOURCE, parked: false, createdAt: { gte: since } } }),
    db.wikiUserGroup.count({ where: { group: "sysop" } }),
  ]);
  return { pages, articles, edits, images, users, activeUsers: active.length, admins };
}

async function userStats(internalUserId: string | null, wikiName: string) {
  const [editCount, user] = await Promise.all([
    db.wikiRevision.count({
      where: {
        source: SOURCE,
        parked: false,
        OR: [...(internalUserId ? [{ authorId: internalUserId }] : []), { author: wikiName }],
      },
    }),
    internalUserId
      ? db.user.findUnique({ where: { id: internalUserId }, select: { createdAt: true } })
      : null,
  ]);
  return { editCount, registration: user?.createdAt ?? null };
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const PAGE_SELECT = {
  id: true,
  pageId: true,
  title: true,
  namespace: true,
  redirectTargetSlug: true,
  redirectTargetFragment: true,
  updatedAt: true,
  wordCount: true,
  pageProps: true,
  displayTitle: true,
} as const;

interface HeadRow {
  articleId: string;
  revId: number | null;
  createdAt: Date;
  byteSize: number;
}

/** The newest revision of each article, in one query. */
async function headRevisions(articleIds: readonly string[]): Promise<Map<string, HeadRow>> {
  if (articleIds.length === 0) return new Map();
  const rows = await db.$queryRaw<HeadRow[]>(Prisma.sql`
    SELECT DISTINCT ON ("articleId") "articleId", "revId", "createdAt", "byteSize"
    FROM "wiki_revisions"
    WHERE "articleId" IN (${Prisma.join(articleIds)}) AND "parked" = false
    ORDER BY "articleId", "createdAt" DESC, "revId" DESC`);
  return new Map(rows.map((row) => [row.articleId, row]));
}

type PageArticle = Prisma.WikiArticleGetPayload<{ select: typeof PAGE_SELECT }>;

async function toPageRows(articles: readonly PageArticle[]): Promise<PageRow[]> {
  const heads = await headRevisions(articles.map((article) => article.id));
  return articles.map((article) => {
    if (article.pageId === null) throw missingIds("wiki_articles.pageId");
    const head = heads.get(article.id);
    return {
      articleId: article.id,
      pageId: article.pageId,
      title: article.title,
      namespace: article.namespace,
      isRedirect: article.redirectTargetSlug !== null,
      redirectTitle: article.redirectTargetSlug,
      redirectFragment: article.redirectTargetFragment,
      touched: article.updatedAt,
      wordCount: article.wordCount,
      headRevId: head?.revId ?? null,
      headTimestamp: head?.createdAt ?? null,
      length: head?.byteSize ?? 0,
      pageProps: toPageProps(article.pageProps),
      displayTitle: article.displayTitle,
    };
  });
}

/** The page properties MediaWiki reported, as text values; null when none were stored (an unrendered page). */
function toPageProps(stored: Prisma.JsonValue | null): Record<string, string> | null {
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) return null;
  return Object.fromEntries(Object.entries(stored).map(([name, value]) => [name, String(value ?? "")]));
}

async function pagesByTitle(titles: readonly string[]): Promise<PageRow[]> {
  if (titles.length === 0) return [];
  const articles = await db.wikiArticle.findMany({
    where: { ...LIVE_PAGE, title: { in: [...titles] } },
    select: PAGE_SELECT,
  });
  return toPageRows(articles);
}

async function pagesById(pageIds: readonly number[]): Promise<PageRow[]> {
  if (pageIds.length === 0) return [];
  const articles = await db.wikiArticle.findMany({
    where: { ...LIVE_PAGE, pageId: { in: [...pageIds] } },
    select: PAGE_SELECT,
  });
  return toPageRows(articles);
}

// ---------------------------------------------------------------------------
// Revisions
// ---------------------------------------------------------------------------

const REVISION_SELECT = {
  id: true,
  mwRevId: true,
  revId: true,
  createdAt: true,
  author: true,
  authorId: true,
  summary: true,
  minor: true,
  byteSize: true,
  byteDelta: true,
  sha1: true,
  textDeleted: true,
  commentDeleted: true,
  userDeleted: true,
  article: { select: { id: true, pageId: true, title: true, namespace: true } },
} as const;

type RevisionRecord = Prisma.WikiRevisionGetPayload<{ select: typeof REVISION_SELECT }> & {
  wikitext?: string;
};

/** The previous revision of each revision of its page (0 when it is the first). */
async function parentIds(revIds: readonly number[]): Promise<Map<number, number>> {
  if (revIds.length === 0) return new Map();
  const rows = await db.$queryRaw<Array<{ revId: number; parentId: number | null }>>(Prisma.sql`
    SELECT r."revId" AS "revId",
      (SELECT p."revId" FROM "wiki_revisions" p
        WHERE p."articleId" = r."articleId" AND p."parked" = false
          AND (p."createdAt" < r."createdAt" OR (p."createdAt" = r."createdAt" AND p."revId" < r."revId"))
        ORDER BY p."createdAt" DESC, p."revId" DESC
        LIMIT 1) AS "parentId"
    FROM "wiki_revisions" r
    WHERE r."source" = ${SOURCE} AND r."revId" IN (${Prisma.join(revIds)})`);
  return new Map(rows.map((row) => [row.revId, row.parentId ?? 0]));
}

/** The MediaWiki user id of each author name when a verified link records it. */
async function authorIds(names: readonly string[]): Promise<Map<string, number>> {
  const unique = [...new Set(names)];
  if (unique.length === 0) return new Map();
  const links = await db.wikiAccountLink.findMany({
    where: {
      source: SOURCE,
      username: { in: unique },
      verifiedAt: { not: null },
      wikiUserId: { not: null },
    },
    select: { username: true, wikiUserId: true },
  });
  return new Map(
    links.flatMap((link) => (link.wikiUserId === null ? [] : [[link.username, link.wikiUserId] as const]))
  );
}

/**
 * `rev_sha1` of a legacy row that has none, from the text when the query already read it (never a
 * read made for the hash): null otherwise, and for a revision whose text is deleted.
 */
function hashOfText(record: RevisionRecord): string | null {
  return record.wikitext !== undefined && !record.textDeleted ? mwSha1Base36(record.wikitext) : null;
}

async function toRevisionRows(records: readonly RevisionRecord[]): Promise<RevisionRow[]> {
  if (records.length === 0) return [];
  const revIds = records.map((record) => {
    if (record.revId === null) throw missingIds("wiki_revisions.revId");
    return record.revId;
  });
  const [parents, heads, mwIds] = await Promise.all([
    parentIds(revIds),
    headRevisions([...new Set(records.map((record) => record.article.id))]),
    authorIds(records.flatMap((record) => (record.author ? [record.author] : []))),
  ]);
  return records.map((record) => {
    const { article } = record;
    if (article.pageId === null) throw missingIds("wiki_articles.pageId");
    const revId = record.revId!;
    const userId = record.author
      ? (mwIds.get(record.author) ?? (record.authorId ? syntheticUserId(record.authorId) : 0))
      : 0;
    return {
      revId,
      ref: toRevisionRef({ id: record.id, mwRevId: record.mwRevId }),
      parentId: parents.get(revId) ?? 0,
      pageId: article.pageId,
      title: article.title,
      namespace: article.namespace,
      timestamp: record.createdAt,
      user: record.author,
      userId,
      comment: record.summary,
      minor: record.minor,
      size: record.byteSize,
      sizeDiff: record.byteDelta,
      sha1: record.sha1 ?? hashOfText(record),
      content: record.textDeleted ? null : (record.wikitext ?? null),
      textHidden: record.textDeleted,
      commentHidden: record.commentDeleted,
      userHidden: record.userDeleted,
      isHead: heads.get(article.id)?.revId === revId,
    };
  });
}

async function revisionsById(
  revIds: readonly number[],
  withContent: boolean
): Promise<RevisionRow[]> {
  if (revIds.length === 0) return [];
  const records = await db.wikiRevision.findMany({
    where: { source: SOURCE, parked: false, revId: { in: [...revIds] }, article: { status: { not: "ARCHIVED" } } },
    select: { ...REVISION_SELECT, ...(withContent ? { wikitext: true } : {}) },
  });
  const rows = await toRevisionRows(records);
  const order = new Map(revIds.map((id, index) => [id, index]));
  return rows.sort((a, b) => (order.get(a.revId) ?? 0) - (order.get(b.revId) ?? 0));
}

async function revisionByRowId(rowId: string): Promise<RevisionRow | null> {
  const record = await db.wikiRevision.findFirst({ where: { id: rowId, parked: false }, select: REVISION_SELECT });
  return record ? ((await toRevisionRows([record]))[0] ?? null) : null;
}

async function revisionCountOf(title: string): Promise<number> {
  return db.wikiRevision.count({ where: { source: SOURCE, parked: false, article: { title } } });
}

async function pageHtml(articleId: string): Promise<{ html: string | null; fresh: boolean } | null> {
  const row = await db.wikiArticle.findUnique({
    where: { id: articleId },
    select: { contentHtml: true, htmlSyncedAt: true },
  });
  return row ? { html: row.contentHtml, fresh: row.htmlSyncedAt !== null } : null;
}

/** `createdAt` / `revId` at or beyond `bound` on `side` (`gte` = at or after it, `lte` = at or before it). */
function revisionBoundWhere(
  side: "gte" | "lte",
  bound: RevisionBound
): Prisma.WikiRevisionWhereInput {
  const strict = side === "gte" ? "gt" : "lt";
  return bound.revId === undefined
    ? { createdAt: { [side]: bound.timestamp } }
    : {
        OR: [
          { createdAt: { [strict]: bound.timestamp } },
          { createdAt: bound.timestamp, revId: { [side]: bound.revId } },
        ],
      };
}

function revisionWhere(query: RevisionQuery): Prisma.WikiRevisionWhereInput {
  const newer = query.dir === "newer";
  const [fromSide, toSide] = newer ? (["gte", "lte"] as const) : (["lte", "gte"] as const);
  const and: Prisma.WikiRevisionWhereInput[] = [];
  if (query.from) and.push(revisionBoundWhere(fromSide, query.from));
  if (query.to) and.push(revisionBoundWhere(toSide, query.to));
  if (query.cursor) and.push(revisionBoundWhere(fromSide, query.cursor));
  if (query.excludeUser) {
    and.push({ OR: [{ author: null }, { author: { not: query.excludeUser } }] });
  }
  return {
    source: SOURCE,
    // A parked revision (a MediaWiki edit that never went live in WikiOS) is not part of the page's history here.
    parked: false,
    ...(query.articleId ? { articleId: query.articleId } : {}),
    ...(query.users ? { author: { in: [...query.users] } } : {}),
    ...(query.minor === undefined ? {} : { minor: query.minor }),
    article: {
      status: { not: "ARCHIVED" },
      ...(query.namespaces ? { namespace: { in: [...query.namespaces] } } : {}),
    },
    ...(and.length > 0 ? { AND: and } : {}),
  };
}

async function findRevisions(query: RevisionQuery): Promise<RevisionRow[]> {
  const direction = query.dir === "newer" ? "asc" : "desc";
  const records = await db.wikiRevision.findMany({
    where: revisionWhere(query),
    orderBy: [{ createdAt: direction }, { revId: direction }],
    take: query.limit + 1,
    select: { ...REVISION_SELECT, ...(query.withContent ? { wikitext: true } : {}) },
  });
  return toRevisionRows(records);
}

// ---------------------------------------------------------------------------
// Restrictions, links, categories, text
// ---------------------------------------------------------------------------

async function restrictionsByTitle(
  titles: readonly string[]
): Promise<Map<string, PageRestrictionRow[]>> {
  const result = new Map<string, PageRestrictionRow[]>();
  if (titles.length === 0) return result;
  const rows = await db.wikiRestriction.findMany({
    where: { source: SOURCE, title: { in: [...titles] } },
    select: { title: true, action: true, level: true, expiresAt: true },
  });
  const now = new Date();
  for (const row of rows.filter((candidate) => isActive(candidate.expiresAt, now))) {
    const list = result.get(row.title) ?? [];
    list.push({ action: row.action, level: row.level, expiresAt: row.expiresAt });
    result.set(row.title, list);
  }
  return result;
}

const slugToTitle = (slug: string) => canonicalizeTitle(slug.replace(/_/g, " "))?.title ?? slug;

/** The title of a link whose target may not exist: the page's own title, else the text it was written as, else its slug. */
function linkTitle(link: {
  targetSlug: string;
  anchorText: string | null;
  targetArticle: { title: string } | null;
}): string {
  if (link.targetArticle) return link.targetArticle.title;
  const written = link.anchorText ? canonicalizeTitle(link.anchorText) : null;
  return written?.slug === link.targetSlug ? written.title : slugToTitle(link.targetSlug);
}

/** The links on the first row to return (`cursor`) and after it, in the listing's direction. */
function linkCursorWhere(query: PerPageQuery): Prisma.WikiLinkWhereInput {
  const { cursor, dir } = query;
  if (!cursor) return {};
  const [strict, loose] = dir === "ascending" ? (["gt", "gte"] as const) : (["lt", "lte"] as const);
  return {
    OR: [
      { sourceArticle: { pageId: { [strict]: cursor.pageId } } },
      { sourceArticle: { pageId: cursor.pageId }, targetSlug: { [loose]: cursor.key } },
    ],
  };
}

async function linksFrom(query: PerPageQuery): Promise<PerPageResult<LinkRow>> {
  if (query.articleIds.length === 0) return { rows: [], next: null };
  const direction = query.dir === "ascending" ? "asc" : "desc";
  const targetSlugs = query.titles?.flatMap((title) => canonicalizeTitle(title)?.slug ?? []);
  const fetched = await db.wikiLink.findMany({
    where: {
      sourceArticleId: { in: [...query.articleIds] },
      isExternal: false,
      ...(targetSlugs ? { targetSlug: { in: targetSlugs } } : {}),
      ...linkCursorWhere(query),
    },
    orderBy: [{ sourceArticle: { pageId: direction } }, { targetSlug: direction }],
    take: query.limit + 1,
    select: {
      targetSlug: true,
      anchorText: true,
      sourceArticle: { select: { pageId: true } },
      targetArticle: { select: { title: true, namespace: true } },
    },
  });
  const rows = fetched.slice(0, query.limit).flatMap((link) => {
    if (link.sourceArticle.pageId === null) throw missingIds("wiki_articles.pageId");
    const title = linkTitle(link);
    const namespace = link.targetArticle?.namespace ?? canonicalizeTitle(title)?.namespaceId ?? 0;
    if (query.namespaces && !query.namespaces.includes(namespace)) return [];
    return [{ pageId: link.sourceArticle.pageId, title, namespace }];
  });
  // A page can link to one target from several sections: list the target once.
  const unique = rows.filter(
    (row, index) => rows.findIndex((r) => r.pageId === row.pageId && r.title === row.title) === index
  );
  const next = fetched[query.limit];
  return {
    rows: unique,
    next:
      next && next.sourceArticle.pageId !== null
        ? { pageId: next.sourceArticle.pageId, key: next.targetSlug }
        : null,
  };
}

function categoryCursorWhere(query: PerPageQuery): Prisma.WikiCategoryMemberWhereInput {
  const { cursor, dir } = query;
  if (!cursor) return {};
  const [strict, loose] = dir === "ascending" ? (["gt", "gte"] as const) : (["lt", "lte"] as const);
  return {
    OR: [
      { article: { pageId: { [strict]: cursor.pageId } } },
      { article: { pageId: cursor.pageId }, category: { name: { [loose]: cursor.key } } },
    ],
  };
}

async function categoriesOf(
  query: PerPageQuery & { hidden?: boolean }
): Promise<PerPageResult<CategoryRow>> {
  if (query.articleIds.length === 0) return { rows: [], next: null };
  const direction = query.dir === "ascending" ? "asc" : "desc";
  const names = query.titles?.flatMap((title) => {
    const canon = canonicalizeTitle(title);
    return canon?.namespaceId === 14 ? [canon.base] : [];
  });
  const fetched = await db.wikiCategoryMember.findMany({
    where: {
      articleId: { in: [...query.articleIds] },
      ...(names || query.hidden !== undefined
        ? { category: { ...(names ? { name: { in: names } } : {}), ...(query.hidden === undefined ? {} : { hidden: query.hidden }) } }
        : {}),
      ...categoryCursorWhere(query),
    },
    orderBy: [{ article: { pageId: direction } }, { category: { name: direction } }],
    take: query.limit + 1,
    select: {
      sortKey: true,
      createdAt: true,
      category: { select: { name: true, hidden: true } },
      article: { select: { pageId: true } },
    },
  });
  const rows = fetched.slice(0, query.limit).map((member) => {
    if (member.article.pageId === null) throw missingIds("wiki_articles.pageId");
    return {
      pageId: member.article.pageId,
      title: `Category:${member.category.name}`,
      sortKey: member.sortKey,
      timestamp: member.createdAt,
      hidden: member.category.hidden,
    };
  });
  const next = fetched[query.limit];
  return {
    rows,
    next:
      next && next.article.pageId !== null
        ? { pageId: next.article.pageId, key: next.category.name }
        : null,
  };
}

/** The first row to return (`cursor`) and after it, for a listing across pages ordered by (page id, `key`). */
function perPageCursorWhere<K extends string>(
  query: PerPageQuery,
  key: K
): { OR: Array<Record<string, unknown>> } | Record<string, never> {
  const { cursor, dir } = query;
  if (!cursor) return {};
  const [strict, loose] = dir === "ascending" ? (["gt", "gte"] as const) : (["lt", "lte"] as const);
  return {
    OR: [
      { article: { pageId: { [strict]: cursor.pageId } } },
      { article: { pageId: cursor.pageId }, [key]: { [loose]: cursor.key } },
    ],
  };
}

async function templatesOf(query: PerPageQuery): Promise<PerPageResult<LinkRow>> {
  if (query.articleIds.length === 0) return { rows: [], next: null };
  const direction = query.dir === "ascending" ? "asc" : "desc";
  const titles = query.titles?.flatMap((title) => canonicalizeTitle(title)?.title ?? []);
  const fetched = await db.wikiTemplateLink.findMany({
    where: {
      articleId: { in: [...query.articleIds] },
      ...(titles ? { templateTitle: { in: titles } } : {}),
      ...perPageCursorWhere(query, "templateTitle"),
    },
    orderBy: [{ article: { pageId: direction } }, { templateTitle: direction }],
    take: query.limit + 1,
    select: { templateTitle: true, article: { select: { pageId: true } } },
  });
  const rows = fetched.slice(0, query.limit).flatMap((link) => {
    if (link.article.pageId === null) throw missingIds("wiki_articles.pageId");
    const namespace = canonicalizeTitle(link.templateTitle)?.namespaceId ?? 0;
    if (query.namespaces && !query.namespaces.includes(namespace)) return [];
    return [{ pageId: link.article.pageId, title: link.templateTitle, namespace }];
  });
  const next = fetched[query.limit];
  return {
    rows,
    next: next && next.article.pageId !== null ? { pageId: next.article.pageId, key: next.templateTitle } : null,
  };
}

async function imagesOf(query: PerPageQuery): Promise<PerPageResult<LinkRow>> {
  if (query.articleIds.length === 0) return { rows: [], next: null };
  if (query.namespaces && !query.namespaces.includes(6)) return { rows: [], next: null };
  const direction = query.dir === "ascending" ? "asc" : "desc";
  const names = query.titles?.flatMap((title) => {
    const canon = canonicalizeTitle(title);
    return canon?.namespaceId === 6 ? [canon.base] : [];
  });
  const fetched = await db.wikiImageLink.findMany({
    where: {
      articleId: { in: [...query.articleIds] },
      ...(names ? { fileName: { in: names } } : {}),
      ...perPageCursorWhere(query, "fileName"),
    },
    orderBy: [{ article: { pageId: direction } }, { fileName: direction }],
    take: query.limit + 1,
    select: { fileName: true, article: { select: { pageId: true } } },
  });
  const rows = fetched.slice(0, query.limit).map((link) => {
    if (link.article.pageId === null) throw missingIds("wiki_articles.pageId");
    return { pageId: link.article.pageId, title: `File:${link.fileName}`, namespace: 6 };
  });
  const next = fetched[query.limit];
  return {
    rows,
    next: next && next.article.pageId !== null ? { pageId: next.article.pageId, key: next.fileName } : null,
  };
}

async function hiddenCategoryNames(names: readonly string[]): Promise<Set<string>> {
  if (names.length === 0) return new Set();
  const rows = await db.wikiCategory.findMany({
    where: { name: { in: [...names] }, hidden: true },
    select: { name: true },
  });
  return new Set(rows.map((row) => row.name));
}

async function wikitextByArticle(
  articleIds: readonly string[],
  maxChars?: number
): Promise<Map<string, string>> {
  if (articleIds.length === 0) return new Map();
  if (maxChars !== undefined) {
    // Prisma binds a JS number as bigint, and Postgres has no left(text, bigint): cast it.
    const rows = await db.$queryRaw<Array<{ id: string; wikitext: string }>>(Prisma.sql`
      SELECT "id", left("wikitext", ${maxChars}::int) AS "wikitext"
      FROM "wiki_articles"
      WHERE "id" IN (${Prisma.join(articleIds)})`);
    return new Map(rows.map((row) => [row.id, row.wikitext]));
  }
  const rows = await db.wikiArticle.findMany({
    where: { id: { in: [...articleIds] } },
    select: { id: true, wikitext: true },
  });
  return new Map(rows.map((row) => [row.id, row.wikitext]));
}

export const prismaApiStore: ApiStore = {
  statistics,
  userStats,
  pagesByTitle,
  pagesById,
  revisionsById,
  findRevisions,
  revisionByRowId,
  revisionCountOf,
  pageHtml,
  restrictionsByTitle,
  linksFrom,
  categoriesOf,
  templatesOf,
  imagesOf,
  hiddenCategoryNames,
  wikitextByArticle,
  listPages,
  listCategoryMembers,
  listBacklinks,
  listEmbeddedIn,
  listImageUsage,
  randomPages,
  listCategories,
  findLogs,
  listUsers,
  listBlocks,
  listProtectedTitles,
};
