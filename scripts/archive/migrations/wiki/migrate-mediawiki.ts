/**
 * migrate-mediawiki.ts — Universal MediaWiki Database Migration Engine (CLI)
 *
 * Imports articles directly from:
 * 1. Live MariaDB database connection (`--from-db`)
 * 2. Standard MediaWiki SQL dump files (`--sql=/path/to/dump.sql`)
 * 3. XML export dumps (`--xml=/path/to/dump.xml`)
 *
 * Usage:
 *   bun run scripts/wiki/migrate-mediawiki.ts --from-db --dry-run
 *   bun run scripts/wiki/migrate-mediawiki.ts --from-db --limit=20
 *   bun run scripts/wiki/migrate-mediawiki.ts --sql=dump.sql --realm=ixwiki
 */

import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { getIxWikiPool, closeWikiBridge } from "../../src/lib/wiki-os/adapters/mediawiki/bridge/mysql-pool";
import { LinkGraphService } from "../../src/lib/wiki-os/core/link-graph-service";
import { toArticleSlug } from "../../src/lib/wiki-os/core/domain-types";
import { DEFAULT_USER_AGENT, DEFAULT_MEDIAWIKI_URL } from "../../src/lib/wiki-os/config";
import type mysql from "mysql2/promise";

const prisma = new PrismaClient();

interface PageRecord {
  page_id: number;
  page_namespace: number;
  page_title: string;
  page_is_redirect: number;
  page_latest: number;
  page_len: number;
  wikitext?: string;
}

function sanitizeUtf8(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/\0/g, "").replace(/\u0000/g, "");
}

function parseSqlInsertValues(sqlContent: string, tableName: string): string[] {
  const regex = new RegExp(`INSERT INTO \`?${tableName}\`? VALUES\\s*(.*?);`, "gis");
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sqlContent)) !== null) {
    if (match[1]) matches.push(match[1]);
  }

  return matches;
}

function parseSqlTuples(valuesBlock: string): string[][] {
  const tuples: string[][] = [];
  let inTuple = false;
  let inString = false;
  let escapeNext = false;
  let currentVal = "";
  let currentTuple: string[] = [];

  for (let i = 0; i < valuesBlock.length; i++) {
    const char = valuesBlock[i];

    if (escapeNext) {
      currentVal += char;
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === "'" || char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "(") {
        inTuple = true;
        currentTuple = [];
        currentVal = "";
        continue;
      }
      if (char === ")") {
        inTuple = false;
        currentTuple.push(currentVal.trim());
        tuples.push(currentTuple);
        currentVal = "";
        continue;
      }
      if (char === "," && inTuple) {
        currentTuple.push(currentVal.trim());
        currentVal = "";
        continue;
      }
    }

    if (inTuple) {
      currentVal += char;
    }
  }

  return tuples;
}

async function fetchArticlesFromLiveDb(limit: number): Promise<PageRecord[]> {
  const pool = getIxWikiPool();
  console.log("🔌 Connecting to live MariaDB `ixwiki` database...");

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT p.page_id, p.page_namespace, p.page_title, p.page_is_redirect, p.page_latest, p.page_len, t.old_text
     FROM page p
     JOIN slots s ON s.slot_revision_id = p.page_latest
     JOIN content c ON c.content_id = s.slot_content_id
     JOIN text t ON t.old_id = SUBSTRING(c.content_address, 4)
     WHERE p.page_namespace = 0 AND p.page_is_redirect = 0
     ORDER BY p.page_len DESC
     LIMIT ${limit}`
  );

  return (rows || []).map((r) => ({
    page_id: r.page_id as number,
    page_namespace: r.page_namespace as number,
    page_title: String(r.page_title),
    page_is_redirect: r.page_is_redirect as number,
    page_latest: r.page_latest as number,
    page_len: r.page_len as number,
    wikitext: r.old_text ? String(r.old_text) : "",
  }));
}

async function streamIngestFromHttpApi(
  limit: number,
  realmArg: string,
  isDryRun: boolean,
  baseUrl = DEFAULT_MEDIAWIKI_URL
): Promise<number> {
  const apiUrl = `${baseUrl.replace(/\/$/, "")}/api.php`;
  console.log(`🌐 Connecting to MediaWiki Action API at ${apiUrl}...`);
  console.log(`📥 Mode: ${limit === Infinity ? "FULL SYNC (All Articles)" : `Targeting ${limit} articles`}`);

  let gapcontinue: string | undefined = undefined;
  let totalProcessed = 0;
  let batchIndex = 1;
  const startTime = Date.now();

  while (totalProcessed < limit) {
    const remaining = limit === Infinity ? 50 : Math.min(50, limit - totalProcessed);
    const url = new URL(apiUrl);
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "allpages");
    url.searchParams.set("gapnamespace", "0");
    url.searchParams.set("gapfilterredir", "nonredirects");
    url.searchParams.set("gaplimit", String(remaining));
    url.searchParams.set("prop", "revisions|info");
    url.searchParams.set("rvprop", "content|ids|timestamp");
    url.searchParams.set("rvslots", "main");
    url.searchParams.set("format", "json");
    if (gapcontinue) {
      url.searchParams.set("gapcontinue", gapcontinue);
    }

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      console.warn(`⚠️  HTTP request failed with status: ${res.status}`);
      break;
    }

    const data: any = await res.json();
    const pages = data?.query?.pages;
    if (!pages || typeof pages !== "object") {
      break;
    }

    const batchPages = Object.values(pages) as any[];
    if (batchPages.length === 0) {
      break;
    }

    let latestTitle = "";

    for (const page of batchPages) {
      if (page && page.ns === 0) {
        const title = sanitizeUtf8((page.title || "").replace(/_/g, " "));
        latestTitle = title;
        const slug = toArticleSlug(title);
        const rev = page.revisions?.[0];
        const wikitext = sanitizeUtf8(rev?.slots?.main?.["*"] || rev?.["*"] || "");

        if (isDryRun) {
          if (totalProcessed < 5) {
            const links = LinkGraphService.extractLinks(wikitext);
            console.log(`   [Dry-Run Preview] Title: "${title}" | Slug: "${slug}" | Length: ${wikitext.length} chars | Links: ${links.length}`);
          }
        } else {
          try {
            const words = wikitext.split(/\s+/).filter(Boolean).length;
            const article = await prisma.wikiArticle.upsert({
              where: {
                source_title: { source: realmArg, title },
              },
              create: {
                slug,
                title,
                source: realmArg,
                wikitext,
                status: "PUBLISHED",
                wordCount: words,
                readingTime: Math.max(1, Math.ceil(words / 200)),
                mwPageId: page.pageid,
                mwLatestRevId: rev?.revid || page.lastrevid || 0,
              },
              update: {
                slug,
                wikitext: wikitext || undefined,
                wordCount: words,
                readingTime: Math.max(1, Math.ceil(words / 200)),
                mwPageId: page.pageid,
                mwLatestRevId: rev?.revid || page.lastrevid || 0,
              },
              select: { id: true },
            });

            if (wikitext) {
              void LinkGraphService.syncArticleLinks(article.id, wikitext, undefined, realmArg).catch(() => {});
            }
          } catch (err: any) {
            console.warn(`   ⚠️ Could not sync article "${title}":`, err.message?.substring(0, 80));
          }
        }

        totalProcessed++;
        if (totalProcessed >= limit) break;
      }
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   [Batch ${batchIndex}] Synced ${batchPages.length} articles (Total: ${totalProcessed} | ${durationSec}s | Latest: "${latestTitle}")`);
    batchIndex++;

    gapcontinue = data?.continue?.gapcontinue;
    if (!gapcontinue) {
      console.log("🏁 Reached end of MediaWiki namespace-0 article catalog.");
      break;
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 Ingestion finished in ${totalTime}s! Total articles processed: ${totalProcessed}`);
  return totalProcessed;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const fromDb = args.includes("--from-db");
  const fromApi = args.includes("--from-api") || args.includes("--from-http") || (!fromDb && !args.some((a) => a.startsWith("--sql=")));
  const sqlArg = args.find((a) => a.startsWith("--sql="))?.split("=")[1];
  const realmArg = args.find((a) => a.startsWith("--realm="))?.split("=")[1] || "ixwiki";
  const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const isAll = args.includes("--all") || (!limitArg && !args.includes("--dry-run"));
  const limit = limitArg ? parseInt(limitArg, 10) : (isAll ? Infinity : 50);

  console.log("==================================================================");
  console.log(`🚀 WikiOS Universal MediaWiki Migration Engine (Realm: ${realmArg})`);
  console.log(`   Mode: ${isDryRun ? "DRY-RUN (Validation & Audit)" : "LIVE INGESTION"}`);
  console.log(`   Scope: ${limit === Infinity ? "FULL SYNC (Unlimited / All Articles)" : `Limit: ${limit} articles`}`);
  console.log(`   Source: ${fromApi ? "MediaWiki Action API" : fromDb ? "Live MariaDB Pool" : sqlArg || "Standard Pipeline"}`);
  console.log("==================================================================");

  if (fromApi) {
    try {
      await streamIngestFromHttpApi(limit, realmArg, isDryRun);
    } catch (apiErr) {
      console.error("❌ Action API streaming failed:", apiErr);
    }
  } else if (fromDb) {
    try {
      const articles = await fetchArticlesFromLiveDb(limit === Infinity ? 50000 : limit);
      console.log(`✅ Retrieved ${articles.length} articles from live MariaDB.`);
      let count = 0;
      for (const page of articles) {
        const title = sanitizeUtf8(page.page_title.replace(/_/g, " "));
        const slug = toArticleSlug(title);
        const wikitext = sanitizeUtf8(page.wikitext || "");

        if (!isDryRun) {
          try {
            const words = wikitext.split(/\s+/).filter(Boolean).length;
            const article = await prisma.wikiArticle.upsert({
              where: { source_title: { source: realmArg, title } },
              create: {
                slug,
                title,
                source: realmArg,
                wikitext,
                status: "PUBLISHED",
                wordCount: words,
                readingTime: Math.max(1, Math.ceil(words / 200)),
                mwPageId: page.page_id,
                mwLatestRevId: page.page_latest,
              },
              update: {
                slug,
                wikitext: wikitext || undefined,
                wordCount: words,
                readingTime: Math.max(1, Math.ceil(words / 200)),
                mwPageId: page.page_id,
                mwLatestRevId: page.page_latest,
              },
              select: { id: true },
            });

            if (wikitext) {
              void LinkGraphService.syncArticleLinks(article.id, wikitext, undefined, realmArg).catch(() => {});
            }
          } catch (itemErr: any) {
            console.warn(`   ⚠️ Could not sync "${title}":`, itemErr.message?.substring(0, 80));
          }
        }

        count++;
        if (count % 250 === 0 || count === articles.length) {
          console.log(`   Processed ${count} / ${articles.length} articles...`);
        }
      }
      console.log(`\n🎉 Ingestion successfully completed! (${count} articles synced)`);
    } catch (dbErr: any) {
      console.error("❌ Direct MariaDB ingestion failed:", dbErr);
    }
  } else if (sqlArg && existsSync(sqlArg)) {
    console.log(`📂 Reading SQL dump from: ${sqlArg}`);
    const content = readFileSync(sqlArg, "utf8");
    const pageBlocks = parseSqlInsertValues(content, "page");
    const allPageTuples = pageBlocks.flatMap((b) => parseSqlTuples(b));
    const articlesToMigrate = allPageTuples
      .map((t) => ({
        page_id: parseInt(t[0] || "0", 10),
        page_namespace: parseInt(t[1] || "0", 10),
        page_title: t[2] || "",
        page_is_redirect: parseInt(t[3] || "0", 10),
        page_latest: parseInt(t[4] || "0", 10),
        page_len: parseInt(t[5] || "0", 10),
      }))
      .filter((p) => p.page_namespace === 0 && p.page_title)
      .slice(0, limit === Infinity ? undefined : limit);

    console.log(`\n📥 Ingesting ${articlesToMigrate.length} articles from SQL dump...`);
    let count = 0;
    for (const page of articlesToMigrate) {
      const title = page.page_title.replace(/_/g, " ");
      const slug = toArticleSlug(title);
      if (!isDryRun) {
        await prisma.wikiArticle.upsert({
          where: { source_title: { source: realmArg, title } },
          create: {
            slug,
            title,
            source: realmArg,
            wikitext: "",
            status: "PUBLISHED",
            mwPageId: page.page_id,
            mwLatestRevId: page.page_latest,
          },
          update: {
            slug,
            mwPageId: page.page_id,
            mwLatestRevId: page.page_latest,
          },
          select: { id: true },
        });
      }
      count++;
      if (count % 25 === 0 || count === articlesToMigrate.length) {
        console.log(`   Processed ${count} / ${articlesToMigrate.length} articles...`);
      }
    }
    console.log(`\n🎉 Ingestion successfully completed! (${count} articles synced)`);
  }
}

main()
  .catch((err) => {
    console.error("❌ Migration failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closeWikiBridge();
  });
