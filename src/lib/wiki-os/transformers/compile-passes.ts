/**
 * src/lib/wiki-os/transformers/compile-passes.ts — the passes of `parseWikitextToHtml` that were regular expressions
 * a text of openers that never close, or of blanks, makes quadratic. Each answers what its expression answered
 * (written in its comment) in one left-to-right scan, like the passes of clean-markup-passes.ts: a search for a
 * closer that found nothing answers every later opener too. tests/lib/wiki-os/regex-dos-transformers.test.ts holds a
 * copy of the whole compiler as it was and fuzzes the two against each other.
 */

import { isBlank } from "../wikitext/blank";
import { forwardFinder } from "../wikitext/forward-finder";
import { lowerAscii, rewriteSpans, type Span } from "./clean-markup-passes";

/** What a `<ref …>` of the text is made of: its `name` attribute, and its content (undefined for `<ref … />`). */
export interface RefMatch {
  name: string | undefined;
  content: string | undefined;
}

/** A `<ref>` found in the text, and where it ends (just past its `/>` or `</ref>`). */
interface RefTag extends RefMatch {
  end: number;
}

const isQuote = (code: number): boolean => code === 34 || code === 39;

/**
 * The `<ref>` that starts at `at` (`lower` is the text in ASCII lower case, `closeAt(from)` where the first `</ref>`
 * at or after `from` is, or -1): what
 * `/<ref(?:\s+name=["']?([^"'>\s]+)["']?)?(?:\s*\/>|>(.*?)<\/ref>)/gis` matches there, tried in the order the
 * expression tries its alternatives: a name, then `/>` or `>…</ref>`; the name one character shorter when it ends
 * with the `/` of `/>`; no name at all.
 */
function refAt(
  text: string,
  lower: string,
  at: number,
  closeAt: (from: number) => number
): RefTag | null {
  const tagStart = at + 4;
  const afterBlanks = (from: number): number => {
    let end = from;
    while (isBlank(text.charCodeAt(end))) end++;
    return end;
  };
  const closed = (from: number, name: string | undefined): RefTag | null => {
    const blanks = afterBlanks(from);
    if (text.startsWith("/>", blanks)) return { end: blanks + 2, name, content: undefined };
    if (text.charCodeAt(from) !== 62) return null;
    const close = closeAt(from + 1);
    return close === -1 ? null : { end: close + 6, name, content: text.slice(from + 1, close) };
  };

  const nameAt = afterBlanks(tagStart);
  if (nameAt > tagStart && lower.startsWith("name=", nameAt)) {
    const valueStart = nameAt + 5 + (isQuote(text.charCodeAt(nameAt + 5)) ? 1 : 0);
    let valueEnd = valueStart;
    while (
      valueEnd < text.length &&
      !isQuote(text.charCodeAt(valueEnd)) &&
      text.charCodeAt(valueEnd) !== 62 &&
      !isBlank(text.charCodeAt(valueEnd))
    ) {
      valueEnd++;
    }
    if (valueEnd > valueStart) {
      const name = text.slice(valueStart, valueEnd);
      const afterName = valueEnd + (isQuote(text.charCodeAt(valueEnd)) ? 1 : 0);
      const withName = closed(afterName, name);
      if (withName) return withName;
      // `name=a/>`: the name is read as `a/` first, and as `a` when nothing closes a `<ref>` after it
      if (text.charCodeAt(valueEnd) === 62 && name.length > 1 && name.endsWith("/")) {
        return { end: valueEnd + 1, name: name.slice(0, -1), content: undefined };
      }
    }
  }
  return closed(tagStart, undefined);
}

/** `text` with each `<ref>` replaced by `render(name, content)`. */
export function replaceRefs(text: string, render: (ref: RefMatch) => string): string {
  const lower = lowerAscii(text);
  const lastClose = lower.lastIndexOf("</ref>");
  // A `<ref>` with content has its closer at the first `</ref>` after it: none after the last one.
  const closeAt = (from: number): number => (from > lastClose ? -1 : lower.indexOf("</ref>", from));
  return rewriteSpans(text, (from) => {
    for (
      let open = lower.indexOf("<ref", from);
      open !== -1;
      open = lower.indexOf("<ref", open + 1)
    ) {
      const tag = refAt(text, lower, open, closeAt);
      if (tag) return [open, tag.end, render(tag)];
    }
    return null;
  });
}

/** `{|` … `|}` as `render(inside)` (what `/\{\|([\s\S]*?)\|\}/g` finds). */
export function replaceWikitables(text: string, render: (inside: string) => string): string {
  const nextClose = forwardFinder(text, "|}");
  return rewriteSpans(text, (from) => {
    const open = text.indexOf("{|", from);
    if (open === -1) return null;
    const close = nextClose(open + 2);
    return close === -1 ? null : [open, close + 2, render(text.slice(open + 2, close))];
  });
}

/** An opener and the closer that ends what it opens, both in lower case; the text between goes to `render`. */
export interface Delimiters {
  open: string;
  close: string;
  render: (inside: string) => string;
}

/**
 * Each stretch from an opener to the first closer after it, as `render(inside)`: the leftmost opener of any of
 * `pairs` first (what `/<s>([\s\S]*?)<\/s>|<del>([\s\S]*?)<\/del>|~~([\s\S]*?)~~/gi` finds). Openers and
 * closers are matched in any case, as the expressions did with their `i` flag.
 */
export function replaceDelimited(text: string, pairs: readonly Delimiters[]): string {
  const lower = lowerAscii(text);
  const nextClose = pairs.map((pair) => forwardFinder(lower, pair.close));
  const nextOpen = pairs.map(() => -1); // where each pair's next opener is, once it is at or after the position asked
  return rewriteSpans(text, (from): Span | null => {
    let best = -1;
    pairs.forEach((pair, index) => {
      if (nextOpen[index] !== Infinity && nextOpen[index]! < from) {
        let open = lower.indexOf(pair.open, from);
        // an opener without a closer after it is none, and so is every later one
        if (open !== -1 && nextClose[index]!(open + pair.open.length) === -1) open = -1;
        nextOpen[index] = open === -1 ? Infinity : open;
      }
      if (nextOpen[index]! !== Infinity && (best === -1 || nextOpen[index]! < nextOpen[best]!))
        best = index;
    });
    if (best === -1) return null;
    const pair = pairs[best]!;
    const open = nextOpen[best]!;
    const start = open + pair.open.length;
    const close = nextClose[best]!(start);
    return [open, close + pair.close.length, pair.render(text.slice(start, close))];
  });
}

const isLineTerminator = (code: number): boolean =>
  code === 10 || code === 13 || code === 8232 || code === 8233;

/**
 * Lines that start with `level` equals signs and have as many after their text, as `render(title)` (what
 * `/^====\s*(.*?)\s*====/gm` finds for four): the title is what is between the blanks, and it cannot
 * hold a line break, though the blanks around it can.
 */
export function replaceHeadings(
  text: string,
  level: number,
  render: (title: string) => string
): string {
  const marks = "=".repeat(level);
  const nextMarks = forwardFinder(text, marks);
  return rewriteSpans(text, (from) => {
    for (let at = text.indexOf(marks, from); at !== -1; at = text.indexOf(marks, at + 1)) {
      if (at > 0 && !isLineTerminator(text.charCodeAt(at - 1))) continue;
      const start = at + level;
      const end = nextMarks(start);
      if (end === -1) return null; // no closing marks for any later line either
      let first = start;
      while (first < end && isBlank(text.charCodeAt(first))) first++;
      let last = end;
      while (last > first && isBlank(text.charCodeAt(last - 1))) last--;
      let breaks = false;
      for (let i = first; i < last && !breaks; i++) breaks = isLineTerminator(text.charCodeAt(i));
      if (!breaks) return [at, end + level, render(text.slice(first, last))];
    }
    return null;
  });
}

/** `[prefix…]` with a body of at least one character, as in `[category:x]` (what `/\[(?:category|Category):[^\]]+\]/gi` cuts); `prefix` in lower case, `category:`. */
export function stripNamespacedBrackets(text: string, prefix: string): string {
  const lower = lowerAscii(text);
  const nextClose = forwardFinder(text, "]");
  const opener = `[${prefix}`;
  return rewriteSpans(text, (from) => {
    for (
      let open = lower.indexOf(opener, from);
      open !== -1;
      open = lower.indexOf(opener, open + 1)
    ) {
      const bodyStart = open + opener.length;
      const close = nextClose(bodyStart);
      if (close === -1) return null;
      if (close > bodyStart) return [open, close + 1];
    }
    return null;
  });
}

/** Where the next `<references …>` is at or after a position (what `/<references\b[^>]*\/?>/i` finds), as a span, or null. */
function referencesTags(text: string): (from: number) => Span | null {
  const lower = lowerAscii(text);
  const nextGreater = forwardFinder(text, ">");
  return (from) => {
    for (
      let open = lower.indexOf("<references", from);
      open !== -1;
      open = lower.indexOf("<references", open + 1)
    ) {
      if (/\w/.test(text.charAt(open + 11))) continue;
      const end = nextGreater(open + 11);
      return end === -1 ? null : [open, end + 1];
    }
    return null;
  };
}

/** Where the next `{{reflist…}}` is at or after a position (what `/\{\{[Rr]eflist[^}]*\}\}/i` finds), as a span, or null. */
function reflists(text: string): (from: number) => Span | null {
  const lower = lowerAscii(text);
  const nextBrace = forwardFinder(text, "}");
  return (from) => {
    for (
      let open = lower.indexOf("{{reflist", from);
      open !== -1;
      open = lower.indexOf("{{reflist", open + 1)
    ) {
      const close = nextBrace(open + 9);
      if (close === -1) return null;
      if (text.charAt(close + 1) === "}") return [open, close + 2];
    }
    return null;
  };
}

/** The spans `find` finds in `text`, each replaced by `replacement` (written as it is, not as a replacement pattern). */
function replaceFound(
  text: string,
  find: (from: number) => Span | null,
  replacement: string
): string {
  return rewriteSpans(text, (from) => {
    const span = find(from);
    return span && [span[0], span[1], replacement];
  });
}

/** Whether the text has a `<references …>` tag. */
export const hasReferencesTag = (text: string): boolean => referencesTags(text)(0) !== null;

/** Whether the text has a `{{reflist}}`. */
export const hasReflist = (text: string): boolean => reflists(text)(0) !== null;

/** `text` with every `<references …>` tag replaced by `replacement` (as `text.replace(/<references\b[^>]*\/?>/gi, …)`, but for the `$` patterns of a replacement string). */
export const replaceReferencesTags = (text: string, replacement: string): string =>
  replaceFound(text, referencesTags(text), replacement);

/** `text` with every `{{reflist}}` replaced by `replacement` (as `text.replace(/\{\{[Rr]eflist[^}]*\}\}/gi, …)`, but for the `$` patterns of a replacement string). */
export const replaceReflists = (text: string, replacement: string): string =>
  replaceFound(text, reflists(text), replacement);
