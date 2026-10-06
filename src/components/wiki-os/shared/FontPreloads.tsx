"use client";

import { preload } from "react-dom";

/**
 * The Schibsted Grotesk weights an article's first screen is set in (body 500, labels 600, 700 and
 * the heavy 800 headings). Without a preload the browser asks for each one only when it has laid
 * the text out, so the page is first set in the fallback face and moves when Schibsted arrives (a
 * notice that wrapped in two lines in the fallback wraps in one, and everything under it jumps).
 * Listed first in <head>, the files are fetched with the HTML and are usually there for the first
 * layout.
 *
 * A client component on purpose: a `preload` made in a server component reaches the browser as a
 * hint in the flight data, after the scripts, not as a <link> in the HTML.
 * The URLs are the ones styles/typography.css declares (the browser matches a preload by URL).
 */
const WEIGHTS = [500, 600, 700, 800] as const;

export function FontPreloads() {
  for (const weight of WEIGHTS) {
    preload(`/fonts/Schibsted%20Grotesk-${weight}.ttf`, {
      as: "font",
      type: "font/ttf",
      crossOrigin: "anonymous",
    });
  }
  return null;
}
