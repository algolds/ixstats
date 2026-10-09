/**
 * image-blurhash.ts — the BlurHash of an image file, from its own pixels (WK-17). Server only (sharp).
 *
 * Best effort and bounded: only a PNG, JPEG, GIF or WebP is read (an SVG is a document and a PDF has no picture, so
 * both get none); sharp refuses a picture of more pixels than an upload may have (`getMaxImageArea`) and gives up
 * after a few seconds; the picture is shrunk to at most 32 px on its longer side before the hash is computed (a JPEG
 * is shrunk while it is decoded); an animation gives its first frame. A file that cannot be decoded gets null, never
 * an error: the upload, or the backfill, goes on without a hash, and readers show the size-only placeholder.
 */

import sharp from "sharp";
import { getMaxImageArea } from "../config";
import { BlurHashService } from "../core/blurhash-service";

/** The types whose pixels are read. */
export const BLURHASH_MIME_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

/** The longer side of the thumbnail the hash is computed from: more pixels change nothing a placeholder shows. */
const THUMBNAIL_SIDE = 32;
/** How long sharp may take to decode one picture (blurhash, upload thumbnails). */
export const DECODE_TIMEOUT_SECONDS = 5;

/** Whether `mimeType` is a type whose pixels `computeBlurhash` reads. */
export function canComputeBlurhash(mimeType: string | null | undefined): boolean {
  return !!mimeType && BLURHASH_MIME_TYPES.includes(mimeType.toLowerCase());
}

/**
 * The BlurHash of the image `bytes` of type `mimeType` (4 × 3 components, 3 × 4 for a portrait picture), or null
 * when the type is not read or the bytes cannot be decoded.
 */
export async function computeBlurhash(
  bytes: Uint8Array,
  mimeType: string | null | undefined
): Promise<string | null> {
  if (!canComputeBlurhash(mimeType) || bytes.length === 0) return null;
  try {
    const { data, info } = await sharp(bytes, {
      limitInputPixels: getMaxImageArea(),
      animated: false,
      failOn: "error",
    })
      .timeout({ seconds: DECODE_TIMEOUT_SECONDS })
      .rotate() // a JPEG's EXIF orientation, as browsers show it
      .resize(THUMBNAIL_SIDE, THUMBNAIL_SIDE, { fit: "inside" })
      // Transparent pixels hold any colour (often black): the placeholder shows them as the white they are drawn on
      .flatten({ background: "#ffffff" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.channels !== 4 || info.width < 1 || info.height < 1) return null;
    const portrait = info.height > info.width;
    return BlurHashService.encode(
      new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
      info.width,
      info.height,
      portrait ? 3 : 4,
      portrait ? 4 : 3
    );
  } catch (error) {
    console.warn(
      "[WikiOS] No BlurHash for an image that could not be decoded:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
