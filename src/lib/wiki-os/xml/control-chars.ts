/**
 * control-chars.ts — the characters no MediaWiki text ever holds.
 *
 * XML 1.0 cannot carry the C0 controls (except tab, line feed and carriage return), U+FFFE, U+FFFF or a lone surrogate,
 * and MediaWiki's input normalisation (`UtfNormal\Validator::cleanUp`) does not keep them in any text it takes: it removes the
 * controls and replaces U+FFFE, U+FFFF and bytes that are not valid UTF-8 with U+FFFD. WikiOS strips the controls
 * and U+FFFE/U+FFFF from the wikitext it saves, and replaces a lone surrogate (which PostgreSQL cannot store: a save of
 * one failed with a 500) with U+FFFD. Whatever it stores is what its export carries and what the mirror pushes, so a
 * revision's hash is the same here, in a dump and on MediaWiki (the mirror would otherwise edit that page on every sync
 * instead of finding it already identical). The strip is idempotent: stripped text is a fixed point, so saving it again
 * changes nothing.
 */

/** U+0000-U+0008, U+000B, U+000C, U+000E-U+001F, U+FFFE and U+FFFF (written as escapes, never as the characters). */
const XML_FORBIDDEN_CONTROLS = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\uFFFE\\uFFFF]", "g");

/** A high surrogate with no low one after it, or a low surrogate with no high one before it. */
const LONE_SURROGATE = new RegExp(
  "[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?<![\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]",
  "g"
);

const REPLACEMENT_CHARACTER = "\uFFFD";

/**
 * `text` as MediaWiki would keep it: without the characters XML 1.0 cannot carry (the controls, U+FFFE, U+FFFF), and
 * with U+FFFD in place of a lone surrogate. Lone surrogates go first, so that removing a control can never join two of
 * them into a pair that was not there.
 */
export function stripXmlForbiddenControlChars(text: string): string {
  return text.replace(LONE_SURROGATE, REPLACEMENT_CHARACTER).replace(XML_FORBIDDEN_CONTROLS, "");
}
