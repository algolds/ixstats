/**
 * Wiki Batch Fetcher Service
 *
 * Fetches and validates batches of wiki articles for lore card generation.
 * Includes comprehensive eligibility filtering, quality scoring, and preview generation.
 *
 * Features:
 * - Batch article fetching from MediaWiki API
 * - Automatic eligibility validation
 * - Quality scoring and ranking
 * - Duplicate detection
 * - Multi-wiki support (IxWiki, IIWiki)
 * - Preview text generation
 * - Robust error handling
 *
 * Usage:
 *   import { WikiBatchFetcher } from '~/lib/wiki-batch-fetcher';
 *   const fetcher = new WikiBatchFetcher();
 *   const articles = await fetcher.fetchRandomArticles(50, 'ixwiki');
 *   const eligible = await fetcher.batchValidateArticles(articles, 'ixwiki');
 */

import type { WikiSource } from "~/lib/mediawiki-config";
import { getMediaWikiApiUrl, getWikiUserAgent } from "~/lib/mediawiki-config";
import {
  type ArticleMetadata,
  type EligibilityRules,
  type EligibilityResult,
  getEligibilityRules,
  checkArticleEligibility,
} from "~/lib/wiki-eligibility-rules";
import { extractCardSummary, validateParsedText } from "~/lib/wiki-rich-text-parser";

/**
 * Eligible article with preview data
 */
export interface EligibleArticle {
  title: string;
  normalizedTitle: string;
  url: string;
  preview: string;
  excerpt: string;
  imageUrl?: string;
  categories: string[];
  metadata: ArticleMetadata;
  eligibility: EligibilityResult;
  fetchedAt: Date;
}

/**
 * Batch fetch result
 */
export interface BatchFetchResult {
  articles: EligibleArticle[];
  statistics: {
    requested: number;
    fetched: number;
    eligible: number;
    ineligible: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    duration: number;
  };
  errors: Array<{ title: string; error: string }>;
}

/**
 * Article fetch options
 */
export interface FetchOptions {
  /** Eligibility strictness level */
  strictness?: "default" | "strict" | "lenient";

  /** Custom eligibility rules (overrides strictness) */
  customRules?: EligibilityRules;

  /** Whether to fetch article images */
  includeImages?: boolean;

  /** Whether to fetch backlinks count */
  includeBacklinks?: boolean;

  /** Maximum number of articles to fetch in parallel */
  batchSize?: number;

  /** Delay between batches (ms) */
  batchDelay?: number;

  /** Timeout for each API call (ms) */
  timeout?: number;

  /** Exclude articles already in database */
  excludeExisting?: boolean;

  /** Titles to explicitly exclude */
  excludeTitles?: string[];

  /** Categories to filter for */
  includeCategories?: string[];

  /** Categories to exclude */
  excludeCategories?: string[];
}

/**
 * Default fetch options
 */
const DEFAULT_FETCH_OPTIONS: Required<
  Omit<FetchOptions, "customRules" | "excludeTitles" | "includeCategories" | "excludeCategories">
> = {
  strictness: "default",
  includeImages: true,
  includeBacklinks: true,
  batchSize: 10,
  batchDelay: 500,
  timeout: 20000,
  excludeExisting: true,
};

/**
 * Wiki Batch Fetcher Service
 */
export class WikiBatchFetcher {
  /**
   * Fetch random articles from wiki
   *
   * @param count Number of articles to attempt to fetch
   * @param wikiSource Wiki source (ixwiki or iiwiki)
   * @param options Fetch options
   * @returns Array of article titles
   */
  async fetchRandomArticles(
    count: number,
    wikiSource: WikiSource,
    options: FetchOptions = {}
  ): Promise<string[]> {
    try {
      const apiUrl = getMediaWikiApiUrl(wikiSource);
      const userAgent = getWikiUserAgent(wikiSource);

      // Fetch more than requested to account for filtering
      const fetchCount = Math.min(count * 3, 500); // API max is usually 500

      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("list", "random");
      url.searchParams.set("rnnamespace", "0"); // Main namespace only
      url.searchParams.set("rnlimit", fetchCount.toString());

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options.timeout || DEFAULT_FETCH_OPTIONS.timeout
      );

      const response = await fetch(url.toString(), {
        headers: { "User-Agent": userAgent },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const articles = data.query?.random || [];

      let titles = articles.map((article: any) => article.title);

      // Filter by category if specified
      if (options.includeCategories && options.includeCategories.length > 0) {
        titles = await this.filterByCategories(titles, wikiSource, options.includeCategories, true);
      }

      // Exclude by category if specified
      if (options.excludeCategories && options.excludeCategories.length > 0) {
        titles = await this.filterByCategories(
          titles,
          wikiSource,
          options.excludeCategories,
          false
        );
      }

      // Exclude specific titles
      if (options.excludeTitles && options.excludeTitles.length > 0) {
        const excludeSet = new Set(options.excludeTitles);
        titles = titles.filter((title: string) => !excludeSet.has(title));
      }

      return titles.slice(0, count);
    } catch (error) {
      console.error(`[Wiki Batch Fetcher] Error fetching random articles:`, error);
      return [];
    }
  }

  /**
   * Validate article eligibility
   *
   * @param articleTitle Article title
   * @param wikiSource Wiki source
   * @param options Fetch options
   * @returns True if article is eligible
   */
  async validateArticleEligibility(
    articleTitle: string,
    wikiSource: WikiSource,
    options: FetchOptions = {}
  ): Promise<boolean> {
    try {
      const metadata = await this.fetchArticleMetadata(articleTitle, wikiSource, options);
      if (!metadata) return false;

      const rules =
        options.customRules ||
        getEligibilityRules(wikiSource, options.strictness || DEFAULT_FETCH_OPTIONS.strictness);

      const result = checkArticleEligibility(metadata, rules);
      return result.eligible;
    } catch (error) {
      console.error(`[Wiki Batch Fetcher] Error validating "${articleTitle}":`, error);
      return false;
    }
  }

  /**
   * Batch validate and fetch article data
   *
   * @param titles Array of article titles
   * @param wikiSource Wiki source
   * @param options Fetch options
   * @returns Batch fetch result with eligible articles
   */
  async batchValidateArticles(
    titles: string[],
    wikiSource: WikiSource,
    options: FetchOptions = {}
  ): Promise<BatchFetchResult> {
    const startTime = Date.now();
    const articles: EligibleArticle[] = [];
    const errors: Array<{ title: string; error: string }> = [];

    const opts = { ...DEFAULT_FETCH_OPTIONS, ...options };
    const rules = options.customRules || getEligibilityRules(wikiSource, opts.strictness);

    // Process in batches to avoid overwhelming the API
    const batchSize = opts.batchSize;
    for (let i = 0; i < titles.length; i += batchSize) {
      const batch = titles.slice(i, i + batchSize);

      // Fetch metadata for each article in parallel
      const metadataPromises = batch.map((title) =>
        this.fetchArticleMetadata(title, wikiSource, options).catch((error) => {
          errors.push({ title, error: error.message });
          return null;
        })
      );

      const metadataResults = await Promise.all(metadataPromises);

      // Validate eligibility
      for (let j = 0; j < metadataResults.length; j++) {
        const metadata = metadataResults[j];
        if (!metadata) continue;

        const eligibility = checkArticleEligibility(metadata, rules);

        if (eligibility.eligible) {
          // Fetch full article data for eligible articles
          try {
            const article = await this.buildEligibleArticle(
              metadata,
              eligibility,
              wikiSource,
              options
            );
            articles.push(article);
          } catch (error: any) {
            errors.push({
              title: metadata.title,
              error: `Failed to build article data: ${error.message}`,
            });
          }
        }
      }

      // Delay between batches
      if (i + batchSize < titles.length) {
        await this.delay(opts.batchDelay);
      }
    }

    // Sort by quality score (highest first)
    articles.sort((a, b) => b.eligibility.score - a.eligibility.score);

    // Calculate statistics
    const scores = articles.map((a) => a.eligibility.score);
    const statistics = {
      requested: titles.length,
      fetched: titles.length - errors.length,
      eligible: articles.length,
      ineligible: titles.length - errors.length - articles.length,
      averageScore: scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      duration: Date.now() - startTime,
    };

    return { articles, statistics, errors };
  }

  /**
   * Fetch article metadata from MediaWiki API
   */
  private async fetchArticleMetadata(
    title: string,
    wikiSource: WikiSource,
    options: FetchOptions = {}
  ): Promise<ArticleMetadata | null> {
    try {
      const apiUrl = getMediaWikiApiUrl(wikiSource);
      const userAgent = getWikiUserAgent(wikiSource);

      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("titles", title);
      url.searchParams.set("prop", "info|categories|pageimages|revisions");
      url.searchParams.set("inprop", "url");
      url.searchParams.set("cllimit", "50");
      url.searchParams.set("piprop", "original|name");
      url.searchParams.set("rvprop", "content|timestamp");
      url.searchParams.set("rvslots", "main");

      const opts = { ...DEFAULT_FETCH_OPTIONS, ...options };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

      const response = await fetch(url.toString(), {
        headers: { "User-Agent": userAgent },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const pages = data.query?.pages;
      if (!pages) return null;

      const page = Object.values(pages)[0] as any;
      if (page.missing || page.invalid) return null;

      // Get wikitext content
      const content = page.revisions?.[0]?.slots?.main?.["*"] || "";
      const timestamp = page.revisions?.[0]?.timestamp;

      // Extract metadata
      const categories = (page.categories || []).map((cat: any) =>
        cat.title.replace(/^Category:/, "")
      );

      // Check for images
      const hasImage = !!page.original?.source;
      const imageCount = hasImage ? 1 : 0;

      // Count references ({{cite}}, <ref>)
      const refMatches = content.match(/<ref[^>]*>|{{cite/gi) || [];
      const referenceCount = refMatches.length;

      // Check for infobox
      const hasInfobox = /{{infobox/i.test(content);

      // Check if featured
      const isFeatured =
        /{{featured/i.test(content) ||
        categories.some((cat: string) => cat.toLowerCase().includes("featured"));

      // Check if redirect
      const isRedirect = page.redirect === true || /^#REDIRECT/i.test(content);

      // Fetch backlinks if requested
      let inboundLinks = 0;
      if (opts.includeBacklinks) {
        inboundLinks = await this.fetchBacklinksCount(title, wikiSource);
      }

      return {
        title: page.title,
        namespace: page.ns || 0,
        length: content.length,
        hasImage,
        imageCount,
        categoryCount: categories.length,
        categories,
        referenceCount,
        inboundLinks,
        hasInfobox,
        isFeatured,
        isRedirect,
        lastModified: timestamp ? new Date(timestamp) : new Date(),
        text: content,
      };
    } catch (error) {
      console.error(`[Wiki Batch Fetcher] Error fetching metadata for "${title}":`, error);
      return null;
    }
  }

  /**
   * Fetch backlinks count for an article
   */
  private async fetchBacklinksCount(title: string, wikiSource: WikiSource): Promise<number> {
    try {
      const apiUrl = getMediaWikiApiUrl(wikiSource);
      const userAgent = getWikiUserAgent(wikiSource);

      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("list", "backlinks");
      url.searchParams.set("bltitle", title);
      url.searchParams.set("bllimit", "500");
      url.searchParams.set("blnamespace", "0"); // Main namespace only

      const response = await fetch(url.toString(), {
        headers: { "User-Agent": userAgent },
      });

      if (!response.ok) return 0;

      const data = await response.json();
      return data.query?.backlinks?.length || 0;
      // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (error) {
      return 0;
    }
  }

  /**
   * Build eligible article object with preview data
   */
  private async buildEligibleArticle(
    metadata: ArticleMetadata,
    eligibility: EligibilityResult,
    wikiSource: WikiSource,
    options: FetchOptions
  ): Promise<EligibleArticle> {
    // Get article URL
    const baseUrls: Record<WikiSource, string> = {
      ixwiki: `${process.env.BASE_PATH || ""}/w`,
      iiwiki: "https://iiwiki.com/wiki",
      althistory: "https://althistory.fandom.com/wiki",
    };
    const url = `${baseUrls[wikiSource]}/${encodeURIComponent(metadata.title)}`;

    // Generate preview text
    const preview = await this.generatePreview(metadata.text || "", wikiSource);

    // Generate excerpt (shorter than preview)
    const excerpt = extractCardSummary(metadata.text || "", false);

    // Get image URL
    let imageUrl: string | undefined;
    if (options.includeImages !== false && metadata.hasImage) {
      imageUrl = await this.fetchImageUrl(metadata.title, wikiSource);
    }

    return {
      title: metadata.title,
      normalizedTitle: metadata.title.replace(/_/g, " "),
      url,
      preview,
      excerpt,
      imageUrl,
      categories: metadata.categories,
      metadata,
      eligibility,
      fetchedAt: new Date(),
    };
  }

  /**
   * Generate preview text from article content
   */
  // eslint-disable-next-line unused-imports/no-unused-vars
  private async generatePreview(content: string, wikiSource: WikiSource): Promise<string> {
    try {
      // Extract intro section (first paragraph)
      const preview = extractCardSummary(content, false);

      if (!validateParsedText(preview, 50)) {
        return "No preview available.";
      }

      return preview;
      // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (error) {
      return "Preview generation failed.";
    }
  }

  /**
   * Fetch image URL for an article
   */
  private async fetchImageUrl(title: string, wikiSource: WikiSource): Promise<string | undefined> {
    try {
      const apiUrl = getMediaWikiApiUrl(wikiSource);
      const userAgent = getWikiUserAgent(wikiSource);

      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("titles", title);
      url.searchParams.set("prop", "pageimages");
      url.searchParams.set("piprop", "original");

      const response = await fetch(url.toString(), {
        headers: { "User-Agent": userAgent },
      });

      if (!response.ok) return undefined;

      const data = await response.json();
      const pages = data.query?.pages;
      if (!pages) return undefined;

      const page = Object.values(pages)[0] as any;
      return page.original?.source;
      // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Filter articles by categories
   */
  private async filterByCategories(
    titles: string[],
    wikiSource: WikiSource,
    categories: string[],
    include: boolean
  ): Promise<string[]> {
    const apiUrl = getMediaWikiApiUrl(wikiSource);
    const userAgent = getWikiUserAgent(wikiSource);

    const results: string[] = [];

    // Process in batches of 50 (API limit)
    for (let i = 0; i < titles.length; i += 50) {
      const batch = titles.slice(i, i + 50);

      const url = new URL(apiUrl);
      url.searchParams.set("action", "query");
      url.searchParams.set("format", "json");
      url.searchParams.set("titles", batch.join("|"));
      url.searchParams.set("prop", "categories");
      url.searchParams.set("cllimit", "50");

      try {
        const response = await fetch(url.toString(), {
          headers: { "User-Agent": userAgent },
        });

        if (!response.ok) continue;

        const data = await response.json();
        const pages = data.query?.pages || {};

        for (const page of Object.values(pages) as any[]) {
          if (page.missing) continue;

          const pageCategories = (page.categories || []).map((cat: any) =>
            cat.title.replace(/^Category:/, "").toLowerCase()
          );

          const hasCategory = categories.some((cat) => pageCategories.includes(cat.toLowerCase()));

          if (include === hasCategory) {
            results.push(page.title);
          }
        }
      } catch (error) {
        console.error(`[Wiki Batch Fetcher] Error filtering by categories:`, error);
      }
    }

    return results;
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch and validate articles in a single call (convenience method)
   *
   * @param count Number of articles to fetch
   * @param wikiSource Wiki source
   * @param options Fetch options
   * @returns Batch fetch result
   */
  async fetchAndValidate(
    count: number,
    wikiSource: WikiSource,
    options: FetchOptions = {}
  ): Promise<BatchFetchResult> {
    console.log(
      `[Wiki Batch Fetcher] Fetching and validating ${count} articles from ${wikiSource}...`
    );

    // Fetch random articles
    const titles = await this.fetchRandomArticles(count, wikiSource, options);

    if (titles.length === 0) {
      console.warn(`[Wiki Batch Fetcher] No articles fetched`);
      return {
        articles: [],
        statistics: {
          requested: count,
          fetched: 0,
          eligible: 0,
          ineligible: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          duration: 0,
        },
        errors: [],
      };
    }

    console.log(`[Wiki Batch Fetcher] Fetched ${titles.length} random articles`);

    // Validate and build eligible articles
    const result = await this.batchValidateArticles(titles, wikiSource, options);

    console.log(
      `[Wiki Batch Fetcher] Validation complete: ${result.statistics.eligible} eligible, ` +
        `${result.statistics.ineligible} ineligible, ${result.errors.length} errors ` +
        `(${result.statistics.duration}ms)`
    );

    return result;
  }

  /**
   * Get eligible articles sorted by quality score
   *
   * @param count Target number of eligible articles
   * @param wikiSource Wiki source
   * @param options Fetch options
   * @param maxAttempts Maximum fetch attempts
   * @returns Array of eligible articles
   */
  async getTopQualityArticles(
    count: number,
    wikiSource: WikiSource,
    options: FetchOptions = {},
    maxAttempts = 3
  ): Promise<EligibleArticle[]> {
    const allArticles: EligibleArticle[] = [];
    let attempts = 0;

    while (allArticles.length < count && attempts < maxAttempts) {
      attempts++;

      // Fetch batch
      const fetchCount = Math.max(count * 2, 50); // Fetch extra to account for filtering
      const result = await this.fetchAndValidate(fetchCount, wikiSource, options);

      // Add eligible articles
      allArticles.push(...result.articles);

      console.log(
        `[Wiki Batch Fetcher] Attempt ${attempts}: ${allArticles.length}/${count} eligible articles`
      );

      if (allArticles.length < count && attempts < maxAttempts) {
        await this.delay(1000); // Wait before next attempt
      }
    }

    // Sort by quality score and return top N
    return allArticles.sort((a, b) => b.eligibility.score - a.eligibility.score).slice(0, count);
  }
}

/**
 * Export singleton instance
 */
export const wikiBatchFetcher = new WikiBatchFetcher();
