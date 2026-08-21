/**
 * Base path utility for production deployments
 * Ensures all internal links respect the BASE_PATH environment variable
 */

// Get the base path dynamically from environment or use empty string for root deployment
export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true"
    ? ""
    : process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || "";
}

export const BASE_PATH = getBasePath();

/**
 * Prepends the BASE_PATH to a given path
 * @param path - The path to prefix (e.g., "/dashboard")
 * @returns The full path with BASE_PATH (e.g., "/projects/ixstats/dashboard")
 */
export function withBasePath(path: string): string {
  const basePath = getBasePath();

  // Handle root path
  if (path === "/") {
    return basePath || "/";
  }

  // Handle external URLs
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("//")) {
    return path;
  }

  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Don't double-prefix if already has base path
  if (basePath && normalizedPath.startsWith(basePath)) {
    return normalizedPath;
  }

  // If we're in the browser, check if the app is actually mounted at BASE_PATH
  // In dev, sometimes NEXT_PUBLIC_BASE_PATH is in .env but the dev server runs at root
  if (typeof window !== "undefined" && basePath) {
    // If the current host looks like the standalone maps domain (eg. maps.example.com),
    // prefer root links so links like `/blurbs/...` point to the maps host.
    try {
      const host = window.location.hostname || "";
      if (host.startsWith("maps.")) {
        return normalizedPath;
      }
    } catch {}

    if (!window.location.pathname.startsWith(basePath)) {
      return normalizedPath; // App is running at root, don't prepend
    }
  }

  return `${basePath}${normalizedPath}`;
}

/**
 * Navigates to a path using the Next.js router or window.location for external URLs.
 */
export function navigateWithBasePath(path: string, router: any) {
  const url = withBasePath(path);
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
    window.location.href = url;
  } else {
    router.push(url);
  }
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
