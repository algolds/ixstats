/**
 * src/lib/wiki-os/wikitext/list-parser.ts — MediaWiki Bulleted & Numbered List Parser.
 */

import { parseInlineLinksAndFormatting } from "./link-parser";
import type { ListBlock } from "./types";

export function parseWikiList(lines: string[]): ListBlock {
  const isOrdered = lines[0]?.trim().startsWith("#") ?? false;
  const items = lines.map((line) => {
    const trimmed = line.trim();
    const content = trimmed.replace(/^[\*#\:\;]+\s*/, "");
    return {
      type: "list-item" as const,
      children: parseInlineLinksAndFormatting(content),
    };
  });

  return {
    type: "list",
    ordered: isOrdered,
    children: items,
  };
}
