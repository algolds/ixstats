import "server-only";

import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { loadOgFonts } from "./og-assets.server";
import { OG_SIZE } from "./og-theme";

/**
 * `element` rendered as a 1200x630 PNG in Schibsted Grotesk. Without the font files the fonts option
 * is left out, so `ImageResponse` uses its bundled default instead of failing on an empty list.
 */
export async function ogImageResponse(element: ReactElement): Promise<ImageResponse> {
  const fonts = await loadOgFonts();
  return new ImageResponse(element, { ...OG_SIZE, fonts: fonts.length > 0 ? fonts : undefined });
}
