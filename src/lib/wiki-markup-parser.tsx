/**
 * Wiki Markup Parser Utility
 *
 * Provides functions for parsing and sanitizing MediaWiki markup
 * for safe rendering in the intelligence briefing system.
 */

import React from "react";
import { sanitizeWikiContent } from "~/lib/sanitize-html";

/**
 * Parses wiki content with support for links, bold, italics, and safe HTML rendering
 *
 * @param content - Raw wiki markup content
 * @param linkHandler - Callback function to handle wiki link clicks
 * @returns React element with parsed and sanitized content
 */
export const parseWikiContent = (
  content: string,
  linkHandler: (link: string) => void
): React.ReactElement | null => {
  if (!content) return null;

  // Replace wiki links [[Link|Display]] or [[Link]]
  let parsed = content.replace(/\[\[([^|\]]+)(\|([^\]]+))?\]\]/g, (match, link, pipe, display) => {
    const displayText = display || link;
    return `<span class="text-blue-400 hover:text-blue-300 cursor-pointer underline" data-link="${link}">${displayText}</span>`;
  });

  // Replace external links [http://example.com Display]
  parsed = parsed.replace(/\[([^\s]+)\s+([^\]]+)\]/g, (match, url, display) => {
    return `<a href="${url}" target="_blank" class="text-blue-400 hover:text-blue-300 underline">${display}</a>`;
  });

  // Parse wiki markup for bold and italics
  parsed = parsed.replace(/'''([^']+)'''/g, '<strong class="font-bold">$1</strong>'); // Bold
  parsed = parsed.replace(/''([^']+)''/g, '<em class="italic">$1</em>'); // Italics

  // Add basic line breaks
  parsed = parsed.replace(/\n\n/g, "<br/><br/>");
  parsed = parsed.replace(/\n/g, " ");

  // SECURITY: Sanitize parsed wiki markup to prevent XSS
  const sanitized = sanitizeWikiContent(parsed);

  return (
    <div
      dangerouslySetInnerHTML={{ __html: sanitized }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const link = target.getAttribute("data-link");
        if (link) {
          e.preventDefault();
          linkHandler(link);
        }
      }}
    />
  );
};

/**
 * Handles wiki link clicks - opens internal wiki links or external URLs
 *
 * @param link - The link to open (wiki page name or external URL)
 */
export const handleWikiLinkClick = (link: string): void => {
  if (link.startsWith("http")) {
    window.open(link, "_blank");
  } else {
    window.open(`https://ixwiki.com/wiki/${encodeURIComponent(link)}`, "_blank");
  }
};
