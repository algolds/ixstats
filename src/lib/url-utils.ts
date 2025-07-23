/**
 * URL utilities for handling base path in different environments
 */

const BASE_PATH = process.env.NODE_ENV === "production" ? "/projects/ixstats" : "";

/**
 * Creates a properly prefixed URL for the current environment
 * @param path - The path to prefix (should start with /)
 * @returns The full path with base path prefix in production
 */
export function createUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalizedPath}`;
}

/**
 * Creates a properly prefixed asset URL for the current environment
 * @param assetPath - The asset path (should start with /)
 * @returns The full asset path with base path prefix in production
 */
export function createAssetUrl(assetPath: string): string {
  return createUrl(assetPath);
}

/**
 * Helper for Next.js router.push() calls to use correct base path
 * @param router - Next.js router instance
 * @param path - The path to navigate to (should start with /)
 */
export function navigateTo(router: any, path: string): void {
  router.push(createUrl(path));
}