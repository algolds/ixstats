/**
 * sha1.ts — MediaWiki's revision hash.
 *
 * MediaWiki stores and exports a revision's `sha1` as the SHA-1 of its UTF-8 text written in base
 * 36 and left-padded with "0" to 31 characters (`Wikimedia\base_convert($sha1, 16, 36, 31)`).
 */

import { createHash } from "node:crypto";

/** Length MediaWiki pads the base-36 digest to (the largest SHA-1 needs 31 digits). */
const SHA1_BASE36_LENGTH = 31;

/** The MediaWiki `rev_sha1` of `text`: "phoiac9h4m842xq45sp7s6u21eteeq1" for the empty string. */
export function mwSha1Base36(text: string): string {
  const hex = createHash("sha1").update(text, "utf8").digest("hex");
  return BigInt(`0x${hex}`).toString(36).padStart(SHA1_BASE36_LENGTH, "0");
}
