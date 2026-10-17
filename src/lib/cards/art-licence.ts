/**
 * A card art's licence, as far as its wiki says (licensing drafts §2.5(b), (c)). A licence that forbids commercial
 * use or changes (NC, ND) blocks the import; free licences are open; anything else (no licence, fair use, all rights
 * reserved) is unknown and listed in Compliance → Licence review. Pure and client-safe.
 */

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

/** Template names and parameters in a File page's wikitext ("{{self|cc-by-4.0}}" → "self", "cc-by-4.0"). */
export function licenceTemplates(wikitext: string): string[] {
  const names: string[] = [];
  for (const match of wikitext.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    names.push(
      ...match[1]
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
    );
  }
  return names;
}

const FILE_URL_PATTERNS = [
  // Fandom's CDN: /<wiki>/images/a/ab/<file>/revision/latest?cb=
  /^https?:\/\/static\.wikia\.nocookie\.net\/[^/]+\/images\/[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/i,
  // Wikimedia's upload host, original or thumbnail
  /^https?:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/i,
  // A MediaWiki's own /images/ path, original or thumbnail
  /\/images\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/i,
  // A file WikiOS serves itself
  /\/api\/wiki\/file\/([^/?#]+)/i,
];

/** The wiki file an art URL points at ("Flag_of_Ireland.svg"), percent-decoded; null when it names none. */
export function fileNameFromArtworkUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  for (const pattern of FILE_URL_PATTERNS) {
    const name = pattern.exec(url)?.[1];
    if (!name) continue;
    try {
      return decodeURIComponent(name);
    } catch {
      return name;
    }
  }
  return null;
}

/** A Commons file's card title: no namespace, no extension, underscores as spaces. */
export function commonsCardTitle(fileTitle: string): string {
  return fileTitle
    .replace(/^file:/i, "")
    .replace(/\.(svg|png|jpe?g|webp|gif)$/i, "")
    .replace(/_/g, " ")
    .trim();
}
