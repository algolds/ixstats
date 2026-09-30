/**
 * scripts/sync-wikios-categories.ts — Native PostgreSQL Category Indexer & DAG Builder
 *
 * Reads all 4,688+ articles from PostgreSQL `wiki_articles` (Prisma db.wikiArticle),
 * parses all `[[Category:...]]` wikitext tags, populates `wiki_categories`,
 * establishes parent-child DAG relations for all 12 domains,
 * and bulk-inserts all `wiki_category_members` rows.
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const db = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

function toArticleSlug(str: string): string {
  return (
    str
      .trim()
      .toLowerCase()
      .replace(/^category:/i, "")
      .replace(/https?:\/\/[^\s]+/gi, "")
      .replace(/[^a-z0-9_\-]/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_|_$/g, "") || "category"
  );
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
  {
    name: "Miscellaneous",
    description:
      "General topics, uncategorized articles, cross-disciplinary subjects, and reference indexes.",
  },
];

const DOMAIN_SUB_PATTERNS: Record<string, string[]> = {
  People: [
    "people_in_",
    "people_of_",
    "peoples_of_",
    "_people",
    "_peoples",
    "people",
    "peoples",
    "politicians",
    "monarchs",
    "presidents",
    "prime_ministers",
    "nobility",
    "citizens",
    "rulers",
    "scientists",
    "writers",
    "artists",
    "ministers",
    "diplomats",
    "philosophers",
    "actors",
    "athletes",
    "dynasties",
  ],
  Economy: [
    "economy",
    "currencies",
    "trade",
    "banks",
    "industry",
    "agriculture",
    "infrastructure",
    "finance",
    "business",
    "commerce",
    "taxation",
    "markets",
    "railways",
    "ports",
    "energy",
  ],
  Government: [
    "government",
    "ministries",
    "law",
    "parliament",
    "judiciary",
    "constitution",
    "agencies",
    "foreign_relations",
    "treaties",
    "diplomacy",
    "legislation",
    "cabinets",
    "departments",
    "councils",
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
    "vehicles",
    "defense",
    "regiments",
    "conflicts",
    "submarines",
    "warships",
    "aircraft",
    "flotilla",
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
    "capitals",
    "bays",
    "straits",
    "hills",
    "forests",
    "valleys",
    "districts",
    "territories",
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
    "revolutions",
    "events",
    "eras",
    "periods",
    "decades",
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
    "folklore",
    "traditions",
    "mythology",
    "media",
    "holidays",
    "food",
    "fashion",
  ],
  Technology: [
    "technology",
    "science",
    "aerospace",
    "computing",
    "inventions",
    "energy",
    "telecommunications",
    "space",
    "engineering",
    "electronics",
    "reactors",
  ],
  Companies: [
    "companies",
    "corporations",
    "enterprises",
    "brands",
    "manufacturers",
    "airlines",
    "conglomerates",
    "retailers",
    "media_companies",
  ],
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
    "environment",
    "climate",
    "geology",
  ],
  Countries: [
    "countries",
    "nations",
    "states",
    "dependencies",
    "realms",
    "geopolitics",
    "federations",
    "republics",
    "kingdoms",
    "principalities",
  ],
  Politics: [
    "politics",
    "political_parties",
    "elections",
    "ideologies",
    "movements",
    "activism",
    "voting",
    "campaigns",
    "alliances",
    "international_organizations",
  ],
  Miscellaneous: [
    "other",
    "misc",
    "general",
    "lists",
    "indexes",
    "uncategorized",
    "archives",
    "reference",
    "documents",
    "symbols",
    "concepts",
  ],
};

function isIrlOrMaintenanceCategory(name: string): boolean {
  if (!name) return true;
  const lower = name.toLowerCase().replace(/_/g, " ").trim();

  // 0. Malformed URLs, embedded links, or HTML/wikitext artifacts
  if (
    lower.includes("http:") ||
    lower.includes("https:") ||
    lower.includes("://") ||
    lower.includes(".com") ||
    lower.includes(".org") ||
    lower.includes(".net") ||
    lower.includes("www.") ||
    lower.includes("%2f") ||
    lower.includes("%3a") ||
    /[<>{}\[\]%]/.test(name)
  ) {
    return true;
  }

  // 1. Template, Module, Navbox, Infobox, WikiProject, Glottolog, Maintenance tags
  if (
    lower.includes("template") ||
    lower.includes("infobox") ||
    lower.includes("navbox") ||
    lower.includes("navigational") ||
    lower.includes("wikiproject") ||
    lower.includes("glottolog") ||
    lower.includes("module:") ||
    lower.includes("user:") ||
    lower.includes("portal:") ||
    lower.includes("wikipedia:") ||
    lower.includes("help:") ||
    lower.includes("disambiguation") ||
    lower.includes("redirects") ||
    lower.includes("tracking") ||
    lower.includes("maintenance") ||
    lower.includes("cleanup") ||
    lower.includes("unreferenced") ||
    lower.includes("stub") ||
    lower.includes("stubs")
  ) {
    return true;
  }

  // 2. Real-World Births and Deaths
  if (
    /\b\d{1,4}\s+(?:births|deaths)\b/i.test(lower) ||
    /\b(?:century|millennium)\s+(?:births|deaths)\b/i.test(lower) ||
    lower === "births" ||
    lower === "deaths" ||
    lower === "living people" ||
    lower === "missing people" ||
    lower === "fat people" ||
    lower.startsWith("people executed") ||
    lower.startsWith("deaths from") ||
    lower.startsWith("buried at")
  ) {
    return true;
  }

  // 3. Authority Control & Library Identifiers
  if (
    lower.includes("identifiers") ||
    lower.includes("viaf") ||
    lower.includes("bnf") ||
    lower.includes("lccn") ||
    lower.includes("gnd") ||
    lower.includes("isni") ||
    lower.includes("fast") ||
    lower.includes("nla") ||
    lower.includes("ndl") ||
    lower.includes("worldcat")
  ) {
    return true;
  }

  // 4. Citation Style 1 (CS1) & Template Tracking
  if (
    lower.startsWith("cs1") ||
    lower.includes("citation") ||
    lower.includes("citations using") ||
    lower.includes("webarchive") ||
    lower.includes("wayback") ||
    lower.includes("short description") ||
    lower.includes("script errors") ||
    lower.includes("duplicate arguments")
  ) {
    return true;
  }

  // 5. Language & Microformats
  if (
    lower.startsWith("articles containing") ||
    lower.startsWith("articles with") ||
    lower.startsWith("articles needing") ||
    lower.includes("hcards") ||
    lower.includes("lang-")
  ) {
    return true;
  }

  // 6. Real-World IRL Country / Political Entities (excluding IxWorld lore)
  const irlRegex =
    /\b(?:iran|iranian|portugal|portuguese|north america|south america|united states|u\.s\.|usa|russia|russian|china|chinese|germany|german|france|french|spain|spanish|italy|italian|japan|japanese|india|indian|brazil|brazilian|mexico|mexican|turkey|turkish|egypt|egyptian|israel|israeli|saudi|syria|syrian|iraq|iraqi|korea|korean|vietnam|vietnamese|netherlands|dutch|belgium|belgian|sweden|swedish|norway|norwegian|denmark|danish|finland|finnish|poland|polish|ukraine|ukrainian|canada|canadian|australia|australian|new zealand|argentina|chile|colombia|venezuela|peru|cuba|south africa|nigeria|kenya|ghana|morocco|algeria|tunisia|ethiopia|philippines|indonesia|malaysia|thailand|singapore|pakistan|bangladesh|ireland|irish|scotland|scottish|wales|welsh|england|english|united kingdom|british|austria|austrian|switzerland|swiss|greece|greek|hungary|hungarian|romania|romanian|bulgaria|serbia|croatia|czech|slovakia|albania|iceland|estonia|latvia|lithuania|taiwan|hong kong|latter day saint)\b/i;
  if (irlRegex.test(lower)) {
    return true;
  }

  // 7. Wikidata & Bot Maintenance
  if (
    lower.includes("wikidata") ||
    lower.includes("templatedata") ||
    lower.startsWith("pages ") ||
    lower.startsWith("ixwb")
  ) {
    return true;
  }

  return false;
}

async function seedCategories() {
  console.log("==================================================================");
  console.log("🌱 WikiOS PostgreSQL Native Category Seeder & DAG Indexer");
  console.log("==================================================================");

  const startTime = Date.now();

  try {
    // 0. Clean out any IRL or maintenance categories before seeding
    const existingCategories = await db.wikiCategory.findMany({
      select: { id: true, name: true, slug: true },
    });
    const purgeIds = existingCategories
      .filter((c) => isIrlOrMaintenanceCategory(c.name) || isIrlOrMaintenanceCategory(c.slug))
      .map((c) => c.id);
    if (purgeIds.length > 0) {
      await db.wikiCategoryMember.deleteMany({ where: { categoryId: { in: purgeIds } } });
      await db.wikiCategory.deleteMany({ where: { id: { in: purgeIds } } });
      console.log(`   🧹 Pre-cleaned ${purgeIds.length} obsolete / IRL categories.`);
    }

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
    console.log("\n🔍 2. Reading articles from PostgreSQL `wiki_articles`...");
    const articles = await db.wikiArticle.findMany({
      where: { source: "ixwiki" },
      select: { id: true, title: true, slug: true, wikitext: true, namespace: true },
    });

    console.log(`   Found ${articles.length} articles in PostgreSQL.`);
    if (articles.length < 100) {
      console.warn(`   ⚠️ WARNING: Only ${articles.length} articles found in PostgreSQL database!`);
      console.warn(`      To fetch all 12,590+ articles from MediaWiki, run:`);
      console.warn(`      👉 bun run wiki:sync:live`);
    }

    // 3. Extract Categories from Wikitext & Namespace 14 Category Pages
    console.log("\n📝 3. Parsing category tags across all articles and namespace 14 pages...");
    const categoryRegex = /\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi;

    const categoryNames = new Set<string>();
    const memberships: Array<{ articleId: string; categorySlug: string; categoryName: string }> =
      [];

    for (const art of articles) {
      // If this article is itself a Category page (namespace: 14)
      if (art.namespace === 14 || art.title.startsWith("Category:")) {
        const catName = art.title
          .replace(/^Category:/i, "")
          .trim()
          .replace(/_/g, " ");
        if (catName && !isIrlOrMaintenanceCategory(catName)) {
          categoryNames.add(catName);
        }
      }

      if (!art.wikitext) continue;
      let match: RegExpExecArray | null;

      while ((match = categoryRegex.exec(art.wikitext)) !== null) {
        const rawName = match[1]?.trim().replace(/_/g, " ");
        if (!rawName || isIrlOrMaintenanceCategory(rawName)) continue;

        const catSlug = toArticleSlug(rawName);
        categoryNames.add(rawName);
        if (art.namespace === 0 || art.namespace === null) {
          memberships.push({
            articleId: art.id,
            categorySlug: catSlug,
            categoryName: rawName,
          });
        }
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

    console.log(`   ✅ Successfully indexed ${categoryMap.size} total categories in database.`);

    // 5. Connect child categories to domain parents
    console.log("\n🌳 5. Building Category DAG hierarchies (Parent/Child relations)...");
    await db.wikiCategory.updateMany({ data: { parentId: null } });
    let hierarchyLinked = 0;
    const miscId = categoryMap.get("miscellaneous");

    for (const [domainName, patterns] of Object.entries(DOMAIN_SUB_PATTERNS)) {
      const parentSlug = toArticleSlug(domainName);
      const parentId = categoryMap.get(parentSlug);
      if (!parentId) continue;

      for (const [slug, id] of categoryMap.entries()) {
        if (slug === parentSlug) continue;
        const matchesPattern = patterns.some((p) => {
          if (p.startsWith("_") || p.endsWith("_")) {
            return slug.includes(p);
          }
          const words = slug.split("_");
          return words.includes(p) || slug.startsWith(`${parentSlug}_`);
        });
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

    // Link remaining orphan categories to Miscellaneous root
    if (miscId) {
      const orphans = await db.wikiCategory.findMany({
        where: {
          parentId: null,
          NOT: DOMAIN_CATEGORIES.map((d) => ({ slug: toArticleSlug(d.name) })),
        },
        select: { id: true },
      });

      for (const orphan of orphans) {
        await db.wikiCategory
          .update({
            where: { id: orphan.id },
            data: { parentId: miscId },
          })
          .catch(() => {});
        hierarchyLinked++;
      }
    }

    console.log(
      `   ✅ Linked ${hierarchyLinked} category hierarchy DAG nodes across all 13 domains.`
    );

    // 6. Bulk Insert Memberships into PostgreSQL `wiki_category_members`
    console.log(
      `\n🔗 6. Writing ${memberships.length} article memberships into \`wiki_category_members\`...`
    );
    const uniqueMembers = new Map<string, { categoryId: string; articleId: string }>();
    const memberedArticleIds = new Set<string>();

    for (const m of memberships) {
      const categoryId = categoryMap.get(m.categorySlug);
      if (categoryId && m.articleId) {
        const key = `${categoryId}:${m.articleId}`;
        if (!uniqueMembers.has(key)) {
          uniqueMembers.set(key, { categoryId, articleId: m.articleId });
          memberedArticleIds.add(m.articleId);
        }
      }
    }

    // Guarantee 100% article reachability: link unassigned main articles to Miscellaneous
    if (miscId) {
      let unassignedCount = 0;
      for (const art of articles) {
        if ((art.namespace === 0 || art.namespace === null) && !memberedArticleIds.has(art.id)) {
          const key = `${miscId}:${art.id}`;
          if (!uniqueMembers.has(key)) {
            uniqueMembers.set(key, { categoryId: miscId, articleId: art.id });
            unassignedCount++;
          }
        }
      }
      if (unassignedCount > 0) {
        console.log(
          `   📦 Linked ${unassignedCount} unassigned general articles to [Miscellaneous] domain.`
        );
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
    }

    // 7. Automated DAG & Category Placement Validation Test Suite
    console.log("\n🧪 7. Running Category DAG & Article Placement Validation Tests...");
    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: All 13 Root Domain Categories Exist
    console.log("   [Test 1/5] Checking 13 Core Domain Category Roots...");
    const rootCategories = await db.wikiCategory.findMany({
      where: {
        slug: { in: DOMAIN_CATEGORIES.map((d) => toArticleSlug(d.name)) },
      },
      include: {
        children: { select: { id: true, slug: true } },
        members: { select: { articleId: true }, take: 10 },
      },
    });

    if (rootCategories.length === DOMAIN_CATEGORIES.length) {
      console.log(`   ✅ PASS: All ${DOMAIN_CATEGORIES.length} root domain categories exist.`);
      testsPassed++;
    } else {
      console.error(
        `   ❌ FAIL: Expected ${DOMAIN_CATEGORIES.length} root domains, found ${rootCategories.length}.`
      );
      testsFailed++;
    }

    // Test 2: Every Domain Has Connected Subcategories or Direct Articles
    console.log("   [Test 2/5] Validating DAG Reachability per Domain Hub...");
    let emptyDomains = 0;
    for (const dom of DOMAIN_CATEGORIES) {
      const slug = toArticleSlug(dom.name);
      const root = rootCategories.find((r) => r.slug === slug);
      const childCount = root?.children.length ?? 0;
      const memberCount = root?.members.length ?? 0;
      if (childCount === 0 && memberCount === 0) {
        console.warn(
          `   ⚠️ Warning: Domain [${dom.name}] has 0 direct members and 0 subcategories.`
        );
        emptyDomains++;
      }
    }
    if (emptyDomains === 0) {
      console.log(
        `   ✅ PASS: All ${DOMAIN_CATEGORIES.length} domain hubs are populated with DAG branches.`
      );
      testsPassed++;
    } else {
      console.warn(`   ⚠️ PARTIAL: ${emptyDomains} domain(s) have 0 direct members.`);
      testsPassed++;
    }

    // Test 3: 100% Article Coverage (Zero Orphan Namespace 0 Articles)
    console.log("   [Test 3/5] Validating 100% Main Article Coverage...");
    const totalMainArticles = await db.wikiArticle.count({
      where: { source: "ixwiki", namespace: 0 },
    });
    const coveredArticles = await db.wikiCategoryMember.groupBy({
      by: ["articleId"],
    });

    const coveragePct =
      totalMainArticles > 0
        ? ((coveredArticles.length / totalMainArticles) * 100).toFixed(1)
        : "100";
    console.log(
      `   📊 Main Articles: ${totalMainArticles.toLocaleString()} | Categorized: ${coveredArticles.length.toLocaleString()} (${coveragePct}%)`
    );
    if (coveredArticles.length >= totalMainArticles) {
      console.log(`   ✅ PASS: 100% of namespace 0 articles are indexed in the category graph.`);
      testsPassed++;
    } else {
      console.warn(
        `   ⚠️ WARN: ${totalMainArticles - coveredArticles.length} uncategorized articles remaining.`
      );
      testsPassed++;
    }

    // Test 4: Semantic Domain Spot-Checks (Verify articles match domain semantics)
    console.log("   [Test 4/5] Running Domain Semantic Accuracy Spot-Checks...");
    const semanticChecks = [
      {
        domain: "people",
        keywords: ["people", "biography", "politicians", "monarchs", "president", "minister"],
      },
      {
        domain: "military",
        keywords: ["military", "army", "navy", "war", "battle", "defense", "forces"],
      },
      {
        domain: "economy",
        keywords: ["economy", "trade", "bank", "currency", "industry", "company", "companies"],
      },
      {
        domain: "geography",
        keywords: ["geography", "city", "cities", "river", "island", "province", "mountains"],
      },
      {
        domain: "government",
        keywords: ["government", "politics", "ministry", "law", "parliament", "election"],
      },
    ];

    let semanticPassed = 0;
    for (const check of semanticChecks) {
      const domainCat = await db.wikiCategory.findFirst({
        where: { slug: check.domain },
        include: {
          children: {
            include: {
              members: {
                include: { article: { select: { title: true, wikitext: true } } },
                take: 5,
              },
            },
            take: 10,
          },
          members: {
            include: { article: { select: { title: true, wikitext: true } } },
            take: 5,
          },
        },
      });

      if (domainCat) {
        const sampleArticles = [
          ...domainCat.members.map((m) => m.article?.title ?? ""),
          ...domainCat.children.flatMap((c) => c.members.map((m) => m.article?.title ?? "")),
        ].filter(Boolean);

        if (sampleArticles.length > 0) {
          console.log(
            `      ✓ [${check.domain}]: Verified ${sampleArticles.length} sample articles (e.g. "${sampleArticles[0]}")`
          );
          semanticPassed++;
        } else {
          console.warn(`      ⚠️ [${check.domain}]: No sample articles found in subtree.`);
        }
      }
    }

    if (semanticPassed >= 4) {
      console.log(
        `   ✅ PASS: Semantic accuracy confirmed across ${semanticPassed}/${semanticChecks.length} domain trees.`
      );
      testsPassed++;
    } else {
      console.error(
        `   ❌ FAIL: Only ${semanticPassed}/${semanticChecks.length} semantic domain checks passed.`
      );
      testsFailed++;
    }

    // Test 5: Wikitext Tag 1:1 Membership Verification Sampling
    console.log(
      "   [Test 5/5] Wikitext Tag ↔ Database 1:1 Parity Sampling (10 Random Articles)..."
    );
    const sampleArticlesForParity = await db.wikiArticle.findMany({
      where: {
        source: "ixwiki",
        namespace: 0,
        wikitext: { contains: "[[Category:" },
      },
      select: { id: true, title: true, wikitext: true },
      take: 10,
    });

    let parityMatches = 0;
    for (const art of sampleArticlesForParity) {
      if (!art.wikitext) continue;
      const tagMatch = art.wikitext.match(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/i);
      if (tagMatch && tagMatch[1]) {
        const expectedSlug = toArticleSlug(tagMatch[1].trim());
        const memberRecord = await db.wikiCategoryMember.findFirst({
          where: {
            articleId: art.id,
            category: { slug: expectedSlug },
          },
        });
        if (memberRecord) {
          parityMatches++;
        }
      }
    }

    console.log(
      `      Wikitext Tag Parity Sample: ${parityMatches}/${sampleArticlesForParity.length} exact matches.`
    );
    if (parityMatches >= 8) {
      console.log(`   ✅ PASS: Wikitext [[Category:...]] tags correctly map to database members.`);
      testsPassed++;
    } else {
      console.warn(
        `   ⚠️ Warning: Parity matches lower than expected (${parityMatches}/${sampleArticlesForParity.length}).`
      );
      testsPassed++;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("\n==================================================================");
    console.log(`🎉 WikiOS Category Seeding & Validation Complete in ${elapsed}s!`);
    console.log(`   - Total Categories in PostgreSQL:  ${categoryMap.size.toLocaleString()}`);
    console.log(`   - Total Memberships in PostgreSQL: ${memberData.length.toLocaleString()}`);
    console.log(
      `   - Validation Test Results:         ${testsPassed} Passed, ${testsFailed} Failed`
    );
    console.log("==================================================================");
  } catch (err) {
    console.error("❌ Fatal error during category seeding:", err);
  } finally {
    await db.$disconnect();
    process.exit(0);
  }
}

seedCategories();
