/**
 * wiki-content-extractor.ts — Full wiki article parser.
 *
 * Takes raw wikitext and extracts structured content beyond just the infobox:
 * sections, lists, tables, categories, links, images, coordinates, and intro.
 *
 * Pure functions — no side effects, no database, no fetch.
 * Builds on wiki-infobox-parser.ts and wiki-bridge.ts cleanWikiMarkup.
 */

import {
  parseInfobox,
  parseCoordTemplate,
  cleanWikiValue,
  type ParsedInfobox,
} from "~/lib/wiki-os/transformers/infobox-parser";
import { cleanWikiMarkup } from "~/lib/wiki-os/transformers/wikitext-parser";

// ── Types ──

export interface WikiSection {
  level: number;
  title: string;
  /** Raw wikitext content of this section */
  content: string;
  /** Cleaned plaintext content */
  cleanContent: string;
}

export interface WikiTable {
  headers: string[];
  rows: string[][];
  /** Section this table appeared in */
  sectionTitle?: string;
}

export interface WikiList {
  /** Section context where this list was found */
  context: string;
  items: string[];
}

export interface WikiExtractedContent {
  title: string;
  /** First paragraph plaintext */
  intro: string;
  /** Parsed infobox if present */
  infobox: ParsedInfobox | null;
  /** All sections with headings and content */
  sections: WikiSection[];
  /** Category links */
  categories: string[];
  /** Coordinates extracted from infobox or {{coord}} templates */
  coordinates: [number, number] | null;
  /** Internal wiki links */
  links: string[];
  /** Image file references */
  images: string[];
  /** Parsed tables */
  tables: WikiTable[];
  /** Parsed lists */
  lists: WikiList[];
}

// ── Section Extraction ──

/**
 * Split wikitext into sections by == headings.
 */
function extractSections(wikitext: string): WikiSection[] {
  const sections: WikiSection[] = [];
  const headingRegex = /^(={2,6})\s*(.+?)\s*\1\s*$/gm;
  const matches: { level: number; title: string; index: number }[] = [];

  let match;
  while ((match = headingRegex.exec(wikitext)) !== null) {
    matches.push({
      level: match[1]!.length,
      title: match[2]!.trim(),
      index: match.index,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!;
    const contentStart = current.index + wikitext.slice(current.index).indexOf("\n") + 1;
    const contentEnd = i + 1 < matches.length ? matches[i + 1]!.index : wikitext.length;
    const content = wikitext.slice(contentStart, contentEnd).trim();

    sections.push({
      level: current.level,
      title: current.title,
      content,
      cleanContent: cleanWikiMarkup(content),
    });
  }

  return sections;
}

// ── Intro Extraction ──

function extractIntro(wikitext: string): string {
  // Remove everything from first heading onward
  const headingIndex = wikitext.search(/^==[^=]/m);
  const introText =
    headingIndex > 0 ? wikitext.substring(0, headingIndex) : wikitext.substring(0, 2000);
  return cleanWikiMarkup(introText);
}

// ── Category Extraction ──

function extractCategories(wikitext: string): string[] {
  const categories: string[] = [];
  const regex = /\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi;
  let match;
  while ((match = regex.exec(wikitext)) !== null) {
    categories.push(match[1]!.trim());
  }
  return categories;
}

// ── Link Extraction ──

function extractLinks(wikitext: string): string[] {
  const links = new Set<string>();
  const regex = /\[\[([^|\]#]+)(?:[|#][^\]]*?)?\]\]/g;
  let match;
  while ((match = regex.exec(wikitext)) !== null) {
    const target = match[1]!.trim();
    // Filter out non-article namespaces
    if (!target.includes(":") || target.startsWith("File:")) continue;
    if (target.startsWith("File:")) continue;
    links.add(target);
  }
  return [...links];
}

// ── Image Extraction ──

function extractImages(wikitext: string): string[] {
  const images: string[] = [];
  const regex = /\[\[(?:File|Image):([^\]|]+)/gi;
  let match;
  while ((match = regex.exec(wikitext)) !== null) {
    images.push(match[1]!.trim());
  }
  return images;
}

// ── Table Extraction ──

function extractTables(wikitext: string, sections: WikiSection[]): WikiTable[] {
  const tables: WikiTable[] = [];
  const tableRegex = /\{\|[^\n]*\n([\s\S]*?)\|\}/g;
  let match;

  while ((match = tableRegex.exec(wikitext)) !== null) {
    const tableContent = match[1]!;
    const rows = tableContent.split(/^\|-/m).filter((r) => r.trim());

    if (rows.length === 0) continue;

    let headers: string[] = [];
    const dataRows: string[][] = [];

    for (const row of rows) {
      const cells = row
        .split(/\n/)
        .filter((line) => line.startsWith("!") || line.startsWith("|"))
        .map((line) => {
          // Remove leading ! or | and any style attributes before second |
          let cell = line.replace(/^[!|]\s*/, "");
          const pipeIdx = cell.indexOf("|");
          if (pipeIdx > 0 && !cell.startsWith("[[")) {
            cell = cell.substring(pipeIdx + 1);
          }
          return cleanWikiValue(cell.trim());
        });

      if (cells.length === 0) continue;

      // If row has ! cells, it's a header row
      if (row.includes("\n!")) {
        headers = cells;
      } else {
        dataRows.push(cells);
      }
    }

    if (dataRows.length > 0 || headers.length > 0) {
      // Find which section this table is in
      let sectionTitle: string | undefined;
      for (const section of sections) {
        if (section.content.includes(match[0]!.substring(0, 50))) {
          sectionTitle = section.title;
          break;
        }
      }

      tables.push({ headers, rows: dataRows, sectionTitle });
    }
  }

  return tables;
}

// ── List Extraction ──

function extractLists(wikitext: string, sections: WikiSection[]): WikiList[] {
  const lists: WikiList[] = [];

  for (const section of sections) {
    const lines = section.content.split("\n");
    let currentItems: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("*") || trimmed.startsWith("#")) {
        const item = cleanWikiValue(trimmed.replace(/^[*#]+\s*/, ""));
        if (item) currentItems.push(item);
      } else if (currentItems.length > 0) {
        lists.push({ context: section.title, items: [...currentItems] });
        currentItems = [];
      }
    }

    if (currentItems.length > 0) {
      lists.push({ context: section.title, items: currentItems });
    }
  }

  return lists;
}

// ── Main Extractor ──

/**
 * Extract all structured content from raw wikitext.
 */
export function extractWikiContent(title: string, wikitext: string): WikiExtractedContent {
  const infobox = parseInfobox(wikitext);
  const sections = extractSections(wikitext);
  const intro = extractIntro(wikitext);
  const categories = extractCategories(wikitext);
  const links = extractLinks(wikitext);
  const images = extractImages(wikitext);
  const tables = extractTables(wikitext, sections);
  const lists = extractLists(wikitext, sections);

  // Extract coordinates: first try infobox coord fields, then global {{coord}}
  let coordinates: [number, number] | null = null;
  if (infobox) {
    // Check for coordinates field in infobox
    const coordField = infobox.fields.find(
      (f) => f.fieldType === "coordinates" || f.key.toLowerCase().includes("coord")
    );
    if (coordField?.typedValue && Array.isArray(coordField.typedValue)) {
      coordinates = coordField.typedValue as [number, number];
    }
  }
  if (!coordinates) {
    coordinates = parseCoordTemplate(wikitext);
  }

  return {
    title,
    intro,
    infobox,
    sections,
    categories,
    coordinates,
    links,
    images,
    tables,
    lists,
  };
}
