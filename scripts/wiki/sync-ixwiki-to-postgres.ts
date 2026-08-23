// scripts/wiki/sync-ixwiki-to-postgres.ts
// Synchronizes published IxWiki articles from MariaDB directly into PostgreSQL WikiArticle table.

import { PrismaClient } from "@prisma/client";
import { getIxWikiPool } from "~/lib/wiki-os/adapters/mediawiki/bridge/mysql-pool";
import { extractIntroFromWikitext } from "~/lib/wiki-os/core/native-search-service";
import type mysql from "mysql2/promise";

const prisma = new PrismaClient();

interface SyncOptions {
  limit?: number;
  verbose?: boolean;
}

function parseArgs(): SyncOptions {
  const args = process.argv.slice(2);
  const options: SyncOptions = {};

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      options.limit = parseInt(arg.split("=")[1] || "0", 10);
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    }
  }

  return options;
}

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function runSync() {
  const options = parseArgs();
  console.log("🚀 Starting IxWiki to PostgreSQL Sync...");
  if (options.limit) console.log(`   Limit: ${options.limit} articles`);

  const pool = getIxWikiPool();

  try {
    // 1. Fetch published namespace 0 pages with latest text
    let query = `
      SELECT p.page_id, p.page_title, p.page_len, p.page_touched, p.page_latest,
             t.old_text, t.old_id
      FROM page p
      JOIN slots s ON s.slot_revision_id = p.page_latest
      JOIN content c ON c.content_id = s.slot_content_id
      JOIN text t ON t.old_id = SUBSTRING(c.content_address, 4)
      WHERE p.page_namespace = 0
        AND p.page_is_redirect = 0
      ORDER BY p.page_len DESC
    `;

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const [rows] = await pool.execute<mysql.RowDataPacket[]>(query);
    console.log(`📦 Retrieved ${rows.length} published articles from MariaDB.`);

    let synced = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const rawTitle = String(row.page_title).replace(/_/g, " ");
        const wikitext = String(row.old_text || "");
        const slug = toSlug(rawTitle);
        const intro = extractIntroFromWikitext(wikitext).slice(0, 480);
        const wordCount = Math.round(wikitext.length / 6);
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));

        await prisma.wikiArticle.upsert({
          where: {
            source_title: {
              source: "ixwiki",
              title: rawTitle,
            },
          },
          create: {
            title: rawTitle,
            slug,
            source: "ixwiki",
            status: "PUBLISHED",
            format: "WIKITEXT",
            wikitext,
            summary: intro || "WikiOS article entry.",
            wordCount,
            readingTime,
            mwPageId: Number(row.page_id),
            mwLatestRevId: Number(row.page_latest),
            syncedAt: new Date(),
          },
          update: {
            slug,
            wikitext,
            summary: intro || "WikiOS article entry.",
            wordCount,
            readingTime,
            mwPageId: Number(row.page_id),
            mwLatestRevId: Number(row.page_latest),
            syncedAt: new Date(),
          },
        });

        synced++;
        if (options.verbose || synced % 100 === 0 || synced === rows.length) {
          console.log(`   [${synced}/${rows.length}] Synced: "${rawTitle}" (${wordCount} words)`);
        }
      } catch (err) {
        errors++;
        if (options.verbose) {
          console.error(`   ❌ Failed to sync row ${row.page_id}:`, err);
        }
      }
    }

    console.log("\n✅ Sync Complete!");
    console.log(`   Total Synced: ${synced}`);
    console.log(`   Errors: ${errors}`);
  } catch (err) {
    console.error("❌ Fatal sync error:", err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runSync();
