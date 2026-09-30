/**
 * src/lib/wiki-os/wikitext/quote-marks.ts — bold/italic as MediaWiki quote marks over a run.
 *
 * Two quotes toggle italic, three bold, five both, and the state runs across links, chips and
 * references until the end of the line. Writing the marks per text chunk would either lose a run
 * that spans a link (`'''[[Foo]] bar'''`) or write `''''''` between two bold chunks; here one mark
 * is written where the state changes and none at a line break.
 */

export interface MarkedSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  /** Text can be broken at its line breaks (the marks end there); an element cannot. */
  isText: boolean;
}

/** The quote marks that turn (bold0, italic0) into (bold1, italic1). */
function quoteTransition(bold0: boolean, italic0: boolean, bold1: boolean, italic1: boolean): string {
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

/** Joins the segments, writing one quote mark where the bold/italic state changes. */
export function joinMarkedSegments(segments: readonly MarkedSegment[]): string {
  let out = "";
  let bold = false;
  let italic = false;
  const moveTo = (nextBold: boolean, nextItalic: boolean): void => {
    out += quoteTransition(bold, italic, nextBold, nextItalic);
    bold = nextBold;
    italic = nextItalic;
  };

  for (const segment of segments) {
    if (!segment.isText) {
      moveTo(segment.bold, segment.italic);
      out += segment.text;
      continue;
    }
    segment.text.split("\n").forEach((line, index) => {
      if (index > 0) {
        moveTo(false, false);
        out += "\n";
      }
      if (line !== "") {
        moveTo(segment.bold, segment.italic);
        out += line;
      }
    });
  }
  moveTo(false, false);
  return out;
}

/** `text` wrapped in the quote marks for its own bold/italic state (a label written on its own). */
export function wrapQuotes(text: string, bold: boolean, italic: boolean): string {
  return joinMarkedSegments([{ text, bold, italic, isText: false }]);
}
