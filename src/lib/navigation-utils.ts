/**
 * Navigation utilities for environment-aware routing.
 * With the subdomain migration (ixstates.ixwiki.com), basePath is always "".
 */

/**
 * Get the correct URL for navigation based on environment.
 * basePath is now always "" — this function normalizes the path.
 */
export function getNavUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return normalizedPath;
}

/**
 * Navigate to a path using window.location (for non-Next.js navigation).
 */
export function navigateToPath(path: string): void {
  const url = getNavUrl(path);
  window.location.href = url;
}

/**
 * Get the base URL for external links or API calls.
 */
export function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NODE_ENV === "production") {
    return "https://ixstates.ixwiki.com";
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
}
