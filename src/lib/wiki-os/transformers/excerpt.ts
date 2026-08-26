/**
 * src/lib/wiki-os/transformers/excerpt.ts — Canonical Plain-Text Excerpt & Lead Image Extractor
 *
 * Strips raw wikitext templates, infoboxes, tables, HTML tags, links, and comments
 * to generate pristine plain-text excerpts and extract genuine lead image URLs.
 */

import { getImageUrl } from "./image-url";

/**
 * Strips all templates and infoboxes, handling arbitrary nesting levels.
 */
export function stripWikitextTemplates(wikitext: string): string {
  if (!wikitext) return "";
  let curr = wikitext;

  // 1. Strip all wikitext tables first
  curr = curr.replace(/\{\|[\s\S]*?\|\}/g, "");

  // 2. Multi-pass recursive stripper to consume nested templates
  let prev = "";
  let depth = 0;
  while (curr !== prev && depth < 10) {
    prev = curr;
    curr = curr.replace(/\{\{[^{}]*\}\}/g, "");
    curr = curr.replace(/\{\{(?:[^{}]|(?!\}\})\{)*\}\}/g, "");
    depth++;
  }

  // 3. Strip any unclosed template at the start of the document
  curr = curr.replace(/^\{\{[\s\S]*?\n\n/g, "\n\n");
  curr = curr.replace(/^\{\{[\s\S]*$/g, "");

  // 4. Strip leftover orphaned infobox parameter lines (e.g. "| key = value")
  curr = curr.replace(/^[|!][^\n]*\n?/gm, "");

  return curr;
}

/**
 * Calculates genuine prose raw text bytes, excluding all templates, tables, tags, and formatting.
 */
export function calculateRawTextBytes(wikitext: string | null | undefined): number {
  if (!wikitext) return 0;

  const prose = stripWikitextTemplates(wikitext)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\{\|[\s\S]*?\|\}/g, "")
    .replace(/\[\[(?:File|Image|Category|Media):[^\]]+\]\]/gi, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1")
    .replace(/\[https?:\/\/[^\s\]]+\]/g, "")
    .replace(/'''?/g, "")
    .replace(/^==+[^=]+==+/gm, "")
    .replace(/<ref[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/^[|!][^\n]*\n?/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  return Buffer.byteLength(prose, "utf8");
}

/**
 * Strips wikitext syntax into clean plain text for article cards and summaries.
 */
export function cleanExcerpt(wikitext: string | null | undefined, maxLen = 220): string {
  if (!wikitext) return "";

  // Strip templates on full document before length truncating
  const strippedTemplates = stripWikitextTemplates(wikitext);

  const cleaned = strippedTemplates
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\{\|[\s\S]*?\|\}/g, "")
    .replace(/\[\[(?:File|Image|Category|Media):[^\]]+\]\]/gi, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1")
    .replace(/\[https?:\/\/[^\s\]]+\]/g, "")
    .replace(/'''?/g, "")
    .replace(/^==+[^=]+==+/gm, "")
    .replace(/<ref[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/^[|!][^\n]*\n?/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 3).trim()}...`;
}

/**
 * Extracts a genuine lead image URL from wikitext or infobox metadata.
 */
export function extractLeadImageFromWikitext(wikitext: string | null | undefined): string | null {
  if (!wikitext) return null;

  // 1. Check [[File:name.jpg]] or [[Image:name.png]]
  const fileMatch = wikitext.match(/\[\[(?:File|Image):([^|\]\n]+)/i);
  if (fileMatch && fileMatch[1]) {
    const raw = fileMatch[1].trim();
    if (isValidImageFilename(raw)) {
      return formatImageUrl(raw);
    }
  }

  // 2. Check infobox image fields (e.g. image = Foo.jpg, flag = Bar.png, photo = Baz.jpg)
  const infoboxMatch = wikitext.match(/(?:image|flag|photo|logo|coa|seal|insignia|emblem)\s*=\s*([^|\n}]+)/i);
  if (infoboxMatch && infoboxMatch[1]) {
    const raw = infoboxMatch[1].trim().replace(/^\[\[(?:File|Image):/i, "").replace(/\]\]$/, "");
    if (isValidImageFilename(raw)) {
      return formatImageUrl(raw);
    }
  }

  return null;
}

function isValidImageFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (lower.includes("icon") || lower.includes("utility") || lower.includes("placeholder")) return false;
  return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp");
}

function formatImageUrl(filename: string): string {
  const clean = filename.replace(/^File:/i, "").replace(/^Image:/i, "").replace(/ /g, "_").trim();
  return getImageUrl(clean);
}
