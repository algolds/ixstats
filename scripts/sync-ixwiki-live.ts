/**
 * scripts/sync-ixwiki-live.ts — Authoritative Live MediaWiki Action API Ingestion Engine
 *
 * Robust, resilient streaming ingestion from https://ixwiki.com/api.php directly into PostgreSQL.
 * Features rate-limit detection, exponential backoff, retry handling, and full Loreward telemetry sync.
 *
 * Usage:
 *   bun run scripts/sync-ixwiki-live.ts
 *   bun run scripts/sync-ixwiki-live.ts --limit=100
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import {
  cleanExcerpt,
  extractLeadImageFromWikitext,
} from "../src/lib/wiki-os/transformers/excerpt";

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

const DEFAULT_USER_AGENT = "IxStats-Builder";
const MEDIAWIKI_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
const API_URL = `${MEDIAWIKI_URL.replace(/\/+$/, "")}/api.php`;

function sanitize(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/\0/g, "").replace(/\u0000/g, "");
}

function toSlug(title: string): string {
  return (
    sanitize(title).trim().toLowerCase().replace(/ /g, "_").replace(/_{2,}/g, "_") || "article"
  );
}

const NAMESPACES_TO_SYNC = [
  { ns: 0, name: "Main / Articles", prefix: "" },
  { ns: 10, name: "Templates", prefix: "Template" },
  { ns: 14, name: "Categories", prefix: "Category" },
  { ns: 4, name: "Project", prefix: "Project" },
  { ns: 2, name: "User Pages", prefix: "User" },
];

async function fetchWithRetry(url: string, retries = 6, baseDelay = 1500): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(25000),
      });

      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        const retryAfter = res.headers.get("retry-after");
        const waitTime = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : baseDelay * Math.pow(1.6, attempt);
        console.warn(
          `   ⏳ Rate limited (${res.status}). Waiting ${(waitTime / 1000).toFixed(1)}s (Attempt ${attempt}/${retries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return await res.json();
    } catch (err: any) {
      if (attempt === retries) throw err;
      const wait = baseDelay * attempt;
      console.warn(
        `   ⚠️ Fetch attempt ${attempt} failed: ${err.message}. Retrying in ${(wait / 1000).toFixed(1)}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  return null;
}

async function syncNamespace(ns: number, prefix: string, name: string, maxPerNs = Infinity) {
  console.log(`\n📦 Syncing Namespace ${ns} (${name})...`);
  let gapcontinue: string | undefined = undefined;
  let processed = 0;
  let batchIndex = 1;
  const startTime = Date.now();

  while (processed < maxPerNs) {
    const remaining = maxPerNs === Infinity ? 50 : Math.min(50, maxPerNs - processed);
    const url = new URL(API_URL);
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "allpages");
    url.searchParams.set("gapnamespace", String(ns));
    url.searchParams.set("gapfilterredir", "nonredirects");
    url.searchParams.set("gaplimit", String(remaining));
    url.searchParams.set("prop", "revisions|info");
    url.searchParams.set("rvprop", "content|ids|timestamp|user|comment|size|flags");
    url.searchParams.set("rvslots", "main");
    url.searchParams.set("format", "json");
    if (gapcontinue) {
      url.searchParams.set("gapcontinue", gapcontinue);
    }

    try {
      const data = await fetchWithRetry(url.toString());
      if (!data) break;

      const pages = data?.query?.pages;
      if (!pages || typeof pages !== "object") {
        break;
      }

      const batchPages = Object.values(pages) as any[];
      if (batchPages.length === 0) break;

      for (const page of batchPages) {
        if (!page || page.pageid === undefined) continue;

        try {
          const rawTitle = sanitize((page.title || "").replace(/_/g, " ").trim());
          if (!rawTitle) continue;

          const slug = toSlug(rawTitle);
          const rev = page.revisions?.[0];
          const wikitext = sanitize(rev?.slots?.main?.["*"] || rev?.["*"] || "");
          const words = wikitext.split(/\s+/).filter(Boolean).length;
          const readingTime = Math.max(1, Math.ceil(words / 200));
          const author = sanitize(rev?.user || "MediaWiki Editor");
          const revId = Number(rev?.revid || page.lastrevid || 0);
          const revTimestamp = rev?.timestamp ? new Date(rev.timestamp) : new Date();
          const cleanSum = cleanExcerpt(wikitext, 300);
          const summary = cleanSum ? cleanSum.substring(0, 480) : null;
          const leadImageUrl = extractLeadImageFromWikitext(wikitext);

          const article = await prisma.wikiArticle.upsert({
            where: {
              source_title: { source: "ixwiki", title: rawTitle },
            },
            create: {
              title: rawTitle,
              slug,
              source: "ixwiki",
              namespace: ns,
              namespacePrefix: prefix || null,
              status: "PUBLISHED",
              format: "WIKITEXT",
              wikitext,
              summary,
              leadImageUrl: leadImageUrl || null,
              wordCount: words,
              readingTime,
              mwPageId: Number(page.pageid),
              mwLatestRevId: revId,
              syncedAt: new Date(),
            },
            update: {
              slug,
              namespace: ns,
              namespacePrefix: prefix || null,
              wikitext,
              summary,
              leadImageUrl: leadImageUrl || null,
              wordCount: words,
              readingTime,
              mwPageId: Number(page.pageid),
              mwLatestRevId: revId,
              syncedAt: new Date(),
            },
            select: { id: true },
          });

          // Create revision record
          if (revId > 0) {
            const existingRev = await prisma.wikiRevision.findFirst({
              where: { source: "ixwiki", mwRevId: revId },
              select: { id: true },
            });

            if (!existingRev) {
              await prisma.wikiRevision.create({
                data: {
                  articleId: article.id,
                  mwRevId: revId,
                  author,
                  summary: sanitize(rev?.comment || "Imported from MediaWiki").substring(0, 480),
                  wikitext,
                  byteSize: Math.max(0, Number(rev?.size || wikitext.length || 0)),
                  byteDelta: 0,
                  minor: Boolean(rev?.minor !== undefined),
                  format: "WIKITEXT",
                  source: "ixwiki",
                  createdAt: revTimestamp,
                },
              });
            }
          }

          processed++;
          if (processed >= maxPerNs) break;
        } catch (pageErr: any) {
          console.warn(`   ⚠️ Warning syncing page "${page.title}":`, pageErr.message);
        }
      }

      const dur = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `   [Batch ${batchIndex}] Synced ${batchPages.length} pages (Total: ${processed} in ${dur}s)`
      );
      batchIndex++;

      // Polite delay between batches
      await new Promise((r) => setTimeout(r, 60));

      gapcontinue = data?.continue?.gapcontinue;
      if (!gapcontinue) {
        console.log(`   🏁 Finished namespace ${ns}.`);
        break;
      }
    } catch (err: any) {
      console.warn(`   ⚠️ Error on batch ${batchIndex}:`, err.message);
      // Wait and retry once before skipping
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return processed;
}

async function syncRecentChangesAndUserContributions() {
  console.log("\n📦 Syncing User Contributions & Historical Activity...");

  // 1. Fetch recent changes from MediaWiki
  const rcUrl = new URL(API_URL);
  rcUrl.searchParams.set("action", "query");
  rcUrl.searchParams.set("list", "recentchanges");
  rcUrl.searchParams.set("rcprop", "title|user|timestamp|comment|sizes|flags|ids");
  rcUrl.searchParams.set("rcnamespace", "0|1|2|4|10|14");
  rcUrl.searchParams.set("rclimit", "500");
  rcUrl.searchParams.set("format", "json");

  try {
    const data = await fetchWithRetry(rcUrl.toString());
    if (data) {
      const changes = data?.query?.recentchanges || [];
      console.log(`   Retrieved ${changes.length} recent changes from MediaWiki.`);

      let rcSynced = 0;
      for (const rc of changes) {
        const revId = Number(rc.revid || 0);
        if (revId <= 0) continue;

        const existing = await prisma.wikiRevision.findFirst({
          where: { source: "ixwiki", mwRevId: revId },
          select: { id: true },
        });

        if (!existing) {
          const rawTitle = sanitize(
            String(rc.title || "")
              .replace(/_/g, " ")
              .trim()
          );
          const article = await prisma.wikiArticle.findFirst({
            where: { source: "ixwiki", title: rawTitle },
            select: { id: true },
          });

          if (article) {
            await prisma.wikiRevision.create({
              data: {
                articleId: article.id,
                mwRevId: revId,
                author: sanitize(rc.user || "MediaWiki Editor"),
                summary: sanitize(rc.comment || "MediaWiki Edit"),
                wikitext: "",
                byteSize: Number(rc.newlen || 0),
                byteDelta: Number(rc.newlen || 0) - Number(rc.oldlen || 0),
                minor: Boolean(rc.minor !== undefined),
                format: "WIKITEXT",
                source: "ixwiki",
                createdAt: rc.timestamp ? new Date(rc.timestamp) : new Date(),
              },
            });
            rcSynced++;
          }
        }
      }
      console.log(`   ✅ Synced ${rcSynced} revisions from RecentChanges.`);
    }
  } catch (err: any) {
    console.warn("   ⚠️ Failed to fetch recent changes:", err.message);
  }

  // 2. Fetch user contributions for key active editors
  const usersToSync = ["Heku", "System", "Admin"];
  for (const username of usersToSync) {
    console.log(`   Syncing contributions for user: "${username}"...`);
    const ucUrl = new URL(API_URL);
    ucUrl.searchParams.set("action", "query");
    ucUrl.searchParams.set("list", "usercontribs");
    ucUrl.searchParams.set("ucuser", username);
    ucUrl.searchParams.set("uclimit", "500");
    ucUrl.searchParams.set("ucprop", "ids|title|timestamp|comment|size|flags");
    ucUrl.searchParams.set("format", "json");

    try {
      const data = await fetchWithRetry(ucUrl.toString());
      if (data) {
        const contribs = data?.query?.usercontribs || [];
        console.log(`   Retrieved ${contribs.length} contributions for "${username}".`);

        let ucSynced = 0;
        for (const c of contribs) {
          const revId = Number(c.revid || 0);
          if (revId <= 0) continue;

          const existing = await prisma.wikiRevision.findFirst({
            where: { source: "ixwiki", mwRevId: revId },
            select: { id: true },
          });

          if (!existing) {
            const rawTitle = sanitize(
              String(c.title || "")
                .replace(/_/g, " ")
                .trim()
            );
            const article = await prisma.wikiArticle.findFirst({
              where: { source: "ixwiki", title: rawTitle },
              select: { id: true },
            });

            if (article) {
              await prisma.wikiRevision.create({
                data: {
                  articleId: article.id,
                  mwRevId: revId,
                  author: username,
                  summary: sanitize(c.comment || ""),
                  wikitext: "",
                  byteSize: Number(c.size || 0),
                  byteDelta: Number(c.sizediff || 0),
                  minor: Boolean(c.minor !== undefined),
                  format: "WIKITEXT",
                  source: "ixwiki",
                  createdAt: c.timestamp ? new Date(c.timestamp) : new Date(),
                },
              });
              ucSynced++;
            }
          }
        }
        console.log(`   ✅ Synced ${ucSynced} revisions for "${username}".`);
      }
    } catch (err: any) {
      console.warn(`   ⚠️ Failed to sync contributions for "${username}":`, err.message);
    }
  }

  // 3. Rebuild Loreward User Stats
  console.log("\n📦 Rebuilding Loreward User Telemetry & Leaderboard...");
  const authors = await prisma.wikiRevision.groupBy({
    by: ["author"],
    where: { source: "ixwiki", author: { not: null } },
    _count: { id: true },
    _sum: { byteSize: true },
  });

  for (const a of authors) {
    if (!a.author) continue;
    const count = a._count.id;
    const totalBytes = a._sum.byteSize || 0;
    const score = count * 10 + Math.round(totalBytes / 500);

    await prisma.lorewardUserStats.upsert({
      where: { username: a.author },
      create: {
        username: a.author,
        totalScore: score,
        totalBytes,
        currentStreak: 1,
        longestStreak: 1,
      },
      update: {
        totalScore: score,
        totalBytes,
      },
    });
  }
  console.log(`✅ Updated ${authors.length} user loreward telemetry profiles.`);
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const limit = limitArg ? parseInt(limitArg, 10) : Infinity;

  console.log("==================================================================");
  console.log(`🚀 WikiOS Live Action API Ingestion Engine (Resilient Streaming)`);
  console.log(`   Source: ${API_URL}`);
  console.log(`   Target: PostgreSQL (${process.env.DATABASE_URL?.split("@")[1] || "Local"})`);
  console.log(
    `   Scope: ${limit === Infinity ? "FULL SYNC (All Namespaces & Articles)" : `Limit: ${limit} per namespace`}`
  );
  console.log("==================================================================");

  const startTotal = Date.now();
  let totalArticles = 0;

  for (const { ns, prefix, name } of NAMESPACES_TO_SYNC) {
    const count = await syncNamespace(ns, prefix, name, limit);
    totalArticles += count;
  }

  await syncRecentChangesAndUserContributions();

  const totalTime = ((Date.now() - startTotal) / 1000).toFixed(1);
  const finalArticleCount = await prisma.wikiArticle.count({ where: { source: "ixwiki" } });
  const finalRevisionCount = await prisma.wikiRevision.count({ where: { source: "ixwiki" } });

  console.log(`\n==================================================================`);
  console.log(`🎉 Live MediaWiki Ingestion Finished in ${totalTime}s!`);
  console.log(`   - Streamed Pages Processed: ${totalArticles.toLocaleString()}`);
  console.log(`   - Verified in PostgreSQL:   ${finalArticleCount.toLocaleString()} articles`);
  console.log(`   - Verified in PostgreSQL:   ${finalRevisionCount.toLocaleString()} revisions`);
  console.log(`==================================================================\n`);

  await prisma.$disconnect();
  process.exit(0);
}

main();
