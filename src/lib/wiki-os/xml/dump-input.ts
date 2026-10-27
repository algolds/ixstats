/**
 * dump-input.ts — open a dump file for `readExport`: plain, gzip, or stdin.
 */

import { createReadStream } from "node:fs";
import { pipeline, type Readable } from "node:stream";
import { createGunzip } from "node:zlib";

/**
 * The bytes of the dump at `file`: `-` is `stdin`, a name ending `.gz` is decompressed on the fly.
 * Any failure (a missing file, a file that is not gzip, a truncated archive) surfaces as an error
 * of the returned stream, so it reaches whoever reads it instead of ending the process.
 */
export function openDumpInput(file: string, stdin: Readable): Readable {
  if (file === "-") return stdin;
  const source = createReadStream(file);
  if (!file.endsWith(".gz")) return source;

  const gunzip = createGunzip();
  // pipeline forwards an error of `source` to `gunzip` (a bare pipe would not).
  pipeline(source, gunzip, () => undefined);
  return gunzip;
}
