/**
 * URL utilities for handling base path in different environments
 * 
 * Note: Next.js automatically handles basePath from next.config.js,
 * so we don't need to manually add it here. This function is kept
 * for consistency and potential future use.
 */

/**
 * Creates a properly prefixed URL for the current environment
 * @param path - The path to prefix (should start with /)
 * @returns The path as-is (Next.js handles basePath automatically)
 */
export function createUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  // Next.js automatically handles basePath from next.config.js
  return normalizedPath;
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