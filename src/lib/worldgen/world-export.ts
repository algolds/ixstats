/** What World Studio's Ship tab downloads: the world's layers as one zip, a PNG, and their file names. */

import type { PngWidth } from "./render-png";
import type { WorldGenResult } from "./worker/world-messages";
import { zipStore, type ZipEntry } from "./zip-store";

/** One file per layer in the world, named for the layer, from the layer's own JSON text. */
export function layerFiles(result: Pick<WorldGenResult, "layers">): ZipEntry[] {
  const encoder = new TextEncoder();
  return Object.entries(result.layers).map(([layer, json]) => ({
    name: `${layer}.geojson`,
    data: encoder.encode(json),
  }));
}

/** The world's layers as a zip archive. */
export const geojsonZip = (result: Pick<WorldGenResult, "layers">): Uint8Array<ArrayBuffer> =>
  zipStore(layerFiles(result));

/** `world-<preset>-<seed>.zip`, or `world-<preset>-<seed>-<width>.png` with a width. */
export function exportFileName(preset: string, seed: number, extra?: PngWidth): string {
  return extra === undefined
    ? `world-${preset}-${seed}.zip`
    : `world-${preset}-${seed}-${extra}.png`;
}

/** What the image failing means to the admin: the browser's canvas limit, by width. */
export function pngFailureText(width: PngWidth): string {
  if (width === 8192) return "Your browser could not make an image this large. Try 4096.";
  if (width === 4096) return "Your browser could not make an image this large. Try 2048.";
  return "Your browser could not make the image.";
}

/** How long a blob URL stays alive after the click that started the download */
export const REVOKE_DELAY_MS = 1000;

/** Hands `blob` to the browser as a download named `filename`, then revokes its URL. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
