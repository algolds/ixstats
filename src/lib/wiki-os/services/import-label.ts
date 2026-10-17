/**
 * The name a WikiOS edit goes out to MediaWiki under when its author has no verified wiki account: `wikios>Label`,
 * a form MediaWiki keeps as it is and never maps to an account. MediaWiki user names cannot hold `>`, so no
 * MediaWiki editor can carry it.
 */

/** MediaWiki's prefix for the names of editors it has no account for: `wikios>Name`. */
export const INTERWIKI_PREFIX = "wikios";
const UNKNOWN_AUTHOR = "Community Contributor";
/** MediaWiki's `actor_name` holds 255 bytes; the import prefix and its `>` take some of them. */
const MAX_ACTOR_NAME_BYTES = 255;
const MAX_LABEL_BYTES = MAX_ACTOR_NAME_BYTES - (INTERWIKI_PREFIX.length + 1);
const IMPORT_NAME_START = `${INTERWIKI_PREFIX}>`;

/** `text` cut to at most `maxBytes` bytes of UTF-8, never in the middle of a character. */
function truncateUtf8(text: string, maxBytes: number): string {
  const bytes = Buffer.from(text, "utf8");
  if (bytes.length <= maxBytes) return text;
  let end = maxBytes;
  // a continuation byte (10xxxxxx) at the cut belongs to a character that starts before it: leave that one out too
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end--;
  return bytes.subarray(0, end).toString("utf8");
}

/**
 * The label a free-text author goes out under (after `wikios>`): one line (a line break or tab, with the spaces around it, becomes
 * one space: MediaWiki's user names hold neither), at most the 248 bytes that fit MediaWiki's 255-byte actor name with the prefix.
 */
function importLabel(author: string | null): string {
  const line = (author ?? "").replace(/\s*[\r\n\t]\s*/g, " ").trim();
  return truncateUtf8(line, MAX_LABEL_BYTES).trim() || UNKNOWN_AUTHOR;
}

/** The `wikios>Label` name an author with no verified wiki account goes out under. */
export const importName = (author: string | null): string =>
  `${IMPORT_NAME_START}${importLabel(author)}`;

/** The label of a `wikios>Label` name, normalized as `importLabel` makes it; null for any other name. */
export function labelOfImportName(name: string): string | null {
  return name.startsWith(IMPORT_NAME_START)
    ? importLabel(name.slice(IMPORT_NAME_START.length))
    : null;
}
