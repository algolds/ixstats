/**
 * A wiki file's facts from `prop=imageinfo` (formatversion 2): its original URL, size, type, SHA-1, description
 * page, a thumbnail, and its licence and author from `extmetadata`. Used by world discovery's map candidates, the
 * infobox hints export and the original-file fetch. Pure parsing plus one batched read through a WikiQuery.
 */
import { z } from "zod";
import { withBasePath } from "~/lib/base-path";
import { sisterWikiFileHosts, SISTER_WIKI_HOSTS } from "~/lib/wiki-os/wiki-hosts";
import { normalizeWikiTitle, type RealmWikiSource } from "~/lib/realms/realm-wiki-settings";
import type { WikiQuery } from "~/lib/realms/lore-import";

export interface WikiFileInfo {
  /** "File:Eurth political map.png" */
  fileTitle: string;
  /** The original file. */
  url: string;
  /** The file's page on its wiki. */
  descriptionUrl: string | null;
  /** A thumbnail through this app's media proxy (never a third-party URL a browser would load directly). */
  thumbUrl: string | null;
  width: number;
  height: number;
  /** Bytes. */
  size: number;
  mime: string;
  sha1: string;
  licence: string | null;
  licenceUrl: string | null;
  artist: string | null;
  credit: string | null;
  /** The credit line to show with the map: the file's own Attribution field, else author, licence and wiki. */
  attribution: string;
}

/** The extmetadata fields asked for; everything else MediaWiki knows about the file is left out. */
export const EXTMETADATA_FIELDS = [
  "LicenseShortName",
  "UsageTerms",
  "LicenseUrl",
  "Artist",
  "Credit",
  "Attribution",
  "AttributionRequired",
] as const;

const MetaValue = z.object({ value: z.unknown() }).partial().passthrough();

const ImageInfoSchema = z.object({
  url: z.string(),
  descriptionurl: z.string().optional(),
  thumburl: z.string().optional(),
  width: z.number(),
  height: z.number(),
  size: z.number(),
  mime: z.string().optional(),
  sha1: z.string().optional(),
  extmetadata: z.record(z.string(), MetaValue).optional(),
});

export const ImageInfoResponseSchema = z.object({
  query: z
    .object({
      normalized: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
      pages: z.array(
        z.object({
          title: z.string(),
          missing: z.boolean().optional(),
          invalid: z.boolean().optional(),
          imageinfo: z.array(ImageInfoSchema).optional(),
        })
      ),
    })
    .optional(),
});
export type ImageInfoResponse = z.infer<typeof ImageInfoResponseSchema>;

/** Plain text from an extmetadata value, which is HTML (an author is usually a link to their user page). */
export function metadataText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 300) : null;
}

/** An https URL, or null. */
function httpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, "https://relative.invalid");
    return url.protocol === "https:" && url.hostname !== "relative.invalid" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * A browser-safe path for a file URL of the wiki: the wiki's own `/images/...` path through the media proxy
 * (`/api/mediawiki/<wiki>/images/...`), else the file by name (`Special:FilePath`), which the proxy resolves.
 */
export function proxiedFileUrl(source: RealmWikiSource, url: string | null, fileTitle: string): string {
  const host = SISTER_WIKI_HOSTS[source];
  const origin = new URL(host.origin);
  if (url) {
    try {
      const parsed = new URL(url, host.origin);
      if (parsed.hostname === origin.hostname && parsed.pathname.startsWith("/images/") && !parsed.search) {
        return withBasePath(`/api/mediawiki/${source}${parsed.pathname}`);
      }
    } catch {
      // fall through to the file name
    }
  }
  const name = fileTitle.replace(/^File:/, "").replace(/ /g, "_");
  return withBasePath(`/api/mediawiki/${source}/wiki/Special:FilePath/${encodeURIComponent(name)}`);
}

/** The credit line: the file's own Attribution field, else "<author>, <licence>, via <wiki>". */
export function attributionLine(
  source: RealmWikiSource,
  fileTitle: string,
  meta: { attribution: string | null; artist: string | null; licence: string | null }
): string {
  if (meta.attribution) return meta.attribution;
  const name = fileTitle.replace(/^File:/, "");
  const parts = [meta.artist ? `${name} by ${meta.artist}` : name, meta.licence].filter(Boolean);
  return `${parts.join(", ")}, via ${SISTER_WIKI_HOSTS[source].name}`;
}

/** The files of an imageinfo response, by their (normalized) title. Missing files and bad URLs are left out. */
export function parseImageInfo(source: RealmWikiSource, data: ImageInfoResponse): Map<string, WikiFileInfo> {
  const files = new Map<string, WikiFileInfo>();
  const hosts = new Set(sisterWikiFileHosts(SISTER_WIKI_HOSTS[source]));
  for (const page of data.query?.pages ?? []) {
    const info = page.imageinfo?.[0];
    if (page.missing || page.invalid || !info) continue;
    const url = httpsUrl(info.url);
    // A file is only ever fetched from its own wiki or that wiki's upload CDN.
    if (!url || !hosts.has(new URL(url).hostname)) continue;
    const meta = info.extmetadata ?? {};
    const licence = metadataText(meta.LicenseShortName?.value) ?? metadataText(meta.UsageTerms?.value);
    const artist = metadataText(meta.Artist?.value);
    const attribution = metadataText(meta.Attribution?.value);
    files.set(page.title, {
      fileTitle: page.title,
      url,
      descriptionUrl: httpsUrl(info.descriptionurl),
      thumbUrl: info.thumburl ? proxiedFileUrl(source, httpsUrl(info.thumburl), page.title) : null,
      width: info.width,
      height: info.height,
      size: info.size,
      mime: (info.mime ?? "").toLowerCase(),
      sha1: (info.sha1 ?? "").toLowerCase(),
      licence,
      licenceUrl: httpsUrl(metadataText(meta.LicenseUrl?.value)),
      artist,
      credit: metadataText(meta.Credit?.value),
      attribution: attributionLine(source, page.title, { attribution, artist, licence }),
    });
  }
  return files;
}

const IMAGEINFO_BATCH = 50;

/** `File:` spelling of a file name ("Map.png", "Image:Map.png" and "File:Map.png" are one file). */
export function asFileTitle(name: string): string {
  return `File:${normalizeWikiTitle(name.replace(/^(?:file|image)\s*:\s*/i, ""))}`;
}

/**
 * Imageinfo for files, 50 a request, each with a thumbnail `thumbWidth` wide. Results are keyed by the `File:`
 * title asked for. Partial results stay in `into` when the client stops part-way.
 */
export async function fetchWikiFileInfo(
  source: RealmWikiSource,
  query: WikiQuery,
  names: string[],
  into: Map<string, WikiFileInfo> = new Map(),
  thumbWidth = 320
): Promise<Map<string, WikiFileInfo>> {
  const titles = [...new Set(names.map(asFileTitle))].filter((title) => !into.has(title));
  for (let i = 0; i < titles.length; i += IMAGEINFO_BATCH) {
    const batch = titles.slice(i, i + IMAGEINFO_BATCH);
    const data = await query(
      {
        prop: "imageinfo",
        iiprop: "url|size|mime|sha1|extmetadata",
        iiextmetadatafilter: EXTMETADATA_FIELDS.join("|"),
        iiurlwidth: String(thumbWidth),
        titles: batch.join("|"),
      },
      ImageInfoResponseSchema
    );
    const renamed = new Map((data.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const [title, file] of parseImageInfo(source, data)) {
      const asked = renamed.get(title);
      into.set(asked && batch.includes(asked) ? asked : title, file);
    }
  }
  return into;
}
