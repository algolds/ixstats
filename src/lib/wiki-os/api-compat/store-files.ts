/**
 * store-files.ts — the file queries of the Prisma `ApiStore` (plan 411): `prop=imageinfo` and `list=allimages` read
 * `wiki_assets` (the facts of the current version), the `File:` page (its id) and the upload log (who and when).
 * Read-only, like the rest of the store (see store.ts). A file whose `File:` page WikiOS deleted does not exist to api.php.
 */

import type { Prisma, WikiAsset } from "@prisma/client";
import { db } from "~/server/db";
import { archivedTitlesAmong } from "~/lib/wiki-os/core/archived-titles";
import { sha1Base36ToHex } from "~/lib/wiki-os/core/file-hash";
import { sha1HexToBase36 } from "~/lib/wiki-os/xml/sha1";
import type { FileListQuery, FileRow } from "./store-types";

const SOURCE = "ixwiki";
/** Rows read for a page of a listing that has to skip deleted files, at most this many times over. */
const MAX_BATCHES = 10;

const underscored = (name: string) => name.replace(/ /g, "_");

/** A file's current version as the log of its uploads remembers it. */
interface UploadFact {
  user: string;
  comment: string | null;
  at: Date;
}

/** The newest upload log entry of each of `titles`. */
async function latestUploads(titles: readonly string[]): Promise<Map<string, UploadFact>> {
  if (titles.length === 0) return new Map();
  const logs = await db.wikiLog.findMany({
    where: { logType: "upload", title: { in: [...titles] } },
    orderBy: { createdAt: "desc" },
    select: { title: true, actorName: true, comment: true, createdAt: true },
  });
  const latest = new Map<string, UploadFact>();
  for (const log of logs) {
    if (!latest.has(log.title)) {
      latest.set(log.title, { user: log.actorName, comment: log.comment, at: log.createdAt });
    }
  }
  return latest;
}

/** The ids of the live `File:` pages among `titles`. */
async function pageIds(titles: readonly string[]): Promise<Map<string, number>> {
  if (titles.length === 0) return new Map();
  const pages = await db.wikiArticle.findMany({
    where: { source: SOURCE, status: { not: "ARCHIVED" }, title: { in: [...titles] } },
    select: { title: true, pageId: true },
  });
  return new Map(
    pages.flatMap((page) => (page.pageId === null ? [] : [[page.title, page.pageId] as const]))
  );
}

/** The assets as `FileRow`s, those whose `File:` page was deleted left out (and the order kept). */
async function toFileRows(assets: readonly WikiAsset[]): Promise<FileRow[]> {
  const titles = assets.map((asset) => `File:${asset.title}`);
  const [hidden, ids, uploads] = await Promise.all([
    archivedTitlesAmong(titles),
    pageIds(titles),
    latestUploads(titles),
  ]);
  return assets
    .filter((asset) => !hidden.has(`File:${asset.title}`))
    .map((asset) => {
      const title = `File:${asset.title}`;
      const upload = uploads.get(title);
      return {
        name: asset.title,
        title,
        pageId: ids.get(title) ?? 0,
        url: asset.url,
        size: asset.sizeBytes,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
        mime: asset.mimeType,
        sha1: asset.sha1 ? sha1Base36ToHex(asset.sha1) : "",
        timestamp: upload?.at ?? asset.updatedAt,
        user: upload?.user ?? null,
        comment: upload?.comment ?? null,
      };
    });
}

export async function filesByName(names: readonly string[]): Promise<FileRow[]> {
  if (names.length === 0) return [];
  const assets = await db.wikiAsset.findMany({
    where: { filename: { in: names.map(underscored) } },
  });
  return toFileRows(assets);
}

/** The name bounds of one batch: from `from` (inclusive for the first batch, exclusive after it) to the query's end, with its prefix. */
function nameBounds(
  query: FileListQuery,
  from: string | undefined,
  inclusive: boolean
): Prisma.StringFilter {
  const ascending = query.dir === "ascending";
  const bounds: Prisma.StringFilter = query.prefix ? { startsWith: query.prefix } : {};
  if (ascending) {
    if (from) bounds[inclusive ? "gte" : "gt"] = from;
    if (query.end) bounds.lte = query.end;
  } else {
    if (from) bounds[inclusive ? "lte" : "lt"] = from;
    if (query.end) bounds.gte = query.end;
  }
  return bounds;
}

function listWhere(
  query: FileListQuery,
  from: string | undefined,
  inclusive: boolean
): Prisma.WikiAssetWhereInput {
  const size: Prisma.IntFilter = {};
  if (query.minSize !== undefined) size.gte = query.minSize;
  if (query.maxSize !== undefined) size.lte = query.maxSize;
  return {
    filename: nameBounds(query, from, inclusive),
    ...(query.mimes ? { mimeType: { in: [...query.mimes] } } : {}),
    ...(query.sha1 ? { sha1: sha1HexToBase36(query.sha1) } : {}),
    ...(Object.keys(size).length > 0 ? { sizeBytes: size } : {}),
  };
}

export async function listFiles(query: FileListQuery): Promise<FileRow[]> {
  const found: FileRow[] = [];
  let from = query.start;
  let inclusive = true;
  for (let batch = 0; batch < MAX_BATCHES && found.length <= query.limit; batch++) {
    const assets = await db.wikiAsset.findMany({
      where: listWhere(query, from, inclusive),
      orderBy: { filename: query.dir === "ascending" ? "asc" : "desc" },
      take: query.limit + 1,
    });
    found.push(...(await toFileRows(assets)));
    if (assets.length < query.limit + 1) break;
    from = assets.at(-1)?.filename;
    inclusive = false;
  }
  return found.slice(0, query.limit + 1);
}
