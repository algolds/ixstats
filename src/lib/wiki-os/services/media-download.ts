// src/lib/wiki-os/services/media-download.ts
// Fetch one media file for `wikios.downloadFile`: only from a host the media proxies already trust
// (plan 401's allowlist: the configured wikis and their upload CDNs), at most 10 MB, every redirect hop
// re-checked. The endpoint is public, so it must not be a way to make this server fetch or buffer anything.

import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { fetchFromAllowedHost, isAllowedMediaUrl } from "~/app/api/mediawiki/_media-response";

/** Largest file `downloadMedia` returns. */
export const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;

/** Read the body, stopping (null) as soon as it grows past `MAX_DOWNLOAD_BYTES`. */
async function readCapped(res: Response): Promise<Buffer | null> {
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_DOWNLOAD_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * The bytes at `url`, or null when the host is not allowlisted, the answer is not OK, or the file is
 * over 10 MB (judged by `Content-Length` first, then while reading).
 */
export async function downloadMedia(url: string): Promise<Buffer | null> {
  if (!isAllowedMediaUrl(url)) return null;
  const res = await fetchFromAllowedHost(
    url,
    { "User-Agent": DEFAULT_USER_AGENT },
    DOWNLOAD_TIMEOUT_MS
  );
  if (!res?.ok) {
    await res?.body?.cancel().catch(() => undefined);
    return null;
  }
  if (Number(res.headers.get("Content-Length")) > MAX_DOWNLOAD_BYTES) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  return readCapped(res);
}
