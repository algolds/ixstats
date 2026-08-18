"use client";

import { useState, useEffect, useMemo } from "react";
import {
  generateImageKeywords,
  type CountryImageData,
  type ImageContext,
} from "~/lib/media";
import { unsplashService, type UnsplashImageData } from "~/lib/media";

// ── Types ────────────────────────────────────────────────────────────────

interface UseCountryImageOptions {
  countryData: CountryImageData | null;
  context: ImageContext;
  enabled?: boolean;
  /** Image size: "small" (400px) for headers, "regular" (1080px) for hero */
  size?: "small" | "regular";
}

interface UseCountryImageResult {
  imageUrl: string | null;
  isLoading: boolean;
  photographer?: string;
  photographerUrl?: string;
}

// ── Module-level caches ──────────────────────────────────────────────────

const memoryCache = new Map<string, UnsplashImageData>();
const inflightRequests = new Map<string, Promise<UnsplashImageData | null>>();

const SESSION_PREFIX = "ixstats_cimg_";
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24h

function getSessionCache(key: string): UnsplashImageData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${SESSION_PREFIX}${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > SESSION_TTL) {
      sessionStorage.removeItem(`${SESSION_PREFIX}${key}`);
      return null;
    }
    return data as UnsplashImageData;
  } catch {
    return null;
  }
}

function setSessionCache(key: string, data: UnsplashImageData): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${SESSION_PREFIX}${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // sessionStorage may be full or unavailable
  }
}

function getCacheKey(context: ImageContext, data: CountryImageData): string {
  return `${context}_${data.continent ?? "x"}_${data.economicTier ?? "x"}_${data.region ?? "x"}_${data.governmentType ?? "x"}`;
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useCountryImage({
  countryData,
  context,
  enabled = true,
  size = "small",
}: UseCountryImageOptions): UseCountryImageResult {
  const [result, setResult] = useState<UseCountryImageResult>({
    imageUrl: null,
    isLoading: true,
  });

  // Stable key from country data
  const cacheKey = useMemo(
    () => (countryData ? getCacheKey(context, countryData) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      context,
      countryData?.continent,
      countryData?.economicTier,
      countryData?.region,
      countryData?.governmentType,
    ]
  );

  useEffect(() => {
    if (!enabled || !countryData || !cacheKey) {
      setResult({ imageUrl: null, isLoading: false });
      return;
    }

    // 1. Check memory cache
    const memCached = memoryCache.get(cacheKey);
    if (memCached) {
      setResult({
        imageUrl: memCached.url,
        isLoading: false,
        photographer: memCached.photographer,
        photographerUrl: memCached.photographerUrl,
      });
      return;
    }

    // 2. Check sessionStorage
    const sessCached = getSessionCache(cacheKey);
    if (sessCached) {
      memoryCache.set(cacheKey, sessCached);
      setResult({
        imageUrl: sessCached.url,
        isLoading: false,
        photographer: sessCached.photographer,
        photographerUrl: sessCached.photographerUrl,
      });
      return;
    }

    // 3. Generate keywords and fetch
    const { query, fallbackQuery, orientation } = generateImageKeywords(countryData, context);

    // Deduplicate in-flight requests
    let request = inflightRequests.get(cacheKey);
    if (!request) {
      request = unsplashService
        .searchImages({ query, orientation, size, per_page: 3 })
        .then((images) => {
          if (images.length > 0) return images[0]!;
          // Try fallback query
          return unsplashService
            .searchImages({
              query: fallbackQuery,
              orientation,
              size,
              per_page: 3,
            })
            .then((fb) => fb[0] ?? null);
        })
        .catch(() => null);

      inflightRequests.set(cacheKey, request);
      request.finally(() => inflightRequests.delete(cacheKey));
    }

    let cancelled = false;
    request.then((image) => {
      if (cancelled) return;
      if (image) {
        memoryCache.set(cacheKey, image);
        setSessionCache(cacheKey, image);
        setResult({
          imageUrl: image.url,
          isLoading: false,
          photographer: image.photographer,
          photographerUrl: image.photographerUrl,
        });
        if (image.downloadUrl) {
          void unsplashService.trackDownload(image.downloadUrl);
        }
      } else {
        setResult({ imageUrl: null, isLoading: false });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, enabled, countryData, context, size]);

  return result;
}
