/**
 * Navigation utilities for environment-aware routing.
 * Production uses /projects/ixstates basePath.
 */

/**
 * Get the correct URL for navigation based on environment.
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
 * Includes the basePath for production environments.
 */
export function getBaseUrl(): string {
  const basePath = process.env.NODE_ENV === "production" ? "/projects/ixstates" : "";

  if (typeof window !== "undefined") {
    return window.location.origin + basePath;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}${basePath}`;
  }

  if (process.env.NODE_ENV === "production") {
    return `https://ixwiki.com${basePath}`;
  }

  return `http://localhost:${process.env.PORT ?? 3000}${basePath}`;
}
