/**
 * src/lib/wiki-os/wikitext/block-lines.ts — logical lines of a wikitext page.
 *
 * A physical line break does not end a line when it sits inside a template (`{{cite\n|a=b}}`), a
 * comment, `<ref>…</ref>` or another opaque tag: a block scan must not treat `|}}` inside a
 * multi-line template as a table end, nor a blank line inside a comment as a paragraph break.
 */

import { findMatchingClosingBraces } from "./link-parser";
import { skipProtectedAt } from "./protected-regions";

/**
 * Index of the line break that ends the logical line starting at `from` (`text.length` for the
 * last line). A `{{` that is never closed is plain text, like in MediaWiki. `lastClose` is
 * `text.lastIndexOf("}}")`; a caller that scans every line passes it once instead of searching per line.
 */
export function logicalLineEnd(
  text: string,
  from: number,
  lastClose = text.lastIndexOf("}}")
): number {
  let i = from;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code === 10) return i;
    if (code === 123 && text.charCodeAt(i + 1) === 123) {
      const close = i + 2 <= lastClose ? findMatchingClosingBraces(text, i) : -1;
      i = close === -1 ? i + 2 : close + 2;
      continue;
    }
    if (code === 60) {
      const end = skipProtectedAt(text, i, true);
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
