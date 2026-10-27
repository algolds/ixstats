/**
 * file-info.ts — `prop=imageinfo` and `list=allimages` (plan 411): the files WikiOS holds, from `wiki_assets`.
 *
 * Only the CURRENT version of a file is described: WikiOS keeps one row per file name, with the bytes of the
 * version that was uploaded last (older versions are entries of the upload log). The URL is the file's own: a
 * path on this site while only WikiOS has the bytes (`/api/wiki/file/<name>`), MediaWiki's `/images/` URL once the
 * mirror has sent them, always absolute. No thumbnails (`iiurlwidth`) and no metadata are made.
 */

import { takePage } from "../continuation";
import { ApiError, badContinue, badValue, mixedParams } from "../errors";
import { mwTimestamp, type JsonObject } from "../format";
import type { ApiParams } from "../params";
import type { FileRow } from "../store-types";
import type { ApiContext } from "../types";
import { directionParam } from "./list-common";
import { escapeHtml, fieldsOf, type PropContext } from "./prop-common";
import type { ListModule, ListResult } from "./query-list";
import { assetUrl } from "~/lib/base-path";
import { sha1Base36ToHex } from "~/lib/wiki-os/core/file-hash";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";

/** What `iiprop` and `aiprop` may name. The ones WikiOS has nothing for (`metadata`, `bitdepth`, ...) are accepted and add nothing. */
const FILE_PROPS = [
  "timestamp",
  "user",
  "userid",
  "comment",
  "parsedcomment",
  "canonicaltitle",
  "url",
  "size",
  "dimensions",
  "sha1",
  "mime",
  "thumbmime",
  "mediatype",
  "metadata",
  "commonmetadata",
  "extmetadata",
  "archivename",
  "bitdepth",
  "uploadwarning",
  "badfile",
] as const;
type FileProp = (typeof FILE_PROPS)[number];

const FILE_NAMESPACE = 6;
const SHA1_HEX = /^[0-9a-f]{40}$/i;
const SHA1_BASE36 = /^[0-9a-z]{1,31}$/i;
/** `iilimit` is the number of versions: only the current one is described, so a larger limit is noted. */
const MAX_VERSIONS = 500;

const underscored = (name: string) => name.replace(/ /g, "_");

/** MediaWiki's media types for the types an upload can be. */
function mediaType(mime: string): string {
  if (mime === "image/svg+xml") return "DRAWING";
  if (mime === "application/pdf") return "OFFICE";
  return mime.startsWith("image/") ? "BITMAP" : "UNKNOWN";
}

/** `url` as an absolute URL: one on this site gets the base path it is served under and the public origin. */
function absolute(url: string, siteUrl: string): string {
  const served = assetUrl(url) ?? url;
  if (/^https?:\/\//i.test(served)) return served;
  return served.startsWith("//") ? `https:${served}` : `${siteUrl}${served}`;
}

const descriptionUrl = (siteUrl: string, title: string) =>
  `${siteUrl}/wiki/${encodeURIComponent(title.replace(/ /g, "_")).replace(/%3A/g, ":")}`;

/** What `iiprop`/`aiprop` ask of one file, in MediaWiki's field names. */
export function fileFields(
  row: FileRow,
  props: ReadonlySet<FileProp>,
  siteUrl: string
): JsonObject {
  const fields: JsonObject = {};
  if (props.has("timestamp")) fields.timestamp = mwTimestamp(row.timestamp);
  if (props.has("user") && row.user !== null) fields.user = row.user;
  // WikiOS keeps no MediaWiki user id for an uploader.
  if (props.has("userid")) fields.userid = 0;
  if (props.has("comment")) fields.comment = row.comment ?? "";
  if (props.has("parsedcomment")) fields.parsedcomment = escapeHtml(row.comment ?? "");
  if (props.has("canonicaltitle")) fields.canonicaltitle = row.title;
  if (props.has("size") || props.has("dimensions")) {
    fields.size = row.size;
    fields.width = row.width;
    fields.height = row.height;
  }
  if (props.has("url")) {
    fields.url = absolute(row.url, siteUrl);
    fields.descriptionurl = descriptionUrl(siteUrl, row.title);
  }
  if (props.has("sha1")) fields.sha1 = row.sha1;
  if (props.has("mime")) fields.mime = row.mime;
  if (props.has("mediatype")) fields.mediatype = mediaType(row.mime);
  return fields;
}

/** `iiprop=...` entry of an upload's answer: every field WikiOS has. */
export function uploadImageInfo(row: FileRow, siteUrl: string): JsonObject {
  const all = new Set<FileProp>([
    "timestamp",
    "user",
    "comment",
    "url",
    "size",
    "sha1",
    "mime",
    "mediatype",
  ]);
  return fileFields(row, all, siteUrl);
}

// ---------------------------------------------------------------------------
// prop=imageinfo
// ---------------------------------------------------------------------------

export async function propImageInfo(pc: PropContext): Promise<void> {
  const { rc, pageSet } = pc;
  const p = rc.params.scope("ii", "imageinfo");
  const props = new Set<FileProp>(p.listOf("prop", FILE_PROPS, ["timestamp", "user"]));
  const versions = p.integer("limit", { fallback: 1, min: 1, max: MAX_VERSIONS });
  if (versions > 1)
    p.addWarning(
      "Only the current version of a file is listed: WikiOS keeps older versions in the upload log."
    );

  const entries = pageSet.entries.filter(
    (entry) =>
      entry.ns === FILE_NAMESPACE && (entry.state === "exists" || entry.state === "missing")
  );
  const rows = await rc.deps.store.filesByName(
    entries.map((entry) => canonicalizeTitle(entry.title)?.base ?? entry.title)
  );
  const byName = new Map(rows.map((row) => [row.title, row]));
  for (const entry of entries) {
    const row = byName.get(entry.title);
    const fields = fieldsOf(pc, entry);
    fields.imagerepository = row ? "local" : "";
    if (row) fields.imageinfo = [fileFields(row, props, rc.deps.siteUrl)];
  }
}

// ---------------------------------------------------------------------------
// list=allimages
// ---------------------------------------------------------------------------

/** A file name as a bot writes it (underscores, any first letter) as the canonical name without `File:`; null when it is no file name. */
function fileNameOf(raw: string): string | null {
  const canon = canonicalizeTitle(`File:${raw}`);
  return canon?.namespaceId === FILE_NAMESPACE ? canon.base : null;
}

/** `aisha1` (40 hex digits) or `aisha1base36`, as hex; undefined when neither is given. */
function sha1Filter(p: ApiParams): string | undefined {
  const hex = p.string("sha1");
  const base36 = p.string("sha1base36");
  if (hex !== undefined && base36 !== undefined)
    throw mixedParams([p.fullName("sha1"), p.fullName("sha1base36")]);
  if (hex !== undefined) {
    if (!SHA1_HEX.test(hex)) throw badValue(p.fullName("sha1"), hex);
    return hex.toLowerCase();
  }
  if (base36 === undefined) return undefined;
  if (!SHA1_BASE36.test(base36)) throw badValue(p.fullName("sha1base36"), base36);
  return sha1Base36ToHex(base36.toLowerCase());
}

async function runAllImages(rc: ApiContext, p: ApiParams): Promise<ListResult> {
  const props = new Set<FileProp>(p.listOf("prop", FILE_PROPS, ["timestamp", "url"]));
  const limit = p.limit("limit", { fallback: 10, high: rc.highLimits });
  const dir = directionParam(p, ["ascending", "descending", "newer", "older"], "ascending");
  p.oneOf("sort", ["name"], "name");
  const continueName = p.string("continue");
  const from = p.string("from");
  const to = p.string("to");
  const prefix = p.string("prefix");
  const mimes = p.list("mime");
  const minSize = p.optionalInteger("minsize", 0);
  const maxSize = p.optionalInteger("maxsize", 0);
  const sha1 = sha1Filter(p);

  const start =
    continueName !== undefined
      ? fileNameOf(continueName)
      : from === undefined
        ? undefined
        : fileNameOf(from);
  if (continueName !== undefined && start === null) throw badContinue();
  const end = to === undefined ? undefined : fileNameOf(to);
  if (to !== undefined && end === null) throw new ApiError("invalidtitle", `Bad title "${to}".`);

  const rows = await rc.deps.store.listFiles({
    prefix: prefix ? underscored(prefix) : undefined,
    start: start ? underscored(start) : undefined,
    end: end ? underscored(end) : undefined,
    dir,
    limit,
    sha1,
    mimes: mimes.length > 0 ? mimes : undefined,
    minSize,
    maxSize,
  });
  const { page, more } = takePage(rows, limit);
  const next = more ? rows[limit] : undefined;
  return {
    items: page.map((row) => ({
      name: underscored(row.name),
      title: row.title,
      ...fileFields(row, props, rc.deps.siteUrl),
    })),
    next: next ? underscored(next.name) : null,
  };
}

export const allImages: ListModule = {
  prefix: "ai",
  resultKey: "allimages",
  generator: false,
  run: runAllImages,
};
