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
    source = "ixwiki"
  ): Promise<{
    category: { id: string; slug: string; name: string; description: string | null } | null;
    articles: Array<{ id: string; slug: string; title: string; summary: string | null }>;
    subcategories: Array<{ id: string; slug: string; name: string; memberCount: number }>;
    parents: Array<{ id: string; slug: string; name: string }>;
  }> {
    const slug = toArticleSlug(categorySlug);

    if (!(db as any).wikiCategory) {
      return {
        category: null,
        articles: [],
        subcategories: [],
        parents: [],
      };
    }

    const cat: any = await (db as any).wikiCategory.findUnique({
      where: { slug },
      include: {
        parent: { select: { id: true, slug: true, name: true } },
        children: {
          select: {
            id: true,
            slug: true,
            name: true,
            _count: { select: { members: true } },
          },
        },
        members: {
          include: {
            article: {
              select: { id: true, title: true, source: true },
            },
          },
        },
      },
    });

    if (!cat) {
      return {
        category: null,
        articles: [],
        subcategories: [],
        parents: [],
      };
    }

    const filteredArticles = (cat.members ?? [])
      .filter((m: any) => m.article?.source === source)
      .map((m: any) => ({
        id: m.article?.id ?? "",
        slug: toArticleSlug(m.article?.title ?? ""),
        title: m.article?.title ?? "",
        summary: null,
      }));

    return {
      category: {
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
      },
      articles: filteredArticles,
      subcategories: (cat.children ?? []).map((c: any) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        memberCount: c._count?.members ?? 0,
      })),
      parents: cat.parent ? [cat.parent] : [],
    };
  }

  /**
   * Sync Category Memberships for an article
   */
  static async syncArticleCategories(
    articleId: string,
    categoryNames: string[]
  ): Promise<void> {
    if (categoryNames.length === 0 || !(db as any).wikiCategoryMember) {
      return;
    }

    // Ensure all categories exist
    const categoryIds: string[] = [];
    for (const name of categoryNames) {
      const slug = toArticleSlug(name);
      const cat: any = await (db as any).wikiCategory.upsert({
        where: { slug },
        create: { slug, name: name.replace(/_/g, " ") },
        update: {},
        select: { id: true },
      });
      categoryIds.push(cat.id);
    }

    // Transactionally update category memberships
    await db.$transaction(async (tx: any) => {
      if (tx.wikiCategoryMember) {
        await tx.wikiCategoryMember.deleteMany({ where: { articleId } });
        await tx.wikiCategoryMember.createMany({
          data: categoryIds.map((categoryId) => ({
            articleId,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }
    });
  }
}
