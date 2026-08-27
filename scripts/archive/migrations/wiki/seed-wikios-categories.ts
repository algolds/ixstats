/**
 * seed-wikios-categories.ts — Native PostgreSQL Category Indexer & DAG Builder
 *
 * Reads all published articles from PostgreSQL `wiki_articles` (Prisma db.wikiArticle),
 * extracts all `[[Category:...]]` wikitext tags, ensures all `WikiCategory` records exist,
 * and bulk-inserts all `WikiCategoryMember` relations into PostgreSQL.
 *
 * 100% Native Prisma PostgreSQL — Zero MariaDB / MySQL dependencies.
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const db = new PrismaClient();

function toArticleSlug(str: string): string {
  return str.trim().toLowerCase().replace(/ /g, "_").replace(/_{2,}/g, "_") || "category";
}

// The 12 primary domain root categories in WikiOS
const DOMAIN_CATEGORIES = [
  {
    name: "Countries",
    description: "Nations, sovereign states, dependent territories, and geopolitical entities.",
  },
  {
    name: "Economy",
    description:
      "Economic systems, international trade, currencies, financial markets, and industry.",
  },
  {
    name: "Government",
    description:
      "Political systems, constitutional structures, governance, and public administration.",
  },
  {
    name: "Military",
    description:
      "Armed forces branches, military equipment, defense doctrines, and historic conflicts.",
  },
  {
    name: "People",
    description:
      "Demographics, ethnic groups, linguistics, notable figures, and social structures.",
  },
  {
    name: "Politics",
    description: "Elections, political movements, political parties, alliances, and diplomacy.",
  },
  {
    name: "History",
    description: "Historical events, timelines, ancient eras, revolutions, and world history.",
  },
  {
    name: "Geography",
    description: "Physical geography, continents, mountain ranges, bodies of water, and climates.",
  },
  {
    name: "Culture",
    description: "Art, architecture, music, folklore, cuisine, holidays, and cultural traditions.",
  },
  {
    name: "Technology",
    description:
      "Science, technological development, aerospace, transport, and research institutions.",
  },
  {
    name: "Companies",
    description:
      "Commercial enterprises, conglomerates, state-owned corporations, and market leaders.",
  },
  {
    name: "Nature",
    description:
      "Flora, fauna, nature reserves, ecosystems, and natural phenomena across the world.",
  },
];

const DOMAIN_SUB_PATTERNS: Record<string, string[]> = {
  People: [
    "people",
    "politicians",
    "monarchs",
    "presidents",
    "prime_ministers",
    "biography",
    "living_people",
    "nobility",
    "citizens",
    "rulers",
    "leaders",
    "scientists",
    "writers",
    "artists",
    "ministers",
    "diplomats",
    "philosophers",
  ],
  Economy: [
    "economy",
    "companies",
    "currencies",
    "trade",
    "banks",
    "industry",
    "agriculture",
    "transport",
    "infrastructure",
    "finance",
    "business",
  ],
  Government: [
    "government",
    "politics",
    "ministries",
    "law",
    "elections",
    "parliament",
    "judiciary",
    "constitution",
    "agencies",
    "foreign_relations",
  ],
  Military: [
    "military",
    "armed_forces",
    "wars",
    "battles",
    "equipment",
    "navy",
    "army",
    "air_force",
    "weapons",
    "fortifications",
  ],
  Geography: [
    "geography",
    "cities",
    "rivers",
    "islands",
    "mountains",
    "regions",
    "provinces",
    "settlements",
    "lakes",
    "oceans",
    "landmarks",
  ],
  History: [
    "history",
    "empires",
    "treaties",
    "ancient",
    "medieval",
    "dynasties",
    "conflicts",
    "chronology",
  ],
  Culture: [
    "culture",
    "music",
    "religion",
    "language",
    "art",
    "cinema",
    "literature",
    "festivals",
    "cuisine",
    "sports",
  ],
  Technology: [
    "technology",
    "science",
    "aerospace",
    "computing",
    "inventions",
    "energy",
    "telecommunications",
  ],
  Companies: ["companies", "corporations", "enterprises", "brands", "manufacturers"],
  Nature: [
    "nature",
    "flora",
    "fauna",
    "animals",
    "plants",
    "ecosystems",
    "wildlife",
    "parks",
    "species",
  ],
};

async function seedCategories() {
  console.log("==================================================================");
  console.log("🌱 WikiOS PostgreSQL Native Category Seeder & DAG Indexer");
  console.log("==================================================================");

  const startTime = Date.now();

  try {
    // 1. Seed Core Domain Root Categories
    console.log("\n📦 1. Seeding 12 Core Domain Categories into PostgreSQL `wiki_categories`...");
    const categoryMap = new Map<string, string>(); // slug -> id

    for (const dom of DOMAIN_CATEGORIES) {
      const slug = toArticleSlug(dom.name);
      const cat = await db.wikiCategory.upsert({
        where: { slug },
        create: {
          slug,
          name: dom.name,
          description: dom.description,
        },
        update: {
          name: dom.name,
          description: dom.description,
        },
        select: { id: true, slug: true },
      });
      categoryMap.set(slug, cat.id);
    }
    console.log(`   ✅ Seeded ${DOMAIN_CATEGORIES.length} primary domain categories.`);

    // 2. Fetch all articles from PostgreSQL `wiki_articles`
    console.log("\n🔍 2. Reading all articles from PostgreSQL `wiki_articles`...");
    const articles = await db.wikiArticle.findMany({
      select: { id: true, title: true, slug: true, wikitext: true, namespace: true, source: true },
    });

    console.log(`   Found ${articles.length} articles in PostgreSQL.`);

    if (articles.length === 0) {
      console.warn("⚠️ No articles found in PostgreSQL `wiki_articles` table!");
      return;
    }

    // 3. Extract Categories from Wikitext
    console.log("\n📝 3. Parsing `[[Category:...]]` wikitext tags across all articles...");
    const categoryRegex = /\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi;

    const categoryNames = new Set<string>();
    const memberships: Array<{ articleId: string; categorySlug: string; categoryName: string }> =
      [];

    for (const art of articles) {
      if (art.namespace === 14 || art.title.startsWith("Category:")) {
        const catName = art.title
          .replace(/^Category:/i, "")
          .trim()
          .replace(/_/g, " ");
        if (catName) {
          categoryNames.add(catName);
        }
      }

      if (!art.wikitext) continue;
      let match: RegExpExecArray | null;

      while ((match = categoryRegex.exec(art.wikitext)) !== null) {
        const rawName = match[1]?.trim().replace(/_/g, " ");
        if (!rawName || rawName.length === 0) continue;

        if (
          rawName.startsWith("Pages ") ||
          rawName.startsWith("Articles ") ||
          rawName.includes(" with ") ||
          rawName.startsWith("IXWB")
        ) {
          continue;
        }

        const catSlug = toArticleSlug(rawName);
        categoryNames.add(rawName);
        memberships.push({
          articleId: art.id,
          categorySlug: catSlug,
          categoryName: rawName,
        });
      }
    }

    console.log(
      `   Found ${categoryNames.size} distinct categories across ${memberships.length} citations.`
    );

    // 4. Batch Upsert all discovered categories into PostgreSQL `wiki_categories`
    console.log(
      `\n💾 4. Upserting ${categoryNames.size} categories into PostgreSQL \`wiki_categories\`...`
    );
    let catUpserted = 0;

    for (const name of categoryNames) {
      const slug = toArticleSlug(name);
      if (!categoryMap.has(slug)) {
        try {
          const cat = await db.wikiCategory.upsert({
            where: { slug },
            create: { slug, name },
            update: {},
            select: { id: true },
          });
          categoryMap.set(slug, cat.id);
          catUpserted++;
        } catch (err: any) {
          console.warn(`   ⚠️ Could not upsert category "${name}":`, err.message?.substring(0, 60));
        }
      }
    }

    console.log(`   ✅ Successfully indexed ${categoryMap.size} total categories.`);

    // 5. Connect child categories to domain parents
    console.log("\n🌳 5. Building Category DAG hierarchies (Parent/Child relations)...");
    let hierarchyLinked = 0;

    for (const [domainName, patterns] of Object.entries(DOMAIN_SUB_PATTERNS)) {
      const parentSlug = toArticleSlug(domainName);
      const parentId = categoryMap.get(parentSlug);
      if (!parentId) continue;

      for (const [slug, id] of categoryMap.entries()) {
        if (slug === parentSlug) continue;
        const matchesPattern = patterns.some(
          (p) => slug.includes(p) || slug.startsWith(`${parentSlug}_`)
        );
        if (matchesPattern) {
          await db.wikiCategory
            .update({
              where: { id },
              data: { parentId },
            })
            .catch(() => {});
          hierarchyLinked++;
        }
      }
    }
    console.log(`   ✅ Linked ${hierarchyLinked} category hierarchy DAG nodes.`);

    // 6. Bulk Insert Memberships into PostgreSQL `wiki_category_members`
    console.log(
      `\n🔗 6. Writing ${memberships.length} article memberships into \`wiki_category_members\`...`
    );
    const uniqueMembers = new Map<string, { categoryId: string; articleId: string }>();

    for (const m of memberships) {
      const categoryId = categoryMap.get(m.categorySlug);
      if (categoryId && m.articleId) {
        const key = `${categoryId}:${m.articleId}`;
        if (!uniqueMembers.has(key)) {
          uniqueMembers.set(key, { categoryId, articleId: m.articleId });
        }
      }
    }

    const memberData = Array.from(uniqueMembers.values());
    console.log(`   Deduplicated to ${memberData.length} unique category memberships.`);

    // Insert in chunks of 500
    const CHUNK_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < memberData.length; i += CHUNK_SIZE) {
      const chunk = memberData.slice(i, i + CHUNK_SIZE);
      await db.wikiCategoryMember.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      inserted += chunk.length;
      if (inserted % 2000 === 0 || inserted === memberData.length) {
        console.log(`   Inserted ${inserted} / ${memberData.length} memberships...`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("\n==================================================================");
    console.log(`🎉 WikiOS Category Seeding Complete in ${elapsed}s!`);
    console.log(`   - Total Categories in PostgreSQL:  ${categoryMap.size.toLocaleString()}`);
    console.log(`   - Total Memberships in PostgreSQL: ${memberData.length.toLocaleString()}`);
    console.log("==================================================================");
  } catch (err) {
    console.error("❌ Fatal error during category seeding:", err);
  } finally {
    await db.$disconnect();
    process.exit(0);
  }
}

seedCategories();
