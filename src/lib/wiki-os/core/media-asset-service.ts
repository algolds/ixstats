/**
 * media-asset-service.ts — WikiOS Native Media & Asset Engine
 *
 * Canonical service for resolving, registering, and querying media assets
 * directly from PostgreSQL `wiki_assets` with MD5 shard path computation.
 */

import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import crypto from "crypto";
import { mediaWikiOrigin, STAGED_FILE_PATH } from "../config";
import { CategoryService } from "./category-service";
import { withoutArchivedFiles } from "./archived-titles";

/** Files of a category looked at when a search is limited to it: more than any category page lists at once. */
const MAX_CATEGORY_FILES = 1_000;
/** Assets read per query while a search skips files whose page was deleted (one archived-title lookup per batch). */
const SEARCH_BATCH = 50;
/** Assets looked at, at most, to fill a page of results while skipping files whose page was deleted: 10 batches. */
const MAX_SEARCH_SCAN = 500;

export interface MediaAssetRecord {
  id: string;
  title: string;
  slug: string;
  filename: string;
  url: string;
  thumbnailUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  md5Hash: string;
  /** The content's hash (base 36); null for an asset that was registered from MediaWiki's files, never uploaded here. */
  sha1: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The facts of an uploaded file that `recordUpload` stores (the name is canonical, without `File:`). */
export interface RecordUploadInput {
  name: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  sha1: string;
  uploaderId: string | null;
}

export interface RegisterAssetInput {
  filename: string;
  title?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number | null;
  height?: number | null;
  blurhash?: string | null;
  originBaseUrl?: string;
  url?: string;
  thumbnailUrl?: string;
}

export class MediaAssetService {
  /**
   * Calculate standard MediaWiki MD5 shard path
   * e.g. "Caphiria_flag.svg" -> shard "8/8c", path "8/8c/Caphiria_flag.svg"
   */
  static getMd5ShardPath(filename: string): {
    shard: string;
    fullPath: string;
    hash: string;
    cleanName: string;
  } {
    const cleanName = filename.replace(/^(?:File|Image):/i, "").replace(/ /g, "_");
    const hash = crypto.createHash("md5").update(cleanName).digest("hex");
    const shard = `${hash[0]}/${hash.slice(0, 2)}`;
    return {
      shard,
      fullPath: `${shard}/${encodeURIComponent(cleanName)}`,
      hash,
      cleanName,
    };
  }

  /**
   * Resolve an asset from PostgreSQL `wiki_assets` by filename or slug (<1ms)
   */
  static async findAsset(filenameOrSlug: string): Promise<MediaAssetRecord | null> {
    const clean = filenameOrSlug
      .replace(/^(?:File|Image):/i, "")
      .replace(/ /g, "_")
      .trim();
    if (!clean) return null;

    const slug = clean.toLowerCase();
    const { hash } = this.getMd5ShardPath(clean);

    try {
      const asset = await db.wikiAsset.findFirst({
        where: {
          OR: [
            { md5Hash: hash },
            { filename: clean },
            { slug },
            { title: clean.replace(/_/g, " ") },
          ],
        },
      });

      return (asset as MediaAssetRecord) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Batch resolve multiple asset records by filenames
   */
  static async findAssets(filenames: string[]): Promise<Map<string, MediaAssetRecord>> {
    const map = new Map<string, MediaAssetRecord>();
    if (!filenames || filenames.length === 0) return map;

    const cleanNames = filenames
      .map((f) =>
        f
          .replace(/^(?:File|Image):/i, "")
          .replace(/ /g, "_")
          .trim()
      )
      .filter(Boolean);
    const hashes = cleanNames.map((n) => this.getMd5ShardPath(n).hash);

    try {
      const assets = await db.wikiAsset.findMany({
        where: {
          OR: [{ filename: { in: cleanNames } }, { md5Hash: { in: hashes } }],
        },
      });

      for (const asset of assets) {
        const record = asset as MediaAssetRecord;
        map.set(asset.filename, record);
        map.set(asset.filename.toLowerCase(), record);
        map.set(asset.slug, record);
        map.set(asset.md5Hash, record);
      }
    } catch (err) {
      console.error("[MediaAssetService] Batch find failed:", err);
    }

    return map;
  }

  /**
   * Assets by name: those whose title or file name contains `query`, of the given MIME types, and (when
   * `category` is given) only the files that category lists. Alphabetical by title. An asset whose `File:`
   * page WikiOS deleted is not listed (the search reads on past it, so a full page of `limit` comes back).
   */
  static async search({
    query,
    category,
    fileTypes,
    limit,
  }: {
    query?: string;
    category?: string;
    fileTypes?: readonly string[];
    limit: number;
  }): Promise<MediaAssetRecord[]> {
    const where: Prisma.WikiAssetWhereInput = {};
    const term = query?.trim();
    if (term) {
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { filename: { contains: term, mode: "insensitive" } },
      ];
    }
    if (fileTypes && fileTypes.length > 0) where.mimeType = { in: [...fileTypes] };
    if (category) {
      const titles = await CategoryService.getMemberTitles(category, ["file"], MAX_CATEGORY_FILES);
      const names = titles.map((title) => title.replace(/^File:/i, ""));
      where.AND = [
        {
          OR: [
            { title: { in: names } },
            { filename: { in: names.map((name) => name.replace(/ /g, "_")) } },
          ],
        },
      ];
    }

    // Fixed batches of SEARCH_BATCH, so the work is bounded whatever `limit` is (at most MAX_SEARCH_SCAN /
    // SEARCH_BATCH batches). `id` breaks ties between assets that share a title, so `skip` never repeats or
    // drops a row between one batch and the next.
    const found: MediaAssetRecord[] = [];
    for (let skip = 0; found.length < limit && skip < MAX_SEARCH_SCAN; skip += SEARCH_BATCH) {
      const batch = await db.wikiAsset.findMany({
        where,
        take: SEARCH_BATCH,
        skip,
        orderBy: [{ title: "asc" }, { id: "asc" }],
      });
      const visible = new Set(await withoutArchivedFiles(batch.map((asset) => asset.title)));
      found.push(...(batch.filter((asset) => visible.has(asset.title)) as MediaAssetRecord[]));
      if (batch.length < SEARCH_BATCH) break;
    }
    return found.slice(0, limit);
  }

  /** The asset of the file called `name` (canonical, with or without `File:`), by its name only; null when there is none. */
  static async findByFileName(
    name: string,
    client: Pick<Prisma.TransactionClient, "wikiAsset"> = db
  ): Promise<MediaAssetRecord | null> {
    const { hash, cleanName } = this.getMd5ShardPath(name);
    return (await client.wikiAsset.findFirst({
      where: { OR: [{ md5Hash: hash }, { filename: cleanName }] },
    })) as MediaAssetRecord | null;
  }

  /** The assets that hold the content `sha1` under another name than `name`: what MediaWiki's "duplicate" warning lists. */
  static async findDuplicates(sha1: string, name: string): Promise<string[]> {
    const { cleanName } = this.getMd5ShardPath(name);
    const rows = await db.wikiAsset.findMany({
      where: { sha1, filename: { not: cleanName } },
      select: { title: true },
      orderBy: { title: "asc" },
      take: 10,
    });
    return rows.map((row) => row.title);
  }

  /**
   * Record that `input.name` now holds the uploaded bytes, in the caller's transaction (the upload service writes
   * the file's log entry and its mirror job there too). The asset is served from WikiOS (`/api/wiki/file/<name>`, no
   * thumbnail) until the mirror job has put the same bytes in MediaWiki: `markMirrored` then switches the URL. A new
   * version of a file replaces the row's facts in place; the older versions live in the upload log.
   */
  static async recordUpload(
    tx: Prisma.TransactionClient,
    input: RecordUploadInput
  ): Promise<MediaAssetRecord> {
    const { hash, cleanName } = this.getMd5ShardPath(input.name);
    const facts = {
      title: cleanName.replace(/_/g, " "),
      filename: cleanName,
      url: `${STAGED_FILE_PATH}${encodeURIComponent(cleanName)}`,
      thumbnailUrl: null,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      width: input.width,
      height: input.height,
      blurhash: null,
      sha1: input.sha1,
      uploaderId: input.uploaderId,
    };
    const existing = await this.findByFileName(cleanName, tx);
    if (existing) {
      return (await tx.wikiAsset.update({
        where: { id: existing.id },
        data: facts,
      })) as MediaAssetRecord;
    }
    const slug = await this.freeSlug(tx, cleanName, hash);
    return (await tx.wikiAsset.create({
      data: { ...facts, slug, md5Hash: hash },
    })) as MediaAssetRecord;
  }

  /** The lower-case file name as the asset's slug, or with a hash prefix before the extension when another file's name took it. */
  private static async freeSlug(
    tx: Prisma.TransactionClient,
    cleanName: string,
    hash: string
  ): Promise<string> {
    const slug = cleanName.toLowerCase();
    if (!(await tx.wikiAsset.findUnique({ where: { slug }, select: { id: true } }))) return slug;
    const dot = cleanName.lastIndexOf(".");
    const base = dot === -1 ? cleanName : cleanName.slice(0, dot);
    const extension = dot === -1 ? "" : cleanName.slice(dot);
    return `${base.toLowerCase()}_${hash.slice(0, 6)}${extension.toLowerCase()}`;
  }

  /**
   * MediaWiki holds the version `sha1` of the file `name`: the asset is served from its `/images/` path now. Nothing
   * changes when the asset has moved on to a newer version (that one is still waiting for its own job); resolves to
   * whether the row was switched.
   */
  static async markMirrored(
    name: string,
    sha1: string,
    client: Pick<Prisma.TransactionClient, "wikiAsset"> = db
  ): Promise<boolean> {
    const { shard, cleanName } = this.getMd5ShardPath(name);
    const base = mediaWikiOrigin().replace(/\/+$/, "");
    const { count } = await client.wikiAsset.updateMany({
      where: { filename: cleanName, sha1 },
      data: { url: `${base}/images/${shard}/${encodeURIComponent(cleanName)}`, thumbnailUrl: null },
    });
    return count > 0;
  }

  /** Whether WikiOS alone holds the bytes behind `url` (an asset URL): they are served from the staging directory. */
  static isStagedUrl(url: string): boolean {
    return url.startsWith(STAGED_FILE_PATH);
  }

  /** Whether an asset still waits to be mirrored with the content `sha1`: its staged copy must be kept. */
  static async isStillStaged(
    sha1: string,
    client: Pick<Prisma.TransactionClient, "wikiAsset"> = db
  ): Promise<boolean> {
    const count = await client.wikiAsset.count({
      where: { sha1, url: { startsWith: STAGED_FILE_PATH } },
    });
    return count > 0;
  }

  /**
   * Register or update a media asset in PostgreSQL `wiki_assets`
   */
  static async registerAsset(data: RegisterAssetInput): Promise<MediaAssetRecord> {
    // oxlint-disable-next-line typescript/no-unused-vars
    const { shard, fullPath, hash, cleanName } = this.getMd5ShardPath(data.filename);
    const title = data.title || cleanName.replace(/_/g, " ");
    let slug = cleanName.toLowerCase();

    const baseUrl = (data.originBaseUrl || mediaWikiOrigin()).replace(/\/+$/, "");
    const canonicalUrl = data.url || `${baseUrl}/images/${fullPath}`;
    const canonicalThumb =
      data.thumbnailUrl ||
      `${baseUrl}/images/thumb/${fullPath}/300px-${encodeURIComponent(cleanName)}`;

    try {
      // 1. Check if asset already exists by md5Hash
      const existingByHash = await db.wikiAsset.findUnique({
        where: { md5Hash: hash },
      });

      if (existingByHash) {
        return (await db.wikiAsset.update({
          where: { id: existingByHash.id },
          data: {
            title,
            filename: cleanName,
            url: canonicalUrl,
            thumbnailUrl: canonicalThumb,
            mimeType: data.mimeType || existingByHash.mimeType,
            sizeBytes: data.sizeBytes || existingByHash.sizeBytes,
            width: data.width ?? existingByHash.width,
            height: data.height ?? existingByHash.height,
            blurhash: data.blurhash ?? existingByHash.blurhash,
          },
        })) as MediaAssetRecord;
      }

      // 2. Check if an asset exists by slug
      const existingBySlug = await db.wikiAsset.findUnique({
        where: { slug },
      });

      if (existingBySlug) {
        // If it's the exact same filename, this is an updated version of the file
        if (existingBySlug.filename.toLowerCase() === cleanName.toLowerCase()) {
          return (await db.wikiAsset.update({
            where: { id: existingBySlug.id },
            data: {
              title,
              filename: cleanName,
              md5Hash: hash,
              url: canonicalUrl,
              thumbnailUrl: canonicalThumb,
              mimeType: data.mimeType || existingBySlug.mimeType,
              sizeBytes: data.sizeBytes || existingBySlug.sizeBytes,
              width: data.width ?? existingBySlug.width,
              height: data.height ?? existingBySlug.height,
              blurhash: data.blurhash ?? existingBySlug.blurhash,
            },
          })) as MediaAssetRecord;
        }

        // Different file name that collided on slug — disambiguate slug with hash prefix
        const dotIndex = cleanName.lastIndexOf(".");
        const baseName = dotIndex !== -1 ? cleanName.slice(0, dotIndex) : cleanName;
        const ext = dotIndex !== -1 ? cleanName.slice(dotIndex) : "";
        slug = `${baseName.toLowerCase()}_${hash.slice(0, 6)}${ext.toLowerCase()}`;
      }

      // 3. Create new record
      return (await db.wikiAsset.create({
        data: {
          title,
          slug,
          filename: cleanName,
          url: canonicalUrl,
          thumbnailUrl: canonicalThumb,
          mimeType: data.mimeType || "image/jpeg",
          sizeBytes: data.sizeBytes || 0,
          width: data.width ?? null,
          height: data.height ?? null,
          // No pixel was read here: a blurhash made up from the name would be a wrong picture, so readers use their placeholder.
          blurhash: data.blurhash ?? null,
          md5Hash: hash,
        },
      })) as MediaAssetRecord;
    } catch (err: unknown) {
      // Fallback: in case of race conditions, try safe update
      const fallback = await db.wikiAsset.findFirst({
        where: { OR: [{ md5Hash: hash }, { filename: cleanName }] },
      });
      if (fallback) {
        return fallback as MediaAssetRecord;
      }
      throw err;
    }
  }
}
