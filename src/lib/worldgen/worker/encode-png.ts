/**
 * The worker's PNG encoder: the render's pixels onto an `OffscreenCanvas`, out through `convertToBlob`. Kept apart
 * from the pure render because jest (jsdom, bun) has no `OffscreenCanvas`; tests pass `createWorldRunner` an encoder
 * of their own.
 */

import type { RenderedMap } from "~/lib/worldgen/render-png";

export async function encodePng({ width, height, rgba }: RenderedMap): Promise<Blob> {
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error("This browser cannot draw the image in the background");
  }
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not make a canvas that large");
  context.putImageData(new ImageData(rgba, width, height), 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}
