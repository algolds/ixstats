import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function getCategoryTree(initialSlugs: string[]) {
  const visited = new Set<string>();
  const queue = [...initialSlugs];
  const allCategories: Array<{ id: string; slug: string; name: string; parentId: string | null }> = [];

  while (queue.length > 0) {
    const currentSlug = queue.shift()!;
    if (visited.has(currentSlug.toLowerCase())) continue;
    visited.add(currentSlug.toLowerCase());

    const cat = await prisma.wikiCategory.findFirst({
      where: {
        slug: {
          equals: currentSlug,
          mode: "insensitive",
        },
      },
      include: {
        children: true,
      },
    });

    if (cat) {
      allCategories.push({
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        parentId: cat.parentId,
      });

      for (const child of cat.children) {
        if (!visited.has(child.slug.toLowerCase())) {
          queue.push(child.slug);
        }
      }
    }
  }

  return allCategories;
}

async function main() {
  console.log("Connecting to PostgreSQL...");
  const articleCount = await prisma.wikiArticle.count();
  const catCount = await prisma.wikiCategory.count();
  console.log(`Database holds ${articleCount} articles and ${catCount} categories.`);

  // 1. Gather relevant category trees
  console.log("Fetching category trees...");
  const govCategories = await getCategoryTree(["government", "category:government"]);
  const polCategories = await getCategoryTree(["politics", "category:politics"]);
  const ideoCategories = await getCategoryTree(["political_ideologies", "category:political_ideologies", "ideologies", "category:ideologies"]);
  const countryCategories = await getCategoryTree(["countries", "category:countries", "sovereign_states", "nations"]);

  console.log(`Found:
    - Government categories: ${govCategories.length}
    - Politics categories: ${polCategories.length}
    - Ideology categories: ${ideoCategories.length}
    - Country categories: ${countryCategories.length}
  `);

  // Combine unique category IDs
  const combinedCatIds = Array.from(
    new Set([
      ...govCategories.map((c) => c.id),
      ...polCategories.map((c) => c.id),
      ...ideoCategories.map((c) => c.id),
      ...countryCategories.map((c) => c.id),
    ])
  );

  console.log(`Total unique categories in scope: ${combinedCatIds.length}`);

  // Fetch articles belonging to these categories
  const categoryMembers = await prisma.wikiCategoryMember.findMany({
    where: {
      categoryId: { in: combinedCatIds },
    },
    include: {
      category: true,
      article: {
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          infoboxData: true,
          readingTime: true,
          wordCount: true,
          // get snippet of wikitext
          wikitext: true,
        },
      },
    },
  });

  console.log(`Total category-article memberships: ${categoryMembers.length}`);

  // Group by article
  const articlesMap = new Map<string, any>();
  for (const cm of categoryMembers) {
    if (!cm.article) continue;
    if (!articlesMap.has(cm.article.id)) {
      articlesMap.set(cm.article.id, {
        id: cm.article.id,
        slug: cm.article.slug,
        title: cm.article.title,
        summary: cm.article.summary,
        infoboxData: cm.article.infoboxData,
        wordCount: cm.article.wordCount,
        categories: [],
        wikitextSnippet: cm.article.wikitext ? cm.article.wikitext.slice(0, 1500) : "",
      });
    }
    articlesMap.get(cm.article.id).categories.push({
      slug: cm.category.slug,
      name: cm.category.name,
    });
  }

  const articles = Array.from(articlesMap.values());
  console.log(`Unique articles found: ${articles.length}`);

  // Also specifically search for political ideologies / political parties / government systems by title pattern
  const extraArticles = await prisma.wikiArticle.findMany({
    where: {
      OR: [
        { title: { contains: "Party", mode: "insensitive" } },
        { title: { contains: "Movement", mode: "insensitive" } },
        { title: { contains: "Government", mode: "insensitive" } },
        { title: { contains: "Constitution", mode: "insensitive" } },
        { title: { contains: "Politics of", mode: "insensitive" } },
        { title: { contains: "Elections in", mode: "insensitive" } },
        { title: { contains: "Monarchy", mode: "insensitive" } },
        { title: { contains: "Republic", mode: "insensitive" } },
        { title: { contains: "Socialism", mode: "insensitive" } },
        { title: { contains: "Liberalism", mode: "insensitive" } },
        { title: { contains: "Conservatism", mode: "insensitive" } },
        { title: { contains: "Fascism", mode: "insensitive" } },
        { title: { contains: "Nationalism", mode: "insensitive" } },
        { title: { contains: "Syndicalism", mode: "insensitive" } },
        { title: { contains: "Parliament", mode: "insensitive" } },
      ],
      namespace: 0,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      infoboxData: true,
      wordCount: true,
      wikitext: true,
    },
    take: 500,
  });

  for (const art of extraArticles) {
    if (!articlesMap.has(art.id)) {
      articlesMap.set(art.id, {
        id: art.id,
        slug: art.slug,
        title: art.title,
        summary: art.summary,
        infoboxData: art.infoboxData,
        wordCount: art.wordCount,
        categories: [],
        wikitextSnippet: art.wikitext ? art.wikitext.slice(0, 1500) : "",
      });
    }
  }

  const allRelevantArticles = Array.from(articlesMap.values());
  console.log(`Total relevant articles after text/title match: ${allRelevantArticles.length}`);

  // Save summary data for analysis
  fs.writeFileSync(
    "/tmp/wikios_political_audit.json",
    JSON.stringify(
      {
        totalArticles: allRelevantArticles.length,
        categories: {
          government: govCategories,
          politics: polCategories,
          ideologies: ideoCategories,
          countries: countryCategories,
        },
        articles: allRelevantArticles.map((a) => ({
          slug: a.slug,
          title: a.title,
          summary: a.summary,
          categories: a.categories.map((c: any) => c.name || c.slug),
          infoboxData: a.infoboxData,
          wikitextSnippet: a.wikitextSnippet,
        })),
      },
      null,
      2
    )
  );

  console.log("Successfully wrote /tmp/wikios_political_audit.json");
}

main()
  .catch((e) => {
    console.error("Error in main:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
