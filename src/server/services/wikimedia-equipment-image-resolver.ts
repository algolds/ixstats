/**
 * Wikimedia Equipment Image Resolver Service
 *
 * Dynamically resolves military equipment images from Wikimedia Commons.
 * Provides intelligent fallback search and caching strategies.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const THUMBNAIL_WIDTH = 300;
const CACHE_DURATION_DAYS = 7;

interface WikimediaImageResult {
  success: boolean;
  imageUrl: string | null;
  thumbnailUrl?: string;
  cached: boolean;
  source: "database" | "wikimedia_api" | "wikimedia_search";
  timestamp: Date;
  error?: string;
}

interface BatchResolveResult {
  equipmentId: string;
  name: string;
  result: WikimediaImageResult;
}

function failure(source: WikimediaImageResult["source"], error: string): WikimediaImageResult {
  return { success: false, imageUrl: null, cached: false, source, timestamp: new Date(), error };
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/**
 * Resolve a single equipment image from Wikimedia
 */
export async function resolveEquipmentImage(equipmentId: string): Promise<WikimediaImageResult> {
  try {
    // 1. Fetch equipment from database
    const equipment = await prisma.militaryEquipmentCatalog.findUnique({
      where: { id: equipmentId },
    });

    if (!equipment) {
      return failure("database", "Equipment not found");
    }

    // 2. Check if we have a valid cached URL (updated within 7 days)
    if (equipment.imageUrl && equipment.updatedAt) {
      const daysSinceUpdate = (Date.now() - equipment.updatedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceUpdate < CACHE_DURATION_DAYS) {
        // Validate that URL is accessible
        const isValid = await validateImageUrl(equipment.imageUrl);

        if (isValid) {
          return {
            success: true,
            imageUrl: equipment.imageUrl,
            cached: true,
            source: "database",
            timestamp: equipment.updatedAt,
          };
        }
      }
    }

    // 3. Try to resolve from Wikimedia by exact name
    const wikimediaResult = await searchWikimediaForEquipment(equipment.name, equipment.category);

    if (wikimediaResult.success && wikimediaResult.imageUrl) {
      // Update database with new URL
      await prisma.militaryEquipmentCatalog.update({
        where: { id: equipmentId },
        data: {
          imageUrl: wikimediaResult.imageUrl,
          updatedAt: new Date(),
        },
      });

      return {
        ...wikimediaResult,
        cached: false,
        timestamp: new Date(),
      };
    }

    // 4. No image found
    return failure("wikimedia_search", "No image found on Wikimedia Commons");
  } catch (error) {
    console.error("[WIKIMEDIA_RESOLVER] Error resolving image:", error);
    return failure("database", errorMessage(error, "Unknown error"));
  }
}

/**
 * Batch resolve multiple equipment images
 */
export async function batchResolveImages(equipmentIds: string[]): Promise<BatchResolveResult[]> {
  const results: BatchResolveResult[] = [];

  // Process in batches of 5 to avoid rate limiting
  for (let i = 0; i < equipmentIds.length; i += 5) {
    const batch = equipmentIds.slice(i, i + 5);
    const batchPromises = batch.map(async (id) => {
      const equipment = await prisma.militaryEquipmentCatalog.findUnique({
        where: { id },
        select: { id: true, name: true },
      });

      const result = await resolveEquipmentImage(id);

      return {
        equipmentId: id,
        name: equipment?.name || "Unknown",
        result,
      };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Rate limit: wait 1 second between batches
    if (i + 5 < equipmentIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Search Wikimedia Commons for equipment image
 */
async function searchWikimediaForEquipment(
  name: string,
  category: string
): Promise<WikimediaImageResult> {
  try {
    // Build search query with equipment name and category
    const searchTerms = buildSearchTerms(name, category);

    // Try each search term
    for (const searchTerm of searchTerms) {
      const result = await queryWikimediaAPI(searchTerm);

      if (result.success && result.imageUrl) {
        return result;
      }
    }

    return failure("wikimedia_search", "No matching images found");
  } catch (error) {
    console.error("[WIKIMEDIA_RESOLVER] Search error:", error);
    return failure("wikimedia_search", errorMessage(error, "Search failed"));
  }
}

/**
 * Query Wikimedia Commons API
 */
async function queryWikimediaAPI(searchTerm: string): Promise<WikimediaImageResult> {
  try {
    const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
    searchUrl.search = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: searchTerm,
      gsrnamespace: "6", // File namespace
      gsrlimit: "3", // Top 3 results
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: String(THUMBNAIL_WIDTH),
      origin: "*",
    }).toString();

    const response = await fetch(searchUrl.toString(), {
      headers: {
        "User-Agent": "IxStats/1.0 (https://ixwiki.com; contact@ixwiki.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    const pages = data.query?.pages;

    if (!pages) {
      return failure("wikimedia_api", "No results found");
    }

    // Get first valid image
    for (const page of Object.values<any>(pages)) {
      const imageInfo = page.imageinfo?.[0];

      if (imageInfo?.url) {
        return {
          success: true,
          imageUrl: imageInfo.url,
          thumbnailUrl: imageInfo.thumburl || imageInfo.url,
          cached: false,
          source: "wikimedia_api",
          timestamp: new Date(),
        };
      }
    }

    return failure("wikimedia_api", "No valid image URLs found");
  } catch (error) {
    console.error("[WIKIMEDIA_RESOLVER] API query error:", error);
    return failure("wikimedia_api", errorMessage(error, "API query failed"));
  }
}

/**
 * Build intelligent search terms based on equipment name and category
 */
/** Category-specific extra search phrases: [name keyword, phrase appended to the name]. */
const CATEGORY_KEYWORDS: Record<string, [string, string][]> = {
  aircraft: [
    ["fighter", "fighter jet"],
    ["bomber", "bomber aircraft"],
    ["helicopter", "helicopter"],
  ],
  naval: [
    ["carrier", "aircraft carrier"],
    ["submarine", "submarine"],
    ["destroyer", "destroyer ship"],
  ],
  vehicle: [
    ["tank", "battle tank"],
    ["apc", "armored personnel carrier"],
  ],
  missile: [["", "missile system"]],
};

function buildSearchTerms(name: string, category: string): string[] {
  const lowerName = name.toLowerCase();
  const keyword = CATEGORY_KEYWORDS[category]?.find(([needle]) => lowerName.includes(needle));

  return [`${name} ${category} military`, name, ...(keyword ? [`${name} ${keyword[1]}`] : [])];
}

/**
 * Validate that an image URL is accessible
 */
async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "IxStats/1.0 (https://ixwiki.com; contact@ixwiki.com)",
      },
    });

    return response.status === 200;
  } catch (error) {
    console.error("[WIKIMEDIA_RESOLVER] URL validation failed:", url, error);
    return false;
  }
}

/**
 * Get statistics about image resolution cache
 */
export async function getImageCacheStats() {
  const total = await prisma.militaryEquipmentCatalog.count();
  const withImages = await prisma.militaryEquipmentCatalog.count({
    where: { imageUrl: { not: null } },
  });
  const recentlyUpdated = await prisma.militaryEquipmentCatalog.count({
    where: {
      imageUrl: { not: null },
      updatedAt: {
        gte: new Date(Date.now() - CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000),
      },
    },
  });

  return {
    total,
    withImages,
    withoutImages: total - withImages,
    recentlyUpdated,
    staleImages: withImages - recentlyUpdated,
    cacheHitRate: withImages > 0 ? (recentlyUpdated / withImages) * 100 : 0,
  };
}
