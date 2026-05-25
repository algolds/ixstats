/**
 * Wiki Rich Text Parser
 *
 * Converts MediaWiki HTML and wikitext to clean, rich text suitable for card descriptions.
 * Handles parsing, sanitization, and formatting while preserving essential structure.
 *
 * Features:
 * - MediaWiki HTML to rich text conversion
 * - Wikitext template and markup removal
 * - Text sanitization and length limiting
 * - Support for basic formatting (bold, italic, headings, lists)
 * - Reference and template stripping
 *
 * Usage:
 *   import { parseWikiHtml, parseWikitext, cleanRichText } from '~/lib/wiki-rich-text-parser';
 *   const richText = parseWikiHtml(htmlContent, { maxLength: 500 });
 */

/**
 * Configuration options for rich text parsing
 */
export interface RichTextParseOptions {
  /** Maximum length of output text (characters) */
  maxLength?: number;

  /** Minimum length of output text (characters) */
  minLength?: number;

  /** Whether to preserve basic formatting (bold, italic) */
  preserveFormatting?: boolean;

  /** Whether to convert headings to plain text */
  stripHeadings?: boolean;

  /** Whether to preserve list formatting */
  preserveLists?: boolean;

  /** Whether to add ellipsis when truncating */
  addEllipsis?: boolean;

  /** Whether to remove all parenthetical expressions */
  removeParentheticals?: boolean;

  /** Whether to remove pronunciation guides */
  removePronunciations?: boolean;

  /** Number of sentences to extract (overrides maxLength if set) */
  sentenceCount?: number;
}

/**
 * Default parsing options
 */
const DEFAULT_PARSE_OPTIONS: Required<RichTextParseOptions> = {
  maxLength: 500,
  minLength: 100,
  preserveFormatting: true,
  stripHeadings: true,
  preserveLists: false,
  addEllipsis: true,
  removeParentheticals: true,
  removePronunciations: true,
  sentenceCount: 0,
};

/**
 * Parse MediaWiki HTML to clean rich text
 *
 * @param html Raw HTML from MediaWiki API
 * @param options Parsing options
 * @returns Cleaned rich text
 */
export function parseWikiHtml(html: string, options: RichTextParseOptions = {}): string {
  const opts = { ...DEFAULT_PARSE_OPTIONS, ...options };

  if (!html) return "";

  let text = html;

  // Remove common MediaWiki elements
  text = removeWikiElements(text);

  // Convert HTML to text while preserving some formatting
  text = htmlToText(text, opts);

  // Clean and format
  text = cleanRichText(text, opts);

  return text;
}

/**
 * Parse raw wikitext to clean rich text
 *
 * @param wikitext Raw wikitext from MediaWiki
 * @param options Parsing options
 * @returns Cleaned rich text
 */
export function parseWikitext(wikitext: string, options: RichTextParseOptions = {}): string {
  const opts = { ...DEFAULT_PARSE_OPTIONS, ...options };

  if (!wikitext) return "";

  let text = wikitext;

  // Remove templates
  text = removeTemplates(text);

  // Remove references
  text = removeReferences(text);

  // Remove files/images
  text = removeFiles(text);

  // Remove categories
  text = removeCategories(text);

  // Remove comments
  text = removeComments(text);

  // Convert wikitext formatting to plain text
  text = wikitextToText(text, opts);

  // Clean and format
  text = cleanRichText(text, opts);

  return text;
}

/**
 * Remove common MediaWiki HTML elements
 */
function removeWikiElements(html: string): string {
  return (
    html
      // Remove reference blocks
      .replace(/<ol class="references">[\s\S]*?<\/ol>/gi, "")
      .replace(/<div class="reflist">[\s\S]*?<\/div>/gi, "")
      .replace(/<sup[^>]*class="reference"[^>]*>[\s\S]*?<\/sup>/gi, "")

      // Remove infoboxes
      .replace(/<table[^>]*class="infobox"[^>]*>[\s\S]*?<\/table>/gi, "")

      // Remove navigation boxes
      .replace(/<table[^>]*class="navbox"[^>]*>[\s\S]*?<\/table>/gi, "")
      .replace(/<div[^>]*class="navbox"[^>]*>[\s\S]*?<\/div>/gi, "")

      // Remove edit sections
      .replace(/<span class="mw-editsection">[\s\S]*?<\/span>/gi, "")

      // Remove hatnotes
      .replace(/<div[^>]*class="hatnote"[^>]*>[\s\S]*?<\/div>/gi, "")

      // Remove thumbnails and figures
      .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, "")
      .replace(/<div[^>]*class="thumb"[^>]*>[\s\S]*?<\/div>/gi, "")

      // Remove scripts and styles
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")

      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, "")
  );
}

/**
 * Convert HTML to text while preserving basic formatting
 */
function htmlToText(html: string, options: Required<RichTextParseOptions>): string {
  let text = html;

  // Preserve formatting if requested
  if (options.preserveFormatting) {
    // Convert bold
    text = text.replace(/<b>(.*?)<\/b>/gi, "**$1**");
    text = text.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");

    // Convert italic
    text = text.replace(/<i>(.*?)<\/i>/gi, "*$1*");
    text = text.replace(/<em>(.*?)<\/em>/gi, "*$1*");
  } else {
    // Remove formatting tags
    text = text.replace(/<\/?(?:b|strong|i|em)>/gi, "");
  }

  // Handle headings
  if (!options.stripHeadings) {
    text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n\n### $1\n\n");
  } else {
    text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n\n$1\n\n");
  }

  // Handle paragraphs
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Handle lists
  if (options.preserveLists) {
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, "• $1\n");
    text = text.replace(/<\/?[ou]l[^>]*>/gi, "\n");
  } else {
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, "$1 ");
    text = text.replace(/<\/?[ou]l[^>]*>/gi, "");
  }

  // Remove all other HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  return text;
}

/**
 * Remove wikitext templates
 */
function removeTemplates(text: string): string {
  // Remove templates like {{template|param1|param2}}
  // Handle nested templates using a simple approach
  let prevText = "";
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops

  while (text !== prevText && iterations < maxIterations) {
    prevText = text;
    text = text.replace(/\{\{[^{}]*\}\}/g, "");
    iterations++;
  }

  return text;
}

/**
 * Remove reference tags
 */
function removeReferences(text: string): string {
  return text
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/\{\{cite[^}]*\}\}/gi, "");
}

/**
 * Remove file and image links
 */
function removeFiles(text: string): string {
  return text.replace(/\[\[File:[^\]]*\]\]/gi, "").replace(/\[\[Image:[^\]]*\]\]/gi, "");
}

/**
 * Remove category links
 */
function removeCategories(text: string): string {
  return text.replace(/\[\[Category:[^\]]*\]\]/gi, "");
}

/**
 * Remove HTML comments
 */
function removeComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * Convert wikitext formatting to plain text
 */
function wikitextToText(text: string, options: Required<RichTextParseOptions>): string {
  // Convert wikitext links [[Link|Text]] or [[Link]]
  text = text.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2");
  text = text.replace(/\[\[([^\]]+)\]\]/g, "$1");

  // Convert external links [http://url Text]
  text = text.replace(/\[https?:\/\/[^\s\]]+ ([^\]]+)\]/g, "$1");
  text = text.replace(/\[https?:\/\/[^\s\]]+\]/g, "");

  if (options.preserveFormatting) {
    // Convert bold '''text'''
    text = text.replace(/'''(.*?)'''/g, "**$1**");

    // Convert italic ''text''
    text = text.replace(/''(.*?)''/g, "*$1*");
  } else {
    // Remove bold and italic markers
    text = text.replace(/'''|''/g, "");
  }

  // Convert headings
  if (!options.stripHeadings) {
    text = text.replace(/^=+\s*(.*?)\s*=+$/gm, "### $1");
  } else {
    text = text.replace(/^=+\s*(.*?)\s*=+$/gm, "$1");
  }

  // Convert lists
  if (options.preserveLists) {
    text = text.replace(/^\*+\s*/gm, "• ");
    text = text.replace(/^#+\s*/gm, "• ");
  } else {
    text = text.replace(/^\*+\s*/gm, "");
    text = text.replace(/^#+\s*/gm, "");
  }

  return text;
}

/**
 * Clean and format rich text
 */
export function cleanRichText(text: string, options: RichTextParseOptions = {}): string {
  const opts = { ...DEFAULT_PARSE_OPTIONS, ...options };

  if (!text) return "";

  // Remove pronunciation guides (e.g., /ˈfɔːrmət/)
  if (opts.removePronunciations) {
    text = text.replace(/\/[ˈˌəɪʊɛæɔɑʌaieou]+[^\/]*\//gi, "");
    text = text.replace(/\([^)]*IPA[^)]*\)/gi, "");
  }

  // Remove parenthetical content if requested
  if (opts.removeParentheticals) {
    // Keep important parentheticals but remove pronunciation/language info
    text = text.replace(/\s*\([^)]*(?:pronunciation|listen|help·info)[^)]*\)/gi, "");
    text = text.replace(/\s*\([^)]*:[^)]*\)/g, ""); // Remove language/origin info
  }

  // Normalize whitespace
  text = text
    .replace(/\r\n/g, "\n") // Normalize line endings
    .replace(/\n{3,}/g, "\n\n") // Max 2 newlines
    .replace(/[ \t]+/g, " ") // Single spaces
    .replace(/\n /g, "\n") // Remove leading spaces on lines
    .replace(/ \n/g, "\n") // Remove trailing spaces on lines
    .trim();

  // Extract by sentence count if specified
  if (opts.sentenceCount && opts.sentenceCount > 0) {
    text = extractSentences(text, opts.sentenceCount);
  }

  // Truncate to max length
  if (opts.maxLength && text.length > opts.maxLength) {
    text = truncateText(text, opts.maxLength, opts.addEllipsis);
  }

  // Ensure minimum length
  if (opts.minLength && text.length < opts.minLength) {
    // Text too short, might not be suitable
    return text;
  }

  return text.trim();
}

/**
 * Extract a specific number of sentences
 */
function extractSentences(text: string, count: number): string {
  // Split by sentence-ending punctuation
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  return sentences.slice(0, count).join(" ").trim();
}

/**
 * Truncate text intelligently at word boundaries
 */
function truncateText(text: string, maxLength: number, addEllipsis: boolean): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Try to truncate at sentence boundary
  const sentenceEnd = text.lastIndexOf(". ", maxLength);
  if (sentenceEnd > maxLength * 0.7) {
    return text.substring(0, sentenceEnd + 1);
  }

  // Try to truncate at word boundary
  const lastSpace = text.lastIndexOf(" ", maxLength);
  if (lastSpace > maxLength * 0.8) {
    const truncated = text.substring(0, lastSpace);
    return addEllipsis ? truncated + "..." : truncated;
  }

  // Hard truncate
  const truncated = text.substring(0, maxLength - 3);
  return addEllipsis ? truncated + "..." : truncated;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&[a-z]+;/gi, ""); // Remove other entities
}

/**
 * Extract first paragraph from wiki content
 *
 * @param content Wiki HTML or text
 * @param maxLength Maximum length
 * @returns First paragraph text
 */
export function extractFirstParagraph(content: string, maxLength = 300): string {
  // Try to find first <p> tag
  const pMatch = content.match(/<p[^>]*>(.*?)<\/p>/i);
  if (pMatch) {
    return parseWikiHtml(pMatch[0], { maxLength, sentenceCount: 2 });
  }

  // Fallback: use first chunk of text
  const lines = content.split("\n");
  const firstParagraph = lines.find((line) => line.trim().length > 50) || lines[0] || "";

  return cleanRichText(firstParagraph, { maxLength, sentenceCount: 2 });
}

/**
 * Extract summary suitable for card description
 *
 * Optimized for lore card descriptions (300-500 chars)
 *
 * @param content Wiki HTML or wikitext
 * @param isHtml Whether content is HTML (true) or wikitext (false)
 * @returns Card-friendly summary text
 */
export function extractCardSummary(content: string, isHtml = true): string {
  const options: RichTextParseOptions = {
    maxLength: 500,
    minLength: 100,
    preserveFormatting: false,
    stripHeadings: true,
    preserveLists: false,
    addEllipsis: true,
    removeParentheticals: true,
    removePronunciations: true,
    sentenceCount: 3, // Aim for 2-3 sentences
  };

  return isHtml ? parseWikiHtml(content, options) : parseWikitext(content, options);
}

/**
 * Validate if parsed text meets quality standards
 *
 * @param text Parsed text
 * @param minLength Minimum acceptable length
 * @returns True if text meets quality standards
 */
export function validateParsedText(text: string, minLength = 100): boolean {
  if (!text || text.length < minLength) {
    return false;
  }

  // Check for minimum number of words (roughly 20 words for 100 chars)
  const wordCount = text.split(/\s+/).length;
  if (wordCount < Math.floor(minLength / 5)) {
    return false;
  }

  // Check that text is not just punctuation or special chars
  const alphaNumCount = (text.match(/[a-z0-9]/gi) || []).length;
  if (alphaNumCount < minLength * 0.7) {
    return false;
  }

  return true;
}

/**
 * Batch parse multiple wiki contents
 *
 * @param contents Array of wiki contents
 * @param options Parsing options
 * @param isHtml Whether contents are HTML
 * @returns Array of parsed texts
 */
export function batchParse(
  contents: string[],
  options: RichTextParseOptions = {},
  isHtml = true
): string[] {
  return contents.map((content) =>
    isHtml ? parseWikiHtml(content, options) : parseWikitext(content, options)
  );
}

/**
 * Get text excerpt with context around a keyword
 *
 * @param text Full text
 * @param keyword Keyword to find
 * @param contextLength Characters before/after keyword
 * @returns Excerpt with keyword in context
 */
export function extractKeywordContext(
  text: string,
  keyword: string,
  contextLength = 150
): string | null {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);

  if (index === -1) {
    return null;
  }

  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + keyword.length + contextLength);

  let excerpt = text.substring(start, end);

  // Add ellipsis if truncated
  if (start > 0) excerpt = "..." + excerpt;
  if (end < text.length) excerpt = excerpt + "...";

  return excerpt;
}

/**
 * Parse options presets
 */
export const PARSE_PRESETS = {
  /** Card description (300-500 chars, clean) */
  cardDescription: {
    maxLength: 500,
    minLength: 100,
    preserveFormatting: false,
    stripHeadings: true,
    preserveLists: false,
    addEllipsis: true,
    removeParentheticals: true,
    removePronunciations: true,
    sentenceCount: 3,
  } as RichTextParseOptions,

  /** Short preview (100-200 chars) */
  preview: {
    maxLength: 200,
    minLength: 50,
    preserveFormatting: false,
    stripHeadings: true,
    preserveLists: false,
    addEllipsis: true,
    removeParentheticals: true,
    removePronunciations: true,
    sentenceCount: 1,
  } as RichTextParseOptions,

  /** Full summary (500-1000 chars, preserve formatting) */
  fullSummary: {
    maxLength: 1000,
    minLength: 200,
    preserveFormatting: true,
    stripHeadings: false,
    preserveLists: true,
    addEllipsis: true,
    removeParentheticals: false,
    removePronunciations: true,
    sentenceCount: 0,
  } as RichTextParseOptions,
} as const;

export type ParsePreset = keyof typeof PARSE_PRESETS;
