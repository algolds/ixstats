/**
 * src/lib/wiki-os/core/intelligent-lore-cache.ts
 *
 * Multi-Tier Intelligent Caching System for Wiki LoreScanner & MediaWiki Bridge.
 *
 * Tiers:
 * 1. Fast In-Memory LRU (Memory Cache with TTL)
 * 2. Negative Cache (Stores empty categories / 404s for 30m to block repeated probe waterfalls)
 * 3. Single-Flight Promise Coalescing (Shares 1 in-flight HTTP request across concurrent calls)
 * 4. Persistent DB Storage (Stores in PostgreSQL `external_api_cache` with 7-day TTL)
 */

import { Cache } from "~/lib/cache/cache";
import { db } from "~/server/db";
import { type WikiSource } from "~/lib/wiki-os/config";
import { canonicalizeTitle, sameTitle } from "~/lib/wiki-os/core/title";
import { type ExtractedBuilderData } from "~/lib/builder/wiki-data-extractor";

export interface LoreScanCachedResult {
  pagesScanned: number;
  foundVariants: string[];
  categoryUsed: string | null;
  extractedData: ExtractedBuilderData;
  pages: Array<{ title: string; content: string }>;
  cachedAt: number;
}

export interface CategoryMemberItem {
  title: string;
}

// ──────────────────────────────────────────────
// In-Memory Storage Tiers
// ──────────────────────────────────────────────

// Tier 1: Lore Scan Results (2 hours memory TTL)
const scanMemoryCache = new Cache<LoreScanCachedResult>({
  defaultTtlMs: 2 * 60 * 60 * 1000,
  maxSize: 300,
  namespace: "lore-scan",
});

// Tier 1: Category Members (2 hours memory TTL)
const categoryMemoryCache = new Cache<CategoryMemberItem[]>({
  defaultTtlMs: 2 * 60 * 60 * 1000,
  maxSize: 500,
  namespace: "cat-members",
});

// Tier 2: Negative Cache for empty categories (30 minutes TTL)
const emptyCategoriesCache = new Cache<boolean>({
  defaultTtlMs: 30 * 60 * 1000,
  maxSize: 1000,
  namespace: "empty-cat",
});

// Tier 2: Negative Cache for missing wikitext pages (30 minutes TTL)
const missingPagesCache = new Cache<boolean>({
  defaultTtlMs: 30 * 60 * 1000,
  maxSize: 2000,
  namespace: "missing-page",
});

// Tier 3: In-flight single-flight promises
const inFlightRequests = new Map<string, Promise<unknown>>();

// ──────────────────────────────────────────────
// IntelligentLoreCache Class
// ──────────────────────────────────────────────

export class IntelligentLoreCache {
  /**
   * Coalesce multiple concurrent in-flight requests into a single execution.
   */
  async coalesce<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = inFlightRequests.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        return await factory();
      } finally {
        inFlightRequests.delete(key);
      }
    })();

    inFlightRequests.set(key, promise as Promise<unknown>);
    return promise;
  }

  // ──────────────────────────────────────────────
  // Negative Caching Helpers
  // ──────────────────────────────────────────────

  isKnownEmptyCategory(wiki: WikiSource, category: string): boolean {
    const key = `${wiki}:${category.toLowerCase().trim()}`;
    return emptyCategoriesCache.get(key) === true;
  }

  markEmptyCategory(wiki: WikiSource, category: string): void {
    const key = `${wiki}:${category.toLowerCase().trim()}`;
    emptyCategoriesCache.set(key, true);
  }

  isKnownMissingPage(wiki: WikiSource, title: string): boolean {
    const key = `${wiki}:${title.toLowerCase().trim()}`;
    return missingPagesCache.get(key) === true;
  }

  markMissingPage(wiki: WikiSource, title: string): void {
    const key = `${wiki}:${title.toLowerCase().trim()}`;
    missingPagesCache.set(key, true);
  }

  // ──────────────────────────────────────────────
  // Category Members Caching
  // ──────────────────────────────────────────────

  async getCategoryMembers(
    wiki: WikiSource,
    category: string
  ): Promise<CategoryMemberItem[] | null> {
    const key = `${wiki}:${category.toLowerCase().trim()}`;

    // Fast negative check
    if (this.isKnownEmptyCategory(wiki, category)) {
      return [];
    }

    // Tier 1: In-Memory
    const memory = categoryMemoryCache.get(key);
    if (memory) {
      return memory;
    }

    // Tier 4: Persistent DB Cache
    try {
      const dbEntry = await db.externalApiCache.findUnique({
        where: { key: `cat:${key}` },
        select: { data: true, expiresAt: true },
      });

      if (dbEntry && dbEntry.expiresAt > new Date()) {
        const parsed = JSON.parse(dbEntry.data) as CategoryMemberItem[];
        categoryMemoryCache.set(key, parsed);
        return parsed;
      }
    } catch {
      // Ignore DB cache errors
    }

    return null;
  }

  async setCategoryMembers(
    wiki: WikiSource,
    category: string,
    members: CategoryMemberItem[]
  ): Promise<void> {
    const key = `${wiki}:${category.toLowerCase().trim()}`;

    if (members.length === 0) {
      this.markEmptyCategory(wiki, category);
      return;
    }

    // Tier 1: In-Memory
    categoryMemoryCache.set(key, members);

    // Tier 4: Persistent DB Cache (7-day TTL)
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.externalApiCache.upsert({
        where: { key: `cat:${key}` },
        create: {
          key: `cat:${key}`,
          service: wiki,
          type: "json",
          identifier: category,
          data: JSON.stringify(members),
          metadata: JSON.stringify({ count: members.length, lastFetched: new Date().toISOString() }),
          expiresAt,
        },
        update: {
          data: JSON.stringify(members),
          metadata: JSON.stringify({ count: members.length, lastFetched: new Date().toISOString() }),
          expiresAt,
        },
      });
    } catch {
      // Non-blocking persistent write
    }
  }

  // ──────────────────────────────────────────────
  // Deep Scan Results Caching
  // ──────────────────────────────────────────────

  async getDeepScan(
    wiki: WikiSource,
    countryName: string
  ): Promise<LoreScanCachedResult | null> {
    const key = `${wiki}:${countryName.toLowerCase().trim()}`;

    // Tier 1: In-Memory
    const memory = scanMemoryCache.get(key);
    if (memory) {
      return memory;
    }

    // Tier 4: Persistent DB Cache
    try {
      const dbEntry = await db.externalApiCache.findUnique({
        where: { key: `lore:${key}` },
        select: { data: true, expiresAt: true },
      });

      if (dbEntry && dbEntry.expiresAt > new Date()) {
        const parsed = JSON.parse(dbEntry.data) as LoreScanCachedResult;
        scanMemoryCache.set(key, parsed);
        return parsed;
      }
    } catch {
      // Ignore DB cache read errors
    }

    return null;
  }

  async setDeepScan(
    wiki: WikiSource,
    countryName: string,
    result: Omit<LoreScanCachedResult, "cachedAt">
  ): Promise<void> {
    const key = `${wiki}:${countryName.toLowerCase().trim()}`;
    const entry: LoreScanCachedResult = {
      ...result,
      cachedAt: Date.now(),
    };

    // Tier 1: In-Memory
    scanMemoryCache.set(key, entry);

    // Tier 4: Persistent DB Cache (7-day TTL)
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.externalApiCache.upsert({
        where: { key: `lore:${key}` },
        create: {
          key: `lore:${key}`,
          service: wiki,
          type: "json",
          identifier: countryName,
          countryName,
          data: JSON.stringify(entry),
          metadata: JSON.stringify({
            pagesScanned: entry.pagesScanned,
            categoryUsed: entry.categoryUsed,
            lastFetched: new Date().toISOString(),
          }),
          expiresAt,
        },
        update: {
          data: JSON.stringify(entry),
          metadata: JSON.stringify({
            pagesScanned: entry.pagesScanned,
            categoryUsed: entry.categoryUsed,
            lastFetched: new Date().toISOString(),
          }),
          expiresAt,
        },
      });
    } catch {
      // Non-blocking persistent write
    }
  }

  /**
   * Invalidate cache for a specific country
   */
  invalidateCountry(wiki: WikiSource, countryName: string): void {
    const key = `${wiki}:${countryName.toLowerCase().trim()}`;
    scanMemoryCache.delete(key);
  }

  /**
   * Forget everything held about the page `title`: the scans that read it (or are for the country it
   * names), the category lists naming it, and the negative "no such page" marks. Memory and the
   * `external_api_cache` rows both; a deleted page must not come back out of a cache.
   */
  async evictTitle(wiki: WikiSource, title: string): Promise<void> {
    const same = (candidate: string) => sameTitle(candidate, title, wiki);
    const dropWhere = <V>(cache: Cache<V>, matches: (value: V, key: string) => boolean) => {
      const keys: string[] = [];
      cache.forEach((value, key) => {
        if (matches(value, key)) keys.push(key);
      });
      for (const key of keys) cache.delete(key);
    };
    const named = (key: string) => same(key.slice(wiki.length + 1));
    dropWhere(
      scanMemoryCache,
      (scan, key) =>
        key.startsWith(`${wiki}:`) &&
        (named(key) || scan.pages.some((page) => same(page.title)) || scan.foundVariants.some(same))
    );
    dropWhere(
      categoryMemoryCache,
      (members, key) => key.startsWith(`${wiki}:`) && members.some((member) => same(member.title))
    );
    dropWhere(missingPagesCache, (_value, key) => key.startsWith(`${wiki}:`) && named(key));

    // The persisted copies: the scan for the country this page is, and any scan or category list that
    // names the page (its title is a quoted string in the stored JSON, with either spelling).
    const canonical = canonicalizeTitle(title, { source: wiki })?.title ?? title;
    const quoted = [canonical, canonical.replace(/ /g, "_")].map((name) => JSON.stringify(name));
    const country = [canonical, canonical.replace(/ /g, "_")].map(
      (name) => `lore:${wiki}:${name.toLowerCase()}`
    );
    await db.externalApiCache.deleteMany({
      where: {
        service: wiki,
        OR: [
          { key: { in: country } },
          ...quoted.map((name) => ({
            key: { startsWith: "lore:" },
            data: { contains: name },
          })),
          ...quoted.map((name) => ({ key: { startsWith: "cat:" }, data: { contains: name } })),
        ],
      },
    });
  }

  /**
   * Cache telemetry
   */
  getTelemetry() {
    return {
      activeInFlightRequests: inFlightRequests.size,
      loreScanEntries: scanMemoryCache.getStats ? scanMemoryCache.getStats() : null,
    };
  }
}

export const intelligentLoreCache = new IntelligentLoreCache();
