/**
 * Base path utility for production deployments
 * Ensures all internal links respect the BASE_PATH environment variable
 */

// Get the base path from environment or use empty string for root deployment
export const BASE_PATH = 
  process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true" 
    ? "" 
    : (process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || "");

/**
 * Prepends the BASE_PATH to a given path
 * @param path - The path to prefix (e.g., "/dashboard")
 * @returns The full path with BASE_PATH (e.g., "/projects/ixstats/dashboard")
 */
export function withBasePath(path: string): string {
  // Handle root path
  if (path === "/") {
    return BASE_PATH || "/";
  }

  // Don't double-prefix if already has base path
  if (BASE_PATH && path.startsWith(BASE_PATH)) {
    return path;
  }

  // Handle external URLs
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("//")) {
    return path;
  }

  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${BASE_PATH}${normalizedPath}`;
}

/** Protomaps basemaps-assets (GitHub Pages) — `access-control-allow-origin: *` */
const MAP_GLYPHS_CORS_CDN =
  "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf";

/**
 * MapLibre glyph PBF URL template (`{fontstack}` / `{range}`).
 * IxWorld standalone often serves the app from `maps.*` while `/fonts` redirects to the main site, which breaks CORS; standalone builds therefore use a public CDN.
 *
 * @see MAP_SYMBOL_FONTS in map-config.ts — font names must exist under this URL.
 */
export function getMapGlyphsUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_MAP_GLYPHS_URL;
  if (typeof explicit === "string" && explicit.trim().length > 0) {
    return explicit.trim();
  }
  if (process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true") {
    return MAP_GLYPHS_CORS_CDN;
  }
  return withBasePath("/fonts/{fontstack}/{range}.pbf");
}

/**
 * Removes the BASE_PATH from a given path
 * Useful for checking pathname matches
 */
export function stripBasePath(path: string): string {
  if (BASE_PATH && path.startsWith(BASE_PATH)) {
    return path.slice(BASE_PATH.length) || "/";
  }
  return path;
}
