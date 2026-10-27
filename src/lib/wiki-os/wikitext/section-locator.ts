// src/lib/wiki-os/wikitext/section-locator.ts
// Finds the wikitext heading for a section title as the reader shows it (section edit links), and
// locates and replaces numbered sections the way MediaWiki does (`action=edit&section=N`).

import { forwardFinder } from "./forward-finder";
import { matchHeading } from "./line-patterns";
import { ProtectedScanner, skipProtectedAt } from "./protected-regions";

/**
 * `text` with each `[[Target|Label]]` as its label and each `[[Target]]` as its target (what
 * `/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/gu` replaced by `$1`): from a `[[` to the first `]` after it, when another `]`
 * follows at once. A search for that `]` that found none answers every later opener, so a text of `[[` is one scan.
 */
function unpackLinks(text: string): string {
  const nextClose = forwardFinder(text, "]");
  const nextPipe = forwardFinder(text, "|");
  const pieces: string[] = [];
  let copied = 0;
  for (let open = text.indexOf("[["); open !== -1;) {
    const close = nextClose(open + 2);
    if (close === -1) break;
    if (text.charCodeAt(close + 1) !== 93) {
      open = text.indexOf("[[", open + 1);
      continue;
    }
    const pipe = nextPipe(open + 2);
    pieces.push(
      text.slice(copied, open),
      text.slice(pipe !== -1 && pipe < close ? pipe + 1 : open + 2, close)
    );
    copied = close + 2;
    open = text.indexOf("[[", copied);
  }
  pieces.push(text.slice(copied));
  return pieces.join("");
}

/** `text` without its tags (what `/<[^>]+>/gu` removed): `<` to the first `>` after it, with a character between. */
function stripTags(text: string): string {
  const nextGreater = forwardFinder(text, ">");
  const pieces: string[] = [];
  let copied = 0;
  for (let open = text.indexOf("<"); open !== -1;) {
    const close = nextGreater(open + 1);
    if (close === -1) break;
    if (close === open + 1) {
      open = text.indexOf("<", open + 1); // `<>` holds no character
      continue;
    }
    pieces.push(text.slice(copied, open));
    copied = close + 1;
    open = text.indexOf("<", copied);
  }
  pieces.push(text.slice(copied));
  return pieces.join("");
}

/** Reduce heading markup to its visible text: [[Target|Label]] → Label, '''bold''' → bold. */
function visibleHeadingText(text: string): string {
  return stripTags(unpackLinks(text).replace(/'{2,}/gu, ""))
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

/**
 * 1-based line number of the first heading whose visible text matches `section`, or null.
 */
export function findSectionLine(wikitext: string, section: string): number | null {
  const target = visibleHeadingText(section);
  if (!target) return null;
  const index = wikitext.split("\n").findIndex((line) => {
    const heading = matchHeading(line, 2, true)?.title;
    return heading !== undefined && visibleHeadingText(heading) === target;
  });
  return index >= 0 ? index + 1 : null;
}

// ---------------------------------------------------------------------------
// Numbered sections (`action=edit&section=N`)
// ---------------------------------------------------------------------------

/**
 * `wikitext` with every comment and opaque element (`<nowiki>`, `<pre>`, ...) blanked out to spaces,
 * keeping every newline, so a heading-looking line inside one is not found and offsets still match.
 * The blanking is per UTF-16 unit (no `u` flag): a character outside the BMP becomes two spaces, as
 * it is two units long, or every offset after it would shift.
 * One pass: it jumps from `<` to `<`, and the scanner (made for this text alone) keeps what it
 * learns about the tags, so a text of `<nowiki ` that never closes is linear too.
 */
function maskProtected(wikitext: string): string {
  let open = wikitext.indexOf("<");
  if (open === -1) return wikitext;
  const scanner = new ProtectedScanner(wikitext);
  const parts: string[] = [];
  let copied = 0;
  while (open !== -1) {
    const end = skipProtectedAt(wikitext, open, false, scanner);
    if (end === null) {
      open = wikitext.indexOf("<", open + 1);
    } else {
      parts.push(wikitext.slice(copied, open), wikitext.slice(open, end).replace(/[^\n]/g, " "));
      copied = end;
      open = wikitext.indexOf("<", end);
    }
  }
  parts.push(wikitext.slice(copied));
  return parts.join("");
}

const isBlank = (char: string | undefined) => char === " " || char === "\t" || char === "\r";

/**
 * The level and text of a heading line ("= Title =" is a level-1 section as in MediaWiki), or null.
 * One to six `=` count on both sides and the smaller side wins ("=== Odd ==" is level 2 titled
 * "= Odd"); a line of only `=` (three or more) is level (n-1)/2 titled with the rest. Linear: it counts the `=` at both ends and never backtracks.
 */
function headingOfLine(line: string): { level: number; text: string } | null {
  let end = line.length;
  while (end > 0 && isBlank(line[end - 1])) end--;
  let left = 0;
  while (left < end && line[left] === "=") left++;
  let right = 0;
  while (right < end - left && line[end - 1 - right] === "=") right++;
  // A line of `=` alone: MediaWiki reads `===` as a level-1 heading titled `=`, `=====` as level 2 titled `=`.
  if (left === end) {
    if (left < 3) return null;
    const bars = Math.min(Math.floor((left - 1) / 2), 6);
    return { level: bars, text: "=".repeat(left - 2 * bars) };
  }
  const level = Math.min(left, right, 6);
  if (level === 0) return null;
  const text = line.slice(level, end - level).trim();
  return text ? { level, text } : null;
}

export interface SectionRange {
  /** Offset of the section's first character (its heading line; 0 for the lead). */
  start: number;
  /** Offset just after the section, subsections included. */
  end: number;
}

export interface SectionHeading {
  /** Offset of the heading line. */
  start: number;
  /** One to six: the number of `=` signs. */
  level: number;
  /** The heading's text between the `=` signs, trimmed (markup left as written). */
  text: string;
}

/** Every heading of a page in order: where it starts, its level and its text. */
export function sectionHeadings(wikitext: string): SectionHeading[] {
  const headings: SectionHeading[] = [];
  let offset = 0;
  for (const line of maskProtected(wikitext).split("\n")) {
    const heading = headingOfLine(line);
    if (heading) headings.push({ start: offset, ...heading });
    offset += line.length + 1;
  }
  return headings;
}

/**
 * The text range of section `index`: 0 is the lead (everything before the first heading), 1 the
 * first heading's section, and so on. A section runs to the next heading of the same or a higher
 * rank, so it includes its subsections. Null when the page has no such section.
 */
export function locateSection(wikitext: string, index: number): SectionRange | null {
  const headings = sectionHeadings(wikitext);
  if (index === 0) return { start: 0, end: headings[0]?.start ?? wikitext.length };
  const heading = headings[index - 1];
  if (!heading) return null;
  const next = headings.slice(index).find((candidate) => candidate.level <= heading.level);
  return { start: heading.start, end: next?.start ?? wikitext.length };
}

/** The wikitext of section `index` (see `locateSection`), or null. */
export function sectionText(wikitext: string, index: number): string | null {
  const range = locateSection(wikitext, index);
  return range ? wikitext.slice(range.start, range.end) : null;
}

/**
 * `wikitext` with section `index` replaced by `newText` the way MediaWiki does: what follows the
 * section is kept after a blank line, and the end of the page is trimmed. An empty `newText` removes
 * the section. Null when the page has no such section.
 */
export function replaceSection(wikitext: string, index: number, newText: string): string | null {
  const range = locateSection(wikitext, index);
  if (!range) return null;
  const before = wikitext.slice(0, range.start);
  const after = wikitext.slice(range.end);
  return `${before}${newText === "" ? "" : `${newText}\n\n`}${after}`.trimEnd();
}
