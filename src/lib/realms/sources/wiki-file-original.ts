/**
 * The original bytes of a sister wiki's file (P2.3), for importing a world map: exact colours matter, so it is
 * fetched straight from the wiki, never through wsrv.nl (which may re-encode an image). Server only.
 *
 * Guards, in order: the file's imageinfo is read from the realm's wiki (a title, never a URL, comes in); its URL
 * must be https on that wiki or its upload CDN (`wiki-hosts.ts`); the download goes through the media proxies'
 * `fetchFromAllowedHost`, which re-checks every redirect hop against the allowlist (narrowed here to that one
 * wiki's hosts); the body must be an image and at most MAX_ORIGINAL_BYTES (the stated size first, then counted
 * while streaming); its SHA-1 must equal the one imageinfo gave; its dimensions are read from the header with
 * sharp (`limitInputPixels`) before anything decodes it, and more than MAX_ORIGINAL_PIXELS is refused.
 */
import { createHash } from "node:crypto";
import sharp from "sharp";
import { fetchFromAllowedHost } from "~/app/api/mediawiki/_media-response";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { sisterWikiFileHosts, SISTER_WIKI_HOSTS } from "~/lib/wiki-os/wiki-hosts";
import type { RealmWikiSource } from "~/lib/realms/realm-wiki-settings";
import type { WikiQuery } from "~/lib/realms/lore-import";
import { asFileTitle, fetchWikiFileInfo, type WikiFileInfo } from "./wiki-file-info";

/** The largest original a map import takes. */
export const MAX_ORIGINAL_BYTES = 40 * 1024 * 1024;
/** The most pixels (width × height) an original may have: 64 megapixels, the map import's own limit. */
export const MAX_ORIGINAL_PIXELS = 64_000_000;
const ORIGINAL_TIMEOUT_MS = 60_000;

export type WikiFileFetchErrorCode =
  | "NOT_FOUND"
  | "HOST_NOT_ALLOWED"
  | "TOO_LARGE"
  | "NOT_AN_IMAGE"
  | "SHA1_MISMATCH"
  | "TOO_MANY_PIXELS"
  | "UNREADABLE"
  | "UNREACHABLE";

export class WikiFileFetchError extends Error {
  constructor(
    public readonly code: WikiFileFetchErrorCode,
    message: string
  ) {
    super(message);
    this.name = "WikiFileFetchError";
  }
}

export interface WikiFileOriginal {
  buffer: Buffer;
  /** The type sharp read from the bytes (not the type the server claimed). */
  mime: string;
  width: number;
  height: number;
  size: number;
  sha1: string;
  licence: string | null;
  attribution: string;
  fileTitle: string;
  descriptionUrl: string | null;
}

export interface OriginalFetchDeps {
  /** Reads the file's imageinfo (the throttled discovery client's query in production). */
  query: WikiQuery;
  /** Defaults to `fetchFromAllowedHost`. */
  download?: typeof fetchFromAllowedHost;
  maxBytes?: number;
  maxPixels?: number;
}

const SHARP_FORMAT_MIME: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  tiff: "image/tiff",
};

/** Whether `url` is https on the wiki's own host or its upload CDN. */
export function isWikiFileUrl(source: RealmWikiSource, url: URL): boolean {
  return url.protocol === "https:" && sisterWikiFileHosts(SISTER_WIKI_HOSTS[source]).includes(url.hostname);
}

async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new WikiFileFetchError("TOO_LARGE", `The file is larger than ${Math.round(maxBytes / 1048576)} MB`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Width, height and type from the image header; nothing is decoded. */
async function headerDimensions(buffer: Buffer, maxPixels: number) {
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(buffer, { limitInputPixels: maxPixels }).metadata();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (/pixel limit/i.test(reason)) {
      throw new WikiFileFetchError(
        "TOO_MANY_PIXELS",
        `The image is over the ${Math.round(maxPixels / 1_000_000)} megapixel limit`
      );
    }
    throw new WikiFileFetchError("UNREADABLE", `The file could not be read as an image: ${reason}`);
  }
  const { width, height, format } = meta;
  if (!width || !height || !format || !SHARP_FORMAT_MIME[format]) {
    throw new WikiFileFetchError("UNREADABLE", "The file could not be read as an image");
  }
  if (width * height > maxPixels) {
    throw new WikiFileFetchError(
      "TOO_MANY_PIXELS",
      `The image is ${width}×${height}, over the ${Math.round(maxPixels / 1_000_000)} megapixel limit`
    );
  }
  return { width, height, mime: SHARP_FORMAT_MIME[format]! };
}

/** The original of `info` (already read from the wiki), with every guard above. */
export async function downloadWikiFileOriginal(
  source: RealmWikiSource,
  info: WikiFileInfo,
  deps: Omit<OriginalFetchDeps, "query"> = {}
): Promise<WikiFileOriginal> {
  const maxBytes = deps.maxBytes ?? MAX_ORIGINAL_BYTES;
  const maxPixels = deps.maxPixels ?? MAX_ORIGINAL_PIXELS;
  const url = new URL(info.url);
  if (!isWikiFileUrl(source, url)) {
    throw new WikiFileFetchError("HOST_NOT_ALLOWED", `${info.fileTitle} is not served by ${SISTER_WIKI_HOSTS[source].name}`);
  }
  if (info.size > maxBytes) {
    throw new WikiFileFetchError("TOO_LARGE", `The file is larger than ${Math.round(maxBytes / 1048576)} MB`);
  }
  const download = deps.download ?? fetchFromAllowedHost;
  let res: Response | null;
  try {
    res = await download(
      url.toString(),
      { "User-Agent": DEFAULT_USER_AGENT, "Api-User-Agent": DEFAULT_USER_AGENT },
      ORIGINAL_TIMEOUT_MS,
      (hop) => isWikiFileUrl(source, hop)
    );
  } catch (error) {
    throw new WikiFileFetchError(
      "UNREACHABLE",
      `The file could not be downloaded: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!res) throw new WikiFileFetchError("HOST_NOT_ALLOWED", "The download redirected to a host that is not allowed");
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new WikiFileFetchError("UNREACHABLE", `The wiki answered HTTP ${res.status} for the file`);
  }
  const type = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!type.startsWith("image/")) {
    await res.body?.cancel().catch(() => undefined);
    throw new WikiFileFetchError("NOT_AN_IMAGE", `The wiki answered with ${type || "an unknown type"}, not an image`);
  }
  if (Number(res.headers.get("content-length")) > maxBytes) {
    await res.body?.cancel().catch(() => undefined);
    throw new WikiFileFetchError("TOO_LARGE", `The file is larger than ${Math.round(maxBytes / 1048576)} MB`);
  }
  const buffer = await readCapped(res, maxBytes);
  const sha1 = createHash("sha1").update(buffer).digest("hex");
  if (!info.sha1 || sha1 !== info.sha1) {
    throw new WikiFileFetchError(
      "SHA1_MISMATCH",
      "The downloaded file does not match the wiki's SHA-1 (it may have changed or been altered on the way); try again"
    );
  }
  const { width, height, mime } = await headerDimensions(buffer, maxPixels);
  return {
    buffer,
    mime,
    width,
    height,
    size: buffer.byteLength,
    sha1,
    licence: info.licence,
    attribution: info.attribution,
    fileTitle: info.fileTitle,
    descriptionUrl: info.descriptionUrl,
  };
}

/**
 * The original bytes of `fileTitle` on the realm's wiki: its imageinfo first (URL, size, SHA-1, licence), then the
 * guarded download. Throws WikiFileFetchError with the reason.
 */
export async function fetchWikiFileOriginal(
  source: RealmWikiSource,
  fileTitle: string,
  deps: OriginalFetchDeps
): Promise<WikiFileOriginal> {
  const title = asFileTitle(fileTitle);
  const info = (await fetchWikiFileInfo(source, deps.query, [title])).get(title);
  if (!info) throw new WikiFileFetchError("NOT_FOUND", `${title} was not found on ${SISTER_WIKI_HOSTS[source].name}`);
  return downloadWikiFileOriginal(source, info, deps);
}
