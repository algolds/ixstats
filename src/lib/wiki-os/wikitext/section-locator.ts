// src/lib/wiki-os/wikitext/section-locator.ts
// Finds the wikitext heading for a section title as the reader shows it (section edit links), and
// locates and replaces numbered sections the way MediaWiki does (`action=edit&section=N`).

import { skipProtectedAt } from "./protected-regions";

const HEADING_LINE_REGEX = /^(={2,6})\s*(.+?)\s*\1\s*$/u;

/** Reduce heading markup to its visible text: [[Target|Label]] → Label, '''bold''' → bold. */
function visibleHeadingText(text: string): string {
  return text
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/gu, "$1")
    .replace(/'{2,}/gu, "")
    .replace(/<[^>]+>/gu, "")
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
    const heading = HEADING_LINE_REGEX.exec(line)?.[2];
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
 * One pass: it jumps from `<` to `<`, and the protected-region scanners it asks are linear.
 */
function maskProtected(wikitext: string): string {
  let open = wikitext.indexOf("<");
  if (open === -1) return wikitext;
  const parts: string[] = [];
  let copied = 0;
  while (open !== -1) {
    const end = skipProtectedAt(wikitext, open);
    if (end === null) {
      open = wikitext.indexOf("<", open + 1);
    } else {
      parts.push(wikitext.slice(copied, open), wikitext.slice(open, end).replace(/[^\n]/gu, " "));
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
 * "= Odd"). Linear: it counts the `=` at both ends and never backtracks.
 */
function headingOfLine(line: string): { level: number; text: string } | null {
  let end = line.length;
  while (end > 0 && isBlank(line[end - 1])) end--;
  let left = 0;
  while (left < end && line[left] === "=") left++;
  let right = 0;
  while (right < end - left && line[end - 1 - right] === "=") right++;
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
