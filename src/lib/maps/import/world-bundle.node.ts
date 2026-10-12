/**
 * Reading a world bundle on the server: gunzip with a decompressed-size cap (a zip bomb stops at the cap, before
 * the JSON is parsed), then the pure parser (`world-bundle.ts`). Server only: this imports `node:zlib`.
 */
import { gunzipSync } from "node:zlib";
import {
  isGzip,
  MAX_WORLD_BUNDLE_JSON_BYTES,
  parseWorldBundleJson,
  type WorldBundleParse,
} from "./world-bundle";

/** A bundle's gzip bytes, validated; `maxJsonBytes` is the decompressed cap (a parameter for tests). */
export function parseWorldBundle(
  bytes: Uint8Array,
  maxJsonBytes = MAX_WORLD_BUNDLE_JSON_BYTES
): WorldBundleParse {
  if (!isGzip(bytes)) return { ok: false, reason: "The file is not a gzip world bundle" };
  let json: string;
  try {
    json = gunzipSync(bytes, { maxOutputLength: maxJsonBytes }).toString("utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return {
      ok: false,
      reason:
        code === "ERR_BUFFER_TOO_LARGE"
          ? `The bundle unpacks to more than ${maxJsonBytes / 1024 / 1024} MB`
          : "The gzip data is corrupt",
    };
  }
  return parseWorldBundleJson(json);
}
