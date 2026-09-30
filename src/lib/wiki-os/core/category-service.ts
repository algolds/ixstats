/**
 * category-service.ts — WikiOS Native Category Hierarchy (DAG) Engine
 *
 * Manages category creation, subcategory trees, and member lookups via PostgreSQL.
 */

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
            _count: { select: { members: true } },
          },
          orderBy: { name: "asc" },
        },
        members: {
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
