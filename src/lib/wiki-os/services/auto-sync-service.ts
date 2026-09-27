/**
 * src/lib/wiki-os/services/auto-sync-service.ts — WikiOS recent-changes sync
 *
 * Reads MediaWiki recentchanges and incrementally synchronizes articles, revisions, and
 * categories into PostgreSQL. runAutoSyncCycle runs from the `wiki-recentchanges` cron job
 * (src/server/cron/jobs.ts) and from the /api/wikios/inbound-sync webhook; there is no
 * in-process daemon.
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
    /[<>{}[\]%]/.test(name)
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

let isSyncing = false;

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

/** Sync one page; never throws (returns false on any failure). */
export async function syncSinglePage(title: string): Promise<boolean> {
  try {
    return await syncPageOrThrow(title);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[WikiAutoSync] Error syncing page "${title}":`, message);
    return false;
  }
}

/**
 * Sync one page's current revision. Returns false when there is nothing to sync (empty title,
 * missing/deleted page); throws on HTTP or database failure so callers can retry later.
 */
async function syncPageOrThrow(title: string): Promise<boolean> {
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
    headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`MediaWiki returned HTTP ${res.status}`);
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

  // Record revision; (source, mwRevId) is unique, so a known revision is skipped by the DB.
  if (revId > 0) {
    const rawByteSize = calculateRawTextBytes(wikitext);
    const prevRev = await db.wikiRevision.findFirst({
      where: { articleId: article.id },
      orderBy: { createdAt: "desc" },
      select: { byteSize: true },
    });

    const byteDelta = prevRev ? rawByteSize - (prevRev.byteSize || 0) : rawByteSize;

    await db.wikiRevision.createMany({
      data: [
        {
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
      ],
      skipDuplicates: true,
    });
  }

  // Parse category tags and sync memberships
  const catMatches = wikitext.match(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi) || [];
  for (const match of catMatches) {
    const catName = match
      .replace(/\[\[Category:/i, "")
      .replace(/\]\]$/, "")
      .split("|")[0]
      ?.trim();
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
}

/** SystemConfig key holding the timestamp of the newest recent change already synced. */
const HWM_KEY = "wikiAutoSync.rcHighWater";
/** Changes per recentchanges request once a high-water mark exists. */
const RC_PAGE_LIMIT = 50;
/** Most recentchanges pages followed (via rccontinue) in one cycle. */
const MAX_RC_PAGES = 10;

interface RecentChange {
  title: string;
  revid: number;
  timestamp: string;
}

interface RecentChangesResponse {
  query?: { recentchanges?: Array<{ title?: string; revid?: number; timestamp?: string }> };
  continue?: Record<string, string>;
}

interface RecentChangesPage {
  changes: RecentChange[];
  next: Record<string, string> | null;
}

async function readHighWater(): Promise<string | null> {
  const row = await db.systemConfig.findUnique({
    where: { key: HWM_KEY },
    select: { value: true },
  });
  return row?.value || null;
}

async function writeHighWater(value: string): Promise<void> {
  await db.systemConfig.upsert({
    where: { key: HWM_KEY },
    create: { key: HWM_KEY, value },
    update: { value },
  });
}

/** One recentchanges request; null when MediaWiki answers with an HTTP error. */
async function fetchRecentChangesPage(
  params: Record<string, string>
): Promise<RecentChangesPage | null> {
  const rcUrl = new URL(API_URL);
  rcUrl.searchParams.set("action", "query");
  rcUrl.searchParams.set("list", "recentchanges");
  rcUrl.searchParams.set("rcprop", "title|user|timestamp|comment|sizes|flags|ids");
  rcUrl.searchParams.set("rcnamespace", "0|1|2|4|10|14");
  rcUrl.searchParams.set("format", "json");
  for (const [key, value] of Object.entries(params)) rcUrl.searchParams.set(key, value);

  const res = await fetch(rcUrl.toString(), {
    headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as RecentChangesResponse;
  const changes = (data.query?.recentchanges ?? []).map((rc) => ({
    title: sanitize(
      String(rc.title ?? "")
        .replace(/_/g, " ")
        .trim()
    ),
    revid: Number(rc.revid ?? 0),
    timestamp: String(rc.timestamp ?? ""),
  }));
  return { changes, next: data.continue ?? null };
}

/**
 * Recent changes to sync, oldest first. Without a high-water mark only the latest `limit`
 * changes are read; with one, every change since it (up to MAX_RC_PAGES pages).
 */
async function collectRecentChanges(
  highWater: string | null,
  limit: number
): Promise<RecentChange[]> {
  if (!highWater) {
    const latest = await fetchRecentChangesPage({ rclimit: String(limit) });
    return (latest?.changes ?? []).reverse();
  }

  const changes: RecentChange[] = [];
  let params: Record<string, string> = {
    rcdir: "newer",
    rcstart: highWater,
    rclimit: String(RC_PAGE_LIMIT),
  };
  for (let pageCount = 0; pageCount < MAX_RC_PAGES; pageCount++) {
    const page = await fetchRecentChangesPage(params);
    if (!page) break;
    changes.push(...page.changes);
    if (!page.next) break;
    params = { ...params, ...page.next };
  }
  return changes;
}

/** True when the change's page was newly synced; throws when its sync failed. */
async function syncChange(rc: RecentChange, syncedTitles: Set<string>): Promise<boolean> {
  if (!rc.title || rc.revid <= 0 || syncedTitles.has(rc.title)) return false;

  const existing = await db.wikiRevision.findFirst({
    where: { source: "ixwiki", mwRevId: rc.revid },
    select: { id: true },
  });
  if (existing) return false;

  syncedTitles.add(rc.title);
  return syncPageOrThrow(rc.title);
}

/**
 * Sync changes in order. The returned high-water mark never passes a failed change, so the
 * failure is retried next cycle.
 */
async function syncChanges(
  changes: RecentChange[]
): Promise<{ updated: number; highWater: string | null }> {
  const syncedTitles = new Set<string>();
  let updated = 0;
  let highWater: string | null = null;
  let failed = false;

  for (const rc of changes) {
    try {
      if (await syncChange(rc, syncedTitles)) updated++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[WikiAutoSync] Error syncing page "${rc.title}":`, message);
      failed = true;
    }
    if (!failed && rc.timestamp) highWater = rc.timestamp;
  }

  return { updated, highWater };
}

export async function runAutoSyncCycle(limit = 30): Promise<AutoSyncStats> {
  if (isSyncing) return lastStats;
  isSyncing = true;

  try {
    const previousHighWater = await readHighWater();
    const changes = await collectRecentChanges(previousHighWater, limit);
    lastStats.pagesChecked = changes.length;

    const { updated, highWater } = await syncChanges(changes);
    if (highWater && highWater !== previousHighWater) await writeHighWater(highWater);

    lastStats.pagesUpdated = updated;
    lastStats.lastRunAt = new Date();
    if (updated > 0) {
      console.log(
        `[WikiAutoSync] 🔄 Auto-synced ${updated} new edits from MediaWiki into PostgreSQL.`
      );
    }
  } catch {
    // Non-fatal background polling error
  } finally {
    isSyncing = false;
  }

  return lastStats;
}
