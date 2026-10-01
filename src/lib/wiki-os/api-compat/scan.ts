/**
 * scan.ts — linear wikitext scanners for `action=parse` (plan 410).
 *
 * `parse` reads text a caller chose, so nothing here may backtrack: each scanner makes one pass
 * (`indexOf` jumps and the stack-based bracket index of `wikitext/match-index.ts`), reads a bounded
 * window around every opener, and trims after matching. A hostile text (`[[Category:` and thousands
 * of spaces, a million `[[` that never close) costs time proportional to its length.
 */

import { matchBrackets, UNINDEXED } from "~/lib/wiki-os/wikitext/match-index";

/** A link target or category name is a page title: at most 255 bytes, so a longer run is not one. */
const MAX_TITLE_CHARS = 300;
/** How far past `[[` the whitespace before `Category:` may run. */
const MAX_LEADING_SPACE = 64;

export interface CategoryLink {
  /** The category name as written (not yet canonical). */
  name: string;
  sortKey: string;
}

const isSpace = (char: string | undefined) => char === " " || char === "\t";

/** The index of the first character at or after `from` that is not a space or tab (at most `limit` further). */
function skipSpaces(text: string, from: number, limit: number): number {
  let at = from;
  while (at < from + limit && isSpace(text[at])) at++;
  return at;
}

/** Where each `[[...]]` link starts and where its `]]` is: one pass, nested links included. */
function* links(text: string): Generator<{ open: number; close: number }> {
  const closes = matchBrackets(text);
  let open = text.indexOf("[[");
  while (open !== -1) {
    const close = closes[open];
    if (close !== undefined && close > 0 && close !== UNINDEXED) yield { open, close };
    open = text.indexOf("[[", open + 2);
  }
}

/**
 * The distinct page targets of `[[Target|label]]` links, in order of first appearance, without a
 * `#fragment`. A target that has a line break, or runs past a title's length, is not a link.
 * At most `max` distinct targets are returned.
 */
export function linkTargets(wikitext: string, max: number): string[] {
  const found = new Set<string>();
  for (const { open, close } of links(wikitext)) {
    if (found.size >= max) break;
    const limit = Math.min(close, open + 2 + MAX_TITLE_CHARS);
    let end = open + 2;
    while (end < limit && !"|#\n".includes(wikitext[end]!)) end++;
    if (end === limit && limit < close) continue; // longer than a title
    if (wikitext[end] === "\n") continue;
    const target = wikitext.slice(open + 2, end).trim();
    if (target) found.add(target);
  }
  return [...found];
}

/**
 * The `[[Category:Name|sort key]]` links (not `[[:Category:Name]]`, which is an ordinary link), the
 * first of each name winning, at most `max`.
 */
export function categoryLinks(wikitext: string, max: number): CategoryLink[] {
  const found = new Map<string, CategoryLink>();
  for (const { open, close } of links(wikitext)) {
    if (found.size >= max) break;
    const keyword = skipSpaces(wikitext, open + 2, MAX_LEADING_SPACE);
    if (wikitext.slice(keyword, keyword + 8).toLowerCase() !== "category") continue;
    const colon = skipSpaces(wikitext, keyword + 8, MAX_LEADING_SPACE);
    if (wikitext[colon] !== ":") continue;
    const limit = Math.min(close, colon + 1 + MAX_TITLE_CHARS);
    let end = colon + 1;
    while (end < limit && wikitext[end] !== "|") end++;
    if (end === limit && limit < close) continue;
    const name = wikitext.slice(colon + 1, end).trim();
    if (!name || found.has(name)) continue;
    const sortKey = wikitext[end] === "|" ? wikitext.slice(end + 1, Math.min(close, end + 1 + MAX_TITLE_CHARS)) : "";
    found.set(name, { name, sortKey: sortKey.trim() });
  }
  return [...found.values()];
}

/** The distinct `http(s)://` addresses in the text, at most `max`. One pass: each match consumes what it scans. */
export function externalUrls(wikitext: string, max: number): string[] {
  const found = new Set<string>();
  for (const match of wikitext.matchAll(/https?:\/\/[^\s<>[\]|"{}]+/g)) {
    found.add(match[0]);
    if (found.size >= max) break;
  }
  return [...found];
}

/** A heading's visible text: `[[Target|Label]]` becomes Label, `[[Target]]` Target, quote marks go. Meant for one short line. */
export function visibleText(heading: string): string {
  let out = "";
  let from = 0;
  for (;;) {
    const open = heading.indexOf("[[", from);
    const close = open === -1 ? -1 : heading.indexOf("]]", open + 2);
    if (close === -1) break;
    out += heading.slice(from, open);
    const inner = heading.slice(open + 2, close);
    out += inner.slice(inner.indexOf("|") + 1);
    from = close + 2;
  }
  return (out + heading.slice(from)).replace(/'{2,}/g, "").trim();
}
