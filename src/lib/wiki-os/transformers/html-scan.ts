/**
 * src/lib/wiki-os/transformers/html-scan.ts — what the passes over article HTML share to stay linear.
 *
 * Their regular expressions (`<table[^>]*class="…"[\s\S]*?</table>`, `<img[^>]+src=…`) were quadratic on a page of
 * tags that never end or never close: each opener read to the end of the page for a `>` or a closer that was
 * not there. These scans find each tag's `>` and each closer once, however many openers come before it, and
 * answer what the expression answered for a tag of the length a tag has (see TAG_BODY).
 */

import { forwardFinder } from "../wikitext/forward-finder";
import { lowerAscii } from "./clean-markup-passes";

/**
 * ponytail: TAG_BODY, 2,048 characters: the longest tag (`<img … >`, `<table … class="infobox">`) these scans
 * read. A page's attributes are a few dozen characters each and its longest tag (an image with a `srcset`)
 * under a thousand (1,033 characters, the longest of the clone's stored HTML); a longer run between a `<` and its
 * `>` is text that was never a tag, and reading it again from every `<` inside it is what made the expressions
 * quadratic.
 *
 * Two kinds of malformed tag read differently from the expressions, and only they: a tag with an attribute of more
 * than 2 KB is not a tag here (the expressions matched it, in time quadratic in the page), and a tag ends at its
 * first `>`, so a `>` inside a quoted attribute value ends it there (as `[^>]*` always did, which is not how an
 * HTML parser reads it; the HTML these scans read has been through the sanitizer, whose output is well formed).
 * The behaviour is kept.
 */
export const TAG_BODY = 2_048;

/** A page and what the scans look things up in: its ASCII lower case (indexes alike) and where each `>` is. */
export interface HtmlScan {
  html: string;
  lower: string;
  nextGreater: (from: number) => number;
}

/** The last page scanned and its lower case: the passes over one page scan it again and again. */
let lastScanned: { html: string; lower: string } | null = null;

export function scanHtml(html: string): HtmlScan {
  if (lastScanned?.html !== html) lastScanned = { html, lower: lowerAscii(html) };
  return { html, lower: lastScanned.lower, nextGreater: forwardFinder(html, ">") };
}

/** A tag: `start` is its `<`, `end` is just past its `>`. */
export interface Tag {
  start: number;
  end: number;
}

/**
 * The opening tags whose name starts with one of `names` (lower case; what `/<(?:a|b)[^>]*>/gi` starts at), in
 * order, from `from` and ending by `to`. A `<name` is a tag when a `>` is within TAG_BODY of it; the `<name`s inside
 * a tag are tags of their own (the expression tried every position).
 */
export function* openingTags(
  scan: HtmlScan,
  names: readonly string[],
  from = 0,
  to = scan.html.length
): Generator<Tag> {
  const { lower, nextGreater } = scan;
  // Where each name's next `<name` is, looked for only when the last one is behind (a page of `<` and no name is one scan).
  const nextOf = names.map(() => -2);
  const nextTag = (position: number): number => {
    let first = -1;
    names.forEach((name, index) => {
      if (nextOf[index] !== -1 && nextOf[index]! < position)
        nextOf[index] = lower.indexOf(`<${name}`, position);
      if (nextOf[index] !== -1 && (first === -1 || nextOf[index]! < first)) first = nextOf[index]!;
    });
    return first;
  };
  for (let at = nextTag(from); at !== -1 && at < to; at = nextTag(at + 1)) {
    const close = nextGreater(at + 1);
    if (close === -1) return; // no `>` after this one is a tag's end either
    if (close < to && close + 1 - at <= TAG_BODY) yield { start: at, end: close + 1 };
  }
}

/**
 * Whether `tag` has a `class` attribute whose value matches `words`: the value starts after `class=` and a
 * quote of `quotes`, and ends at the next one of them (what `/class=["'][^"']*\b(?:a|b)\b[^"']*["']/i` reads).
 */
export function hasClass(scan: HtmlScan, tag: Tag, quotes: string, words: RegExp): boolean {
  const text = scan.lower.slice(tag.start, tag.end);
  for (let at = text.indexOf("class="); at !== -1; at = text.indexOf("class=", at + 1)) {
    if (!quotes.includes(text.charAt(at + 6))) continue;
    let end = at + 7;
    while (end < text.length && !quotes.includes(text.charAt(end))) end++;
    if (end < text.length && words.test(text.slice(at + 7, end))) return true;
  }
  return false;
}

/** The value of the last `name="…"` of the tag (what `/[^>]*name="([^"]*)"/` captures: it reads greedily), or null. */
export function lastAttribute(scan: HtmlScan, tag: Tag, name: string): string | null {
  const text = scan.lower.slice(tag.start, tag.end);
  const opener = `${name}="`;
  for (
    let at = text.lastIndexOf(opener);
    at !== -1;
    at = at === 0 ? -1 : text.lastIndexOf(opener, at - 1)
  ) {
    const end = text.indexOf('"', at + opener.length);
    if (end !== -1 && end < text.length - 1) {
      return scan.html.slice(tag.start + at + opener.length, tag.start + end);
    }
  }
  return null;
}

/** How to find a block: the tags that open it, which of them do, and the closers that end it. */
export interface BlockSpec {
  /** Names (lower case) the opening tag starts with. */
  names: readonly string[];
  /** Whether this opening tag opens one. */
  opens: (scan: HtmlScan, tag: Tag) => boolean;
  /** What ends it (lower case, whole closing tags): the first of any after the opening tag. */
  closers: readonly string[];
}

/**
 * The blocks of the page, left to right and apart: from each opening tag that opens one to the first closer after
 * it, whichever closer comes first (what `/<table[^>]*class=…[\s\S]*?<\/table>/gi` matches). An opener with no
 * closer after it has none after any later opener either.
 */
export function* blocks(
  scan: HtmlScan,
  spec: BlockSpec,
  from = 0,
  to = scan.html.length
): Generator<readonly [start: number, end: number]> {
  const nextCloser = spec.closers.map((closer) => forwardFinder(scan.lower, closer));
  let reached = from;
  for (const tag of openingTags(scan, spec.names, from, to)) {
    if (tag.start < reached || !spec.opens(scan, tag)) continue;
    let end = -1;
    spec.closers.forEach((closer, index) => {
      const at = nextCloser[index]!(tag.end);
      if (at !== -1 && at + closer.length <= to && (end === -1 || at + closer.length < end)) {
        end = at + closer.length;
      }
    });
    if (end === -1) return;
    reached = end;
    yield [tag.start, end];
  }
}

/** Paragraphs: `<p…>` to the first `</p>` (as `/<p[^>]*>[\s\S]*?<\/p>/gi`: a `<pre>` opens one too). */
export const PARAGRAPHS: BlockSpec = { names: ["p"], closers: ["</p>"], opens: () => true };

/** `html` without the blocks `spec` finds. */
export function removeBlocks(html: string, spec: BlockSpec): string {
  const pieces: string[] = [];
  let copied = 0;
  for (const [start, end] of blocks(scanHtml(html), spec)) {
    pieces.push(html.slice(copied, start));
    copied = end;
  }
  pieces.push(html.slice(copied));
  return pieces.join("");
}

/** An `<img>` tag with a `src`: the tag's text and the address. */
export interface ImageTag extends Tag {
  tag: string;
  src: string;
}

/**
 * The `<img …>` tags that have a `src`, in order (what `/<img[^>]+src=["']([^"']+)["'][^>]*>/gi` matches): the
 * address is the one after the last `src=` that is followed by a quote and a value (the expression reads
 * greedily), so `<img src="a" data-src="b">` is `b`.
 */
export function* imageTags(scan: HtmlScan, from = 0, to = scan.html.length): Generator<ImageTag> {
  let reached = from;
  for (const tag of openingTags(scan, ["img"], from, to)) {
    if (tag.start < reached) continue;
    const text = scan.lower.slice(tag.start, tag.end);
    for (let at = text.lastIndexOf("src="); at >= 5; at = text.lastIndexOf("src=", at - 1)) {
      if (!`"'`.includes(text.charAt(at + 4))) continue;
      let end = at + 5;
      while (end < text.length - 1 && !`"'`.includes(text.charAt(end))) end++;
      if (end === at + 5 || end >= text.length - 1) continue;
      reached = tag.end;
      yield {
        ...tag,
        tag: scan.html.slice(tag.start, tag.end),
        src: scan.html.slice(tag.start + at + 5, tag.start + end),
      };
      break;
    }
  }
}
