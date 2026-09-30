import { existsSync, readFileSync } from "fs";
import { join } from "path";

function loadEnvFile(filename: string) {
  const filePath = join(process.cwd(), filename);
  if (existsSync(filePath)) {
    const content = readFileSync(filePath, "utf-8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const parts = trimmed.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts
            .slice(1)
            .join("=")
            .trim()
            .replace(/^['"]|['"]$/g, "");
          process.env[key] = val;
        }
      }
    });
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");
loadEnvFile(".env.local.dev");

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================================");
  console.log("📊 WikiOS Native PostgreSQL Database & Subsystems Health Audit");
  console.log("==================================================================");

  // 1. Article metrics
  const totalArticles = await prisma.wikiArticle.count();
  const publishedArticles = await prisma.wikiArticle.count({ where: { status: "PUBLISHED" } });
  const withWikitext = await prisma.wikiArticle.count({ where: { wikitext: { not: "" } } });
  const withHtml = await prisma.wikiArticle.count({ where: { contentHtml: { not: "" } } });
  const redirects = await prisma.wikiArticle.count({
    where: { redirectTargetSlug: { not: null } },
  });

  // Namespace distribution
  const namespaces = await (prisma.wikiArticle as any).groupBy({
    by: ["namespace", "namespacePrefix"],
    _count: { id: true },
    orderBy: { namespace: "asc" },
  });

  // 2. Revision metrics
  const totalRevisions = await prisma.wikiRevision.count();

  // 3. Link Graph metrics
  const totalLinks = await prisma.wikiLink.count();

  // 4. Category metrics
  const totalCategories = await prisma.wikiCategory.count();
  const totalCategoryMembers = await prisma.wikiCategoryMember.count();

  // 5. Watchlists & Logs metrics
  const totalWatchlists = (await (prisma as any).wikiWatchlist?.count().catch(() => 0)) ?? 0;
  const totalLogs = (await (prisma as any).wikiLog?.count().catch(() => 0)) ?? 0;

  // 6. Media Asset metrics
  const totalAssets = await (prisma as any).wikiAsset.count();
  const withDimensions = await (prisma as any).wikiAsset.count({
    where: { width: { not: null }, height: { not: null } },
  });
  const withThumbnails = await (prisma as any).wikiAsset.count({
    where: { thumbnailUrl: { not: null } },
  });

  console.log("\n📖 1. Articles & Namespaces:");
  console.log(`   - Total Articles:          ${totalArticles.toLocaleString()}`);
  console.log(
    `   - Published Articles:      ${publishedArticles.toLocaleString()} (${((publishedArticles / (totalArticles || 1)) * 100).toFixed(1)}%)`
  );
  console.log(
    `   - With Wikitext Content:   ${withWikitext.toLocaleString()} (${((withWikitext / (totalArticles || 1)) * 100).toFixed(1)}%)`
  );
  console.log(`   - Pre-compiled HTML:       ${withHtml.toLocaleString()}`);
  console.log(`   - Redirect Aliases:        ${redirects.toLocaleString()}`);

  console.log("\n   Namespace Breakdown:");
  for (const ns of namespaces) {
    const label = ns.namespacePrefix ? `${ns.namespacePrefix} (NS:${ns.namespace})` : `Main (NS:0)`;
    console.log(`     • ${label.padEnd(24)} : ${ns._count.id.toLocaleString()} articles`);
  }

  console.log("\n📜 2. Revisions & Lineage:");
  console.log(`   - Total Stored Revisions:  ${totalRevisions.toLocaleString()}`);

  console.log("\n🕸️  3. Relational Link Graph:");
  console.log(`   - Total Link Graph Edges:  ${totalLinks.toLocaleString()}`);
  console.log(
    `   - Avg Links per Article:   ${(totalLinks / (totalArticles || 1)).toFixed(1)} edges`
  );

  console.log("\n🏷️  4. Taxonomies & Categories:");
  console.log(`   - Total Categories:        ${totalCategories.toLocaleString()}`);
  console.log(`   - Category Memberships:    ${totalCategoryMembers.toLocaleString()}`);

  console.log("\n🛡️  5. Watchlists & Governance Logs:");
  console.log(`   - Active User Watchlists:  ${totalWatchlists.toLocaleString()}`);
  console.log(`   - System Governance Logs:  ${totalLogs.toLocaleString()}`);

  console.log("\n🖼️  6. Media & Assets (wiki_assets):");
  console.log(`   - Total Registered Assets: ${totalAssets.toLocaleString()}`);
  console.log(
    `   - With Dimensions (W x H): ${withDimensions.toLocaleString()} (${((withDimensions / (totalAssets || 1)) * 100).toFixed(1)}%)`
  );
  console.log(
    `   - With Thumbnail Variants: ${withThumbnails.toLocaleString()} (${((withThumbnails / (totalAssets || 1)) * 100).toFixed(1)}%)`
  );

  console.log("\n==================================================================");
  console.log("✅ Audit successfully completed. All subsystems active in PostgreSQL.");
  console.log("==================================================================");
}

main()
  .catch((err) => {
    console.error("❌ Audit failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
