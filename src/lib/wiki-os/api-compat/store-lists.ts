/**
 * store-lists.ts — the listing queries of the Prisma `ApiStore` (plan 410): allpages, category
 * members, backlinks, random pages, categories, log events, users, blocks and protected titles.
 * Read-only, like the rest of the store (see store.ts).
 */

import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { RightsAdminService } from "~/lib/wiki-os/core/rights-admin-service";
import { toArticleSlug } from "~/lib/wiki-os/core/domain-types";
import { isActive } from "~/lib/wiki-os/rights";
import { syntheticUserId } from "./auth-store";
import type {
  BacklinkQuery,
  BlockListRow,
  CategoryListQuery,
  CategoryMemberQuery,
  CategoryMemberRow,
  CategorySummaryRow,
  ListPagesQuery,
  LogQuery,
  LogRow,
  PageListRow,
  ProtectedTitleQuery,
  ProtectedTitleRow,
  RandomPagesQuery,
  UserListQuery,
  UserListRow,
} from "./store-types";

const SOURCE = "ixwiki";
const LIVE_PAGE = { source: SOURCE, status: { not: "ARCHIVED" } } as const;
const FILE_NAMESPACE = 6;
const CATEGORY_NAMESPACE = 14;

function missingPageId(): Error {
  return new Error(
    "wiki_articles.pageId is not populated: apply prisma/manual-migrations/2026-09-30-wikios-api.sql before serving api.php"
  );
}

const redirectWhere = (filter: "all" | "redirects" | "nonredirects"): Prisma.WikiArticleWhereInput =>
  filter === "redirects"
    ? { redirectTargetSlug: { not: null } }
    : filter === "nonredirects"
      ? { redirectTargetSlug: null }
      : {};

const redirectSql = (filter: "all" | "redirects" | "nonredirects"): Prisma.Sql =>
  filter === "redirects"
    ? Prisma.sql`AND a."redirectTargetSlug" IS NOT NULL`
    : filter === "nonredirects"
      ? Prisma.sql`AND a."redirectTargetSlug" IS NULL`
      : Prisma.empty;

// ---------------------------------------------------------------------------
// allpages, backlinks, random
// ---------------------------------------------------------------------------

type ListedArticle = { pageId: number | null; title: string; namespace: number; redirectTargetSlug: string | null };
const LIST_SELECT = { pageId: true, title: true, namespace: true, redirectTargetSlug: true } as const;

function toListRow(article: ListedArticle): PageListRow {
  if (article.pageId === null) throw missingPageId();
  return {
    pageId: article.pageId,
    title: article.title,
    namespace: article.namespace,
    isRedirect: article.redirectTargetSlug !== null,
  };
}

export async function listPages(query: ListPagesQuery): Promise<PageListRow[]> {
  const ascending = query.dir === "ascending";
  const [lower, upper] = ascending ? [query.start, query.end] : [query.end, query.start];
  const rows = await db.wikiArticle.findMany({
    where: {
      ...LIVE_PAGE,
      namespace: query.namespace,
      title: {
        ...(query.prefix ? { startsWith: query.prefix } : {}),
        ...(lower ? { gte: lower } : {}),
        ...(upper ? { lte: upper } : {}),
      },
      ...redirectWhere(query.filterRedirects),
    },
    orderBy: { title: ascending ? "asc" : "desc" },
    take: query.limit + 1,
    select: LIST_SELECT,
  });
  return rows.map(toListRow);
}

/** Pages in page id order that match `relation`, from `query.cursor`, with the query's namespace and redirect filters. */
async function listRelatedPages(relation: Prisma.WikiArticleWhereInput, query: BacklinkQuery): Promise<PageListRow[]> {
  const rows = await db.wikiArticle.findMany({
    where: {
      ...LIVE_PAGE,
      ...relation,
      ...(query.namespaces ? { namespace: { in: [...query.namespaces] } } : {}),
      ...(query.cursor === undefined ? {} : { pageId: { gte: query.cursor } }),
      ...redirectWhere(query.filterRedirects),
    },
    orderBy: { pageId: "asc" },
    take: query.limit + 1,
    select: LIST_SELECT,
  });
  return rows.map(toListRow);
}

export async function listBacklinks(query: BacklinkQuery): Promise<PageListRow[]> {
  const target = canonicalizeTitle(query.target);
  if (!target) return [];
  return listRelatedPages({ outgoingLinks: { some: { targetSlug: target.slug, isExternal: false } } }, query);
}

/** Pages that transclude a template (or a Lua module through #invoke), from the last render of each. */
export async function listEmbeddedIn(query: BacklinkQuery): Promise<PageListRow[]> {
  const target = canonicalizeTitle(query.target);
  if (!target) return [];
  return listRelatedPages({ templateLinks: { some: { templateTitle: target.title } } }, query);
}

/** Pages that use a file, from the last render of each. */
export async function listImageUsage(query: BacklinkQuery): Promise<PageListRow[]> {
  const target = canonicalizeTitle(query.target);
  if (!target || target.namespaceId !== FILE_NAMESPACE) return [];
  return listRelatedPages({ imageLinks: { some: { fileName: target.base } } }, query);
}

export async function randomPages(query: RandomPagesQuery): Promise<PageListRow[]> {
  const rows = await db.$queryRaw<ListedArticle[]>(Prisma.sql`
    SELECT a."pageId", a."title", a."namespace", a."redirectTargetSlug"
    FROM "wiki_articles" a
    WHERE a."source" = ${SOURCE} AND a."status" <> 'ARCHIVED'
      AND a."namespace" IN (${Prisma.join(query.namespaces)})
      ${redirectSql(query.filterRedirects)}
    ORDER BY random()
    LIMIT ${query.limit}`);
  return rows.map(toListRow);
}

/**
 * Page titles that start with or hold `query` (case-insensitive), main namespace, in title order.
 * Selects the title only: a title search never reads a page's text.
 */
export async function searchTitles(query: string, limit: number, offset: number): Promise<string[]> {
  const rows = await db.wikiArticle.findMany({
    where: {
      ...LIVE_PAGE,
      namespace: 0,
      title: { contains: query, mode: "insensitive" },
    },
    orderBy: { title: "asc" },
    skip: offset,
    take: limit,
    select: { title: true },
  });
  return rows.map((row) => row.title);
}

// ---------------------------------------------------------------------------
// categorymembers
// ---------------------------------------------------------------------------

/** The namespaces a `cmtype` selection means: files are File:, subcategories Category:, pages the rest. */
function memberTypeSql(types: CategoryMemberQuery["types"]): Prisma.Sql {
  const parts = types.map((type) =>
    type === "file"
      ? Prisma.sql`a."namespace" = ${FILE_NAMESPACE}`
      : type === "subcat"
        ? Prisma.sql`a."namespace" = ${CATEGORY_NAMESPACE}`
        : Prisma.sql`a."namespace" NOT IN (${FILE_NAMESPACE}, ${CATEGORY_NAMESPACE})`
  );
  return parts.length === 0 || parts.length === 3 ? Prisma.empty : Prisma.sql`AND (${Prisma.join(parts, " OR ")})`;
}

interface MemberRecord {
  pageId: number | null;
  title: string;
  namespace: number;
  redirectTargetSlug: string | null;
  sortKey: string | null;
  sortValue: string;
  addedAt: Date;
}

export async function listCategoryMembers(query: CategoryMemberQuery): Promise<CategoryMemberRow[]> {
  const category = canonicalizeTitle(query.category);
  if (!category) return [];
  const ascending = query.dir === "ascending";
  const order = Prisma.raw(ascending ? "ASC" : "DESC");
  const byTime = query.sort === "timestamp";
  // MediaWiki sorts a category by the upper-cased sort key ("uppercase" collation), the title when there is none.
  const sortExpr = byTime ? Prisma.sql`m."createdAt"` : Prisma.sql`UPPER(COALESCE(m."sortKey", a."title"))`;
  const [lower, upper] = ascending ? [query.start, query.end] : [query.end, query.start];
  const cursorValue = query.cursor ? (byTime ? new Date(query.cursor.sortValue) : query.cursor.sortValue) : null;
  const rows = await db.$queryRaw<MemberRecord[]>(Prisma.sql`
    SELECT a."pageId", a."title", a."namespace", a."redirectTargetSlug", m."sortKey",
           ${byTime ? Prisma.sql`m."createdAt"::text` : sortExpr} AS "sortValue", m."createdAt" AS "addedAt"
    FROM "wiki_category_members" m
    JOIN "wiki_articles" a ON a."id" = m."articleId"
    JOIN "wiki_categories" c ON c."id" = m."categoryId"
    WHERE c."slug" = ${toArticleSlug(category.base)} AND a."source" = ${SOURCE} AND a."status" <> 'ARCHIVED'
      ${query.namespaces ? Prisma.sql`AND a."namespace" IN (${Prisma.join(query.namespaces)})` : Prisma.empty}
      ${memberTypeSql(query.types)}
      ${byTime && lower ? Prisma.sql`AND m."createdAt" >= ${lower}` : Prisma.empty}
      ${byTime && upper ? Prisma.sql`AND m."createdAt" <= ${upper}` : Prisma.empty}
      ${
        query.cursor && cursorValue !== null
          ? ascending
            ? Prisma.sql`AND (${sortExpr}, a."pageId") >= (${cursorValue}, ${query.cursor.pageId})`
            : Prisma.sql`AND (${sortExpr}, a."pageId") <= (${cursorValue}, ${query.cursor.pageId})`
          : Prisma.empty
      }
    ORDER BY ${sortExpr} ${order}, a."pageId" ${order}
    LIMIT ${query.limit + 1}`);
  return rows.map((row) => ({
    ...toListRow(row),
    sortKey: row.sortKey,
    sortValue: byTime ? row.addedAt.toISOString() : row.sortValue,
    addedAt: row.addedAt,
  }));
}

// ---------------------------------------------------------------------------
// allcategories
// ---------------------------------------------------------------------------

export async function listCategories(query: CategoryListQuery): Promise<CategorySummaryRow[]> {
  const ascending = query.dir === "ascending";
  const [lower, upper] = ascending ? [query.start, query.end] : [query.end, query.start];
  // One row per category name (two categories may differ only in their slug), counting the members
  // that are not deleted pages; a name is never split across two pages of the listing.
  const rows = await db.$queryRaw<Array<{ name: string; members: bigint; hidden: boolean }>>(Prisma.sql`
    SELECT c."name" AS "name", COUNT(m."id") AS "members", bool_or(c."hidden") AS "hidden"
    FROM "wiki_categories" c
    JOIN "wiki_category_members" m ON m."categoryId" = c."id"
    JOIN "wiki_articles" a ON a."id" = m."articleId"
    WHERE a."source" = ${SOURCE} AND a."status" <> 'ARCHIVED'
      ${query.prefix ? Prisma.sql`AND starts_with(c."name", ${query.prefix})` : Prisma.empty}
      ${lower ? Prisma.sql`AND c."name" >= ${lower}` : Prisma.empty}
      ${upper ? Prisma.sql`AND c."name" <= ${upper}` : Prisma.empty}
    GROUP BY c."name"
    ORDER BY c."name" ${Prisma.raw(ascending ? "ASC" : "DESC")}
    LIMIT ${query.limit + 1}`);
  return rows.map((row) => ({ name: row.name, members: Number(row.members), hidden: row.hidden }));
}

// ---------------------------------------------------------------------------
// logevents
// ---------------------------------------------------------------------------

/** Log entries at or after `ts` (and at `id` or beyond when given) on `side`. */
function logBoundWhere(
  side: "gte" | "lte",
  ts: Date,
  logId?: number
): Prisma.WikiLogWhereInput {
  const strict = side === "gte" ? "gt" : "lt";
  return logId === undefined
    ? { createdAt: { [side]: ts } }
    : { OR: [{ createdAt: { [strict]: ts } }, { createdAt: ts, logId: { [side]: logId } }] };
}

export async function findLogs(query: LogQuery): Promise<LogRow[]> {
  const newer = query.dir === "newer";
  const [fromSide, toSide] = newer ? (["gte", "lte"] as const) : (["lte", "gte"] as const);
  const and: Prisma.WikiLogWhereInput[] = [];
  if (query.from) and.push(logBoundWhere(fromSide, query.from));
  if (query.to) and.push(logBoundWhere(toSide, query.to));
  if (query.cursor) and.push(logBoundWhere(fromSide, query.cursor.timestamp, query.cursor.logId));
  if (query.titlePrefix) and.push({ title: { startsWith: query.titlePrefix } });
  if (query.excludeUser) and.push({ NOT: { actorName: query.excludeUser } });
  const direction = newer ? "asc" : "desc";
  const rows = await db.wikiLog.findMany({
    where: {
      logId: { not: null },
      ...(query.type ? { logType: query.type } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.title ? { title: query.title } : {}),
      ...(query.user ? { actorName: query.user } : {}),
      ...(and.length > 0 ? { AND: and } : {}),
    },
    orderBy: [{ createdAt: direction }, { logId: direction }],
    take: query.limit + 1,
    select: {
      logId: true,
      logType: true,
      action: true,
      title: true,
      actorName: true,
      comment: true,
      params: true,
      createdAt: true,
      article: { select: { pageId: true } },
    },
  });
  return rows.map((row) => ({
    logId: row.logId!,
    type: row.logType,
    action: row.action,
    title: row.title,
    namespace: canonicalizeTitle(row.title)?.namespaceId ?? 0,
    pageId: row.article?.pageId ?? 0,
    actor: row.actorName,
    comment: row.comment,
    params: (row.params ?? null) as LogRow["params"],
    timestamp: row.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// allusers, blocks, protected titles
// ---------------------------------------------------------------------------

/** The user ids and wiki names holding `group` explicitly (not expired). */
async function groupMembers(group: string): Promise<{ ids: string[]; names: string[] }> {
  const rows = await db.wikiUserGroup.findMany({
    where: { group },
    select: { userId: true, wikiUsername: true, expiresAt: true },
    take: 5000,
  });
  const now = new Date();
  const live = rows.filter((row) => isActive(row.expiresAt, now));
  return {
    ids: live.flatMap((row) => row.userId ?? []),
    names: live.flatMap((row) => row.wikiUsername ?? []),
  };
}

const memberFilter = ({ ids, names }: { ids: string[]; names: string[] }): Prisma.WikiAccountLinkWhereInput => ({
  OR: [{ userId: { in: ids } }, { username: { in: names } }],
});

export async function listUsers(query: UserListQuery): Promise<UserListRow[]> {
  const ascending = query.dir === "ascending";
  const [lower, upper] = ascending ? [query.start, query.end] : [query.end, query.start];
  const and: Prisma.WikiAccountLinkWhereInput[] = [];
  if (query.group) and.push(memberFilter(await groupMembers(query.group)));
  if (query.excludeGroup) and.push({ NOT: memberFilter(await groupMembers(query.excludeGroup)) });

  const links = await db.wikiAccountLink.findMany({
    where: {
      source: SOURCE,
      verifiedAt: { not: null },
      username: {
        ...(query.prefix ? { startsWith: query.prefix } : {}),
        ...(lower ? { gte: lower } : {}),
        ...(upper ? { lte: upper } : {}),
      },
      ...(and.length > 0 ? { AND: and } : {}),
    },
    orderBy: { username: ascending ? "asc" : "desc" },
    take: query.limit + 1,
    select: { username: true, userId: true, wikiUserId: true, user: { select: { createdAt: true } } },
  });
  const names = links.map((link) => link.username);
  const ids = links.map((link) => link.userId);
  const [groups, edits] = await Promise.all([
    links.length === 0
      ? []
      : db.wikiUserGroup.findMany({
          where: { OR: [{ userId: { in: ids } }, { wikiUsername: { in: names } }] },
          select: { userId: true, wikiUsername: true, group: true, expiresAt: true },
          // Several rows per user: more than the guard's default 1000 for a full page of users.
          take: 50_000,
        }),
    query.withEditCount && links.length > 0
      ? db.wikiRevision.groupBy({
          by: ["author"],
          where: { source: SOURCE, parked: false, author: { in: names } },
          _count: { _all: true },
        })
      : [],
  ]);
  const now = new Date();
  const editCounts = new Map(edits.flatMap((row) => (row.author ? [[row.author, row._count._all] as const] : [])));
  return links.map((link) => ({
    name: link.username,
    userId: link.wikiUserId ?? syntheticUserId(link.userId),
    registration: link.user.createdAt,
    editCount: editCounts.get(link.username) ?? 0,
    groups: groups
      .filter(
        (row) =>
          (row.userId === link.userId || row.wikiUsername === link.username) && isActive(row.expiresAt, now)
      )
      .map((row) => row.group),
  }));
}

export async function listBlocks(
  limit: number,
  cursor?: string
): Promise<{ blocks: BlockListRow[]; nextCursor: string | null }> {
  return RightsAdminService.listBlocks(limit, cursor);
}

export async function listProtectedTitles(query: ProtectedTitleQuery): Promise<ProtectedTitleRow[]> {
  const newer = query.dir === "newer";
  const [fromSide, toSide] = newer ? (["gte", "lte"] as const) : (["lte", "gte"] as const);
  const strict = newer ? "gt" : "lt";
  const direction = newer ? "asc" : "desc";
  const now = new Date();
  const and: Prisma.WikiRestrictionWhereInput[] = [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }];
  if (query.from) and.push({ createdAt: { [fromSide]: query.from } });
  if (query.to) and.push({ createdAt: { [toSide]: query.to } });
  if (query.cursor) {
    and.push({
      OR: [
        { createdAt: { [strict]: query.cursor.timestamp } },
        { createdAt: query.cursor.timestamp, id: { [fromSide]: query.cursor.id } },
      ],
    });
  }
  const rows = await db.wikiRestriction.findMany({
    where: { source: SOURCE, action: "create", ...(query.level ? { level: query.level } : {}), AND: and },
    orderBy: [{ createdAt: direction }, { id: direction }],
    take: query.limit + 1,
    select: { id: true, title: true, level: true, createdAt: true, reason: true, expiresAt: true, setById: true },
  });
  // A title that has a page is protected from editing, not creation: only missing titles are listed.
  const existing = new Set(
    rows.length === 0
      ? []
      : (
          await db.wikiArticle.findMany({
            where: { ...LIVE_PAGE, title: { in: rows.map((row) => row.title) } },
            select: { title: true },
          })
        ).map((row) => row.title)
  );
  const names = await RightsAdminService.displayNames(rows.flatMap((row) => row.setById ?? []));
  return rows
    .filter((row) => !existing.has(row.title))
    .map((row) => ({
      id: row.id,
      title: row.title,
      namespace: canonicalizeTitle(row.title)?.namespaceId ?? 0,
      level: row.level,
      timestamp: row.createdAt,
      user: (row.setById && names.get(row.setById)) || null,
      comment: row.reason,
      expiresAt: row.expiresAt,
    }))
    .filter((row) => !query.namespaces || query.namespaces.includes(row.namespace));
}
