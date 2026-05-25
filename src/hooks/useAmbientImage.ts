"use client";

import { useState, useEffect, useCallback } from "react";
import { env } from "~/env";

// Theme-specific queries for Unsplash
const THEME_QUERIES: Record<string, string[]> = {
  overview: ["modern capital city skyline architecture", "government building aerial view"],
  economy: ["financial district skyline", "modern stock market trading"],
  labor: ["modern professional office", "industrial factory automation"],
  government: ["parliament building architecture", "grand courthouse interior"],
  demographics: ["diverse urban crowd cityscape", "modern city plaza people"],
  analytics: ["abstract data visualization", "technology network futuristic"],
};

// Fallback gradients when API fails or offline
const FALLBACK_GRADIENTS: Record<string, string> = {
  overview: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  economy: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)",
  labor: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #b91c1c 100%)",
  government: "linear-gradient(135deg, #4c1d95 0%, #5b21b6 50%, #6d28d9 100%)",
  demographics: "linear-gradient(135deg, #164e63 0%, #155e75 50%, #0e7490 100%)",
  analytics: "linear-gradient(135deg, #831843 0%, #9d174d 50%, #be185d 100%)",
};

interface AmbientImageResult {
  imageUrl: string | null;
  gradient: string;
  isLoading: boolean;
  error: string | null;
  photographer?: string;
  photographerUrl?: string;
  blur?: string;
}

interface CachedImage {
  url: string;
  photographer: string;
  photographerUrl: string;
  timestamp: number;
}

const CACHE_KEY_PREFIX = "ixstats_ambient_";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCachedImage(theme: string): CachedImage | null {
  if (typeof window === "undefined") return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + theme);
    if (!cached) return null;

    const parsed: CachedImage = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY_PREFIX + theme);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function setCachedImage(theme: string, data: CachedImage): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(CACHE_KEY_PREFIX + theme, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export function useAmbientImage(
  theme: string = "overview",
  countryName?: string
): AmbientImageResult {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photographer, setPhotographer] = useState<string | undefined>();
  const [photographerUrl, setPhotographerUrl] = useState<string | undefined>();

  const gradient = FALLBACK_GRADIENTS[theme] || FALLBACK_GRADIENTS.overview;

  const fetchImage = useCallback(async () => {
    // Check cache first
    const cached = getCachedImage(theme);
    if (cached) {
      setImageUrl(cached.url);
      setPhotographer(cached.photographer);
      setPhotographerUrl(cached.photographerUrl);
      setIsLoading(false);
      return;
    }

    // Get Unsplash API key from environment
    const accessKey = env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;

    if (!accessKey) {
      // No API key - use fallback gradient
      setIsLoading(false);
      return;
    }

    const queries = THEME_QUERIES[theme] || THEME_QUERIES.overview;
    const query = countryName
      ? countryName + " " + queries[0]
      : queries[Math.floor(Math.random() * queries.length)];

    try {
      const response = await fetch(
        "https://api.unsplash.com/photos/random?query=" +
          encodeURIComponent(query) +
          "&orientation=landscape&content_filter=high",
        {
          headers: {
            Authorization: "Client-ID " + accessKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unsplash API error: " + response.status);
      }

      const data = await response.json();

      // Use regular size for hero (not full to save bandwidth)
      const url = data.urls?.regular || data.urls?.small;
      const photographerName = data.user?.name;
      const photographerLink = data.user?.links?.html;

      if (url) {
        setImageUrl(url);
        setPhotographer(photographerName);
        setPhotographerUrl(photographerLink);

        // Cache the result
        setCachedImage(theme, {
          url,
          photographer: photographerName || "",
          photographerUrl: photographerLink || "",
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch image");
      // Continue with fallback gradient
    } finally {
      setIsLoading(false);
    }
  }, [theme, countryName]);

  useEffect(() => {
    fetchImage();
  }, [fetchImage]);

  return {
    imageUrl,
    gradient,
    isLoading,
    error,
    photographer,
    photographerUrl,
    blur: "20px", // Default blur amount for overlay effects
  };
}

// Preload hook for tab switching
export function usePreloadAmbientImages(themes: string[]): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const accessKey = env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
    if (!accessKey) return;

    // Preload images for themes that aren't cached
    themes.forEach((theme) => {
      const cached = getCachedImage(theme);
      if (!cached) {
        const queries = THEME_QUERIES[theme] || THEME_QUERIES.overview;
        const query = queries[0];

        // Use fetch to get image URL, then preload
        fetch(
          "https://api.unsplash.com/photos/random?query=" +
            encodeURIComponent(query) +
            "&orientation=landscape&content_filter=high",
          {
            headers: {
              Authorization: "Client-ID " + accessKey,
            },
          }
        )
          .then((res) => res.json())
          .then((data) => {
            const url = data.urls?.regular || data.urls?.small;
            if (url) {
              setCachedImage(theme, {
                url,
                photographer: data.user?.name || "",
                photographerUrl: data.user?.links?.html || "",
                timestamp: Date.now(),
              });

              // Preload the image
              const img = new Image();
              img.src = url;
            }
          })
          .catch(() => {
            // Ignore preload errors
          });
      }
    });
  }, [themes]);
}
