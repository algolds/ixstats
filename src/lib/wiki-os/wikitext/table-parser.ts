/**
 * src/lib/wiki-os/wikitext/table-parser.ts — MediaWiki Wikitable Parser.
 */

import { splitLogicalLines } from "./block-lines";
import { parseInlineLinksAndFormatting } from "./link-parser";
import type { WikiTableBlock, TableRowNode, TableCellNode } from "./types";

/**
 * Splits balanced table cell lines by `||` or `!!`, ignoring delimiters inside links, templates, or comments.
 */
export function splitBalancedDoubleTokens(text: string, delimiter: "||" | "!!"): string[] {
  const parts: string[] = [];
  let current = "";
  let inLink = 0;
  let inTmpl = 0;
  let inComment = false;
  let i = 0;

  while (i < text.length) {
    if (!inComment && text.startsWith("<!--", i)) {
      inComment = true;
      current += "<!--";
      i += 4;
      continue;
    }
    if (inComment) {
      if (text.startsWith("-->", i)) {
        inComment = false;
        current += "-->";
        i += 3;
        continue;
      }
      current += text[i];
      i++;
      continue;
    }
    if (text.startsWith("[[", i)) {
      inLink++;
      current += "[[";
      i += 2;
      continue;
    }
    if (text.startsWith("]]", i)) {
      inLink = Math.max(0, inLink - 1);
      current += "]]";
      i += 2;
      continue;
    }
    if (text.startsWith("{{", i)) {
      inTmpl++;
      current += "{{";
      i += 2;
      continue;
    }
    if (text.startsWith("}}", i)) {
      inTmpl = Math.max(0, inTmpl - 1);
      current += "}}";
      i += 2;
      continue;
    }

    if (text.startsWith(delimiter, i) && inLink === 0 && inTmpl === 0) {
      parts.push(current);
      current = "";
      i += 2;
      continue;
    }

    current += text[i];
    i++;
  }

  parts.push(current);
  return parts;
}

/**
 * Parses table cell content and attributes, respecting balanced brackets and templates
 * so attributes like `style="..." |` are isolated and not confused with piped links `[[File:...|120px]]`.
 */
export function extractTableCellContent(rawCell: string): { attributes: string; content: string } {
  let inLink = 0;
  let inTmpl = 0;
  let inComment = false;
  let sepIdx = -1;

  for (let i = 0; i < rawCell.length; i++) {
    if (!inComment && rawCell.startsWith("<!--", i)) {
      inComment = true;
      i += 3;
      continue;
    }
    if (inComment) {
      if (rawCell.startsWith("-->", i)) {
        inComment = false;
        i += 2;
      }
      continue;
    }
    if (rawCell.startsWith("[[", i)) {
      inLink++;
      i++;
      continue;
    }
    if (rawCell.startsWith("]]", i)) {
      inLink = Math.max(0, inLink - 1);
      i++;
      continue;
    }
    if (rawCell.startsWith("{{", i)) {
      inTmpl++;
      i++;
      continue;
    }
    if (rawCell.startsWith("}}", i)) {
      inTmpl = Math.max(0, inTmpl - 1);
      i++;
      continue;
    }

    if (rawCell[i] === "|" && inLink === 0 && inTmpl === 0) {
      const before = rawCell.slice(0, i).trim();
      const hasAttrPattern =
        /[a-zA-Z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s]+)/.test(before) ||
        /^(?:align|valign|bgcolor|width|height|colspan|rowspan|scope|class|style)\b/i.test(before);

      if (hasAttrPattern) {
        sepIdx = i;
        break;
      }
    }
  }

  if (sepIdx !== -1) {
    return {
      attributes: rawCell.slice(0, sepIdx).trim(),
      content: rawCell.slice(sepIdx + 1).trim(),
    };
  }

  return { attributes: "", content: rawCell.trim() };
}

export function parseWikitable(raw: string): WikiTableBlock {
  const lines = splitLogicalLines(raw);
  const rows: TableRowNode[] = [];
  let currentCells: TableCellNode[] = [];
  let currentRowAttributes: string | undefined;
  let caption: string | undefined;
  let tableAttributes: string | undefined;

  // Source ranges (plan 414): the `{|` line and its captions, then each row's lines, then the rest
  // (empty rows and the `|}` line). Together with the "\n" between them they are `raw` again.
  let headEnd = 0;
  let boundary = -1; // end of the last piece already cut from `raw`
  let lastCellEnd = -1; // end of the last line that belongs to the row being read

  const pushRow = (): void => {
    rows.push({
      type: "table-row",
      attributes: currentRowAttributes,
      raw: raw.slice(boundary + 1, lastCellEnd),
      children: currentCells,
    });
    boundary = lastCellEnd;
    currentCells = [];
  };

  for (const { text: rawLine, end } of lines) {
    const line = rawLine.trim();
    if (line.startsWith("{|")) {
      const attrs = line.slice(2).trim();
      if (attrs) tableAttributes = attrs;
      headEnd = boundary = end;
      continue;
    }
    if (line.startsWith("|}") || line === "|}") continue;

    // Caption: |+
    if (line.startsWith("|+")) {
      const { content } = extractTableCellContent(line.slice(2).trim());
      caption = content;
      if (rows.length === 0 && currentCells.length === 0) headEnd = boundary = end;
      continue;
    }

    // Row separator: |-
    if (line.startsWith("|-")) {
      if (currentCells.length > 0) pushRow();
      currentRowAttributes = line.slice(2).trim() || undefined;
      continue;
    }

    // Header cells: ! or !! (or || on header lines)
    if (line.startsWith("!")) {
      const headerParts = splitBalancedDoubleTokens(line.slice(1), "!!");
      for (const part of headerParts) {
        const subParts = splitBalancedDoubleTokens(part, "||");
        for (const sub of subParts) {
          const { attributes, content } = extractTableCellContent(sub);
          const inlines = parseInlineLinksAndFormatting(content);
          currentCells.push({
            type: "table-cell",
            isHeader: true,
            attributes: attributes || undefined,
            children: inlines,
          });
        }
      }
      lastCellEnd = end;
      continue;
    }

    // Standard cells: | or ||
    if (line.startsWith("|")) {
      const cellParts = splitBalancedDoubleTokens(line.slice(1), "||");
      for (const part of cellParts) {
        const { attributes, content } = extractTableCellContent(part);
        const inlines = parseInlineLinksAndFormatting(content);
        currentCells.push({
          type: "table-cell",
          isHeader: false,
          attributes: attributes || undefined,
          children: inlines,
        });
      }
      lastCellEnd = end;
      continue;
    }

    // Multiline continuation text inside the last active cell: every line, a blank one too, is
    // one line break plus its own text, so a blank line between paragraphs stays one blank line.
    if (currentCells.length > 0) {
      const lastCell = currentCells[currentCells.length - 1]!;
      if (line.length === 0) {
        lastCell.children.push({ type: "text", text: "\n" } as any);
      } else {
        const additionalInlines = parseInlineLinksAndFormatting(rawLine);
        lastCell.children.push({ type: "text", text: "\n" } as any, ...additionalInlines);
      }
      lastCellEnd = end;
    }
  }

  if (currentCells.length > 0) pushRow();

  return {
    type: "table",
    caption,
    attributes: tableAttributes,
    rawWikitext: raw,
    headRaw: raw.slice(0, headEnd),
    tailRaw: raw.slice(boundary + 1),
    children: rows,
  };
}
