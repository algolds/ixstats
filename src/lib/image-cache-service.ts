// src/lib/image-cache-service.ts
/**
 * Image and Media Cache Service
 * Provides caching for external image APIs (Unsplash, flag services, Wikimedia Commons, etc.)
 */

import {
  externalApiCache,
  type CacheMetadata,
  CACHE_TTL,
} from "./external-api-cache";

export interface CachedImage {
  url: string;
  originalUrl?: string;
  width?: number;
  height?: number;
  format?: string;
  size?: number;
  alt?: string;
}

/**
 * Image Cache Service
 * Provides high-level caching for image and media API responses
 */
export class ImageCacheService {
  /**
   * Get cached Unsplash image
   */
  async getUnsplashImage(query: string): Promise<CachedImage | null> {
    const cached = await externalApiCache.get<CachedImage>({
      service: "unsplash",
      type: "image",
      identifier: query,
      ttl: CACHE_TTL.IMAGE,
    });

    return cached?.data ?? null;
  }

  /**
   * Cache Unsplash image
   */
  async setUnsplashImage(
    query: string,
    data: CachedImage,
    metadata?: Partial<CacheMetadata>
  ): Promise<void> {
    await externalApiCache.set(
      {
        service: "unsplash",
        type: "image",
        identifier: query,
        ttl: CACHE_TTL.IMAGE,
      },
      data,
      {
        ...metadata,
        imageUrl: data.url,
        originalUrl: data.originalUrl,
      }
    );
  }

  /**
   * Get cached flag from flagcdn
   */
  async getFlagCdn(countryCode: string): Promise<string | null> {
    const cached = await externalApiCache.get<CachedImage>({
      service: "flagcdn",
      type: "flag",
      identifier: countryCode,
      ttl: CACHE_TTL.FLAG,
    });

    return cached?.data?.url ?? null;
  }

  /**
   * Cache flag from flagcdn
   */
  async setFlagCdn(
    countryCode: string,
    url: string,
    metadata?: Partial<CacheMetadata>
  ): Promise<void> {
    await externalApiCache.set(
      {
        service: "flagcdn",
        type: "flag",
        identifier: countryCode,
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
   * Get cached Wikimedia Commons image
   */
  async getWikimediaImage(filename: string): Promise<CachedImage | null> {
    const cached = await externalApiCache.get<CachedImage>({
      service: "wikimedia",
      type: "image",
      identifier: filename,
      ttl: CACHE_TTL.IMAGE,
    });

    return cached?.data ?? null;
  }

  /**
   * Cache Wikimedia Commons image
   */
  async setWikimediaImage(
    filename: string,
    data: CachedImage,
    metadata?: Partial<CacheMetadata>
  ): Promise<void> {
    await externalApiCache.set(
      {
        service: "wikimedia",
        type: "image",
        identifier: filename,
        ttl: CACHE_TTL.IMAGE,
      },
      data,
      {
        ...metadata,
        imageUrl: data.url,
        originalUrl: data.originalUrl,
      }
    );
  }

  /**
   * Get cached country data from REST Countries API
   */
  async getCountryData(countryName: string): Promise<any | null> {
    const cached = await externalApiCache.get({
      service: "restcountries",
      type: "country-data",
      identifier: countryName,
      countryName,
      ttl: CACHE_TTL.COUNTRY_DATA,
    });

    return cached?.data ?? null;
  }

  /**
   * Cache country data from REST Countries API
   */
  async setCountryData(
    countryName: string,
    data: any,
    metadata?: Partial<CacheMetadata>
  ): Promise<void> {
    await externalApiCache.set(
      {
        service: "restcountries",
        type: "country-data",
        identifier: countryName,
        countryName,
        ttl: CACHE_TTL.COUNTRY_DATA,
      },
      data,
      metadata
    );
  }

  /**
   * Get cached custom image from any service
   */
  async getCustomImage(service: string, identifier: string): Promise<CachedImage | null> {
    const cached = await externalApiCache.get<CachedImage>({
      service: service as any,
      type: "image",
      identifier,
      ttl: CACHE_TTL.IMAGE,
    });

    return cached?.data ?? null;
  }

  /**
   * Cache custom image from any service
   */
  async setCustomImage(
    service: string,
    identifier: string,
    data: CachedImage,
    metadata?: Partial<CacheMetadata>
  ): Promise<void> {
    await externalApiCache.set(
      {
        service: service as any,
        type: "image",
        identifier,
        ttl: CACHE_TTL.IMAGE,
      },
      data,
      {
        ...metadata,
        imageUrl: data.url,
      }
    );
  }

  /**
   * Clear all image cache
   */
  async clearAllImages(): Promise<number> {
    const [unsplash, wikimedia, flagcdn] = await Promise.all([
      externalApiCache.clearService("unsplash"),
      externalApiCache.clearService("wikimedia"),
      externalApiCache.clearService("flagcdn"),
    ]);

    return unsplash + wikimedia + flagcdn;
  }

  /**
   * Clear cache for a specific country's images
   */
  async clearCountry(countryName: string): Promise<number> {
    return externalApiCache.clearCountry(countryName);
  }

  /**
   * Get image cache statistics
   */
  async getStats() {
    const [unsplash, wikimedia, flagcdn, restcountries] = await Promise.all([
      externalApiCache.getStats("unsplash"),
      externalApiCache.getStats("wikimedia"),
      externalApiCache.getStats("flagcdn"),
      externalApiCache.getStats("restcountries"),
    ]);

    return {
      unsplash,
      wikimedia,
      flagcdn,
      restcountries,
    };
  }
}

// Singleton instance
export const imageCache = new ImageCacheService();
