/**
 * Decode a map image (PNG, JPEG, WebP, anything sharp reads) once, to raw RGBA. The size is checked from the
 * header before any pixel is decoded, with the same 64-megapixel limit as the rest of the map code
 * (MAX_PNG_PIXELS); an unreadable or oversize image is a PngDecodeError (the admin's input, not a fault).
 * Server only (sharp).
 */
import { MAX_PNG_PIXELS, PngDecodeError } from "~/lib/maps/png-realm-map";

export interface DecodedImage {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row by row from the top. */
  data: Uint8Array;
}

export async function imageDimensions(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  const sharp = (await import("sharp")).default;
  const metadata = await sharp(bytes)
    .metadata()
    .catch((err: Error) => {
      throw new PngDecodeError(err.message);
    });
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!(width > 0 && height > 0)) throw new PngDecodeError("it has no pixels");
  if (width * height > MAX_PNG_PIXELS) throw new PngDecodeError(`it is ${width}×${height} pixels`);
  return { width, height };
}

export async function decodeImage(bytes: Uint8Array): Promise<DecodedImage> {
  const { width, height } = await imageDimensions(bytes);
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(bytes, { limitInputPixels: MAX_PNG_PIXELS })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .catch((err: Error) => {
      throw new PngDecodeError(err.message);
    });
  if (info.width !== width || info.height !== height || info.channels !== 4) {
    throw new PngDecodeError("its decoded size does not match its header");
  }
  return { width, height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}
