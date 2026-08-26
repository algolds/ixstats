/**
 * src/lib/wiki-os/services/auto-sync-service.ts — Continuous WikiOS Real-Time Sync Daemon
 *
 * Automatically monitors MediaWiki / MariaDB for all live changes, edits, and page creations,
 * and incrementally synchronizes articles, revisions, and categories into PostgreSQL.
 */

import { db } from "~/server/db";
import { cleanExcerpt, calculateRawTextBytes } from "../transformers/wikitext-parser";
import { extractLeadImageFromWikitext } from "../transformers/image-url";
import { toArticleSlug } from "../core/domain-types";
import { DEFAULT_USER_AGENT } from "../config";

const MEDIAWIKI_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
const API_URL = `${MEDIAWIKI_URL.replace(/\/+$/, "")}/api.php`;

function sanitize(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/\0/g, "").replace(/\u0000/g, "");
}

export function isIrlOrMaintenanceCategory(name: string): boolean {
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
  const irlRegex = /\b(?:iran|iranian|portugal|portuguese|north america|south america|united states|u\.s\.|usa|russia|russian|china|chinese|germany|german|france|french|spain|spanish|italy|italian|japan|japanese|india|indian|brazil|brazilian|mexico|mexican|turkey|turkish|egypt|egyptian|israel|israeli|saudi|syria|syrian|iraq|iraqi|korea|korean|vietnam|vietnamese|netherlands|dutch|belgium|belgian|sweden|swedish|norway|norwegian|denmark|danish|finland|finnish|poland|polish|ukraine|ukrainian|canada|canadian|australia|australian|new zealand|argentina|chile|colombia|venezuela|peru|cuba|south africa|nigeria|kenya|ghana|morocco|algeria|tunisia|ethiopia|philippines|indonesia|malaysia|thailand|singapore|pakistan|bangladesh|ireland|irish|scotland|scottish|wales|welsh|england|english|united kingdom|british|austria|austrian|switzerland|swiss|greece|greek|hungary|hungarian|romania|romanian|bulgaria|serbia|croatia|czech|slovakia|albania|iceland|estonia|latvia|lithuania|taiwan|hong kong|latter day saint)\b/i;
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

let isSyncing = false;
let syncTimer: NodeJS.Timeout | null = null;

export interface AutoSyncStats {
  pagesChecked: number;
  pagesUpdated: number;
  revisionsCreated: number;
  lastRunAt: Date | null;
}

const lastStats: AutoSyncStats = {
  pagesChecked: 0,
  pagesUpdated: 0,
  revisionsCreated: 0,
  lastRunAt: null,
};

export async function syncSinglePage(title: string): Promise<boolean> {
  try {
    const rawTitle = sanitize(title.replace(/_/g, " ").trim());
    if (!rawTitle) return false;

    const url = new URL(API_URL);
    url.searchParams.set("action", "query");
    url.searchParams.set("titles", rawTitle);
    url.searchParams.set("prop", "revisions|info");
    url.searchParams.set("rvprop", "content|ids|timestamp|user|comment|size|flags");
    url.searchParams.set("rvslots", "main");
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": DEFAULT_USER_AGENT, "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return false;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return false;

    const page = Object.values(pages)[0] as any;
    if (!page || page.pageid === undefined || page.missing !== undefined) return false;

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
    const slug = toArticleSlug(rawTitle);
    const ns = Number(page.ns || 0);

    const article = await (db as any).wikiArticle.upsert({
      where: {
        source_title: { source: "ixwiki", title: rawTitle },
      },
      create: {
        title: rawTitle,
        slug,
        source: "ixwiki",
        namespace: ns,
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

    // Record revision
    if (revId > 0) {
      const existingRev = await (db as any).wikiRevision.findFirst({
        where: { source: "ixwiki", mwRevId: revId },
        select: { id: true },
      });

      if (!existingRev) {
        const rawByteSize = calculateRawTextBytes(wikitext);
        const prevRev = await (db as any).wikiRevision.findFirst({
          where: { articleId: article.id },
          orderBy: { createdAt: "desc" },
          select: { byteSize: true },
        });

        const byteDelta = prevRev ? (rawByteSize - (prevRev.byteSize || 0)) : rawByteSize;

        await (db as any).wikiRevision.create({
          data: {
            articleId: article.id,
            mwRevId: revId,
            author,
            summary: sanitize(rev?.comment || "").substring(0, 480),
            wikitext,
            byteSize: rawByteSize,
            byteDelta,
            minor: Boolean(rev?.minor !== undefined),
            format: "WIKITEXT",
            source: "ixwiki",
            createdAt: revTimestamp,
          },
        });
      }
    }

    // Parse category tags and sync memberships
    const catMatches = wikitext.match(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi) || [];
    for (const match of catMatches) {
      const catName = match.replace(/\[\[Category:/i, "").replace(/\]\]$/, "").split("|")[0]?.trim();
      if (!catName || isIrlOrMaintenanceCategory(catName)) continue;

      const catSlug = toArticleSlug(catName);
      const category = await (db as any).wikiCategory.upsert({
        where: { slug: catSlug },
        create: {
          slug: catSlug,
          name: catName.replace(/_/g, " "),
        },
        update: {},
        select: { id: true },
      });

      await (db as any).wikiCategoryMember.upsert({
        where: {
          categoryId_articleId: {
            categoryId: category.id,
            articleId: article.id,
          },
        },
        create: {
          articleId: article.id,
          categoryId: category.id,
        },
        update: {},
      });
    }

    return true;
  } catch (err: any) {
    console.error(`[WikiAutoSync] Error syncing page "${title}":`, err.message);
    return false;
  }
}

export async function runAutoSyncCycle(limit = 30): Promise<AutoSyncStats> {
  if (isSyncing) return lastStats;
  isSyncing = true;

  try {
    const rcUrl = new URL(API_URL);
    rcUrl.searchParams.set("action", "query");
    rcUrl.searchParams.set("list", "recentchanges");
    rcUrl.searchParams.set("rcprop", "title|user|timestamp|comment|sizes|flags|ids");
    rcUrl.searchParams.set("rcnamespace", "0|1|2|4|10|14");
    rcUrl.searchParams.set("rclimit", String(limit));
    rcUrl.searchParams.set("format", "json");

    const res = await fetch(rcUrl.toString(), {
      headers: { "User-Agent": DEFAULT_USER_AGENT, "Accept": "application/json" },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      isSyncing = false;
      return lastStats;
    }

    const data = await res.json();
    const changes = data?.query?.recentchanges || [];
    lastStats.pagesChecked = changes.length;

    let updated = 0;
    for (const rc of changes) {
      const revId = Number(rc.revid || 0);
      const rawTitle = sanitize(String(rc.title || "").replace(/_/g, " ").trim());
      if (!rawTitle) continue;

      if (revId > 0) {
        const existing = await (db as any).wikiRevision.findFirst({
          where: { source: "ixwiki", mwRevId: revId },
          select: { id: true },
        });

        if (!existing) {
          const ok = await syncSinglePage(rawTitle);
          if (ok) updated++;
        }
      }
    }

    lastStats.pagesUpdated = updated;
    lastStats.lastRunAt = new Date();
    if (updated > 0) {
      console.log(`[WikiAutoSync] 🔄 Auto-synced ${updated} new edits from MediaWiki into PostgreSQL.`);
    }
  } catch (err: any) {
    // Non-fatal background polling error
  } finally {
    isSyncing = false;
  }

  return lastStats;
}

export function startWikiAutoSyncDaemon(intervalMs = 45000): void {
  if (syncTimer) return;
  console.log(`[WikiAutoSync] 🚀 MediaWiki auto-sync daemon initialized (Interval: ${intervalMs / 1000}s).`);
  
  // Run first cycle immediately in background
  setTimeout(() => {
    runAutoSyncCycle().catch(() => {});
  }, 3000);

  syncTimer = setInterval(() => {
    runAutoSyncCycle().catch(() => {});
  }, intervalMs);
}

export function stopWikiAutoSyncDaemon(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
