/**
 * control-chars.ts — the characters no MediaWiki text ever holds.
 *
 * XML 1.0 cannot carry the C0 controls (except tab, line feed and carriage return) or U+FFFE and
 * U+FFFF, and MediaWiki's input normalisation (`UtfNormal\Validator::cleanUp`) removes them from every
 * text it takes, so a page in MediaWiki never has one. WikiOS strips them from the wikitext it saves,
 * for the same reason: the export writer drops them from a dump, and a revision that kept one would
 * hash differently here than in the dump and on MediaWiki (the mirror would then edit that page on
 * every sync instead of finding it already identical).
 */

/** U+0000-U+0008, U+000B, U+000C, U+000E-U+001F, U+FFFE and U+FFFF. */
const XML_FORBIDDEN_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/** `text` without the characters XML 1.0 cannot carry and MediaWiki never stores. */
export function stripXmlForbiddenControlChars(text: string): string {
  return text.replace(XML_FORBIDDEN_CONTROLS, "");
}
