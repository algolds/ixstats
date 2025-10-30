// src/lib/services/wikiCommonsImageService.ts
// Intelligent image fetching from Wikimedia Commons with caching

interface WikiCommonsImage {
  url: string;
  thumbnailUrl: string;
  title: string;
  description?: string;
  license?: string;
  cached: boolean;
}

interface CachedImage {
  url: string;
  thumbnailUrl: string;
  title: string;
  description?: string;
  license?: string;
  timestamp: number;
  searchTerm: string;
}

const CACHE_KEY_PREFIX = "wiki_commons_image_";
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const THUMBNAIL_SIZE = 300;

/**
 * Validate that an image URL is accessible and returns a valid image
 */
export async function validateImageUrl(url: string): Promise<boolean> {
  if (!url || url.trim() === "") return false;

  // For Wikimedia URLs, we can trust them directly
  if (url.includes("wikimedia.org") || url.includes("wikipedia.org")) {
    return true;
  }

  // For other URLs, try to load the image
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      console.log(`[WikiCommons] Image validated successfully: ${url}`);
      resolve(true);
    };

    img.onerror = () => {
      console.warn(`[WikiCommons] Image validation failed: ${url}`);
      resolve(false);
    };

    // Set crossOrigin to anonymous to allow CORS
    img.crossOrigin = "anonymous";
    img.src = url;

    // Timeout after 3 seconds
    setTimeout(() => {
      console.warn(`[WikiCommons] Image validation timeout: ${url}`);
      resolve(false);
    }, 3000);
  });
}

/**
 * Search Wikimedia Commons for relevant images
 */
export async function searchWikiCommonsImages(
  searchTerm: string,
  limit: number = 1
): Promise<WikiCommonsImage[]> {
  try {
    // Check cache first
    const cached = getCachedImage(searchTerm);
    if (cached) {
      return [cached];
    }

    // Build search query - combine asset name with "military" for better results
    const enhancedSearch = `${searchTerm} military`;

    // Use Wikimedia Commons API
    const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
    searchUrl.searchParams.set("action", "query");
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("generator", "search");
    searchUrl.searchParams.set("gsrsearch", enhancedSearch);
    searchUrl.searchParams.set("gsrnamespace", "6"); // File namespace
    searchUrl.searchParams.set("gsrlimit", limit.toString());
    searchUrl.searchParams.set("prop", "imageinfo|info");
    searchUrl.searchParams.set("iiprop", "url|extmetadata");
    searchUrl.searchParams.set("iiurlwidth", THUMBNAIL_SIZE.toString());
    searchUrl.searchParams.set("origin", "*");

    const response = await fetch(searchUrl.toString());
    if (!response.ok) {
      console.warn(`[WikiCommons] Search failed for "${searchTerm}":`, response.statusText);
      return [];
    }

    const data = await response.json();
    const pages = data.query?.pages;

    if (!pages) {
      console.warn(`[WikiCommons] No images found for "${searchTerm}"`);
      return [];
    }

    const results: WikiCommonsImage[] = [];

    for (const pageId in pages) {
      const page = pages[pageId];
      const imageInfo = page.imageinfo?.[0];

      if (!imageInfo) continue;

      // Validate that we have a valid URL
      const imageUrl = imageInfo.url || "";
      const thumbUrl = imageInfo.thumburl || imageInfo.url || "";

      if (!imageUrl || !thumbUrl) {
        console.warn(`[WikiCommons] Skipping image with missing URL for "${searchTerm}"`);
        continue;
      }

      const result: WikiCommonsImage = {
        url: imageUrl,
        thumbnailUrl: thumbUrl,
        title: page.title?.replace("File:", "") || searchTerm,
        description: imageInfo.extmetadata?.ImageDescription?.value,
        license: imageInfo.extmetadata?.LicenseShortName?.value,
        cached: false,
      };

      results.push(result);

      // Cache the first result
      if (results.length === 1) {
        cacheImage(searchTerm, result);
      }
    }

    if (results.length === 0) {
      console.warn(`[WikiCommons] No valid images processed for "${searchTerm}"`);
    } else {
      console.log(`[WikiCommons] Found ${results.length} image(s) for "${searchTerm}"`);
    }

    return results;
  } catch (error) {
    console.error(`[WikiCommons] Error fetching images for "${searchTerm}":`, error);
    return [];
  }
}

/**
 * Get image for a specific military asset type
 */
export async function getAssetImage(
  assetName: string,
  assetType: string,
  category?: string
): Promise<WikiCommonsImage | null> {
  // Build intelligent search terms based on asset type and category
  const searchTerms = buildSearchTerms(assetName, assetType, category);

  // Try each search term until we find an image
  for (const term of searchTerms) {
    const images = await searchWikiCommonsImages(term, 1);
    if (images.length > 0) {
      return images[0];
    }
  }

  console.warn(`[WikiCommons] No images found for asset: ${assetName} (${assetType})`);
  return null;
}

/**
 * Build intelligent search terms for different asset types
 */
function buildSearchTerms(assetName: string, assetType: string, category?: string): string[] {
  const terms: string[] = [];

  // Primary search: exact asset name
  terms.push(assetName);

  // Add category-specific search
  if (category) {
    terms.push(`${category} ${assetName}`);
  }

  // Add type-specific enhancements
  switch (assetType) {
    case "aircraft":
      terms.push(`${assetName} aircraft`);
      if (category?.toLowerCase().includes("fighter")) {
        terms.push(`${assetName} fighter jet`);
      } else if (category?.toLowerCase().includes("helicopter")) {
        terms.push(`${assetName} helicopter`);
      } else if (category?.toLowerCase().includes("bomber")) {
        terms.push(`${assetName} bomber`);
      }
      break;

    case "ship":
      terms.push(`${assetName} ship`);
      if (category?.toLowerCase().includes("carrier")) {
        terms.push(`${assetName} aircraft carrier`);
      } else if (category?.toLowerCase().includes("submarine")) {
        terms.push(`${assetName} submarine`);
      } else if (category?.toLowerCase().includes("destroyer")) {
        terms.push(`${assetName} destroyer`);
      }
      break;

    case "vehicle":
      terms.push(`${assetName} military vehicle`);
      if (category?.toLowerCase().includes("tank")) {
        terms.push(`${assetName} tank`);
      } else if (category?.toLowerCase().includes("apc")) {
        terms.push(`${assetName} armored personnel carrier`);
      }
      break;

    case "weapon_system":
      terms.push(`${assetName} weapon system`);
      if (category?.toLowerCase().includes("missile")) {
        terms.push(`${assetName} missile`);
      } else if (category?.toLowerCase().includes("artillery")) {
        terms.push(`${assetName} artillery`);
      }
      break;

    case "installation":
      terms.push(`${assetName} military base`);
      break;
  }

  return terms;
}

/**
 * Cache an image result in localStorage
 */
function cacheImage(searchTerm: string, image: WikiCommonsImage): void {
  try {
    const cacheKey = CACHE_KEY_PREFIX + searchTerm.toLowerCase().replace(/\s+/g, "_");
    const cached: CachedImage = {
      ...image,
      timestamp: Date.now(),
      searchTerm,
    };

    localStorage.setItem(cacheKey, JSON.stringify(cached));
    console.log(`[WikiCommons] Cached image for "${searchTerm}"`);
  } catch (error) {
    console.warn(`[WikiCommons] Failed to cache image for "${searchTerm}":`, error);
  }
}

/**
 * Get cached image if available and not expired
 */
function getCachedImage(searchTerm: string): WikiCommonsImage | null {
  try {
    const cacheKey = CACHE_KEY_PREFIX + searchTerm.toLowerCase().replace(/\s+/g, "_");
    const cachedStr = localStorage.getItem(cacheKey);

    if (!cachedStr) return null;

    const cached: CachedImage = JSON.parse(cachedStr);

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > CACHE_DURATION) {
      localStorage.removeItem(cacheKey);
      console.log(`[WikiCommons] Cache expired for "${searchTerm}"`);
      return null;
    }

    console.log(`[WikiCommons] Using cached image for "${searchTerm}"`);
    return {
      ...cached,
      cached: true,
    };
  } catch (error) {
    console.warn(`[WikiCommons] Failed to retrieve cached image for "${searchTerm}":`, error);
    return null;
  }
}

/**
 * Clear all cached images
 */
export function clearImageCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => localStorage.removeItem(key));
    console.log(`[WikiCommons] Cleared ${keys.length} cached images`);
  } catch (error) {
    console.error("[WikiCommons] Failed to clear cache:", error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { count: number; totalSize: number } {
  let count = 0;
  let totalSize = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        count++;
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }
    }
  } catch (error) {
    console.error("[WikiCommons] Failed to get cache stats:", error);
  }

  return { count, totalSize };
}
