/**
 * A wiki file's facts from `prop=imageinfo` (formatversion 2): its original URL, size, type, SHA-1, description
 * page, a thumbnail, and its licence and author from `extmetadata`. Used by world discovery's map candidates, the
 * infobox hints export, the original-file fetch and card art licences. Pure parsing plus one batched read through a
 * WikiQuery.
 */
import { z } from "zod";
import { withBasePath } from "~/lib/base-path";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
import {
  sisterWikiFileHosts,
  SISTER_WIKI_HOSTS,
  type SisterWikiId,
} from "~/lib/wiki-os/wiki-hosts";
import { normalizeWikiTitle } from "~/lib/realms/realm-wiki-settings";
import type { WikiQuery } from "~/lib/realms/lore-import";

/** A wiki whose files can be read: IxWiki or any sister wiki (Commons included). */
export type FileWiki = "ixwiki" | SisterWikiId;

/** Where Commons serves its files. IxWiki shows Commons files too (InstantCommons), from these hosts. */
const COMMONS_FILE_HOSTS = sisterWikiFileHosts(SISTER_WIKI_HOSTS.commons);

/** A file wiki's name and the hosts its file URLs may point at. */
function fileWiki(source: FileWiki): { name: string; hosts: Set<string> } {
  if (source === "ixwiki") {
    return {
      name: "IxWiki",
      hosts: new Set([new URL(mediaWikiOrigin()).hostname, ...COMMONS_FILE_HOSTS]),
    };
  }
  return {
    name: SISTER_WIKI_HOSTS[source].name,
    hosts: new Set(sisterWikiFileHosts(SISTER_WIKI_HOSTS[source])),
  };
}

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
  // IxWiki and Fandom may answer an empty array for a file with none (PHP's empty array).
  extmetadata: z
    .union([
      z.record(z.string(), MetaValue),
      z.tuple([]).transform((): Record<string, z.infer<typeof MetaValue>> => ({})),
    ])
    .optional(),
});

export const ImageInfoResponseSchema = z.object({
  query: z
    .object({
      normalized: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
      pages: z.array(
        z.object({
          title: z.string(),
          missing: z.boolean().optional(),
          /** A file of a foreign repository (IxWiki's InstantCommons): no local page, so `missing`, yet known. */
          known: z.boolean().optional(),
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
 * A file's URL and the wiki holding it, or null when the URL is not https or not on the wiki or its upload CDN (a
 * file is only ever fetched from there). A Commons file IxWiki shows is held by Commons: credited to it, with its
 * thumbnail through the Commons proxy.
 */
function servedFile(
  source: FileWiki,
  hosts: Set<string>,
  value: string
): { url: string; holder: FileWiki } | null {
  const https = httpsUrl(value);
  if (!https) return null;
  const url = new URL(https);
  if (!hosts.has(url.hostname)) return null;
  // Commons adds a tracking query (`?utm_source=...`), which is not part of the file.
  const tracking = [...url.searchParams.keys()].filter((key) => key.startsWith("utm_"));
  for (const key of tracking) url.searchParams.delete(key);
  return {
    url: url.toString(),
    holder: COMMONS_FILE_HOSTS.includes(url.hostname) ? "commons" : source,
  };
}

/**
 * A browser-safe path for a file URL of the wiki: the wiki's own `/images/...` path through the media proxy
 * (`/api/mediawiki/<wiki>/images/...`), else the file by name (`Special:FilePath`), which the proxy resolves.
 */
export function proxiedFileUrl(
  source: SisterWikiId,
  url: string | null,
  fileTitle: string
): string {
  const host = SISTER_WIKI_HOSTS[source];
  const origin = new URL(host.origin);
  if (url) {
    try {
      const parsed = new URL(url, host.origin);
      if (
        parsed.hostname === origin.hostname &&
        parsed.pathname.startsWith("/images/") &&
        !parsed.search
      ) {
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
  source: FileWiki,
  fileTitle: string,
  meta: { attribution: string | null; artist: string | null; licence: string | null }
): string {
  if (meta.attribution) return meta.attribution;
  const name = fileTitle.replace(/^File:/, "");
  const parts = [meta.artist ? `${name} by ${meta.artist}` : name, meta.licence].filter(Boolean);
  return `${parts.join(", ")}, via ${fileWiki(source).name}`;
}

/** The files of an imageinfo response, by their (normalized) title. Missing files and bad URLs are left out. */
export function parseImageInfo(
  source: FileWiki,
  data: ImageInfoResponse
): Map<string, WikiFileInfo> {
  const files = new Map<string, WikiFileInfo>();
  const { hosts } = fileWiki(source);
  for (const page of data.query?.pages ?? []) {
    const info = page.imageinfo?.[0];
    if ((page.missing && !page.known) || page.invalid || !info) continue;
    const served = servedFile(source, hosts, info.url);
    if (!served) continue;
    const { url, holder } = served;
    const meta = info.extmetadata ?? {};
    const licence =
      metadataText(meta.LicenseShortName?.value) ?? metadataText(meta.UsageTerms?.value);
    const artist = metadataText(meta.Artist?.value);
    const attribution = metadataText(meta.Attribution?.value);
    files.set(page.title, {
      fileTitle: page.title,
      url,
      descriptionUrl: httpsUrl(info.descriptionurl),
      thumbUrl:
        holder !== "ixwiki" && info.thumburl
          ? proxiedFileUrl(holder, httpsUrl(info.thumburl), page.title)
          : null,
      width: info.width,
      height: info.height,
      size: info.size,
      mime: (info.mime ?? "").toLowerCase(),
      sha1: (info.sha1 ?? "").toLowerCase(),
      licence,
      licenceUrl: httpsUrl(metadataText(meta.LicenseUrl?.value)),
      artist,
      credit: metadataText(meta.Credit?.value),
      attribution: attributionLine(holder, page.title, { attribution, artist, licence }),
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
  source: FileWiki,
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
