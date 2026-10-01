/**
 * category-service.ts — WikiOS Native Category Hierarchy (DAG) Engine
 *
 * Manages category creation, subcategory trees, and member lookups via PostgreSQL.
 */

import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { toArticleSlug } from "./domain-types";
import { canonicalizeTitle } from "./title";

export interface CategoryTreeItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  memberCount: number;
  subcategories: CategoryTreeItem[];
}

/** A category an article is in, as the render reports it (`categories` of `action=parse`). */
export interface RenderedCategory {
  /** The category's name without "Category:" (underscores or spaces). */
  name: string;
  /** The sort key given for this article ([[Category:X|key]] or {{DEFAULTSORT}}); null when none. */
  sortKey: string | null;
  /** MediaWiki hides the category (__HIDDENCAT__): it is not shown on the article. */
  hidden: boolean;
}

/** A category page lists this many members; the next page starts where `CategoryMemberPage.next` says. */
export const CATEGORY_PAGE_SIZE = 200;

export interface CategoryMember {
  /** The member's full title, namespace prefix included. */
  title: string;
  namespace: number;
}

/**
 * A position in a category's member list: the last member shown. The next page starts strictly after
 * it in (sort key, title) order, so members that share a sort key are neither repeated nor skipped.
 */
export interface CategoryCursor {
  sortKey: string;
  title: string;
}

export interface CategoryMemberPage {
  members: CategoryMember[];
  /** Every member of the category, not only this page's. */
  total: number;
  /** The cursor of the next page, or null at the end. */
  next: CategoryCursor | null;
}

interface MemberRow {
  title: string;
  namespace: number;
  sortKey: string;
}

/** How many members of each kind a category has: published pages only, told apart by namespace. */
export interface CategoryCounts {
  /** Members that are neither files nor categories. */
  pages: number;
  /** Members that are categories (namespace 14). */
  subcats: number;
  /** Members that are files (namespace 6). */
  files: number;
}

interface CountRow {
  slug: string;
  name: string;
  pages: bigint;
  subcats: bigint;
  files: bigint;
}

/** What a category's member is, by its namespace: a subcategory (14), a file (6), else a page. */
export type MemberKind = "page" | "subcat" | "file";

const KIND_CONDITION: Record<MemberKind, Prisma.Sql> = {
  page: Prisma.sql`a."namespace" NOT IN (6, 14)`,
  subcat: Prisma.sql`a."namespace" = 14`,
  file: Prisma.sql`a."namespace" = 6`,
};

/** A category name as the tables store it: no "Category:", spaces for underscores. */
function categoryName(category: string): string {
  return category
    .replace(/^Category:/i, "")
    .replace(/_/g, " ")
    .trim();
}

/** The rows of `wiki_categories` a category name denotes, as the page of members matches them. */
function categoryMatch(name: string) {
  return Prisma.sql`c."slug" = ${toArticleSlug(name)} OR lower(c."name") = lower(${name})`;
}

export class CategoryService {
  /**
   * One page of a category's members in MediaWiki's order: by sort key (the page title when it has
   * none), case-insensitively. The page starts at the sort key `from` (inclusive, MediaWiki's
   * `?from=`), or, with `after` (the title of the last member of the previous page, whose sort key is
   * `from`), strictly after that member: ties on the sort key break by title, so a long run of equal
   * keys never repeats or stalls a page. Members of every namespace are listed (a deleted page is not
   * a member for anyone); the caller tells subcategories (14), files (6) and pages apart.
   */
  static async getMemberPage(
    category: string,
    { from, after, limit }: { from: string; after: string; limit: number }
  ): Promise<CategoryMemberPage> {
    const name = category
      .replace(/^Category:/i, "")
      .replace(/_/g, " ")
      .trim();
    const slug = toArticleSlug(name);
    const inCategory = Prisma.sql`c."slug" = ${slug} OR lower(c."name") = lower(${name})`;
    const sortKey = Prisma.sql`upper(COALESCE(m."sortKey", a."title"))`;
    const start =
      after === ""
        ? Prisma.sql`${sortKey} >= upper(${from})`
        : Prisma.sql`(${sortKey}, a."title") > (upper(${from}), ${after})`;

    const [rows, totals] = await Promise.all([
      db.$queryRaw<MemberRow[]>`
        SELECT a."title" AS "title", a."namespace" AS "namespace",
               COALESCE(m."sortKey", a."title") AS "sortKey"
        FROM wiki_category_members m
        JOIN wiki_categories c ON c."id" = m."categoryId"
        JOIN wiki_articles a ON a."id" = m."articleId"
        WHERE (${inCategory}) AND a."source" = 'ixwiki' AND a."status" = 'PUBLISHED'
          AND ${start}
        ORDER BY ${sortKey}, a."title"
        LIMIT ${limit + 1}`,
      db.$queryRaw<Array<{ total: bigint }>>`
        SELECT count(*) AS "total"
        FROM wiki_category_members m
        JOIN wiki_categories c ON c."id" = m."categoryId"
        JOIN wiki_articles a ON a."id" = m."articleId"
        WHERE (${inCategory}) AND a."source" = 'ixwiki' AND a."status" = 'PUBLISHED'`,
    ]);

    const shown = rows.slice(0, limit);
    const last = shown[shown.length - 1];
    return {
      members: shown.map((row) => ({ title: row.title, namespace: row.namespace })),
      total: Number(totals[0]?.total ?? 0),
      next: rows.length > limit && last ? { sortKey: last.sortKey, title: last.title } : null,
    };
  }

  /**
   * Get Category Details and Direct Members (Articles & Subcategories)
   */
  static async getCategoryDetails(
    categorySlug: string,
    // oxlint-disable-next-line typescript/no-unused-vars
    source = "ixwiki"
  ): Promise<{
    category: { id: string; slug: string; name: string; description: string | null } | null;
    articles: Array<{ id: string; slug: string; title: string; summary: string | null }>;
    subcategories: Array<{ id: string; slug: string; name: string; memberCount: number }>;
    parents: Array<{ id: string; slug: string; name: string }>;
  }> {
    const rawCategory = categorySlug.replace(/^Category:/i, "").trim();
    const slug = toArticleSlug(rawCategory);
    const cleanName = rawCategory.replace(/_/g, " ");

    if (!(db as any).wikiCategory) {
      return {
        category: null,
        articles: [],
        subcategories: [],
        parents: [],
      };
    }

    // 1. Direct fetch from PostgreSQL WikiCategory DAG
    const cat = await db.wikiCategory.findFirst({
      where: {
        OR: [
          { slug },
          { slug: slug.replace(/_/g, "-") },
          { slug: slug.replace(/-/g, "_") },
          { name: { equals: cleanName, mode: "insensitive" } },
          { name: { equals: rawCategory, mode: "insensitive" } },
        ],
      },
      include: {
        parent: { select: { id: true, slug: true, name: true } },
        children: {
          select: {
            id: true,
            slug: true,
            name: true,
            _count: { select: { members: { where: { article: { status: "PUBLISHED" } } } } },
          },
          orderBy: { name: "asc" },
        },
        members: {
          where: { article: { status: "PUBLISHED" } },
          include: {
            article: {
              select: { id: true, title: true, slug: true, summary: true, leadImageUrl: true },
            },
          },
          take: 500,
        },
      },
    });

    const articleMap = new Map<
      string,
      { id: string; slug: string; title: string; summary: string | null }
    >();
    const subcatMap = new Map<
      string,
      { id: string; slug: string; name: string; memberCount: number }
    >();

    if (cat) {
      if (cat.members && cat.members.length > 0) {
        for (const m of cat.members) {
          if (m.article) {
            const aSlug = m.article.slug || toArticleSlug(m.article.title);
            articleMap.set(aSlug, {
              id: m.article.id,
              slug: aSlug,
              title: m.article.title.replace(/_/g, " "),
              summary: m.article.summary ?? null,
            });
          }
        }
      }

      if (cat.children && cat.children.length > 0) {
        for (const c of cat.children) {
          subcatMap.set(c.slug, {
            id: c.id,
            slug: c.slug,
            name: c.name.replace(/_/g, " "),
            memberCount: c._count?.members ?? 0,
          });
        }
      }
    }

    // 2. If direct members are few, pull member articles from child subcategories in the DAG
    if (articleMap.size < 50 && cat?.children && cat.children.length > 0) {
      const childIds = cat.children.map((c) => c.id);
      const childMembers = await db.wikiCategoryMember.findMany({
        where: {
          categoryId: { in: childIds },
          article: { status: "PUBLISHED" },
        },
        include: {
          article: {
            select: { id: true, title: true, slug: true, summary: true, leadImageUrl: true },
          },
        },
        take: 300,
      });

      for (const m of childMembers) {
        if (m.article) {
          const aSlug = m.article.slug || toArticleSlug(m.article.title);
          if (!articleMap.has(aSlug)) {
            articleMap.set(aSlug, {
              id: m.article.id,
              slug: aSlug,
              title: m.article.title.replace(/_/g, " "),
              summary: m.article.summary ?? null,
            });
          }
        }
      }
    }

    // 3. Fallback: check if category members exist by categoryId/slug
    if (articleMap.size === 0) {
      const directMembers = await db.wikiCategoryMember.findMany({
        where: {
          OR: [
            { category: { slug } },
            { category: { name: { equals: cleanName, mode: "insensitive" } } },
          ],
          article: { status: "PUBLISHED" },
        },
        include: {
          article: {
            select: { id: true, title: true, slug: true, summary: true },
          },
        },
        take: 500,
      });

      for (const m of directMembers) {
        if (m.article) {
          const aSlug = m.article.slug || toArticleSlug(m.article.title);
          if (!articleMap.has(aSlug)) {
            articleMap.set(aSlug, {
              id: m.article.id,
              slug: aSlug,
              title: m.article.title.replace(/_/g, " "),
              summary: m.article.summary ?? null,
            });
          }
        }
      }
    }

    const articles = Array.from(articleMap.values()).sort((a, b) => a.title.localeCompare(b.title));
    const subcategories = Array.from(subcatMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return {
      category: cat
        ? {
            id: cat.id,
            slug: cat.slug,
            name: cat.name,
            description: cat.description,
          }
        : {
            id: slug,
            slug,
            name: cleanName,
            description: null,
          },
      articles,
      subcategories,
      parents: cat?.parent ? [cat.parent] : [],
    };
  }

  /**
   * Replace the article's categories with the ones the render reported, inside `tx`: each category is
   * created if it is new (and carries MediaWiki's `hidden` flag), the memberships are replaced as a set
   * with their sort keys, so a category that is no longer reported disappears. The categories come from
   * the render, which sees the ones templates add and the sort keys; nothing reads wikitext. Resolves to
   * the number of memberships.
   */
  static async replaceArticleCategories(
    tx: Prisma.TransactionClient,
    articleId: string,
    categories: readonly RenderedCategory[]
  ): Promise<number> {
    const bySlug = new Map<string, { name: string; sortKey: string | null; hidden: boolean }>();
    for (const category of categories) {
      const canon = canonicalizeTitle(`Category:${category.name}`);
      if (!canon || canon.namespaceId !== 14) continue;
      const slug = toArticleSlug(canon.base);
      if (!bySlug.has(slug)) {
        bySlug.set(slug, { name: canon.base, sortKey: category.sortKey, hidden: category.hidden });
      }
    }

    const members: Array<{ articleId: string; categoryId: string; sortKey: string | null }> = [];
    for (const [slug, category] of bySlug) {
      const row = await tx.wikiCategory.upsert({
        where: { slug },
        create: { slug, name: category.name, hidden: category.hidden },
        update: { hidden: category.hidden },
        select: { id: true },
      });
      members.push({ articleId, categoryId: row.id, sortKey: category.sortKey });
    }

    await tx.wikiCategoryMember.deleteMany({ where: { articleId } });
    if (members.length > 0) {
      await tx.wikiCategoryMember.createMany({ data: members, skipDuplicates: true });
    }
    return members.length;
  }

  /**
   * Get Category Members (Articles and Subcategories) for bridge dispatchers
   */
  static async getCategoryMembers(
    category: string,
    limit = 50,
    source = "ixwiki"
  ): Promise<Array<{ title: string; type: "page" | "subcat" | "file" }>> {
    const details = await this.getCategoryDetails(category, source);
    const members: Array<{ title: string; type: "page" | "subcat" | "file" }> = [];

    for (const art of details.articles) {
      if (members.length >= limit) break;
      members.push({
        title: art.title,
        type: "page",
      });
    }

    for (const sub of details.subcategories) {
      if (members.length >= limit) break;
      members.push({
        title: `Category:${sub.name}`,
        type: "subcat",
      });
    }

    return members;
  }

  /**
   * The member counts of each category in `categories` (names, with or without "Category:"), keyed by the
   * name as given. A category with no published member, or that does not exist, has no members.
   */
  static async getCounts(categories: readonly string[]): Promise<Map<string, CategoryCounts>> {
    const names = categories.map(categoryName);
    const counts = new Map<string, CategoryCounts>();
    if (names.length === 0) return counts;

    const slugs = names.map(toArticleSlug);
    const rows = await db.$queryRaw<CountRow[]>`
      SELECT c."slug" AS "slug", c."name" AS "name",
             count(*) FILTER (WHERE a."namespace" NOT IN (6, 14)) AS "pages",
             count(*) FILTER (WHERE a."namespace" = 14) AS "subcats",
             count(*) FILTER (WHERE a."namespace" = 6) AS "files"
      FROM wiki_categories c
      JOIN wiki_category_members m ON m."categoryId" = c."id"
      JOIN wiki_articles a ON a."id" = m."articleId"
      WHERE (c."slug" IN (${Prisma.join(slugs)}) OR lower(c."name") IN (${Prisma.join(names.map((name) => name.toLowerCase()))}))
        AND a."source" = 'ixwiki' AND a."status" = 'PUBLISHED'
      GROUP BY c."slug", c."name"`;

    categories.forEach((given, index) => {
      const name = names[index]!;
      const row = rows.find(
        (candidate) =>
          candidate.slug === slugs[index] || candidate.name.toLowerCase() === name.toLowerCase()
      );
      counts.set(given, {
        pages: Number(row?.pages ?? 0),
        subcats: Number(row?.subcats ?? 0),
        files: Number(row?.files ?? 0),
      });
    });
    return counts;
  }

  /**
   * The titles (namespace prefix included) of the published members of `category` of the given kinds,
   * in the category page's order: by sort key, then title.
   */
  static async getMemberTitles(
    category: string,
    kinds: readonly MemberKind[],
    limit: number
  ): Promise<string[]> {
    if (kinds.length === 0) return [];
    const name = categoryName(category);
    const ofKind = Prisma.join(
      kinds.map((kind) => KIND_CONDITION[kind]),
      " OR "
    );
    const rows = await db.$queryRaw<Array<{ title: string }>>`
      SELECT a."title" AS "title"
      FROM wiki_category_members m
      JOIN wiki_categories c ON c."id" = m."categoryId"
      JOIN wiki_articles a ON a."id" = m."articleId"
      WHERE (${categoryMatch(name)}) AND a."source" = 'ixwiki' AND a."status" = 'PUBLISHED'
        AND (${ofKind})
      ORDER BY upper(COALESCE(m."sortKey", a."title")), a."title"
      LIMIT ${limit}`;
    return rows.map((row) => row.title);
  }

  /**
   * Names of the categories that are not hidden, by name: those that contain `query`, else those from
   * `from` on, alphabetically; with their member counts.
   */
  static async search({
    query,
    from,
    limit,
  }: {
    query: string;
    from: string;
    limit: number;
  }): Promise<Array<{ name: string } & CategoryCounts>> {
    const where: Prisma.WikiCategoryWhereInput = { hidden: false };
    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { slug: { contains: toArticleSlug(query), mode: "insensitive" } },
      ];
    } else if (from) {
      where.name = { gte: from, mode: "insensitive" };
    }
    const categories = await db.wikiCategory.findMany({
      where,
      select: { name: true },
      orderBy: { name: "asc" },
      take: limit,
    });
    const counts = await this.getCounts(categories.map((category) => category.name));
    return categories.map(({ name }) => ({
      name,
      ...(counts.get(name) ?? { pages: 0, subcats: 0, files: 0 }),
    }));
  }

  /** The names of up to `limit` categories that are not hidden and start with `prefix`, alphabetically. */
  static async autocomplete(prefix: string, limit: number): Promise<string[]> {
    const categories = await db.wikiCategory.findMany({
      where: { hidden: false, name: { startsWith: categoryName(prefix), mode: "insensitive" } },
      select: { name: true },
      orderBy: { name: "asc" },
      take: limit,
    });
    return categories.map((category) => category.name);
  }
}
