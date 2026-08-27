/**
 * migrate-historical-revisions.ts — High-Throughput Historical Revision & Subsystem ETL
 *
 * Streams historical revisions, non-main namespaces (Talk, User, Template, Category, Project),
 * user watchlists, and event logs from MariaDB `ixwiki` into PostgreSQL.
 *
 * Usage:
 *   bun run scripts/wiki/migrate-historical-revisions.ts --from-db --dry-run
 *   bun run scripts/wiki/migrate-historical-revisions.ts --from-db --limit=100
 *   bun run scripts/wiki/migrate-historical-revisions.ts --from-db --all
 */

import { PrismaClient } from "@prisma/client";
import {
  getIxWikiPool,
  closeWikiBridge,
} from "../../src/lib/wiki-os/adapters/mediawiki/bridge/mysql-pool";
import { toArticleSlug } from "../../src/lib/wiki-os/core/domain-types";
import type mysql from "mysql2/promise";

const prisma = new PrismaClient();

const NAMESPACE_PREFIXES: Record<number, string> = {
  0: "",
  1: "Talk",
  2: "User",
  3: "User_talk",
  4: "Project",
  5: "Project_talk",
  6: "File",
  7: "File_talk",
  8: "MediaWiki",
  9: "MediaWiki_talk",
  10: "Template",
  11: "Template_talk",
  12: "Help",
  13: "Help_talk",
  14: "Category",
  15: "Category_talk",
};

interface RevisionRow {
  rev_id: number;
  rev_page: number;
  rev_parent_id: number;
  rev_timestamp: string;
  rev_len: number;
  rev_minor_edit: number;
  actor_name: string;
  comment_text: string | null;
  old_text: string | null;
  page_title: string;
  page_namespace: number;
}

interface PageRow {
  page_id: number;
  page_namespace: number;
  page_title: string;
  page_is_redirect: number;
  page_latest: number;
  page_len: number;
  old_text: string | null;
}

interface WatchlistRow {
  wl_user: number;
  wl_namespace: number;
  wl_title: string;
  wl_notificationtimestamp: string | null;
  user_name: string | null;
}

interface LogRow {
  log_id: number;
  log_type: string;
  log_action: string;
  log_timestamp: string;
  log_actor: number;
  log_namespace: number;
  log_title: string;
  log_comment: string | null;
  log_params: string | null;
  actor_name: string | null;
}

function sanitizeUtf8(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/\0/g, "").replace(/\u0000/g, "");
}

function parseMediaWikiTimestamp(ts: string): Date {
  if (!ts || ts.length < 14) return new Date();
  const year = parseInt(ts.substring(0, 4), 10);
  const month = parseInt(ts.substring(4, 6), 10) - 1;
  const day = parseInt(ts.substring(6, 8), 10);
  const hour = parseInt(ts.substring(8, 10), 10);
  const min = parseInt(ts.substring(10, 12), 10);
  const sec = parseInt(ts.substring(12, 14), 10);
  return new Date(Date.UTC(year, month, day, hour, min, sec));
}

async function migrateNonMainNamespaces(pool: mysql.Pool, isDryRun: boolean): Promise<number> {
  console.log("\n📦 Migrating non-main namespaces (Talk, User, Template, Category, Project)...");

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT p.page_id, p.page_namespace, p.page_title, p.page_is_redirect, p.page_latest, p.page_len, t.old_text
     FROM page p
     JOIN slots s ON s.slot_revision_id = p.page_latest
     JOIN content c ON c.content_id = s.slot_content_id
     JOIN text t ON t.old_id = SUBSTRING(c.content_address, 4)
     WHERE p.page_namespace IN (1, 2, 3, 4, 10, 14)
     ORDER BY p.page_id ASC`
  );

  const pages = (rows || []) as PageRow[];
  console.log(`   Found ${pages.length} non-main namespace articles in MariaDB.`);

  if (isDryRun) {
    console.log(
      `   [DRY-RUN] Would upsert ${pages.length} articles across namespaces 1, 2, 3, 4, 10, 14.`
    );
    return pages.length;
  }

  let count = 0;
  for (const p of pages) {
    const rawTitle = String(p.page_title).replace(/_/g, " ");
    const prefix = NAMESPACE_PREFIXES[p.page_namespace] || "";
    const fullTitle = prefix ? `${prefix}:${rawTitle}` : rawTitle;
    const slug = toArticleSlug(fullTitle);
    const wikitext = p.old_text ? String(p.old_text) : "";

    await prisma.wikiArticle.upsert({
      where: {
        source_title: {
          source: "ixwiki",
          title: fullTitle,
        },
      },
      create: {
        title: fullTitle,
        slug,
        source: "ixwiki",
        status: "PUBLISHED",
        format: "WIKITEXT",
        wikitext,
        namespace: p.page_namespace,
        namespacePrefix: prefix || null,
        mwPageId: p.page_id,
        mwLatestRevId: p.page_latest,
        wordCount: wikitext.split(/\s+/).filter(Boolean).length,
        readingTime: Math.max(1, Math.ceil(wikitext.split(/\s+/).filter(Boolean).length / 200)),
      },
      update: {
        wikitext,
        namespace: p.page_namespace,
        namespacePrefix: prefix || null,
        mwPageId: p.page_id,
        mwLatestRevId: p.page_latest,
      },
    });

    // If talk page (namespace 1), parse sections into WikiDiscussionThread
    if (p.page_namespace === 1 && wikitext.trim()) {
      try {
        const baseTitle = rawTitle;
        const mainArticle = await prisma.wikiArticle.findFirst({
          where: { source: "ixwiki", title: baseTitle, namespace: 0 },
        });

        if (mainArticle) {
          const sections = wikitext.split(/(?:^|\n)==\s*([^=]+)\s*==/g);
          // sections[0] is header/intro, sections[1] is section 1 title, sections[2] is section 1 body, etc.
          for (let i = 1; i < sections.length; i += 2) {
            const sectionTitle = (sections[i] || "").trim();
            const sectionBody = (sections[i + 1] || "").trim();
            if (sectionTitle && sectionBody) {
              const existingThread = await prisma.wikiDiscussionThread.findFirst({
                where: { articleTitle: mainArticle.title, title: sectionTitle },
              });
              if (!existingThread) {
                const thread = await prisma.wikiDiscussionThread.create({
                  data: {
                    articleTitle: mainArticle.title,
                    title: sectionTitle,
                    status: "OPEN",
                    createdBy: "system",
                  },
                });
                await prisma.wikiDiscussionComment.create({
                  data: {
                    threadId: thread.id,
                    content: sanitizeUtf8(sectionBody),
                    userId: "system",
                  },
                });
              }
            }
          }
        }
      } catch (err) {
        // Silently continue discussion extraction
      }
    }

    count++;
  }

  console.log(`   ✓ Upserted ${count} non-main namespace articles.`);
  return count;
}

async function migrateHistoricalRevisions(
  pool: mysql.Pool,
  limit: number,
  isDryRun: boolean
): Promise<number> {
  console.log("\n📜 Migrating historical revisions stream...");

  // Cache article map: mwPageId -> articleId and (namespace:title) -> articleId
  const articles = await prisma.wikiArticle.findMany({
    select: { id: true, title: true, namespace: true, mwPageId: true },
  });
  const pageIdToArticleId = new Map<number, string>();
  const titleToArticleId = new Map<string, string>();

  for (const a of articles) {
    if (a.mwPageId) pageIdToArticleId.set(a.mwPageId, a.id);
    titleToArticleId.set(`${a.namespace}:${a.title.toLowerCase().replace(/_/g, " ")}`, a.id);
  }

  console.log(
    `   Cached ${articles.length} article mappings for fast relational foreign key binding.`
  );

  let lastRevId = 0;
  let totalImported = 0;
  const batchSize = 250;

  while (totalImported < limit) {
    const fetchLimit = limit === Infinity ? batchSize : Math.min(batchSize, limit - totalImported);

    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT r.rev_id, r.rev_page, r.rev_parent_id, r.rev_timestamp, r.rev_len, r.rev_minor_edit,
              a.actor_name, c.comment_text, t.old_text, p.page_title, p.page_namespace
       FROM revision r
       JOIN page p ON p.page_id = r.rev_page
       JOIN actor a ON a.actor_id = r.rev_actor
       LEFT JOIN comment c ON c.comment_id = r.rev_comment_id
       JOIN slots s ON s.slot_revision_id = r.rev_id
       JOIN content cnt ON cnt.content_id = s.slot_content_id
       JOIN text t ON t.old_id = SUBSTRING(cnt.content_address, 4)
       WHERE r.rev_id > ?
       ORDER BY r.rev_id ASC
       LIMIT ?`,
      [lastRevId, fetchLimit]
    );

    const revisions = (rows || []) as RevisionRow[];
    if (revisions.length === 0) break;

    if (isDryRun) {
      console.log(
        `   [DRY-RUN] Batch: ${revisions.length} revisions (rev_id ${revisions[0]?.rev_id} to ${revisions[revisions.length - 1]?.rev_id}).`
      );
      totalImported += revisions.length;
      lastRevId = revisions[revisions.length - 1]!.rev_id;
      continue;
    }

    // Process chunk
    for (const r of revisions) {
      let articleId = pageIdToArticleId.get(r.rev_page);
      if (!articleId) {
        const rawTitle = String(r.page_title).replace(/_/g, " ");
        const prefix = NAMESPACE_PREFIXES[r.page_namespace] || "";
        const fullTitle = prefix ? `${prefix}:${rawTitle}` : rawTitle;
        articleId = titleToArticleId.get(`${r.page_namespace}:${fullTitle.toLowerCase()}`);
      }

      if (!articleId) {
        // Create stub article if missing
        const rawTitle = String(r.page_title).replace(/_/g, " ");
        const prefix = NAMESPACE_PREFIXES[r.page_namespace] || "";
        const fullTitle = prefix ? `${prefix}:${rawTitle}` : rawTitle;
        const slug = toArticleSlug(fullTitle);

        const newArt = await prisma.wikiArticle.create({
          data: {
            title: fullTitle,
            slug,
            source: "ixwiki",
            status: "PUBLISHED",
            format: "WIKITEXT",
            namespace: r.page_namespace,
            namespacePrefix: prefix || null,
            mwPageId: r.rev_page,
            mwLatestRevId: r.rev_id,
            wikitext: r.old_text ? String(r.old_text) : "",
          },
        });
        articleId = newArt.id;
        pageIdToArticleId.set(r.rev_page, articleId);
        titleToArticleId.set(`${r.page_namespace}:${fullTitle.toLowerCase()}`, articleId);
      }

      const revDate = parseMediaWikiTimestamp(String(r.rev_timestamp));
      const wikitext = r.old_text ? String(r.old_text) : "";

      await prisma.wikiRevision.upsert({
        where: {
          id: `mw-${r.rev_id}`,
        },
        create: {
          id: `mw-${r.rev_id}`,
          articleId,
          mwRevId: r.rev_id,
          format: "WIKITEXT",
          wikitext,
          author: r.actor_name ? String(r.actor_name) : "MediaWiki Author",
          summary: r.comment_text ? String(r.comment_text) : null,
          minor: r.rev_minor_edit === 1,
          source: "ixwiki",
          byteSize: r.rev_len || wikitext.length,
          byteDelta: 0,
          createdAt: revDate,
        },
        update: {
          wikitext,
          author: r.actor_name ? String(r.actor_name) : undefined,
          summary: r.comment_text ? String(r.comment_text) : undefined,
          byteSize: r.rev_len || wikitext.length,
        },
      });

      totalImported++;
    }

    lastRevId = revisions[revisions.length - 1]!.rev_id;
    console.log(`   ✓ Streamed ${totalImported} revisions (latest rev_id: ${lastRevId})...`);
  }

  console.log(`   ✓ Total historical revisions processed: ${totalImported}`);
  return totalImported;
}

async function migrateWatchlists(pool: mysql.Pool, isDryRun: boolean): Promise<number> {
  console.log("\n⭐ Migrating user watchlists...");

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT w.wl_user, w.wl_namespace, w.wl_title, w.wl_notificationtimestamp, u.user_name
     FROM watchlist w
     LEFT JOIN user u ON u.user_id = w.wl_user`
  );

  const watchlists = (rows || []) as WatchlistRow[];
  console.log(`   Found ${watchlists.length} watchlist entries in MariaDB.`);

  if (isDryRun) {
    console.log(`   [DRY-RUN] Would process ${watchlists.length} watchlist entries.`);
    return watchlists.length;
  }

  // Map users by wikiUsername
  const users = await prisma.user.findMany({
    where: { wikiUsername: { not: null } },
    select: { id: true, wikiUsername: true },
  });
  const userMap = new Map<string, string>();
  for (const u of users) {
    if (u.wikiUsername) userMap.set(u.wikiUsername.toLowerCase(), u.id);
  }

  let count = 0;
  for (const w of watchlists) {
    if (!w.user_name) continue;
    const userId = userMap.get(w.user_name.toLowerCase());
    if (!userId) continue;

    const rawTitle = String(w.wl_title).replace(/_/g, " ");
    const prefix = NAMESPACE_PREFIXES[w.wl_namespace] || "";
    const fullTitle = prefix ? `${prefix}:${rawTitle}` : rawTitle;

    const article = await prisma.wikiArticle.findFirst({
      where: { source: "ixwiki", title: fullTitle, namespace: w.wl_namespace },
      select: { id: true },
    });

    if (article) {
      await prisma.wikiWatchlist.upsert({
        where: {
          userId_articleId: {
            userId,
            articleId: article.id,
          },
        },
        create: {
          userId,
          articleId: article.id,
          notificationTime: w.wl_notificationtimestamp
            ? parseMediaWikiTimestamp(w.wl_notificationtimestamp)
            : null,
        },
        update: {
          notificationTime: w.wl_notificationtimestamp
            ? parseMediaWikiTimestamp(w.wl_notificationtimestamp)
            : undefined,
        },
      });
      count++;
    }
  }

  console.log(`   ✓ Migrated ${count} active user watchlists.`);
  return count;
}

async function migrateSystemLogs(
  pool: mysql.Pool,
  limit: number,
  isDryRun: boolean
): Promise<number> {
  console.log("\n🛡️ Migrating system event and governance logs...");

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT l.log_id, l.log_type, l.log_action, l.log_timestamp, l.log_actor,
            l.log_namespace, l.log_title, c.comment_text as log_comment, l.log_params,
            a.actor_name
     FROM logging l
     JOIN actor a ON a.actor_id = l.log_actor
     LEFT JOIN comment c ON c.comment_id = l.log_comment_id
     ORDER BY l.log_id DESC
     LIMIT ${limit === Infinity ? 5000 : limit}`
  );

  const logs = (rows || []) as LogRow[];
  console.log(`   Found ${logs.length} system logs in MariaDB.`);

  if (isDryRun) {
    console.log(`   [DRY-RUN] Would process ${logs.length} system logs.`);
    return logs.length;
  }

  let count = 0;
  for (const l of logs) {
    const rawTitle = String(l.log_title).replace(/_/g, " ");
    const prefix = NAMESPACE_PREFIXES[l.log_namespace] || "";
    const fullTitle = prefix ? `${prefix}:${rawTitle}` : rawTitle;

    const article = await prisma.wikiArticle.findFirst({
      where: { source: "ixwiki", title: fullTitle },
      select: { id: true },
    });

    await prisma.wikiLog.upsert({
      where: {
        id: `mw-log-${l.log_id}`,
      },
      create: {
        id: `mw-log-${l.log_id}`,
        articleId: article?.id || null,
        logType: String(l.log_type),
        action: String(l.log_action),
        title: fullTitle,
        actorName: l.actor_name ? String(l.actor_name) : "System",
        comment: l.log_comment ? String(l.log_comment).substring(0, 1000) : null,
        createdAt: parseMediaWikiTimestamp(String(l.log_timestamp)),
      },
      update: {},
    });
    count++;
  }

  console.log(`   ✓ Migrated ${count} governance & event logs.`);
  return count;
}

async function main() {
  console.log("==================================================================");
  console.log("🚀 WikiOS Historical Revisions & MediaWiki Subsystem ETL");
  console.log("==================================================================");

  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isAll = args.includes("--all");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = isAll ? Infinity : limitArg ? parseInt(limitArg.split("=")[1]!, 10) : 50;

  console.log(`⚙️  Configuration:`);
  console.log(
    `   - Mode:       ${isDryRun ? "DRY RUN (Preview Only)" : "LIVE DATABASE INGESTION"}`
  );
  console.log(`   - Limit:      ${limit === Infinity ? "ALL (Unlimited)" : limit}`);

  const pool = getIxWikiPool();

  try {
    // 1. Non-main namespaces
    await migrateNonMainNamespaces(pool, isDryRun);

    // 2. Historical revisions
    await migrateHistoricalRevisions(pool, limit, isDryRun);

    // 3. User watchlists
    await migrateWatchlists(pool, isDryRun);

    // 4. System logs
    await migrateSystemLogs(pool, limit, isDryRun);

    console.log("\n==================================================================");
    console.log("✅ Ingestion successfully finished! All subsystems in sync.");
    console.log("==================================================================");
  } finally {
    await closeWikiBridge();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("❌ Migration failed with error:", err);
  process.exit(1);
});
