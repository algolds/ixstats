/**
 * scripts/audit/audit-wikios-db.ts — Standalone WikiOS PostgreSQL Diagnostic & Self-Audit Suite
 *
 * Runs comprehensive assertions on PostgreSQL `wiki_articles`, `wiki_revisions`,
 * `wiki_categories`, and `wiki_category_members` to verify database health and data integrity.
 *
 * Usage:
 *   bun run audit:wikios-db
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { cleanExcerpt } from "../../src/lib/wiki-os/transformers/excerpt";
import type { WikiArticleCardData, WikiCategoryPortalData } from "../../src/lib/wiki-os/types/canonical";

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

const EXPECTED_DOMAINS = [
  "Countries", "Economy", "Government", "Military",
  "People", "Politics", "History", "Geography",
  "Culture", "Technology", "Companies", "Nature",
  "Miscellaneous"
];

async function main() {
  console.log("==================================================================");
  console.log("🔬 WikiOS Database Diagnostic & Self-Audit Suite");
  console.log(`   Database URL: ${process.env.DATABASE_URL?.split("@")[1] || "Local PostgreSQL"}`);
  console.log("==================================================================");

  let errors = 0;
  let warnings = 0;

  // 1. Article Count & Namespace Check
  console.log("\n📦 1. Checking Article Counts and Namespaces...");
  const articleCount = await prisma.wikiArticle.count({ where: { source: "ixwiki" } });
  console.log(`   Total Wiki Articles: ${articleCount.toLocaleString()}`);

  if (articleCount < 100) {
    console.error(`   ❌ FATAL: wiki_articles count is critically low (${articleCount} < 100). Database requires sync!`);
    errors++;
  } else if (articleCount < 4000) {
    console.warn(`   ⚠️ WARNING: wiki_articles count is below canonical threshold (${articleCount} < 4,000).`);
    warnings++;
  } else {
    console.log(`   ✅ Article count meets production threshold (>= 4,000).`);
  }

  const nsDistribution = await prisma.wikiArticle.groupBy({
    by: ["namespace"],
    where: { source: "ixwiki" },
    _count: { id: true },
  });
  console.log("   Namespace Breakdown:");
  for (const ns of nsDistribution) {
    const label = ns.namespace === 0 ? "Main (Articles)" :
                  ns.namespace === 14 ? "Categories" :
                  ns.namespace === 10 ? "Templates" :
                  ns.namespace === 2 ? "User Pages" :
                  ns.namespace === 4 ? "Project Pages" : `Namespace ${ns.namespace}`;
    console.log(`     - ${label.padEnd(20)}: ${ns._count.id.toLocaleString()}`);
  }

  // 2. Revision Ledger Check
  console.log("\n📜 2. Checking Revision History Ledger...");
  const revCount = await prisma.wikiRevision.count({ where: { source: "ixwiki" } });
  console.log(`   Total Wiki Revisions: ${revCount.toLocaleString()}`);

  if (revCount < 1000) {
    console.error(`   ❌ ERROR: wiki_revisions count is low (${revCount} < 1,000).`);
    errors++;
  } else {
    console.log(`   ✅ Revision ledger is healthy.`);
  }

  // 3. Category DAG & Membership Check
  console.log("\n🌳 3. Checking Category DAG Taxonomy & Memberships...");
  const categoryCount = await prisma.wikiCategory.count();
  const memberCount = await prisma.wikiCategoryMember.count();
  console.log(`   Total Categories:  ${categoryCount.toLocaleString()}`);
  console.log(`   Total Memberships: ${memberCount.toLocaleString()}`);

  if (categoryCount < 500) {
    console.warn(`   ⚠️ WARNING: Total categories count (${categoryCount}) is below expected (~750).`);
    warnings++;
  } else {
    console.log(`   ✅ Category taxonomy is populated.`);
  }

  if (memberCount < 3000) {
    console.warn(`   ⚠️ WARNING: Total category memberships (${memberCount}) is below expected (~5,000).`);
    warnings++;
  } else {
    console.log(`   ✅ Category membership graph is connected.`);
  }

  // 4. Validate All 12 Core Domains
  console.log("\n🏛️ 4. Validating 12 Core Domain Taxonomies...");
  for (const domain of EXPECTED_DOMAINS) {
    const slug = domain.toLowerCase();
    const cat = await prisma.wikiCategory.findFirst({
      where: { OR: [{ slug }, { name: { equals: domain, mode: "insensitive" } }] },
      include: {
        _count: { select: { members: true, children: true } },
      },
    });

    if (!cat) {
      console.error(`   ❌ Missing domain category: "${domain}"`);
      errors++;
    } else {
      console.log(`   ✅ Domain [${domain.padEnd(12)}]: ${cat._count.members.toString().padStart(4)} direct members, ${cat._count.children.toString().padStart(3)} subcategories`);
    }
  }

  // 5. Author Identity & Loreward Statistics
  console.log("\n👤 5. Checking Author Identity & Loreward Scoring...");
  const loreStatsCount = await prisma.lorewardUserStats.count();
  console.log(`   Tracked Loreward User Profiles: ${loreStatsCount.toLocaleString()}`);

  const topAuthors = await prisma.lorewardUserStats.findMany({
    orderBy: { totalScore: "desc" },
    take: 5,
    select: { username: true, totalScore: true, totalBytes: true },
  });

  if (topAuthors.length > 0) {
    console.log("   Top Active Editors:");
    for (const a of topAuthors) {
      console.log(`     - ${a.username.padEnd(20)}: Score: ${a.totalScore.toLocaleString()}, Bytes: ${a.totalBytes.toLocaleString()}`);
    }
  }

  // 6. Universal Type Contract Serialization Test
  console.log("\n🧪 6. Testing Universal Canonical Type Serialization...");
  const sampleArticle = await prisma.wikiArticle.findFirst({
    where: { source: "ixwiki", namespace: 0, wikitext: { not: "" } },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      wikitext: true,
      leadImageUrl: true,
      wordCount: true,
      readingTime: true,
      namespace: true,
      source: true,
      createdAt: true,
      revisions: { take: 1, orderBy: { createdAt: "desc" }, select: { author: true } },
    },
  });

  if (sampleArticle) {
    const cardData: WikiArticleCardData = {
      id: sampleArticle.id,
      slug: sampleArticle.slug,
      title: sampleArticle.title,
      excerpt: sampleArticle.summary || cleanExcerpt(sampleArticle.wikitext, 220),
      thumbnail: sampleArticle.leadImageUrl,
      author: sampleArticle.revisions[0]?.author || "MediaWiki Editor",
      timestamp: sampleArticle.createdAt.toISOString(),
      categories: [],
      namespace: sampleArticle.namespace ?? 0,
      wordCount: sampleArticle.wordCount ?? 0,
      readingTime: sampleArticle.readingTime ?? 1,
      source: "ixwiki",
    };

    console.log(`   Sample Article: "${cardData.title}"`);
    console.log(`   Excerpt: "${cardData.excerpt.slice(0, 80)}..."`);
    console.log(`   Thumbnail: ${cardData.thumbnail || "None"}`);
    console.log(`   ✅ Serialization to WikiArticleCardData passed successfully.`);
  }

  console.log("\n==================================================================");
  if (errors === 0) {
    console.log(`🎉 WikiOS Database Audit PASSED with ${warnings} warnings.`);
  } else {
    console.error(`❌ WikiOS Database Audit FAILED with ${errors} critical errors and ${warnings} warnings.`);
  }
  console.log("==================================================================");

  await prisma.$disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal Audit Runner Error:", err);
  process.exit(1);
});
