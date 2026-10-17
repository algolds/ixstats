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
 * "self", "cc-by-4.0"). Magic words and parser functions (a name with `:`, "{{DEFAULTSORT:PD logo}}", "{{#if:x|PD}}"),
 * named parameters and multi-word text ("{{Information|description=PD scan}}", "{{en|PD scan}}") are left out, so
 * text never reads as a licence.
 */
export function licenceTemplates(wikitext: string): string[] {
  const names: string[] = [];
  for (const match of wikitext.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    const [name, ...params] = match[1].split("|").map((part) => part.trim());
    if (!name || name.includes(":")) continue;
    names.push(name, ...params.filter((param) => /^[^\s=]+$/.test(param)));
  }
  return names;
}

/** Fandom's CDN hosts (static, and the older vignette, img and images.wikia.com), shared by every Fandom wiki. */
const FANDOM_CDN_HOSTS = String.raw`(?:(?:static|vignette\d*|img\d+)\.wikia\.nocookie\.net|images\.wikia\.com)`;
const FANDOM_CDN_HOST = new RegExp(`^${FANDOM_CDN_HOSTS}$`, "i");

/**
 * AltHistory's files on Fandom's CDN: `<host>/althistory/images/a/ab/<file>/revision/latest?cb=`, where the older
 * hosts may put `__cb<time>/` first. The host is exact (a `/` follows it), and no other Fandom wiki's path matches.
 * Group 1 is the file, still percent-encoded.
 */
const ALTHISTORY_CDN_FILE = new RegExp(
  String.raw`^https?:\/\/${FANDOM_CDN_HOSTS}\/(?:__cb\d+\/)?althistory\/images\/[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)`,
  "i"
);

/** A file's path on its wiki's own hosts: MediaWiki's `/images/` and Commons' upload path, original or thumbnail. */
const FILE_PATHS = [
  /^\/images\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/i,
  /^\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/i,
];

/** A file WikiOS serves itself, a path on this app: an IxWiki file. */
const STAGED_FILE = /\/api\/wiki\/file\/([^/?#]+)/i;

/** A file name from a URL segment, percent-decoded. Null for none, and for `.` or `..`: a path step is no file. */
function decodedName(segment: string | undefined): string | null {
  if (!segment) return null;
  let name = segment;
  try {
    name = decodeURIComponent(segment);
  } catch {
    // A malformed escape is kept as it came.
  }
  return /^(?:file:)?\.\.?$/i.test(name) ? null : name;
}

/** An http(s) URL, or null. */
function webUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed : null;
  } catch {
    return null;
  }
}

/** The AltHistory file a Fandom CDN URL points at, percent-decoded; null for any other URL. */
export function althistoryCdnFileName(url: string): string | null {
  return decodedName(ALTHISTORY_CDN_FILE.exec(url)?.[1]);
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
  const parsed = webUrl(url);
  if (!parsed) return null;
  // Every Fandom wiki shares the CDN, so only an AltHistory file path names a file there.
  if (FANDOM_CDN_HOST.test(parsed.hostname)) {
    return source === "althistory" ? althistoryCdnFileName(url) : null;
  }
  if (!wikiFileHosts(source).has(parsed.hostname)) return null;
  return decodedName(FILE_PATHS.map((pattern) => pattern.exec(parsed.pathname)?.[1]).find(Boolean));
}

/** A Commons file's card title: no namespace, no extension, underscores as spaces. */
export function commonsCardTitle(fileTitle: string): string {
  return fileTitle
    .replace(/^file:/i, "")
    .replace(/\.(svg|png|jpe?g|webp|gif)$/i, "")
    .replace(/_/g, " ")
    .trim();
}
