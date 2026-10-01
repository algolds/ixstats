/**
 * media-references.ts — the files a page's text refers to, found in one scan.
 *
 * Every save reads its text for them (media-asset-service.ts registers what it finds), so the scan is the
 * length of the text: the expression for `<img>` tags (`<img[^>]+…`) read to the end of the text from every
 * `<img` that had no `>` after it. Pure: no database.
 */

import { openingTags, scanHtml } from "../transformers/html-scan";

const FILE_LINK = /\[\[(?:File|Image):([^\]|#]+)/gi;
const INFOBOX_IMAGE = /\|\s*(?:image|logo|flag|coat_of_arms|seal|map|photo)\s*=\s*([^|\n\r]+)/gi;

/** The picture an infobox parameter names: not a template, and a file of a picture type. */
function infoboxFilename(parameter: string): string | null {
  const raw = parameter.trim();
  if (!raw || raw.startsWith("{{") || !/\.(?:png|jpg|jpeg|svg|gif|webp)$/i.test(raw)) return null;
  return raw
    .replace(/^\[\[(?:File|Image):/i, "")
    .replace(/\]\].*$/, "")
    .trim();
}

/**
 * What `value` (an attribute's value, no quotes in it) names as `…/images/…/Name.ext` (what
 * `/[^"']*\/images\/[^"']*\/([^"'/?#]+)/i` captures): the last name that follows a `/images/` and a `/`. The last
 * `/` that a name follows is the one the expression ends on, whichever `/images/` it started from.
 */
function imagesPathFilename(value: string): string | null {
  const first = value.toLowerCase().indexOf("/images/");
  if (first === -1) return null;
  for (
    let slash = value.lastIndexOf("/");
    slash >= first + 8;
    slash = value.lastIndexOf("/", slash - 1)
  ) {
    if (slash + 1 >= value.length || "/?#".includes(value.charAt(slash + 1))) continue;
    let end = slash + 1;
    while (end < value.length && !"/?#".includes(value.charAt(end))) end++;
    return value.slice(slash + 1, end);
  }
  return null;
}

/** The first quote (either kind) at or after `from` in `text`, or -1. */
function nextQuote(text: string, from: number): number {
  for (let at = from; at < text.length; at++) if (text[at] === '"' || text[at] === "'") return at;
  return -1;
}

/**
 * The file each `<img>` tag names, in order (what
 * `/<img[^>]+(?:src=["'](?:[^"']*\/images\/[^"']*\/([^"'/?#]+))|data-file=["']([^"']+)["'])/gi` captures): the `src`
 * path's file name or the `data-file` value, whichever comes last in the tag (the expression reads greedily).
 */
function* imageTagFilenames(content: string): Generator<string> {
  const scan = scanHtml(content);
  let reached = 0;
  for (const tag of openingTags(scan, ["img"])) {
    if (tag.start < reached) continue;
    const text = scan.lower.slice(tag.start, tag.end);
    const original = content.slice(tag.start, tag.end);
    const candidates = [...text.matchAll(/data-file=|src=/g)].filter((c) => c.index >= 5).reverse();
    for (const candidate of candidates) {
      const isDataFile = candidate[0] === "data-file=";
      const quote = candidate.index + candidate[0].length;
      if (text[quote] !== '"' && text[quote] !== "'") continue;
      const close = nextQuote(text, quote + 1);
      if (close === -1 || close >= text.length - 1) continue;
      const value = original.slice(quote + 1, close);
      const filename = isDataFile ? value : imagesPathFilename(value);
      if (!filename) continue;
      reached = tag.end;
      yield filename;
      break;
    }
  }
}

/** The files `content` (wikitext or HTML) names: `[[File:…]]` links, picture parameters of an infobox, `<img>` tags. */
export function referencedFilenames(content: string): Set<string> {
  const found = new Set<string>();
  for (const match of content.matchAll(FILE_LINK)) found.add(match[1]!.trim());
  for (const match of content.matchAll(INFOBOX_IMAGE)) {
    const filename = infoboxFilename(match[1]!);
    if (filename !== null) found.add(filename);
  }
  for (const raw of imageTagFilenames(content)) {
    found.add(decodeURIComponent(raw).replace(/^(\d+px-)/i, ""));
  }
  return found;
}
