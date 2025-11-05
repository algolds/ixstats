// src/lib/wikimedia-image-loader.ts
/**
 * Wikimedia Image Loader for Next.js
 *
 * Custom image loader for optimizing Wikimedia Commons images.
 * Generates thumbnail URLs with appropriate dimensions.
 */

export interface WikimediaLoaderProps {
  src: string;
  width: number;
  quality?: number;
}

/**
 * Wikimedia Commons image loader
 * Generates optimized thumbnail URLs from Wikimedia
 */
export function wikimediaImageLoader({ src, width, quality }: WikimediaLoaderProps): string {
  // If not a Wikimedia URL, return as-is
  if (!src.includes("wikimedia.org") && !src.includes("wikipedia.org")) {
    return src;
  }

  // If already a thumb URL, parse and replace width
  if (src.includes("/thumb/")) {
    // Extract the base URL and filename
    const thumbMatch = src.match(/(.*\/thumb\/.+\/)(\d+px-.+)/);
    if (thumbMatch) {
      const [, baseUrl, filename] = thumbMatch;
      const newFilename = filename.replace(/^\d+px-/, `${width}px-`);
      return `${baseUrl}${newFilename}`;
    }
  }

  // For full-size images, construct thumbnail URL
  // Wikimedia format: .../wikipedia/commons/thumb/a/ab/Filename.jpg/300px-Filename.jpg
  const urlMatch = src.match(/\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/);
  if (urlMatch) {
    const [, hash1, hash2, filename] = urlMatch;
    const baseUrl = src.substring(0, src.lastIndexOf("/wikipedia/commons/"));
    return `${baseUrl}/wikipedia/commons/thumb/${hash1}/${hash2}/${filename}/${width}px-${filename}`;
  }

  // Fallback: return original URL
  return src;
}

/**
 * Validate if URL is from Wikimedia Commons
 */
export function isWikimediaUrl(url: string): boolean {
  return url.includes("wikimedia.org") || url.includes("wikipedia.org");
}

/**
 * Extract filename from Wikimedia URL
 */
export function extractWikimediaFilename(url: string): string | null {
  const match = url.match(/\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Generate Wikimedia Commons thumbnail URL
 */
export function generateWikimediaThumbnail(url: string, width: number): string {
  return wikimediaImageLoader({ src: url, width });
}
