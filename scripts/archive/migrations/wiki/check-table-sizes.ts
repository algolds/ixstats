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
  console.log("💾 PostgreSQL WikiOS Storage & Table Footprint Inspection");
  console.log("==================================================================");

  const tables = [
    "wiki_articles",
    "wiki_templates",
    "wiki_revisions",
    "wiki_links",
    "wiki_assets",
    "wiki_categories",
    "wiki_category_members",
    "wiki_watchlists",
    "wiki_logs",
  ];

  let totalBytesAll = 0;

  console.log("\n📊 Table Footprints (Data + Indexes):");
  console.log("------------------------------------------------------------------");

  for (const table of tables) {
    try {
      const result: any = await prisma.$queryRawUnsafe(`
        SELECT 
          pg_size_pretty(pg_relation_size('${table}')) AS data_size,
          pg_size_pretty(pg_total_relation_size('${table}')) AS total_size,
          pg_total_relation_size('${table}') AS total_bytes,
          (SELECT COUNT(*) FROM "${table}") AS row_count;
      `);

      const row = result[0];
      if (row) {
        totalBytesAll += Number(row.total_bytes);
        console.log(
          `   • ${table.padEnd(24)} : ${Number(row.row_count).toLocaleString().padStart(7)} rows | Data: ${row.data_size.padStart(8)} | Total: ${row.total_size.padStart(8)}`
        );
      }
    } catch (err: any) {
      console.log(`   • ${table.padEnd(24)} : (table does not exist or empty)`);
    }
  }

  // Template namespace articles specifically
  try {
    const templateArticlesSize: any = await prisma.$queryRawUnsafe(`
      SELECT 
        pg_size_pretty(SUM(pg_column_size(wikitext))::bigint) AS wikitext_size,
        COUNT(*) AS template_article_count
      FROM wiki_articles 
      WHERE namespace = 10;
    `);

    const tRow = templateArticlesSize[0];
    console.log("\n🧩 Namespace 10 (Templates in wiki_articles) Footprint:");
    console.log(`   - Total Template Articles:  ${Number(tRow.template_article_count).toLocaleString()}`);
    console.log(`   - Raw Wikitext Size:        ${tRow.wikitext_size || "0 bytes"}`);
  } catch (err) {
    // ignore
  }

  // Total DB size
  const totalPrettyResult: any = await prisma.$queryRawUnsafe(`
    SELECT pg_size_pretty(SUM(pg_total_relation_size(quote_ident(tablename)))::bigint) as total_db_size
    FROM pg_tables
    WHERE schemaname = 'public';
  `);

  console.log("------------------------------------------------------------------");
  console.log(`📦 Total WikiOS Storage Footprint: ${(totalBytesAll / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`🏢 Entire PostgreSQL Public DB:    ${totalPrettyResult[0]?.total_db_size || "N/A"}`);
  console.log("==================================================================");
}

main()
  .catch((err) => {
    console.error("❌ Storage inspection failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
