/**
 * Wiki Intelligence Parser
 *
 * Parses and extracts intelligence from MediaWiki content for the Intelligence System.
 * Provides structured data extraction from wiki markup, infoboxes, and templates.
 */

import React from "react";

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
