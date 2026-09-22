/**
 * scripts/audit/test-lorescanner-sample.ts
 *
 * Randomly samples 25 countries from IIWiki and AltHistory caches, runs them
 * through the optimized Intelligent LoreScanner (parallel category probing,
 * MediaWiki pipe-batching, multi-tier LRU caching, and negative caching).
 *
 * Evaluates both Cold and Warm performance and outputs an audit report.
 */

import * as fs from "fs";
import * as path from "path";
import {
  getArticleWikitext,
  getCategoryMembers,
  getBatchWikitext,
} from "../../src/lib/wiki-os/adapters/mediawiki/bridge";
import { cleanWikitextForDisplay } from "../../src/lib/wiki-os/adapters/ixstates/cache-service";
import {
  extractDataFromWikiSections,
  type ExtractedBuilderData,
} from "../../src/lib/builder/wiki-data-extractor";
import { type WikiSource } from "../../src/lib/wiki-os/config";
import { intelligentLoreCache } from "../../src/lib/wiki-os/core/intelligent-lore-cache";

interface CountryCandidate {
  pageName: string;
  displayName: string;
  officialName?: string;
  completeness: number;
}

interface ScanResultItem {
  index: number;
  countryName: string;
  site: "iiwiki" | "althistory";
  categoryFound: string | null;
  categoryMemberCount: number;
  pagesScanned: number;
  pagesEnriched: string[];
  coldLatencyMs: number;
  warmLatencyMs: number;
  hasGovernment: boolean;
  hasEconomy: boolean;
  hasDemographics: boolean;
  departmentsCount: number;
  majorIndustriesCount: number;
  extractedData: ExtractedBuilderData;
}

const TOPIC_PRIORITIES = [
  "economy",
  "economic",
  "government",
  "politics",
  "demographics",
  "military",
  "armed forces",
  "foreign relations",
  "constitution",
  "parliament",
  "senate",
  "ministry",
  "cabinet",
  "industry",
  "geography",
];

const GENERIC_CATEGORY_PATTERN =
  /^(countries|nations|sovereign states|member states|micronations|articles with|pages with|all articles|cs1|good articles|featured articles|stubs|redirects|capitals|cities)$/i;

async function executeScan(
  country: CountryCandidate,
  site: "iiwiki" | "althistory",
  cachedMainArticle?: { title: string; wikitext: string } | null
): Promise<{
  matchedCategory: string | null;
  rawMembersCount: number;
  pages: Array<{ title: string; content: string }>;
  extractedData: ExtractedBuilderData;
}> {
  const countryName = country.pageName;
  const officialName = country.officialName;

  // 1. Fetch main article if not provided
  const mainArticle =
    cachedMainArticle ??
    (await getArticleWikitext(countryName, site as WikiSource).catch(() => null));
  const mainWikitext = mainArticle?.wikitext ?? "";

  const catMatches = mainWikitext.match(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi) || [];
  const categoryTags: string[] = catMatches
    .map((c: string) => c.replace(/^\[\[Category:/i, "").replace(/\]\]$/, "").split("|")[0]?.trim())
    .filter((c: string | undefined): c is string => Boolean(c));

  // 2. Filter Candidate Categories (strictly country-specific hubs, max 3)
  const nameLower = countryName.toLowerCase();
  const officialLower = officialName?.toLowerCase();

  const relevantCategoryTags = categoryTags
    .map((c: string) => c.replace(/^Category:/i, "").trim())
    .filter((c: string) => {
      const cLower = c.toLowerCase();
      if (GENERIC_CATEGORY_PATTERN.test(c)) return false;
      return (
        cLower.includes(nameLower) ||
        (officialLower ? cLower.includes(officialLower) : false)
      );
    });

  const candidateCategories = Array.from(
    new Set([
      countryName,
      ...(officialName && officialLower !== nameLower ? [officialName] : []),
      ...relevantCategoryTags,
    ])
  ).slice(0, 3);

  let matchedCategory: string | null = null;
  let rawMembers: Array<{ title: string }> = [];

  // Parallel Category Probing with Single-Flight Coalesce
  const probePromises = candidateCategories.map((cat: string) =>
    intelligentLoreCache.coalesce(`probe:${site}:${cat.toLowerCase()}`, async () => {
      const cached = await intelligentLoreCache.getCategoryMembers(site as WikiSource, cat);
      if (cached) return { cat, members: cached };

      const membersResult = await getCategoryMembers(cat, 50, "page", site as WikiSource);
      const members = Array.isArray(membersResult)
        ? membersResult
        : membersResult &&
            typeof membersResult === "object" &&
            "members" in membersResult &&
            Array.isArray(membersResult.members)
          ? (membersResult.members as Array<{ title: string }>)
          : [];

      await intelligentLoreCache.setCategoryMembers(site as WikiSource, cat, members);
      return { cat, members };
    })
  );

  const probeResults = await Promise.allSettled(probePromises);
  for (const res of probeResults) {
    if (res.status === "fulfilled" && res.value.members.length > 0) {
      matchedCategory = res.value.cat;
      rawMembers = res.value.members;
      break;
    }
  }

  // 3. Filter & Prioritize Domain Relevant Pages
  const categoryPages = rawMembers
    .map((m: { title: string }) => m.title)
    .filter(
      (t: string) =>
        Boolean(t) &&
        !t.startsWith("Category:") &&
        t.toLowerCase() !== countryName.toLowerCase()
    );

  const scoredCategoryPages = categoryPages.sort((a: string, b: string) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aScore = TOPIC_PRIORITIES.some((k: string) => aLower.includes(k)) ? 1 : 0;
    const bScore = TOPIC_PRIORITIES.some((k: string) => bLower.includes(k)) ? 1 : 0;
    return bScore - aScore;
  });

  const pagesToScan = [
    countryName,
    ...scoredCategoryPages.slice(0, 8),
    ...(scoredCategoryPages.length < 3
      ? [
          `Economy of ${countryName}`,
          `Politics of ${countryName}`,
          `Government of ${countryName}`,
          `Demographics of ${countryName}`,
          `Military of ${countryName}`,
          `Foreign relations of ${countryName}`,
        ]
      : []),
  ];

  const seen = new Set<string>();
  const uniquePages = pagesToScan
    .filter((p: string) => {
      const key = p.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);

  const pages: Array<{ title: string; content: string }> = [];
  const subpagesToFetch: string[] = [];

  for (const p of uniquePages) {
    if (p.toLowerCase() === countryName.toLowerCase() && mainWikitext) {
      pages.push({
        title: p,
        content: cleanWikitextForDisplay(mainWikitext),
      });
    } else {
      subpagesToFetch.push(p);
    }
  }

  // 4. Single Native MediaWiki Batch Query
  if (subpagesToFetch.length > 0) {
    const batchMap = await getBatchWikitext(subpagesToFetch, site as WikiSource);
    for (const title of subpagesToFetch) {
      const article = batchMap.get(title.toLowerCase()) || batchMap.get(title);
      if (article?.wikitext) {
        pages.push({
          title: article.title,
          content: cleanWikitextForDisplay(article.wikitext),
        });
      }
    }
  }

  const extractedData = extractDataFromWikiSections(pages);

  return {
    matchedCategory,
    rawMembersCount: rawMembers.length,
    pages,
    extractedData,
  };
}

async function scanCountry(
  country: CountryCandidate,
  site: "iiwiki" | "althistory",
  index: number
): Promise<ScanResultItem> {
  const countryName = country.pageName;

  // 1. Invalidate to guarantee true COLD measurement
  intelligentLoreCache.invalidateCountry(site as WikiSource, countryName);

  // Measure COLD pass
  const coldStart = performance.now();
  const coldResult = await executeScan(country, site);
  const coldLatencyMs = Math.round(performance.now() - coldStart);

  // Save in Tier-1 & Tier-4 cache
  await intelligentLoreCache.setDeepScan(site as WikiSource, countryName, {
    pagesScanned: coldResult.pages.length,
    foundVariants: coldResult.pages.map((p: { title: string }) => p.title),
    categoryUsed: coldResult.matchedCategory,
    extractedData: coldResult.extractedData,
    pages: coldResult.pages,
  });

  // Measure WARM pass (served from cache)
  const warmStart = performance.now();
  const warmCached = await intelligentLoreCache.getDeepScan(site as WikiSource, countryName);
  const warmLatencyMs = Math.round(performance.now() - warmStart);

  const finalPages = warmCached ? warmCached.pages : coldResult.pages;
  const finalExtracted = warmCached ? warmCached.extractedData : coldResult.extractedData;

  return {
    index,
    countryName,
    site,
    categoryFound: coldResult.matchedCategory,
    categoryMemberCount: coldResult.rawMembersCount,
    pagesScanned: finalPages.length,
    pagesEnriched: finalPages.map((p: { title: string }) => p.title),
    coldLatencyMs,
    warmLatencyMs,
    hasGovernment: Boolean(finalExtracted.government && finalExtracted.government.confidence > 0),
    hasEconomy: Boolean(finalExtracted.economy && finalExtracted.economy.confidence > 0),
    hasDemographics: Boolean(finalExtracted.demographics && finalExtracted.demographics.confidence > 0),
    departmentsCount: finalExtracted.government?.departments?.length ?? 0,
    majorIndustriesCount: finalExtracted.economy?.majorIndustries?.length ?? 0,
    extractedData: finalExtracted,
  };
}

async function main() {
  console.log("========================================================================");
  console.log(" 🛰️  Intelligent LoreScanner 25-Nation Benchmark (Cold vs. Warm)");
  console.log("========================================================================");

  const cacheDir = path.join(process.cwd(), "data", "cache", "eligible-countries");
  const iiwikiFile = path.join(cacheDir, "iiwiki.json");
  const althistoryFile = path.join(cacheDir, "althistory.json");

  let iiwikiCountries: CountryCandidate[] = [];
  let althistoryCountries: CountryCandidate[] = [];

  if (fs.existsSync(iiwikiFile)) {
    const raw = JSON.parse(fs.readFileSync(iiwikiFile, "utf-8"));
    iiwikiCountries = raw.countries || [];
  }
  if (fs.existsSync(althistoryFile)) {
    const raw = JSON.parse(fs.readFileSync(althistoryFile, "utf-8"));
    althistoryCountries = raw.countries || [];
  }

  const shuffledAlt = [...althistoryCountries].sort(() => Math.random() - 0.5);
  const shuffledIi = [...iiwikiCountries].sort(() => Math.random() - 0.5);

  const targetTotal = process.argv[2] ? parseInt(process.argv[2], 10) : 25;
  const targetAltCount = Math.min(Math.floor(targetTotal / 2), shuffledAlt.length);
  const targetIiCount = targetTotal - targetAltCount;

  const selectedAlt = shuffledAlt.slice(0, targetAltCount);
  const selectedIi = shuffledIi.slice(0, targetIiCount);

  const sampleList: Array<{ country: CountryCandidate; site: "iiwiki" | "althistory" }> = [
    ...selectedAlt.map((c: CountryCandidate) => ({ country: c, site: "althistory" as const })),
    ...selectedIi.map((c: CountryCandidate) => ({ country: c, site: "iiwiki" as const })),
  ].sort(() => Math.random() - 0.5);

  console.log(`Evaluating ${sampleList.length} nations across IIWiki and AltHistory.\n`);

  const results: ScanResultItem[] = [];

  for (let i = 0; i < sampleList.length; i++) {
    const item = sampleList[i]!;
    try {
      const res = await scanCountry(item.country, item.site, i + 1);
      results.push(res);
      console.log(
        `[${i + 1}/25] ✓ ${item.country.pageName} (${item.site}): Cold ${res.coldLatencyMs}ms | Warm ${res.warmLatencyMs}ms (Category: ${res.categoryFound ?? "none"}, ${res.pagesScanned} pages)`
      );
    } catch (err) {
      console.log(`[${i + 1}/25] ✗ ${item.country.pageName} (${item.site}) failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const totalScanned = results.length;
  const avgColdLatency = Math.round(
    results.reduce((acc: number, r: ScanResultItem) => acc + r.coldLatencyMs, 0) / (totalScanned || 1)
  );
  const avgWarmLatency = Math.round(
    results.reduce((acc: number, r: ScanResultItem) => acc + r.warmLatencyMs, 0) / (totalScanned || 1)
  );
  const categoryHits = results.filter((r: ScanResultItem) => r.categoryFound !== null).length;
  const avgPages = (
    results.reduce((acc: number, r: ScanResultItem) => acc + r.pagesScanned, 0) / (totalScanned || 1)
  ).toFixed(1);

  console.log("\n========================================================================");
  console.log(" 📊 BENCHMARK COMPARISON");
  console.log("========================================================================");
  console.log(`Total Nations Tested:         ${totalScanned} / 25`);
  console.log(`Average COLD Latency:         ${avgColdLatency} ms`);
  console.log(`Average WARM Latency:         ${avgWarmLatency} ms`);
  console.log(
    `Cache Acceleration Factor:    ${Math.round(avgColdLatency / Math.max(1, avgWarmLatency))}x faster on revisit`
  );
  console.log(
    `Category Hub Hit Rate:        ${categoryHits} / ${totalScanned} (${Math.round((categoryHits / totalScanned) * 100)}%)`
  );
  console.log(`Average Pages Enriched:       ${avgPages} pages/nation`);

  const outPath = path.join(process.cwd(), "data", "cache", "lorescanner-sample-25.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: {
          totalScanned,
          avgColdLatency,
          avgWarmLatency,
          speedup: `${Math.round(avgColdLatency / Math.max(1, avgWarmLatency))}x`,
          categoryHits,
          categoryHitRate: `${Math.round((categoryHits / totalScanned) * 100)}%`,
          avgPages,
        },
        results: results.map((r: ScanResultItem) => ({
          index: r.index,
          countryName: r.countryName,
          site: r.site,
          categoryFound: r.categoryFound,
          categoryMemberCount: r.categoryMemberCount,
          pagesScanned: r.pagesScanned,
          pagesEnriched: r.pagesEnriched,
          coldLatencyMs: r.coldLatencyMs,
          warmLatencyMs: r.warmLatencyMs,
          enrichment: {
            hasGovernment: r.hasGovernment,
            hasEconomy: r.hasEconomy,
            hasDemographics: r.hasDemographics,
            departmentsCount: r.departmentsCount,
            majorIndustriesCount: r.majorIndustriesCount,
          },
        })),
      },
      null,
      2
    ),
    "utf-8"
  );
  console.log(`\nDetailed report saved to: ${outPath}\n`);
}

main().catch((err) => {
  console.error("Fatal error during benchmark:", err);
  process.exit(1);
});
