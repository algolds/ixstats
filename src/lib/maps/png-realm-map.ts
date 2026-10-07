/**
 * PNG realm maps (decisions 10–11): the image limits shared by the pipeline router, the province importer and the
 * map import engine (src/lib/maps/import), and the error an unreadable image raises. Pure — no I/O.
 */

/** Largest PNG/JPEG (decoded bytes) the Full Pipeline accepts. */
export const MAX_PNG_BYTES = 25 * 1024 * 1024;

/** Base64 length of a MAX_PNG_BYTES image — the bound runPipeline's input enforces. */
export const MAX_PNG_BASE64_LENGTH = Math.ceil(MAX_PNG_BYTES / 3) * 4;

/** Largest map image, in pixels, the pipeline decodes (8192×8192): bounds the raw buffers it allocates. */
export const MAX_PNG_MEGAPIXELS = 64;
export const MAX_PNG_PIXELS = MAX_PNG_MEGAPIXELS * 1024 * 1024;

/** The uploaded map image could not be decoded, or is too large to decode: the admin's input, not a fault. */
export class PngDecodeError extends Error {
  constructor(reason: string) {
    super(
      `The map image could not be read (PNG or JPEG, at most ${MAX_PNG_MEGAPIXELS} megapixels): ${reason}`
    );
    this.name = "PngDecodeError";
  }
}
