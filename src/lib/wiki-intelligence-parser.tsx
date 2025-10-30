/**
 * Wiki Intelligence Parser
 *
 * Parses and extracts intelligence from MediaWiki content for the Intelligence System.
 * Provides structured data extraction from wiki markup, infoboxes, and templates.
 */

import React from "react";

/**
 * Parsed wiki content structure
 */
export interface ParsedWikiContent {
  title: string;
  summary: string;
  infobox: Record<string, string>;
  sections: WikiSection[];
  categories: string[];
  images: string[];
  links: string[];
}

/**
 * Wiki section structure
 */
export interface WikiSection {
  id: string;
  title: string;
  level?: number;
  sourcePage?: string;
  sourceUrl?: string;
  content: string;
  subsections?: WikiSection[];
  classification: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
  importance: "critical" | "high" | "medium" | "low";
  images?: string[];
  links?: string[];
  categories?: string[];
  linkCount?: number;
  lastFetched?: number;
  wikitextLength?: number;
  apiCallCount?: number;
  wordCount: number;
  lastModified: string;
}

/**
 * Parse wiki markup content into structured data
 *
 * @param markup - Raw wiki markup text
 * @param title - Page title
 * @returns Parsed wiki content structure
 */
export function parseWikiMarkup(markup: string, title: string = ""): ParsedWikiContent {
  const sections: WikiSection[] = [];
  const infobox: Record<string, string> = {};
  const categories: string[] = [];
  const images: string[] = [];
  const links: string[] = [];

  // Extract infobox data
  const infoboxMatch = markup.match(/\{\{Infobox[\s\S]*?\}\}/i);
  if (infoboxMatch) {
    const infoboxText = infoboxMatch[0];
    const lines = infoboxText.split("\n");

    lines.forEach((line) => {
      const keyValue = line.match(/\|\s*(\w+)\s*=\s*(.+)/);
      if (keyValue) {
        infobox[keyValue[1].trim()] = keyValue[2].trim();
      }
    });
  }

  // Extract categories
  const categoryMatches = markup.matchAll(/\[\[Category:([^\]]+)\]\]/g);
  for (const match of categoryMatches) {
    categories.push(match[1]);
  }

  // Extract images
  const imageMatches = markup.matchAll(/\[\[File:([^\]|]+)/g);
  for (const match of imageMatches) {
    images.push(match[1]);
  }

  // Extract internal links
  const linkMatches = markup.matchAll(/\[\[([^\]|]+)/g);
  for (const match of linkMatches) {
    if (!match[1].startsWith("File:") && !match[1].startsWith("Category:")) {
      links.push(match[1]);
    }
  }

  // Extract summary (first paragraph before first heading)
  const summaryMatch = markup.match(/^([^=\n]+(?:\n[^=\n]+)*)/);
  const summary = summaryMatch ? summaryMatch[1].trim() : "";

  // Parse sections
  const sectionRegex = /^(={2,})\s*(.+?)\s*\1$/gm;
  let match;

  while ((match = sectionRegex.exec(markup)) !== null) {
    const level = match[1].length - 1;
    const sectionTitle = match[2].trim();
    const startIndex = match.index + match[0].length;
    const nextMatch = sectionRegex.exec(markup);
    const endIndex = nextMatch ? nextMatch.index : markup.length;

    sectionRegex.lastIndex = startIndex;

    const content = markup.substring(startIndex, endIndex).trim();
    const sectionId = sectionTitle.toLowerCase().replace(/\s+/g, "-");
    const sectionImageMatches = Array.from(content.matchAll(/\[\[File:([^\]|]+)/g)).map(
      (match) => match[1]
    );
    const sectionLinkMatches = Array.from(content.matchAll(/\[\[([^\]|]+)/g))
      .map((match) => match[1])
      .filter((link) => !link.startsWith("File:") && !link.startsWith("Category:"));

    sections.push({
      id: sectionId,
      title: sectionTitle,
      level,
      sourcePage: title || sectionTitle,
      sourceUrl: `https://ixwiki.com/wiki/${encodeURIComponent(sectionTitle)}`,
      content,
      subsections: [],
      classification: "PUBLIC",
      importance: "medium",
      images: sectionImageMatches,
      links: sectionLinkMatches,
      linkCount: sectionLinkMatches.length,
      wordCount: content ? content.split(/\s+/).filter(Boolean).length : 0,
      lastModified: new Date().toISOString(),
    });
  }

  return {
    title,
    summary,
    infobox,
    sections,
    categories,
    images,
    links,
  };
}

/**
 * Extract intelligence-relevant data from parsed wiki content
 *
 * @param content - Parsed wiki content
 * @returns Intelligence data object
 */
export function extractIntelligenceData(content: ParsedWikiContent): Record<string, any> {
  const intelligence: Record<string, any> = {
    title: content.title,
    summary: content.summary,
    categories: content.categories,
    metadata: {},
    keyData: {},
  };

  // Extract key data from infobox
  if (content.infobox) {
    intelligence.metadata = { ...content.infobox };

    // Extract specific intelligence fields
    const keyFields = [
      "population",
      "gdp",
      "government",
      "leader",
      "capital",
      "area",
      "currency",
      "established",
      "type",
    ];

    keyFields.forEach((field) => {
      const value = Object.entries(content.infobox).find(([key]) =>
        key.toLowerCase().includes(field.toLowerCase())
      );
      if (value) {
        intelligence.keyData[field] = value[1];
      }
    });
  }

  // Extract section summaries
  intelligence.sections = content.sections.map((section) => ({
    title: section.title,
    preview: section.content.substring(0, 200) + (section.content.length > 200 ? "..." : ""),
  }));

  return intelligence;
}

/**
 * Parse wiki template syntax
 *
 * @param template - Template string (e.g., "{{Template|param1=value1}}")
 * @returns Template name and parameters
 */
export function parseTemplate(template: string): { name: string; params: Record<string, string> } {
  const match = template.match(/\{\{([^|]+)(?:\|(.+))?\}\}/s);

  if (!match) {
    return { name: "", params: {} };
  }

  const name = match[1].trim();
  const params: Record<string, string> = {};

  if (match[2]) {
    const paramString = match[2];
    const paramMatches = paramString.matchAll(/([^|=]+)=([^|]+)/g);

    for (const paramMatch of paramMatches) {
      params[paramMatch[1].trim()] = paramMatch[2].trim();
    }
  }

  return { name, params };
}

/**
 * Strip wiki markup from text, leaving plain text
 *
 * @param markup - Wiki markup text
 * @returns Plain text without markup
 */
export function stripWikiMarkup(markup: string): string {
  let text = markup;

  // Remove templates
  text = text.replace(/\{\{[^}]+\}\}/g, "");

  // Remove file/image links
  text = text.replace(/\[\[File:[^\]]+\]\]/g, "");

  // Convert internal links to plain text
  text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, link, display) => display || link);

  // Remove external link brackets
  text = text.replace(
    /\[(https?:\/\/[^\s\]]+)(?:\s+([^\]]+))?\]/g,
    (_, url, display) => display || url
  );

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Remove categories
  text = text.replace(/\[\[Category:[^\]]+\]\]/g, "");

  // Clean up multiple newlines
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Truncate content to a reasonable length
 *
 * @param content - Content to truncate
 * @param maxLength - Maximum length in characters
 * @returns Object with truncated content and isTruncated flag
 */
export function truncateContent(
  content: string,
  maxLength: number = 500
): { truncated: string; isTruncated: boolean } {
  if (content.length <= maxLength) {
    return { truncated: content, isTruncated: false };
  }

  // Try to truncate at a sentence boundary
  const truncated = content.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf(".");
  const lastNewline = truncated.lastIndexOf("\n");
  const breakPoint = Math.max(lastPeriod, lastNewline);

  if (breakPoint > maxLength * 0.7) {
    return { truncated: truncated.substring(0, breakPoint + 1), isTruncated: true };
  }

  return { truncated: truncated + "...", isTruncated: true };
}

/**
 * Parse wiki content for display with link handling
 *
 * @param content - Wiki content to parse
 * @param handleLinkClick - Callback for link clicks
 * @returns JSX elements for rendering
 */
export function parseWikiContent(
  content: string,
  handleLinkClick: (page: string) => void
): React.ReactNode {
  // Simple text parsing - convert wiki links to clickable elements
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const linkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    const page = match[1]!;
    const display = match[2] || page;

    // Add the link as a clickable span
    parts.push(
      <span
        key={match.index}
        className="cursor-pointer text-blue-400 underline hover:text-blue-300"
        onClick={() => handleLinkClick(page)}
      >
        {display}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}

/**
 * Parse infobox value for display
 *
 * @param value - Infobox value to parse (may contain wiki markup)
 * @returns Cleaned display value
 */
export function parseInfoboxValue(value: string | undefined): string {
  if (!value) return "";
  return stripWikiMarkup(value);
}
