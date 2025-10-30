/**
 * Navigation utilities for environment-aware routing
 * Handles basePath differences between development and production
 */

/**
 * Get the correct URL for navigation based on environment
 * Development: uses root path (no basePath)
 * Production: uses /projects/ixstats basePath
 */
export function getNavUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // In production, basePath is handled by Next.js automatically
  // In development, no basePath is used
  return normalizedPath;
}

/**
 * Navigate to a path using window.location (for non-Next.js navigation)
 * This handles the basePath automatically based on environment
 */
export function navigateToPath(path: string): void {
  const url = getNavUrl(path);
  window.location.href = url;
}

/**
 * Get the base URL for external links or API calls
 * This includes the basePath for production environments
 */
export function getBaseUrl(): string {
  const basePath = process.env.NODE_ENV === "production" ? "/projects/ixstats" : "";

  if (typeof window !== "undefined") {
    return window.location.origin + basePath;
  }

  // Server-side URL building
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}${basePath}`;
  }

  if (process.env.NODE_ENV === "production") {
    return `https://ixwiki.com${basePath}`;
  }

  return `http://localhost:${process.env.PORT ?? 3000}${basePath}`;
}
