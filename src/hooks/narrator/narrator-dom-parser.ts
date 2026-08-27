// src/hooks/narrator/narrator-dom-parser.ts
// Parsing and chunking utilities for WikiOS Kokoro TTS article narration

import type { PlaybackBlock } from "./narrator-types";

// Strip citation/edit cruft from raw article text.
export function cleanContentText(text: string): string {
  return text
    .replace(/\[\d+\]/g, "") // remove [1], [2] citation brackets
    .replace(/\[citation needed\]/gi, "")
    .replace(/\[edit\]/gi, "")
    .trim();
}

// Split prose into sentences (abbreviation-naive, but the server re-splits anyway).
export function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g);
  return parts ? parts.map((s) => s.trim()).filter(Boolean) : [text];
}

// Pack prose into bounded chunks so every TTS request is ~constant size (~14s on Kokoro).
export const TTS_CHUNK_CHARS = 240;

export function chunkText(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  const flush = () => {
    const t = buf.trim();
    if (t) out.push(t);
    buf = "";
  };
  const add = (s: string) => {
    if (buf && buf.length + s.length + 1 > TTS_CHUNK_CHARS) flush();
    buf = buf ? `${buf} ${s}` : s;
  };
  for (const sentence of splitSentences(text)) {
    if (sentence.length <= TTS_CHUNK_CHARS) {
      add(sentence);
      continue;
    }
    flush(); // oversize sentence — split on clause, then words
    for (const clause of sentence.split(/(?<=[,;:—-])\s+/)) {
      if (clause.length <= TTS_CHUNK_CHARS) {
        add(clause);
        continue;
      }
      for (const word of clause.split(/\s+/)) add(word);
    }
  }
  flush();
  return out.length ? out : [text];
}

/**
 * Extracts and tags audio playback blocks from an article container DOM element.
 */
export function extractArticleBlocks(container: HTMLElement): PlaybackBlock[] {
  const elements = Array.from(container.querySelectorAll("h2, h3, h4, p, li")) as HTMLElement[];
  const validBlocks: PlaybackBlock[] = [];
  let currentSectionId = "";

  elements.forEach((el, index) => {
    // Exclude elements inside infoboxes, sidebars, coordinates, nav boxes, math, etc.
    if (
      el.closest(".infobox") ||
      el.closest(".aside") ||
      el.closest(".sidebar") ||
      el.closest(".navbox") ||
      el.closest(".reflist") ||
      el.closest(".coordinates") ||
      el.closest(".wikios-ixworld-loading") ||
      el.closest("table")
    ) {
      return;
    }

    // Read cleaned text content
    const clean = cleanContentText(el.textContent || "");
    if (!clean) return;

    const isHeading = el.tagName.startsWith("H");

    if (isHeading) {
      currentSectionId = el.id || `heading-${index}`;
    }

    // Add a unique identifier class to bind the DOM element
    const blockId = `wikios-narrator-block-${index}`;
    el.setAttribute("data-narrator-block", blockId);

    if (isHeading) {
      validBlocks.push({
        id: blockId,
        text: clean,
        type: "heading",
        sectionId: currentSectionId || undefined,
        element: el,
      });
    } else {
      // One block per bounded chunk, all sharing the same DOM element for highlighting.
      chunkText(clean).forEach((chunk, si) => {
        validBlocks.push({
          id: `${blockId}-s${si}`,
          text: chunk,
          type: "prose",
          sectionId: currentSectionId || undefined,
          element: el,
        });
      });
    }
  });

  return validBlocks;
}
