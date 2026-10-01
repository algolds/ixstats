/**
 * category-service.ts — WikiOS Native Category Hierarchy (DAG) Engine
 *
 * Manages category creation, subcategory trees, and member lookups via PostgreSQL.
 */

import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { toArticleSlug } from "./domain-types";

export interface CategoryTreeItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  memberCount: number;
  subcategories: CategoryTreeItem[];
}

/** A category page lists this many members; the next page starts where `CategoryMemberPage.next` says. */
export const CATEGORY_PAGE_SIZE = 200;

export interface CategoryMember {
  /** The member's full title, namespace prefix included. */
  title: string;
  namespace: number;
}

export interface CategoryMemberPage {
  members: CategoryMember[];
  /** Every member of the category, not only this page's. */
  total: number;
  /** Where the next page starts (a `from` value), or null at the end. */
  next: string | null;
}

interface MemberRow {
  title: string;
  namespace: number;
  sortKey: string;
}

export class CategoryService {
  /**
   * One page of a category's members in MediaWiki's order: by sort key (the page title when it has
   * none), case-insensitively, starting at `from`. Members of every namespace are listed (a deleted
   * page is not a member for anyone); the caller tells subcategories (14), files (6) and pages apart.
   */
  static async getMemberPage(
    category: string,
    { from, limit }: { from: string; limit: number }
  ): Promise<CategoryMemberPage> {
    const name = category
      .replace(/^Category:/i, "")
      .replace(/_/g, " ")
      .trim();
    const slug = toArticleSlug(name);
    const inCategory = Prisma.sql`c."slug" = ${slug} OR lower(c."name") = lower(${name})`;

    const [rows, totals] = await Promise.all([
      db.$queryRaw<MemberRow[]>`
        SELECT a."title" AS "title", a."namespace" AS "namespace",
               COALESCE(m."sortKey", a."title") AS "sortKey"
        FROM wiki_category_members m
        JOIN wiki_categories c ON c."id" = m."categoryId"
        JOIN wiki_articles a ON a."id" = m."articleId"
        WHERE (${inCategory}) AND a."source" = 'ixwiki' AND a."status" = 'PUBLISHED'
          AND upper(COALESCE(m."sortKey", a."title")) >= upper(${from})
        ORDER BY upper(COALESCE(m."sortKey", a."title")), a."title"
        LIMIT ${limit + 1}`,
      db.$queryRaw<Array<{ total: bigint }>>`
        SELECT count(*) AS "total"
        FROM wiki_category_members m
        JOIN wiki_categories c ON c."id" = m."categoryId"
        JOIN wiki_articles a ON a."id" = m."articleId"
        WHERE (${inCategory}) AND a."source" = 'ixwiki' AND a."status" = 'PUBLISHED'`,
    ]);

    const members = rows
      .slice(0, limit)
      .map((row) => ({ title: row.title, namespace: row.namespace }));
    return { members, total: Number(totals[0]?.total ?? 0), next: rows[limit]?.sortKey ?? null };
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
   * Sync Category Memberships for an article
   */
  static async syncArticleCategories(articleId: string, categoryNames: string[]): Promise<void> {
    if (categoryNames.length === 0) {
      return;
    }

    // Ensure all categories exist
    const categoryIds: string[] = [];
    for (const name of categoryNames) {
      const slug = toArticleSlug(name);
      const cat = await db.wikiCategory.upsert({
        where: { slug },
        create: { slug, name: name.replace(/_/g, " ") },
        update: {},
        select: { id: true },
      });
      categoryIds.push(cat.id);
    }

    // Transactionally update category memberships
    await db.$transaction(async (tx) => {
      await tx.wikiCategoryMember.deleteMany({ where: { articleId } });
      await tx.wikiCategoryMember.createMany({
        data: categoryIds.map((categoryId) => ({
          articleId,
          categoryId,
        })),
        skipDuplicates: true,
      });
    });
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
}
