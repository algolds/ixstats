/**
 * src/lib/wiki-os/wikitext/list-parser.ts — MediaWiki Bulleted & Numbered List Parser.
 */

import { parseInlineLinksAndFormatting } from "./link-parser";
import type { ListBlock } from "./types";

export function parseWikiList(lines: string[]): ListBlock {
  const firstLine = lines[0]?.trim() ?? "";
  const isOrdered = firstLine.startsWith("#");
  const items = lines.map((line) => {
    const trimmed = line.trim();
    // `[\s\S]` so an item whose template or reference spans several lines keeps its whole text; only blanks are
    // spacing after the marker (a non-breaking space there is text MediaWiki shows)
    const match = trimmed.match(/^([*#:\;]+)[ \t]*([\s\S]*)$/);
    const prefix = match ? match[1]! : (isOrdered ? "#" : "*");
    const content = match ? match[2]! : trimmed;
    const level = prefix.length;

    return {
      type: "list-item" as const,
      level,
      prefix,
      raw: line,
      children: parseInlineLinksAndFormatting(content),
    };
  });

  return {
    type: "list",
    ordered: isOrdered,
    children: items,
  };
}
