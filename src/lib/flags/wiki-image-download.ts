/**
 * The bytes of a wiki file for a local flag or coat of arms (`scripts/realms/localize-realm-flags.ts`). Server only.
 *
 * The file's URL comes from its wiki's `imageinfo` (redirects followed; a file the wiki takes from Commons comes back
 * with its Commons URL). The download takes the media proxy's two routes (`api/mediawiki/[wiki]/[...path]`): the
 * file straight from its allowlisted host, every redirect re-checked, kept only when its SHA-1 is the wiki's; else
 * through wsrv.nl, which reaches origins that refuse servers (IIWiki's Cloudflare). Either way the answer must be an
 * image of at most 5 MB. An SVG is rasterized to PNG, so the file served from `public/flags/` holds nothing
 * scriptable; raster images keep their bytes.
 */
import { createHash } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import {
  fetchFromAllowedHost,
  isAllowedMediaUrl,
  readCapped,
} from "~/app/api/mediawiki/_media-response";
import type { WikiQuery } from "~/lib/realms/lore-import";
import { asFileTitle } from "~/lib/realms/sources/wiki-file-info";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";

export const MAX_FLAG_BYTES = 5 * 1024 * 1024;
const MAX_FLAG_PIXELS = 25_000_000;
/** The width an SVG flag or arms is rasterized to. */
export const SVG_RASTER_WIDTH = 1200;

const TIMEOUT_MS = 30_000;
/** Fewer than MediaWiki's 50: a 50-title imageinfo read times out through the IIWiki development relay. */
const TITLES_PER_REQUEST = 20;
const UA_HEADERS = { "User-Agent": DEFAULT_USER_AGENT, "Api-User-Agent": DEFAULT_USER_AGENT };

export interface ResolvedWikiImage {
  url: string;
  /** Lower-case hex, empty when the wiki gave none. */
  sha1: string;
  /** Bytes, as the wiki states them. */
  size: number;
}

const Rename = z.object({ from: z.string(), to: z.string() });
const ImageInfoAnswer = z.object({
  query: z
    .object({
      normalized: z.array(Rename).optional(),
      redirects: z.array(Rename).optional(),
      pages: z.array(
        z.object({
          title: z.string(),
          imageinfo: z
            .array(
              z.object({
                url: z.string(),
                sha1: z.string().optional(),
                size: z.number().optional(),
              })
            )
            .optional(),
        })
      ),
    })
    .optional(),
});
type ImageInfoAnswer = z.infer<typeof ImageInfoAnswer>;

/** A lookup from an asked title to its file, through the wiki's normalization and redirects. */
function filesOf(data: ImageInfoAnswer): (title: string) => ResolvedWikiImage | undefined {
  const query = data.query;
  const renamed = new Map(
    [...(query?.normalized ?? []), ...(query?.redirects ?? [])].map((r) => [r.from, r.to])
  );
  const pages = new Map<string, ResolvedWikiImage>();
  for (const page of query?.pages ?? []) {
    const info = page.imageinfo?.[0];
    if (info) {
      pages.set(page.title, {
        url: info.url,
        sha1: (info.sha1 ?? "").toLowerCase(),
        size: info.size ?? 0,
      });
    }
  }
  return (title) => {
    let current = title;
    for (let hop = 0; hop < 3 && renamed.has(current); hop++) {
      current = renamed.get(current) ?? current;
    }
    return pages.get(current);
  };
}

/** The files behind `fileNames` on one wiki, keyed by the name asked; a name the wiki has no file for is left out. */
export async function resolveWikiImages(
  query: WikiQuery,
  fileNames: readonly string[]
): Promise<Map<string, ResolvedWikiImage>> {
  const found = new Map<string, ResolvedWikiImage>();
  const asked = [...new Set(fileNames)];
  for (let i = 0; i < asked.length; i += TITLES_PER_REQUEST) {
    const batch = asked.slice(i, i + TITLES_PER_REQUEST);
    const data = await query(
      {
        prop: "imageinfo",
        iiprop: "url|size|sha1",
        redirects: "1",
        titles: batch.map(asFileTitle).join("|"),
      },
      ImageInfoAnswer
    );
    const fileOf = filesOf(data);
    for (const name of batch) {
      const file = fileOf(asFileTitle(name));
      if (file) found.set(name, file);
    }
  }
  return found;
}

/** A GET of an image URL; null when a redirect left the allowlist. */
export type ImageFetch = (url: string) => Promise<Response | null>;

export interface DownloadDeps {
  /** Defaults to `fetchFromAllowedHost`. */
  direct?: ImageFetch;
  /** Defaults to wsrv.nl. */
  relay?: ImageFetch;
  maxBytes?: number;
}

const directFetch: ImageFetch = (url) => fetchFromAllowedHost(url, UA_HEADERS, TIMEOUT_MS);

const relayFetch: ImageFetch = (url) =>
  fetch(`https://wsrv.nl/?url=${encodeURIComponent(url)}`, {
    headers: UA_HEADERS,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

type Attempt = { buffer: Buffer } | { error: string };

const megabytes = (bytes: number) => Math.round(bytes / 1048576);
const sha1Of = (buffer: Buffer) => createHash("sha1").update(buffer).digest("hex");

/** Why a response is not taken, or null when its body may be read. */
function refusal(res: Response, maxBytes: number): string | null {
  if (!res.ok) return `HTTP ${res.status}`;
  const type = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!type.startsWith("image/")) return `not an image (${type || "no type"})`;
  if (Number(res.headers.get("content-length")) > maxBytes) return `over ${megabytes(maxBytes)} MB`;
  return null;
}

async function attempt(fetchImage: ImageFetch, url: string, maxBytes: number): Promise<Attempt> {
  let res: Response | null;
  try {
    res = await fetchImage(url);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  if (!res) return { error: "redirected off the allowlist" };
  const reason = refusal(res, maxBytes);
  if (reason) {
    await res.body?.cancel().catch(() => undefined);
    return { error: reason };
  }
  const body = await readCapped(res, maxBytes);
  return body ? { buffer: Buffer.from(body) } : { error: `over ${megabytes(maxBytes)} MB` };
}

/** The file's bytes, straight from its host when they match its SHA-1, else through wsrv.nl. Throws with both reasons. */
export async function downloadWikiImage(
  image: ResolvedWikiImage,
  deps: DownloadDeps = {}
): Promise<{ buffer: Buffer; via: "direct" | "wsrv" }> {
  const maxBytes = deps.maxBytes ?? MAX_FLAG_BYTES;
  if (!/^https:\/\//i.test(image.url) || !isAllowedMediaUrl(image.url)) {
    throw new Error(`${image.url} is not an allowed wiki host`);
  }
  if (image.size > maxBytes) {
    throw new Error(`The file is larger than ${megabytes(maxBytes)} MB`);
  }
  const direct = await attempt(deps.direct ?? directFetch, image.url, maxBytes);
  if ("buffer" in direct && sha1Of(direct.buffer) === image.sha1) {
    return { buffer: direct.buffer, via: "direct" };
  }
  const directError = "error" in direct ? direct.error : "SHA-1 differs from the wiki's";
  const relayed = await attempt(deps.relay ?? relayFetch, image.url, maxBytes);
  if ("buffer" in relayed) return { buffer: relayed.buffer, via: "wsrv" };
  throw new Error(`direct: ${directError}; wsrv: ${relayed.error}`);
}

const RASTER_EXTENSIONS: Readonly<Record<string, string>> = {
  png: "png",
  jpeg: "jpg",
  gif: "gif",
  webp: "webp",
};

/** The file to store: a raster image as it came (with its extension), an SVG rasterized to a PNG. */
export async function toStoredImage(
  buffer: Buffer,
  maxPixels: number = MAX_FLAG_PIXELS
): Promise<{ ext: string; data: Buffer }> {
  const meta = await sharp(buffer, { limitInputPixels: maxPixels })
    .metadata()
    .catch(() => null);
  const format = meta?.format;
  if (format === "svg" && meta?.width) {
    const density = Math.min(2400, Math.max(1, (72 * SVG_RASTER_WIDTH) / meta.width));
    const data = await sharp(buffer, { density, limitInputPixels: maxPixels })
      .resize({ width: SVG_RASTER_WIDTH })
      .png()
      .toBuffer();
    return { ext: "png", data };
  }
  const ext = format ? RASTER_EXTENSIONS[format] : undefined;
  if (!ext) throw new Error(`The file is not an image a flag can be (${format ?? "unreadable"})`);
  return { ext, data: buffer };
}
