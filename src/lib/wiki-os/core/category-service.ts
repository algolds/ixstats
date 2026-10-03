/** WikiOS native category hierarchy (DAG): subcategory trees and member lookups via PostgreSQL. */

import { db } from "~/server/db";
import { toArticleSlug } from "./domain-types";

const ARTICLE_SELECT = { id: true, title: true, slug: true, summary: true } as const;

interface CategoryArticle {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
}

export class CategoryService {
  static async getCategoryDetails(
    categorySlug: string,
    // oxlint-disable-next-line typescript/no-unused-vars
    source = "ixwiki"
  ): Promise<{
    category: { id: string; slug: string; name: string; description: string | null } | null;
    articles: CategoryArticle[];
    subcategories: Array<{ id: string; slug: string; name: string; memberCount: number }>;
    parents: Array<{ id: string; slug: string; name: string }>;
  }> {
    const rawCategory = categorySlug.replace(/^Category:/i, "").trim();
    const slug = toArticleSlug(rawCategory);
    const cleanName = rawCategory.replace(/_/g, " ");

    if (!(db as any).wikiCategory) {
      return { category: null, articles: [], subcategories: [], parents: [] };
    }

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
        members: { include: { article: { select: ARTICLE_SELECT } }, take: 500 },
      },
    });

    const articleMap = new Map<string, CategoryArticle>();
    const addArticles = (
      members: Array<{ article: CategoryArticle | null }>,
      overwrite = false
    ) => {
      for (const { article } of members) {
        if (!article) continue;
        const aSlug = article.slug || toArticleSlug(article.title);
        if (!overwrite && articleMap.has(aSlug)) continue;
        articleMap.set(aSlug, {
          id: article.id,
          slug: aSlug,
          title: article.title.replace(/_/g, " "),
          summary: article.summary ?? null,
        });
      }
    };

    addArticles(cat?.members ?? [], true);

    const subcategories = (cat?.children ?? [])
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name.replace(/_/g, " "),
        memberCount: c._count?.members ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Few direct members: pull member articles from child subcategories in the DAG
    if (articleMap.size < 50 && cat?.children && cat.children.length > 0) {
      addArticles(
        await db.wikiCategoryMember.findMany({
          where: { categoryId: { in: cat.children.map((c) => c.id) } },
          include: { article: { select: ARTICLE_SELECT } },
          take: 300,
        })
      );
    }

    // Fallback: members matched by category slug or name
    if (articleMap.size === 0) {
      addArticles(
        await db.wikiCategoryMember.findMany({
          where: {
            OR: [
              { category: { slug } },
              { category: { name: { equals: cleanName, mode: "insensitive" } } },
            ],
          },
          include: { article: { select: ARTICLE_SELECT } },
          take: 500,
        })
      );
    }

    const articles = Array.from(articleMap.values()).sort((a, b) => a.title.localeCompare(b.title));

    return {
      category: cat
        ? { id: cat.id, slug: cat.slug, name: cat.name, description: cat.description }
        : { id: slug, slug, name: cleanName, description: null },
      articles,
      subcategories,
      parents: cat?.parent ? [cat.parent] : [],
    };
  }

  /** Articles then subcategories of a category, for the bridge dispatchers. */
  static async getCategoryMembers(
    category: string,
    limit = 50,
    source = "ixwiki"
  ): Promise<Array<{ title: string; type: "page" | "subcat" | "file" }>> {
    const details = await this.getCategoryDetails(category, source);
    return [
      ...details.articles.map((art) => ({ title: art.title, type: "page" as const })),
      ...details.subcategories.map((sub) => ({
        title: `Category:${sub.name}`,
        type: "subcat" as const,
      })),
    ].slice(0, Math.max(0, limit));
  }
}
