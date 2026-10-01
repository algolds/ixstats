/**
 * article-seo.ts — what a crawler or a link unfurler reads from an article: its description (the
 * first paragraph of prose) and its lead image, derived from the same sanitized HTML the reader is
 * served, so the metadata costs no extra query.
 */

import { extractLeadImageFromHtml } from "./transformers/image-url";

/** Only the start of the page is looked at: the first paragraph is near it. */
const SCAN_LIMIT = 60_000;
const MAX_DESCRIPTION = 200;
/** The shortest paragraph that counts as prose (a caption or a one-word stub does not). */
const MIN_PARAGRAPH = 40;

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** The characters of an HTML entity the sanitizer leaves in text (`&amp;`, `&#39;`, `&#x27;`). */
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code =
        body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** A tag, at most this long: a bound on the scan from each "<" keeps stripping linear (attribute values may hold a raw "<"). */
const TAG = /<[^>]{0,1000}>/g;

/** `html` as plain text: tags gone, entities decoded, whitespace collapsed. */
function textOf(html: string): string {
  return decodeEntities(html.replace(TAG, " ")).replace(/\s+/g, " ").trim();
}

/** `text` cut at a word boundary to at most `max` characters, with an ellipsis when it was cut. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** An opening `<p>` tag: its attributes are bounded so a page full of `<p ` inside attribute values stays linear. */
const PARAGRAPH_OPEN = /<p(?=[\s>])[^>]{0,200}>/gi;

/**
 * The description of an article: its first paragraph of real prose, about 200 characters. Null when
 * the page has none (a list, a table, a redirect notice). Every step moves forward through the text
 * once, so hostile HTML cannot make it quadratic.
 */
export function descriptionFromHtml(html: string): string | null {
  const head = html.slice(0, SCAN_LIMIT);
  PARAGRAPH_OPEN.lastIndex = 0;
  for (let open = PARAGRAPH_OPEN.exec(head); open; open = PARAGRAPH_OPEN.exec(head)) {
    const close = head.indexOf("</p>", PARAGRAPH_OPEN.lastIndex);
    if (close === -1) return null;
    const text = textOf(head.slice(PARAGRAPH_OPEN.lastIndex, close));
    if (text.length >= MIN_PARAGRAPH) return clip(text, MAX_DESCRIPTION);
    PARAGRAPH_OPEN.lastIndex = close + "</p>".length;
  }
  return null;
}

/** An absolute URL for the lead image (a site-relative `/images/...` path gets `origin`), or null. */
export function leadImageUrl(html: string, origin: string): string | null {
  const image = extractLeadImageFromHtml(html.slice(0, SCAN_LIMIT));
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  return image.startsWith("//")
    ? `https:${image}`
    : image.startsWith("/")
      ? `${origin}${image}`
      : null;
}

export interface ArticleSeo {
  description: string | null;
  image: string | null;
}

/** The description and lead image of an article, from its infobox and body HTML. */
export function articleSeo(
  parts: { contentHtml: string; infoboxHtml: string | null },
  origin: string
): ArticleSeo {
  return {
    description: descriptionFromHtml(parts.contentHtml),
    image: leadImageUrl(`${parts.infoboxHtml ?? ""}${parts.contentHtml}`, origin),
  };
}
