/**
 * src/lib/wiki-os/wikitext/table-parser.ts — MediaWiki Wikitable Parser.
 */

import { isBlank } from "./blank";
import { splitLogicalLines } from "./block-lines";
import { parseInlineLinksAndFormatting } from "./link-parser";
import type { WikiTableBlock, TableRowNode, TableCellNode } from "./types";

/**
 * Splits balanced table cell lines by `||` or `!!`, ignoring delimiters inside links, templates, or comments.
 */
export function splitBalancedDoubleTokens(text: string, delimiter: "||" | "!!"): string[] {
  const parts: string[] = [];
  const delimiterCode = delimiter.charCodeAt(0);
  let inLink = 0;
  let inTmpl = 0;
  let start = 0;
  let i = 0;

  while (i < text.length) {
    const code = text.charCodeAt(i);
    const next = text.charCodeAt(i + 1);
    if (code === 60 && text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end === -1) break;
      i = end + 3;
    } else if (code === 91 && next === 91) {
      inLink++;
      i += 2;
    } else if (code === 93 && next === 93) {
      inLink = Math.max(0, inLink - 1);
      i += 2;
    } else if (code === 123 && next === 123) {
      inTmpl++;
      i += 2;
    } else if (code === 125 && next === 125) {
      inTmpl = Math.max(0, inTmpl - 1);
      i += 2;
    } else if (code === delimiterCode && next === delimiterCode && inLink === 0 && inTmpl === 0) {
      parts.push(text.slice(start, i));
      i += 2;
      start = i;
    } else {
      i++;
    }
  }

  parts.push(text.slice(start));
  return parts;
}

/** `[a-zA-Z0-9_-]`. */
const isNameCode = (code: number): boolean =>
  (code >= 97 && code <= 122) ||
  (code >= 65 && code <= 90) ||
  (code >= 48 && code <= 57) ||
  code === 95 ||
  code === 45;

/** The cell starts with an attribute keyword as a whole word (`style |`, `class="x" |`). */
const STARTS_WITH_ATTRIBUTE =
  /^\s*(?:align|valign|bgcolor|width|height|colspan|rowspan|scope|class|style)\b/i;

/**
 * The first length of text before a `|` that holds `name = value`: a name character, any blanks, `=`, any
 * blanks and a character that is not blank (what `/[a-zA-Z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s]+)/` finds in
 * it; a quoted value is a `[^\s]+` already). Text longer than this holds one, so one scan answers every `|`.
 * Infinity when the cell holds none.
 */
function nameValueEnd(cell: string): number {
  let afterName = false; // the last character that is not blank is a name character
  let afterEquals = false; // ... is the `=` that follows one
  for (let i = 0; i < cell.length; i++) {
    const code = cell.charCodeAt(i);
    if (isBlank(code)) continue;
    if (afterEquals) return i + 1;
    afterEquals = code === 61 && afterName;
    afterName = isNameCode(code);
  }
  return Infinity;
}

/**
 * Parses table cell content and attributes, respecting balanced brackets and templates
 * so attributes like `style="..." |` are isolated and not confused with piped links `[[File:...|120px]]`.
 */
function cellSeparatorIndex(rawCell: string): number {
  let inLink = 0;
  let inTmpl = 0;
  let inComment = false;
  let sepIdx = -1;
  // Whether the text before a `|` reads as attributes depends on nothing but how long it is (see
  // nameValueEnd, and a keyword that starts the cell), so it is worked out once, not for every `|`.
  const settledAt = STARTS_WITH_ATTRIBUTE.test(rawCell) ? 0 : nameValueEnd(rawCell);

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

    if (rawCell[i] === "|" && inLink === 0 && inTmpl === 0 && i >= settledAt) {
      sepIdx = i;
      break;
    }
  }

  return sepIdx;
}

export function extractTableCellContent(rawCell: string): { attributes: string; content: string } {
  const sepIdx = cellSeparatorIndex(rawCell);
  if (sepIdx !== -1) {
    return {
      attributes: rawCell.slice(0, sepIdx).trim(),
      content: rawCell.slice(sepIdx + 1).trim(),
    };
  }
  return { attributes: "", content: rawCell.trim() };
}

/** Where the content of a cell's first line starts: after its attributes' `|` and the blanks that follow. */
function contentStart(rawCell: string): number {
  const from = cellSeparatorIndex(rawCell) + 1;
  return from + (rawCell.length - from - rawCell.slice(from).trimStart().length);
}

/** One cell as found on its line: the text after its delimiter, and where it starts and ends in the table's text. */
interface CellSpan {
  text: string;
  /** Where `text` starts. */
  textAt: number;
  start: number;
  end: number;
}

/**
 * The cells of a `|` or `!` line. `line` is the trimmed line, starting at `lineStart` in the table's text, whose
 * logical line ends at `lineEnd`. A cell starts at its delimiter (the line's `|`/`!`, or the `||`/`!!` before it) and
 * ends where the next one starts, the last at the end of the line.
 */
function cellSpans(line: string, lineStart: number, lineEnd: number, header: boolean): CellSpan[] {
  const spans: CellSpan[] = [];
  let outerAt = lineStart + 1;
  for (const part of header ? splitBalancedDoubleTokens(line.slice(1), "!!") : [line.slice(1)]) {
    let at = outerAt;
    for (const text of splitBalancedDoubleTokens(part, "||")) {
      spans.push({
        text,
        textAt: at,
        start: spans.length === 0 ? lineStart : at - 2,
        end: lineEnd,
      });
      at += text.length + 2;
    }
    outerAt += part.length + 2;
  }
  for (let i = 0; i + 1 < spans.length; i++) spans[i]!.end = spans[i + 1]!.start;
  return spans;
}

function cellNode(
  span: CellSpan,
  isHeader: boolean
): { node: TableCellNode; start: number; end: number; textStart: number; continued: boolean } {
  const { attributes, content } = extractTableCellContent(span.text);
  return {
    node: {
      type: "table-cell",
      isHeader,
      attributes: attributes || undefined,
      children: parseInlineLinksAndFormatting(content),
    },
    start: span.start,
    end: span.end,
    // where the content starts in the table's text: after the delimiter, the attributes and the blanks
    textStart: span.textAt + contentStart(span.text),
    /** Continuation lines have been added to it. */
    continued: false,
  };
}

type OpenCell = ReturnType<typeof cellNode>;

/** The row's cells with their sources; `rowStart` is where the row starts in the table's text `raw`. */
function withCellSources(raw: string, rowStart: number, cells: OpenCell[]): TableCellNode[] {
  return cells.map((cell, index) => {
    const cellRaw = raw.slice(cell.start, cell.end);
    const headLength = cell.textStart - cell.start;
    const contentEnd = Math.max(headLength, cellRaw.trimEnd().length);
    cell.node.source = {
      raw: cellRaw,
      start: cell.start - rowStart,
      sepBefore: index === 0 ? "" : raw.slice(cells[index - 1]!.end, cell.start),
      head: cellRaw.slice(0, headLength),
      tail: cellRaw.slice(contentEnd),
    };
    return cell.node;
  });
}

export function parseWikitable(raw: string): WikiTableBlock {
  const lines = splitLogicalLines(raw);
  const rows: TableRowNode[] = [];
  let currentCells: OpenCell[] = [];
  let currentRowAttributes: string | undefined;
  let caption: string | undefined;
  let tableAttributes: string | undefined;

  // Source ranges (plan 414): the `{|` line and its captions, then each row's lines, then the rest
  // (empty rows and the `|}` line). Together with the "\n" between them they are `raw` again.
  let headEnd = 0;
  let boundary = -1; // end of the last piece already cut from `raw`
  let lastCellEnd = -1; // end of the last line that belongs to the row being read

  const pushRow = (): void => {
    const rowStart = boundary + 1;
    rows.push({
      type: "table-row",
      attributes: currentRowAttributes,
      raw: raw.slice(rowStart, lastCellEnd),
      headRaw: raw.slice(rowStart, currentCells[0]!.start),
      children: withCellSources(raw, rowStart, currentCells),
    });
    boundary = lastCellEnd;
    currentCells = [];
  };

  for (const { text: rawLine, start, end } of lines) {
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

    // Cells: `!` lines (split at !! and ||) are header cells, `|` lines (split at ||) data cells
    if (line.startsWith("!") || line.startsWith("|")) {
      const header = line.startsWith("!");
      const lineStart = start + (rawLine.length - rawLine.trimStart().length);
      for (const span of cellSpans(line, lineStart, end, header))
        currentCells.push(cellNode(span, header));
      lastCellEnd = end;
      continue;
    }

    // Multiline continuation text inside the last active cell: every line, a blank one too, is
    // one line break plus its own text, so a blank line between paragraphs stays one blank line.
    // The blanks that ended the cell's first line, and those of a blank line, are kept with the line break: an edit
    // that writes the cell again writes them as they were.
    if (currentCells.length > 0) {
      const open = currentCells[currentCells.length - 1]!;
      const firstLine = open.continued ? "" : raw.slice(open.start, open.end);
      const lineBreak = `${firstLine.slice(firstLine.trimEnd().length)}\n`;
      open.continued = true;
      open.end = end;
      const lastCell = open.node;
      if (line.length === 0) {
        lastCell.children.push({ type: "text", text: lineBreak + rawLine } as any);
      } else {
        const additionalInlines = parseInlineLinksAndFormatting(rawLine);
        lastCell.children.push({ type: "text", text: lineBreak } as any, ...additionalInlines);
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
