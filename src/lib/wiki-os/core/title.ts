/**
 * title.ts — the one MediaWiki-canonical identity for a WikiOS page title.
 *
 * Copies MediaWiki's `Title::newFromText` with `$wgCapitalLinks = true`: underscores become spaces,
 * whitespace collapses, a known namespace prefix is recognised case-insensitively and written in
 * its canonical form, the first letter of the page name is upper-cased (the rest is untouched) and
 * the text is Unicode NFC. Every title entering storage or a lookup goes through
 * `canonicalizeTitle`; the namespace table itself lives in `../namespace-policy.ts`.
 */

import { parseWikiTitle } from "../namespace-policy";
import { toArticleSlug, type ArticleSlug } from "./domain-types";

/** Canonical namespace names keyed by namespace id (the main namespace has no prefix). */
export const NAMESPACE_CANONICAL_NAMES: Readonly<Record<number, string>> = Object.freeze({
  "-2": "Media",
  "-1": "Special",
  1: "Talk",
  2: "User",
  3: "User talk",
  4: "IxWiki",
  5: "IxWiki talk",
  6: "File",
  7: "File talk",
  8: "MediaWiki",
  9: "MediaWiki talk",
  10: "Template",
  11: "Template talk",
  12: "Help",
  13: "Help talk",
  14: "Category",
  15: "Category talk",
  274: "Widget",
  275: "Widget talk",
  828: "Module",
  829: "Module talk",
  2300: "Gadget",
  2301: "Gadget talk",
  2302: "Gadget definition",
  2303: "Gadget definition talk",
  2600: "Topic",
});

export interface CanonicalTitle {
  /** "User talk:Foo bar": the DB `title` and display form. */
  title: string;
  /** Namespace id (0 = main). */
  namespaceId: number;
  /** "User talk"; null for the main namespace. */
  namespacePrefix: string | null;
  /** Page name without the namespace prefix ("Foo bar"). */
  base: string;
  /** `toArticleSlug(title)`: the lower-case lookup key. */
  slug: ArticleSlug;
  /** Text after "#" with underscores turned into spaces, or null. */
  fragment: string | null;
  /** "User_talk:Foo_bar": the `/wiki/<urlPath>` segment (":" and "/" stay literal). */
  urlPath: string;
}

/** MediaWiki's longest page name (namespace prefix excluded), in UTF-8 bytes. */
const MAX_TITLE_BYTES = 255;
/** Characters MediaWiki never allows in a page name. "#" is gone by then: it starts the fragment. */
const ILLEGAL_TITLE_CHARS = /[[\]{}|<>]/;

/** Length of `text` in UTF-8 bytes (no TextEncoder/Buffer: this also runs in the browser and jsdom). */
function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * Upper-case only the first code point, the way `$wgCapitalLinks` does. A code point whose
 * upper-case form is several characters (`ß` becomes `SS`) stays as typed: MediaWiki keeps the
 * legacy single-character mappings for titles.
 */
function capitalizeFirst(name: string): string {
  const [first, ...rest] = Array.from(name);
  if (first === undefined) return name;
  const upper = first.toLocaleUpperCase("en");
  return (Array.from(upper).length === 1 ? upper : first) + rest.join("");
}

/** `/wiki/` path segment for a title: underscores, percent-encoded, ":" and "/" kept literal. */
function toUrlPath(title: string): string {
  return encodeURIComponent(title.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2F/g, "/");
}

/** Split `raw` at its first "#": the page text and the trimmed, space-separated fragment. */
function splitFragment(raw: string): { rest: string; fragment: string | null } {
  const hash = raw.indexOf("#");
  if (hash === -1) return { rest: raw, fragment: null };
  const fragment = raw.slice(hash + 1).replace(/_/g, " ").trim();
  return { rest: raw.slice(0, hash), fragment: fragment || null };
}

/**
 * The canonical form of a page title, or null when MediaWiki would refuse it (empty, no page name
 * after the namespace, illegal characters, over 255 bytes).
 */
export function canonicalizeTitle(raw: string): CanonicalTitle | null {
  const { rest, fragment } = splitFragment(raw.normalize("NFC"));
  const parsed = parseWikiTitle(rest);
  if (!parsed) return null;

  const base = capitalizeFirst(parsed.base);
  if (!base || ILLEGAL_TITLE_CHARS.test(base)) return null;
  if (utf8Length(base) > MAX_TITLE_BYTES) return null;

  const namespacePrefix = NAMESPACE_CANONICAL_NAMES[parsed.namespaceId] ?? null;
  const title = namespacePrefix ? `${namespacePrefix}:${base}` : base;
  return {
    title,
    namespaceId: parsed.namespaceId,
    namespacePrefix,
    base,
    slug: toArticleSlug(title),
    fragment,
    urlPath: toUrlPath(title),
  };
}

/**
 * Decode a URL path segment exactly once. Never throws: a malformed escape returns the raw
 * segment, and "+" stays "+" (it is a space only in query strings).
 */
export function decodeTitleParam(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}
