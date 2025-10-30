// src/lib/mediawiki-cache-service.ts
/**
 * MediaWiki-specific cache service
 * Wraps the universal ExternalApiCache with MediaWiki-specific helpers
 */

import {
  externalApiCache,
  type CacheOptions,
  type CacheMetadata,
  CACHE_TTL,
} from "./external-api-cache";

export interface WikiInfobox {
  rawWikitext: string;
  parsedTemplateData: Record<string, any>;
  renderedHtml: string;
}

export interface WikiPageContent {
  wikitext: string;
  html?: string;
  sections?: string[];
}

/**
 * MediaWiki Cache Service
 * Provides high-level caching for MediaWiki API responses
 */
export class MediaWikiCacheService {
  /**
   * Get cached infobox data for a country
   */
  async getInfobox(countryName: string): Promise<WikiInfobox | null> {
    const cached = await externalApiCache.get<WikiInfobox>({
      service: "mediawiki",
      type: "infobox",
      identifier: countryName,
      countryName,
      ttl: CACHE_TTL.INFOBOX,
    });

    return cached?.data ?? null;
  }

  /**
   * Cache infobox data for a country
   */
  async setInfobox(
    countryName: string,
    data: WikiInfobox,
    metadata?: Partial<CacheMetadata>
  ): Promise<void> {
    await externalApiCache.set(
      {
        service: "mediawiki",
        type: "infobox",
        identifier: countryName,
        countryName,
        ttl: CACHE_TTL.INFOBOX,
      },
      data,
      {
        ...metadata,
        wikitextLength: data.rawWikitext?.length,
      }
    );
  }

  /**
   * Get cached wikitext for a page
   */
  async getWikitext(pageName: string): Promise<string | null> {
    const cached = await externalApiCache.get<WikiPageContent>({
      service: "mediawiki",
      type: "wikitext",
      identifier: pageName,
      ttl: CACHE_TTL.WIKITEXT,
    });

    return cached?.data?.wikitext ?? null;
  }

  /**
   * Cache wikitext for a page
   */
  async setWikitext(
    pageName: string,
    wikitext: string,
    metadata?: Partial<CacheMetadata>
  ): Promise<void> {
    await externalApiCache.set(
      {
        service: "mediawiki",
        type: "wikitext",
        identifier: pageName,
        ttl: CACHE_TTL.WIKITEXT,
      },
      { wikitext },
      {
        ...metadata,
        wikitextLength: wikitext.length,
      }
    );
  }

  /**
   * Get cached page content (wikitext + HTML)
   */
  async getPageContent(pageName: string): Promise<WikiPageContent | null> {
    const cached = await externalApiCache.get<WikiPageContent>({
      service: "mediawiki",
      type: "page",
      identifier: pageName,
      ttl: CACHE_TTL.WIKITEXT,
    });

    return cached?.data ?? null;
  }

  /**
   * Cache page content
   */
  async setPageContent(
    pageName: string,
    content: WikiPageContent,
    metadata?: Partial<CacheMetadata>
  ): Promise<void> {
    await externalApiCache.set(
      {
        service: "mediawiki",
        type: "page",
        identifier: pageName,
        ttl: CACHE_TTL.WIKITEXT,
      },
      content,
      {
        ...metadata,
        wikitextLength: content.wikitext?.length,
      }
    );
  }

  /**
   * Get cached template data
   */
  async getTemplate(templateName: string): Promise<string | null> {
    const cached = await externalApiCache.get<{ content: string }>({
      service: "mediawiki",
      type: "template",
      identifier: templateName,
      ttl: CACHE_TTL.TEMPLATE,
    });

    return cached?.data?.content ?? null;
  }

  /**
   * Cache template data
   */
  async setTemplate(
    templateName: string,
    content: string,
    metadata?: Partial<CacheMetadata>
  ): Promise<void> {
    await externalApiCache.set(
      {
        service: "mediawiki",
        type: "template",
        identifier: templateName,
        ttl: CACHE_TTL.TEMPLATE,
      },
      { content },
      metadata
    );
  }

  /**
   * Get cached flag URL for a country
   */
  async getFlag(countryName: string): Promise<string | null> {
    const cached = await externalApiCache.get<{ url: string }>({
      service: "mediawiki",
      type: "flag",
      identifier: countryName,
      countryName,
      ttl: CACHE_TTL.FLAG,
    });

    return cached?.data?.url ?? null;
  }

  /**
   * Cache flag URL for a country
   */
  async setFlag(
    countryName: string,
    url: string,
    metadata?: Partial<CacheMetadata>
  ): Promise<void> {
    await externalApiCache.set(
      {
        service: "mediawiki",
        type: "flag",
        identifier: countryName,
        countryName,
        ttl: CACHE_TTL.FLAG,
      },
      { url },
      {
        ...metadata,
        imageUrl: url,
      }
    );
  }

  /**
   * Check if cache needs revalidation
   */
  async needsRevalidation(type: string, identifier: string): Promise<boolean> {
    return externalApiCache.needsRevalidation({
      service: "mediawiki",
      type: type as any,
      identifier,
    });
  }

  /**
   * Validate cached content
   */
  async validateContent<T = any>(type: string, identifier: string, freshData: T): Promise<boolean> {
    return externalApiCache.validateContent(
      {
        service: "mediawiki",
        type: type as any,
        identifier,
      },
      freshData
    );
  }

  /**
   * Clear all MediaWiki cache
   */
  async clearAll(): Promise<number> {
    return externalApiCache.clearService("mediawiki");
  }

  /**
   * Clear cache for a specific country
   */
  async clearCountry(countryName: string): Promise<number> {
    return externalApiCache.clearCountry(countryName);
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    return externalApiCache.getStats("mediawiki");
  }
}

// Singleton instance
export const mediaWikiCache = new MediaWikiCacheService();
