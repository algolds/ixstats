/**
 * file-hash.ts — the SHA-1 of an uploaded file in the two forms WikiOS meets it.
 *
 * MediaWiki stores a file's hash in base 36 (`img_sha1`, 31 characters, zero-padded: the same encoding as a
 * revision's `rev_sha1`, see xml/sha1.ts) and reports it in 40 hex digits through the Action API
 * (`prop=imageinfo&iiprop=sha1`). WikiOS keeps the base-36 form (`wiki_assets.sha1`, the name of the file in the
 * staging directory) and converts to hex where it talks to MediaWiki's API.
 */

import { createHash } from "node:crypto";
import { sha1HexToBase36 } from "../xml/sha1";

export interface FileHash {
  /** 40 lower-case hex digits: what `imageinfo` reports. */
  hex: string;
  /** `img_sha1`: 31 characters of 0-9a-z. The key of `wiki_assets.sha1` and the staging file's name. */
  base36: string;
}

/** The SHA-1 of `bytes`. */
export function hashFile(bytes: Uint8Array): FileHash {
  const hex = createHash("sha1").update(bytes).digest("hex");
  return { hex, base36: sha1HexToBase36(hex) };
}

/** The hex form of a base-36 hash (`wiki_assets.sha1`), as the Action API writes it. */
export function sha1Base36ToHex(base36: string): string {
  let value = 0n;
  for (const char of base36) value = value * 36n + BigInt(Number.parseInt(char, 36));
  return value.toString(16).padStart(40, "0");
}

/** Whether `value` has the shape of a base-36 file hash: it names a file in the staging directory, so nothing else may. */
export function isFileHash(value: string): boolean {
  return /^[0-9a-z]{31}$/.test(value);
}
