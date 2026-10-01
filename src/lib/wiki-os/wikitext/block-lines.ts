/**
 * src/lib/wiki-os/wikitext/block-lines.ts — logical lines of a wikitext page.
 *
 * A physical line break does not end a line when it sits inside a template (`{{cite\n|a=b}}`), a
 * comment, `<ref>…</ref>` or another opaque tag: a block scan must not treat `|}}` inside a
 * multi-line template as a table end, nor a blank line inside a comment as a paragraph break.
 */

import { findMatchingClosingBraces } from "./link-parser";
import { matchBraces, type MatchIndex } from "./match-index";
import { ProtectedScanner, skipProtectedAt } from "./protected-regions";

/**
 * Index of the line break that ends the logical line starting at `from` (`text.length` for the
 * last line). A `{{` that is never closed is plain text, like in MediaWiki. `braces` is
 * `matchBraces(text)`, and `scanner` a `ProtectedScanner` of `text`; a caller that scans every line passes
 * both once so the scan stays linear.
 */
export function logicalLineEnd(
  text: string,
  from: number,
  braces: MatchIndex = matchBraces(text),
  scanner?: ProtectedScanner
): number {
  let i = from;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code === 10) return i;
    if (code === 123 && text.charCodeAt(i + 1) === 123) {
      const close = findMatchingClosingBraces(text, i, braces);
      i = close === -1 ? i + 2 : close + 2;
      continue;
    }
    if (code === 60) {
      const end = skipProtectedAt(text, i, true, scanner);
      if (end !== null) {
        i = end;
        continue;
      }
    }
    i++;
  }
  return text.length;
}

/** Whether `line` (one logical line) is nothing but one template, `{{…}}`, with nothing after it. */
export function isTemplateOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{{")) return false;
  const close = findMatchingClosingBraces(trimmed, 0);
  return close !== -1 && trimmed.slice(close + 2).trim() === "";
}

export interface LogicalLine {
  text: string;
  /** Offset of the first character. */
  start: number;
  /** Offset just after the last character (the line break is not part of the line). */
  end: number;
}

/** `text` as logical lines with their offsets: `lines.map((l) => l.text).join("\n")` is `text`. */
export function splitLogicalLines(text: string): LogicalLine[] {
  const braces = matchBraces(text);
  const scanner = new ProtectedScanner(text);
  const lines: LogicalLine[] = [];
  let start = 0;
  while (start <= text.length) {
    const end = logicalLineEnd(text, start, braces, scanner);
    lines.push({ text: text.slice(start, end), start, end });
    start = end + 1;
  }
  return lines;
}
