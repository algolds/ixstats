/** A tiny generated PNG for the image decoders' size limits (no files on disk). */
import sharp from "sharp";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A valid 1×1 PNG whose header claims `width`×`height` pixels — enough for a decoder to refuse it on
 * size without anyone allocating a giant image.
 */
export async function pngClaimingSize(width: number, height: number): Promise<Buffer> {
  const png = await sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  // Signature (8 bytes), then the IHDR chunk: length (4), type (4), data (13: width, height, …), CRC (4).
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  png.writeUInt32BE(crc32(png.subarray(12, 29)), 29);
  return png;
}
