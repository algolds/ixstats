// src/components/shared/editor/imageAlt.ts
// Derives readable alt text from an image URL's file name.

const THUMBNAIL_PREFIX = /^\d+px-/i;
const FILE_EXTENSION = /\.[a-z0-9]{2,5}$/i;
// SVG thumbnails are rasters named "<file>.svg.png".
const RASTERIZED_EXTENSION = /\.(svg|png|jpe?g|gif|webp)$/i;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** "…/thumb/a/ab/My_Map.svg/960px-My_Map.svg.png" becomes "My Map"; "" when nothing usable. */
export function altFromImageUrl(url: string): string {
  const path = url.split(/[?#]/)[0] ?? "";
  const lastSegment = path.split("/").filter(Boolean).pop() ?? "";
  const name = safeDecode(lastSegment)
    .replace(THUMBNAIL_PREFIX, "")
    .replace(FILE_EXTENSION, "")
    .replace(RASTERIZED_EXTENSION, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name;
}
