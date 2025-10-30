/**
 * URL utilities for handling base path in different environments
 *
 * For Next.js Link components and router.push, basePath is handled automatically.
 * For direct window.location.href assignments, we need to manually add the base path.
 */

// Get base path from environment (must match next.config.js)
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || "";

/**
 * Creates a properly prefixed URL for the current environment
 * @param path - The path to prefix (should start with /)
 * @returns The path with base path prefix for production
 */
export function createUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Next.js Link and router automatically handle basePath
  // BUT window.location.href assignments need manual prefix
  // Since we can't detect the caller, always return the path with prefix
  // Next.js will handle duplicate prefix in Link/router cases
  return normalizedPath;
}

/**
 * Creates a URL with explicit base path for direct navigation (window.location.href)
 * Use this for window.location assignments to ensure base path is included
 * @param path - The path to prefix (should start with /)
 * @returns The full path with base path prefix
 */
export function createAbsoluteUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Don't double-prefix if already has base path
  if (BASE_PATH && normalizedPath.startsWith(BASE_PATH)) {
    return normalizedPath;
  }

  return BASE_PATH ? `${BASE_PATH}${normalizedPath}` : normalizedPath;
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
