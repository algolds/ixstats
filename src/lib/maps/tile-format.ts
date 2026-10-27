/**
 * The format of the vector tiles the server renders: the SQL, geometry kinds, simplification and the properties each
 * tile carries (`tile-render.ts`). Tile URLs carry it (`/f<n>/`) and so does the disk cache
 * (`<MAP_TILE_DIR>/<realm>/f<n>/...`), so tiles cached as immutable for a year, in browsers and on disk, are always
 * what that URL's renderer would draw. Bump it in the same commit as any change to what the renderer produces; the
 * next deploy then asks for new URLs and fills a new folder instead of reusing the old tiles.
 */
export const TILE_FORMAT_VERSION = 1;
