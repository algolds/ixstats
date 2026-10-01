/**
 * src/lib/wiki-os/wikitext/line-patterns.ts — the line shapes the block parser recognizes, scanned once.
 *
 * Each is what a regular expression answered (written in its comment) before a line of two million
 * blanks, underscores or equals signs made that expression read the line quadratically many times over.
 */

import { isBlank } from "./blank";

/** `.` of a regular expression without the `s` flag does not match these. */
const isLineTerminator = (code: number): boolean =>
  code === 10 || code === 13 || code === 8232 || code === 8233;

export interface HeadingMatch {
  /** The number of `=` signs on each side (1 to 6). */
  level: number;
  /** What is between them without the blanks around it. */
  title: string;
}

/** The title of what lies between the `=` runs `[from, to)` of `line`: blanks, a title with no line break in it, blanks. */
function headingTitle(line: string, from: number, to: number): string | null {
  let first = from;
  while (first < to && isBlank(line.charCodeAt(first))) first++;
  if (first === to) {
    // Nothing but blanks: the title is the last of them that is not a line break.
    for (let at = to - 1; at >= from; at--) {
      if (!isLineTerminator(line.charCodeAt(at))) return line.charAt(at);
    }
    return null;
  }
  let last = to - 1;
  while (isBlank(line.charCodeAt(last))) last--;
  for (let at = first; at <= last; at++) {
    if (isLineTerminator(line.charCodeAt(at))) return null;
  }
  return line.slice(first, last + 1);
}

/**
 * `== Title ==` (what `/^(={1,6})\s*(.+?)\s*\1$/` captures: the level and the title). The longest run of
 * up to six `=` that also ends the line is the level; a run that is longer than that on one side leaves
 * its extra `=` in the title.
 */
export function matchHeading(line: string): HeadingMatch | null {
  let run = 0;
  while (run < 6 && line.charCodeAt(run) === 61) run++;
  for (let level = run; level >= 1; level--) {
    if (line.length <= 2 * level) continue;
    let closes = true;
    for (let at = line.length - level; at < line.length && closes; at++)
      closes = line.charCodeAt(at) === 61;
    if (!closes) continue;
    const title = headingTitle(line, level, line.length - level);
    if (title !== null) return { level, title };
  }
  return null;
}

/**
 * A line of nothing but magic words, `__NOTOC__ __TOC__` (what `/^(?:__[A-Za-z0-9_]+__[ \t]*)+$/` matches): groups
 * of letters, digits and underscores that start and end with `__`, apart or side by side, with spaces and tabs
 * allowed after each.
 */
export function isMagicWordLine(line: string): boolean {
  if (line.length === 0 || line.charCodeAt(0) === 32 || line.charCodeAt(0) === 9) return false;
  let start = 0;
  while (start < line.length) {
    let end = start;
    while (end < line.length && line.charCodeAt(end) !== 32 && line.charCodeAt(end) !== 9) end++;
    if (end - start < 5 || !line.startsWith("__", start) || !line.startsWith("__", end - 2))
      return false;
    for (let at = start; at < end; at++) {
      const code = line.charCodeAt(at);
      const word =
        code === 95 ||
        (code >= 48 && code <= 57) ||
        (code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122);
      if (!word) return false;
    }
    start = end;
    while (start < line.length && (line.charCodeAt(start) === 32 || line.charCodeAt(start) === 9))
      start++;
  }
  return true;
}

const REDIRECT = "#redirect";

/** Whether `line` starts with `#REDIRECT`, an optional `:` and `[[` (what `/^#redirect\s*:?\s*\[\[/i` matches). */
export function startsRedirect(line: string): boolean {
  for (let at = 0; at < REDIRECT.length; at++) {
    const code = line.charCodeAt(at);
    if ((code >= 65 && code <= 90 ? code + 32 : code) !== REDIRECT.charCodeAt(at)) return false;
  }
  let at = REDIRECT.length;
  while (isBlank(line.charCodeAt(at))) at++;
  if (line.charCodeAt(at) === 58) {
    at++;
    while (isBlank(line.charCodeAt(at))) at++;
  }
  return line.startsWith("[[", at);
}
