/**
 * src/lib/wiki-os/wikitext/quote-marks.ts — bold/italic as MediaWiki quote marks over a run.
 *
 * Two quotes toggle italic, three bold, five both, and the state runs across links, chips and
 * references until the end of the line. Writing the marks per text chunk would either lose a run
 * that spans a link (`'''[[Foo]] bar'''`) or write `''''''` between two bold chunks; here one mark
 * is written where the state changes and none at a line break.
 */

import { ProtectedScanner, skipProtectedAt } from "./protected-regions";

export interface MarkedSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  /** Text can be broken at its line breaks (the marks end there); an element cannot. */
  isText: boolean;
}

/** The quote marks that turn (bold0, italic0) into (bold1, italic1). */
function quoteTransition(
  bold0: boolean,
  italic0: boolean,
  bold1: boolean,
  italic1: boolean
): string {
  const closeBold = bold0 && !bold1;
  const closeItalic = italic0 && !italic1;
  const openBold = !bold0 && bold1;
  const openItalic = !italic0 && italic1;
  let out = "";
  if (closeBold && closeItalic) out += "'''''";
  else out += (closeItalic ? "''" : "") + (closeBold ? "'''" : "");
  if (openBold && openItalic) out += "'''''";
  else out += (openItalic ? "''" : "") + (openBold ? "'''" : "");
  return out;
}

/**
 * The line breaks of `text` that end a line for MediaWiki's quote marks: not those inside a comment or a literal tag
 * (`<nowiki>`, `<pre>`, …), which MediaWiki removes or hides before it reads the marks.
 */
function lineBreaks(text: string): number[] {
  const breaks: number[] = [];
  if (!text.includes("\n")) return breaks;
  const scanner = new ProtectedScanner(text);
  const special = /[<\n]/g;
  let match: RegExpExecArray | null;
  while ((match = special.exec(text)) !== null) {
    if (match[0] === "\n") {
      breaks.push(match.index);
      continue;
    }
    const end = skipProtectedAt(text, match.index, false, scanner);
    if (end !== null) special.lastIndex = Math.max(end, match.index + 1);
  }
  return breaks;
}

/**
 * Joins the segments, writing one quote mark where the bold/italic state changes and closing every mark at the end of
 * its line (a line break inside a comment or a literal tag does not end the line).
 */
export function joinMarkedSegments(segments: readonly MarkedSegment[]): string {
  // Pieces joined at the end: a text of a million lines is millions of appends, which a rope of strings flattens slowly.
  const pieces: string[] = [];
  let bold = false;
  let italic = false;
  const moveTo = (nextBold: boolean, nextItalic: boolean): void => {
    if (nextBold === bold && nextItalic === italic) return;
    pieces.push(quoteTransition(bold, italic, nextBold, nextItalic));
    bold = nextBold;
    italic = nextItalic;
  };

  for (const segment of segments) {
    if (!segment.isText) {
      moveTo(segment.bold, segment.italic);
      pieces.push(segment.text);
      continue;
    }
    let from = 0;
    for (const end of [...lineBreaks(segment.text), segment.text.length]) {
      if (from > 0) {
        moveTo(false, false);
        pieces.push("\n");
      }
      if (end > from) {
        moveTo(segment.bold, segment.italic);
        pieces.push(segment.text.slice(from, end));
      }
      from = end + 1;
    }
  }
  moveTo(false, false);
  return pieces.join("");
}

/** `text` wrapped in the quote marks for its own bold/italic state (a label written on its own). */
export function wrapQuotes(text: string, bold: boolean, italic: boolean): string {
  return joinMarkedSegments([{ text, bold, italic, isText: false }]);
}
