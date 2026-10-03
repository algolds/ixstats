/**
 * WikiOS recent-changes sync: incrementally copies MediaWiki articles, revisions and categories
 * into PostgreSQL. runAutoSyncCycle runs from the `wiki-recentchanges` cron job
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
  return (str ?? "").replaceAll("\0", "");
}

const CATEGORY_SUBSTRINGS = [
  // malformed URLs and link artifacts
  "http:",
  "https:",
  "://",
  ".com",
  ".org",
  ".net",
  "www.",
  "%2f",
  "%3a",
  // template / maintenance / namespace tags
  "template",
  "infobox",
  "navbox",
  "navigational",
  "wikiproject",
  "glottolog",
  "module:",
  "user:",
  "portal:",
  "wikipedia:",
  "help:",
  "disambiguation",
  "redirects",
  "tracking",
  "maintenance",
  "cleanup",
  "unreferenced",
  "stub",
  // authority control and library identifiers
  "identifiers",
  "viaf",
  "bnf",
  "lccn",
  "gnd",
  "isni",
  "fast",
  "nla",
  "ndl",
  "worldcat",
  // citation style and template tracking
  "citation",
  "webarchive",
  "wayback",
  "short description",
  "script errors",
  "duplicate arguments",
  "hcards",
  "lang-",
  "wikidata",
];

const CATEGORY_PREFIXES = [
  "people executed",
  "deaths from",
  "buried at",
  "cs1",
  "articles containing",
  "articles with",
  "articles needing",
  "pages ",
  "ixwb",
];

const CATEGORY_EXACT = new Set([
  "births",
  "deaths",
  "living people",
  "missing people",
  "fat people",
]);

const MARKUP_ARTIFACT = /[<>{}[\]%]/;
const REAL_WORLD_BIRTHS_DEATHS = /\b(?:\d{1,4}\s+|(?:century|millennium)\s+)(?:births|deaths)\b/;

// Real-world countries and political entities (IxWorld lore is deliberately not listed).
const REAL_WORLD_ENTITY =
  /\b(?:iran|iranian|portugal|portuguese|north america|south america|united states|u\.s\.|usa|russia|russian|china|chinese|germany|german|france|french|spain|spanish|italy|italian|japan|japanese|india|indian|brazil|brazilian|mexico|mexican|turkey|turkish|egypt|egyptian|israel|israeli|saudi|syria|syrian|iraq|iraqi|korea|korean|vietnam|vietnamese|netherlands|dutch|belgium|belgian|sweden|swedish|norway|norwegian|denmark|danish|finland|finnish|poland|polish|ukraine|ukrainian|canada|canadian|australia|australian|new zealand|argentina|chile|colombia|venezuela|peru|cuba|south africa|nigeria|kenya|ghana|morocco|algeria|tunisia|ethiopia|philippines|indonesia|malaysia|thailand|singapore|pakistan|bangladesh|ireland|irish|scotland|scottish|wales|welsh|england|english|united kingdom|british|austria|austrian|switzerland|swiss|greece|greek|hungary|hungarian|romania|romanian|bulgaria|serbia|croatia|czech|slovakia|albania|iceland|estonia|latvia|lithuania|taiwan|hong kong|latter day saint)\b/;

function isIrlOrMaintenanceCategory(name: string): boolean {
  if (!name) return true;
  const lower = name.toLowerCase().replace(/_/g, " ").trim();
  return (
    MARKUP_ARTIFACT.test(name) ||
    CATEGORY_SUBSTRINGS.some((fragment) => lower.includes(fragment)) ||
    CATEGORY_PREFIXES.some((prefix) => lower.startsWith(prefix)) ||
    CATEGORY_EXACT.has(lower) ||
    REAL_WORLD_BIRTHS_DEATHS.test(lower) ||
    REAL_WORLD_ENTITY.test(lower)
  );
}

let isSyncing = false;

interface AutoSyncStats {
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

interface MwRevision {
  slots?: { main?: { "*"?: string } };
  "*"?: string;
  user?: string;
  revid?: number;
  timestamp?: string;
  comment?: string;
  minor?: string;
}

interface MwPage {
  pageid?: number;
  missing?: string;
  ns?: number;
  lastrevid?: number;
  revisions?: MwRevision[];
}

/** The page's current revision from MediaWiki; null when the page is missing or deleted. */
async function fetchPageWithRevision(rawTitle: string): Promise<MwPage | null> {
  const url = new URL(API_URL);
  url.search = new URLSearchParams({
    action: "query",
    titles: rawTitle,
    prop: "revisions|info",
    rvprop: "content|ids|timestamp|user|comment|size|flags",
    rvslots: "main",
    format: "json",
  }).toString();

  const res = await fetch(url, {
    headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`MediaWiki returned HTTP ${res.status}`);

  const data = await res.json();
  const page = Object.values(data?.query?.pages ?? {})[0] as MwPage | undefined;
  return page && page.pageid !== undefined && page.missing === undefined ? page : null;
}

/** Record the revision; (source, mwRevId) is unique, so a known revision is skipped by the DB. */
async function recordRevision(
  articleId: string,
  revId: number,
  rev: MwRevision | undefined,
  wikitext: string
): Promise<void> {
  const byteSize = calculateRawTextBytes(wikitext);
  const prevRev = await db.wikiRevision.findFirst({
    where: { articleId },
    orderBy: { createdAt: "desc" },
    select: { byteSize: true },
  });

  await db.wikiRevision.createMany({
    data: [
      {
        articleId,
        mwRevId: revId,
        author: sanitize(rev?.user || "MediaWiki Editor"),
        summary: sanitize(rev?.comment).substring(0, 480),
        wikitext,
        byteSize,
        byteDelta: prevRev ? byteSize - (prevRev.byteSize || 0) : byteSize,
        minor: rev?.minor !== undefined,
        format: "WIKITEXT",
        source: "ixwiki",
        createdAt: rev?.timestamp ? new Date(rev.timestamp) : new Date(),
      },
    ],
    skipDuplicates: true,
  });
}

async function syncCategories(articleId: string, wikitext: string): Promise<void> {
  for (const [, rawName] of wikitext.matchAll(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi)) {
    const catName = rawName?.trim();
    if (!catName || isIrlOrMaintenanceCategory(catName)) continue;

    const slug = toArticleSlug(catName);
    const category = await (db as any).wikiCategory.upsert({
      where: { slug },
      create: { slug, name: catName.replace(/_/g, " ") },
      update: {},
      select: { id: true },
    });

    await (db as any).wikiCategoryMember.upsert({
      where: { categoryId_articleId: { categoryId: category.id, articleId } },
      create: { articleId, categoryId: category.id },
      update: {},
    });
  }
}

/**
 * Sync one page's current revision. Returns false when there is nothing to sync (empty title,
 * missing/deleted page); throws on HTTP or database failure so callers can retry later.
 */
async function syncPageOrThrow(title: string): Promise<boolean> {
  const rawTitle = sanitize(title.replace(/_/g, " ").trim());
  if (!rawTitle) return false;

  const page = await fetchPageWithRevision(rawTitle);
  if (!page) return false;

  const rev = page.revisions?.[0];
  const wikitext = sanitize(rev?.slots?.main?.["*"] || rev?.["*"]);
  const words = wikitext.split(/\s+/).filter(Boolean).length;
  const revId = Number(rev?.revid || page.lastrevid || 0);
  const cleanSum = cleanExcerpt(wikitext, 300);
  const where = { source_title: { source: "ixwiki", title: rawTitle } };

  // The reader prefers cached contentHtml, so when the wikitext changes the cache must be cleared
  // or MediaWiki-side edits never show (NEW-2). An empty cache is re-rendered on the next view.
  const previous = await db.wikiArticle.findUnique({ where, select: { wikitext: true } });

  const fields = {
    slug: toArticleSlug(rawTitle),
    namespace: Number(page.ns || 0),
    wikitext,
    summary: cleanSum ? cleanSum.substring(0, 480) : null,
    leadImageUrl: extractLeadImageFromWikitext(wikitext) || null,
    wordCount: words,
    readingTime: Math.max(1, Math.ceil(words / 200)),
    mwPageId: Number(page.pageid),
    mwLatestRevId: revId,
    syncedAt: new Date(),
  };

  const article = await (db as any).wikiArticle.upsert({
    where,
    create: {
      ...fields,
      title: rawTitle,
      source: "ixwiki",
      status: "PUBLISHED",
      format: "WIKITEXT",
    },
    update: {
      ...fields,
      ...(!previous || previous.wikitext !== wikitext ? { contentHtml: "" } : {}),
    },
    select: { id: true },
  });

  if (revId > 0) await recordRevision(article.id, revId, rev, wikitext);
  await syncCategories(article.id, wikitext);
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

  // The export worker records the bot revision it pushed as the article's mwLatestRevId; that
  // revision is a WikiOS edit already held in Postgres, not a new MediaWiki-side change (NEW-4).
  const exportedEcho = await db.wikiArticle.findFirst({
    where: { source: "ixwiki", mwLatestRevId: rc.revid },
    select: { id: true },
  });
  if (exportedEcho) return false;

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
