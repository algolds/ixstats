/**
 * A card art's licence, as far as its wiki says (licensing drafts §2.5(b), (c)). A licence that forbids commercial
 * use or changes (NC, ND) blocks the import; free licences are open; anything else (no licence, fair use, all rights
 * reserved) is unknown and listed in Compliance → Licence review. Pure and client-safe.
 */
import type { CardWikiSource } from "~/lib/cards/card-sources";
import { wikiFileHosts } from "~/lib/wiki-os/media-hosts";

export type LicenceStatus = "OPEN" | "RESTRICTED" | "UNKNOWN";

const RESTRICTED = [/\bnc\b/i, /non[\s-]?commercial/i, /\bnd\b/i, /no[\s-]?deriv/i];
const OPEN = [
  /\bcc0\b/i,
  /public[\s-]?domain/i,
  /\bpd\b/i,
  /\bcc[\s-]?by\b/i,
  /creative commons attribution/i,
  /\bgfdl\b/i,
  /gnu free documentation/i,
  /free art licen[cs]e/i,
];

export function classifyLicence(texts: ReadonlyArray<string | null | undefined>): LicenceStatus {
  const present = texts.filter((text): text is string => Boolean(text?.trim()));
  if (present.some((text) => RESTRICTED.some((pattern) => pattern.test(text)))) return "RESTRICTED";
  if (present.some((text) => OPEN.some((pattern) => pattern.test(text)))) return "OPEN";
  return "UNKNOWN";
}

/**
 * Template names in a File page's wikitext, each with its one-token positional parameters ("{{self|cc-by-4.0}}" →
 * "self", "cc-by-4.0"). Named parameters and free text ("{{Information|description=PD scan}}", "{{en|PD scan}}")
 * are left out, so a description never reads as a licence.
 */
export function licenceTemplates(wikitext: string): string[] {
  const names: string[] = [];
  for (const match of wikitext.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    const [name, ...params] = match[1].split("|").map((part) => part.trim());
    names.push(...[name, ...params.filter((param) => /^[^\s=]+$/.test(param))].filter(Boolean));
  }
  return names;
}

/**
 * AltHistory's files on Fandom's CDN: `static.wikia.nocookie.net/althistory/images/a/ab/<file>/revision/latest?cb=`,
 * and the older vignette, img and images.wikia.com hosts (which may put `__cb<time>/` first). The host is exact (a
 * `/` follows it), and no other Fandom wiki's path matches. Group 1 is the file, still percent-encoded.
 */
export const ALTHISTORY_CDN_FILE =
  /^https?:\/\/(?:(?:static|vignette\d*|img\d+)\.wikia\.nocookie\.net|images\.wikia\.com)\/(?:__cb\d+\/)?althistory\/images\/[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/i;

/** A file's path on its wiki's own hosts: MediaWiki's `/images/` and Commons' upload path, original or thumbnail. */
const FILE_PATHS = [
  /^\/images\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/i,
  /^\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/i,
];

/** A file WikiOS serves itself, a path on this app: an IxWiki file. */
const STAGED_FILE = /\/api\/wiki\/file\/([^/?#]+)/i;

function decodedName(name: string | undefined): string | null {
  if (!name) return null;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/** The path of an http(s) URL on one of the wiki's file hosts, else null. */
function pathOnWiki(url: string, source: CardWikiSource): string | null {
  try {
    const parsed = new URL(url);
    const web = parsed.protocol === "https:" || parsed.protocol === "http:";
    return web && wikiFileHosts(source).has(parsed.hostname) ? parsed.pathname : null;
  } catch {
    return null;
  }
}

/**
 * The `source` wiki's file an art URL points at ("Flag_of_Ireland.svg"), percent-decoded. Null when the URL is not
 * one of that wiki's files (another host, another Fandom wiki, no file path), so foreign art is never credited with
 * the wiki's same-named file.
 */
export function fileNameFromArtworkUrl(
  url: string | null | undefined,
  source: CardWikiSource
): string | null {
  if (!url) return null;
  if (url.startsWith("/")) {
    return source === "ixwiki" ? decodedName(STAGED_FILE.exec(url)?.[1]) : null;
  }
  const cdnFile = ALTHISTORY_CDN_FILE.exec(url)?.[1];
  if (cdnFile) return source === "althistory" ? decodedName(cdnFile) : null;
  const path = pathOnWiki(url, source);
  return path
    ? decodedName(FILE_PATHS.map((pattern) => pattern.exec(path)?.[1]).find(Boolean))
    : null;
}

/** A Commons file's card title: no namespace, no extension, underscores as spaces. */
export function commonsCardTitle(fileTitle: string): string {
  return fileTitle
    .replace(/^file:/i, "")
    .replace(/\.(svg|png|jpe?g|webp|gif)$/i, "")
    .replace(/_/g, " ")
    .trim();
}
