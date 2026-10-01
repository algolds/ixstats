/**
 * category-service.ts — WikiOS Native Category Hierarchy (DAG) Engine
 *
 * Manages category creation, subcategory trees, and member lookups via PostgreSQL.
 */

import type { Prisma } from "@prisma/client";
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

export class CategoryService {
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
