/**
 * src/lib/wiki-os/wikitext/table-parser.ts — MediaWiki Wikitable Parser.
 */

import { parseInlineLinksAndFormatting } from "./link-parser";
import type { WikiTableBlock, TableRowNode, TableCellNode } from "./types";

export function parseWikitable(raw: string): WikiTableBlock {
  const lines = raw.split("\n");
  const rows: TableRowNode[] = [];
  let currentCells: TableCellNode[] = [];
  let caption: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.startsWith("{|") || line === "|}") continue;

    // Caption
    if (line.startsWith("|+")) {
      caption = line.slice(2).trim();
      continue;
    }

    // Row separator
    if (line.startsWith("|-")) {
      if (currentCells.length > 0) {
        rows.push({ type: "table-row", children: currentCells });
        currentCells = [];
      }
      continue;
    }

    // Header cells: ! or !!
    if (line.startsWith("!")) {
      const headerParts = line.slice(1).split("!!");
      for (const part of headerParts) {
        const inlines = parseInlineLinksAndFormatting(part.trim());
        currentCells.push({
          type: "table-cell",
          isHeader: true,
          children: inlines,
        });
      }
      continue;
    }

    // Standard cells: | or ||
    if (line.startsWith("|")) {
      const cellParts = line.slice(1).split("||");
      for (const part of cellParts) {
        const inlines = parseInlineLinksAndFormatting(part.trim());
        currentCells.push({
          type: "table-cell",
          isHeader: false,
          children: inlines,
        });
      }
      continue;
    }
  }

  if (currentCells.length > 0) {
    rows.push({ type: "table-row", children: currentCells });
  }

  return {
    type: "table",
    caption,
    rawWikitext: raw,
    children: rows,
  };
}
