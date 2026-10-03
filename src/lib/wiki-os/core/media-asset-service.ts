/**
 * Resolves, registers and queries media assets in PostgreSQL `wiki_assets`, with MD5 shard path
 * computation.
 */

import { db } from "~/server/db";
import crypto from "crypto";
import { DEFAULT_MEDIAWIKI_URL } from "../config";
import { BlurHashService } from "./blurhash-service";

interface MediaAssetRecord {
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
  createdAt: Date;
  updatedAt: Date;
}

interface RegisterAssetInput {
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
   * Register or update a media asset in PostgreSQL `wiki_assets`
   */
  static async registerAsset(data: RegisterAssetInput): Promise<MediaAssetRecord> {
    const { fullPath, hash, cleanName } = this.getMd5ShardPath(data.filename);
    const title = data.title || cleanName.replace(/_/g, " ");
    let slug = cleanName.toLowerCase();

    const baseUrl = (data.originBaseUrl || DEFAULT_MEDIAWIKI_URL).replace(/\/+$/, "");
    const canonicalUrl = data.url || `${baseUrl}/images/${fullPath}`;
    const canonicalThumb =
      data.thumbnailUrl ||
      `${baseUrl}/images/thumb/${fullPath}/300px-${encodeURIComponent(cleanName)}`;

    // Fields for refreshing an existing record: input values win, stored values fill the gaps.
    const refreshFields = (existing: MediaAssetRecord) => ({
      title,
      filename: cleanName,
      url: canonicalUrl,
      thumbnailUrl: canonicalThumb,
      mimeType: data.mimeType || existing.mimeType,
      sizeBytes: data.sizeBytes || existing.sizeBytes,
      width: data.width ?? existing.width,
      height: data.height ?? existing.height,
      blurhash: data.blurhash ?? existing.blurhash,
    });

    try {
      const existingByHash = await db.wikiAsset.findUnique({ where: { md5Hash: hash } });
      if (existingByHash) {
        return (await db.wikiAsset.update({
          where: { id: existingByHash.id },
          data: refreshFields(existingByHash as MediaAssetRecord),
        })) as MediaAssetRecord;
      }

      const existingBySlug = await db.wikiAsset.findUnique({ where: { slug } });
      if (existingBySlug) {
        // The exact same filename is an updated version of the file
        if (existingBySlug.filename.toLowerCase() === cleanName.toLowerCase()) {
          return (await db.wikiAsset.update({
            where: { id: existingBySlug.id },
            data: { ...refreshFields(existingBySlug as MediaAssetRecord), md5Hash: hash },
          })) as MediaAssetRecord;
        }

        // A different file name that collided on slug: disambiguate with a hash prefix
        const dotIndex = cleanName.lastIndexOf(".");
        const baseName = dotIndex !== -1 ? cleanName.slice(0, dotIndex) : cleanName;
        const ext = dotIndex !== -1 ? cleanName.slice(dotIndex) : "";
        slug = `${baseName.toLowerCase()}_${hash.slice(0, 6)}${ext.toLowerCase()}`;
      }

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
          blurhash: data.blurhash || BlurHashService.generateDeterministicHash(cleanName),
          md5Hash: hash,
        },
      })) as MediaAssetRecord;
    } catch (err: unknown) {
      // Race conditions: another writer may have created the record meanwhile
      const fallback = await db.wikiAsset.findFirst({
        where: { OR: [{ md5Hash: hash }, { filename: cleanName }] },
      });
      if (fallback) return fallback as MediaAssetRecord;
      throw err;
    }
  }

  /**
   * Extracts and auto-registers new image references found in wikitext or HTML
   */
  static async processContentImages(content: string, originBaseUrl?: string): Promise<number> {
    if (!content) return 0;

    const foundFilenames = new Set<string>();

    // 1. Match wikitext [[File:Name.ext...]]
    const fileRegex = /\[\[(?:File|Image):([^\]|#]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = fileRegex.exec(content)) !== null) {
      if (match[1]) foundFilenames.add(match[1].trim());
    }

    // 2. Match infobox parameters | image = Name.ext, | flag = Name.ext
    const infoboxParamRegex =
      /\|\s*(?:image|logo|flag|coat_of_arms|seal|map|photo)\s*=\s*([^|\n\r]+)/gi;
    while ((match = infoboxParamRegex.exec(content)) !== null) {
      const raw = match[1]?.trim();
      if (raw && !raw.startsWith("{{") && /\.(?:png|jpg|jpeg|svg|gif|webp)$/i.test(raw)) {
        foundFilenames.add(
          raw
            .replace(/^\[\[(?:File|Image):/i, "")
            .replace(/\]\].*$/, "")
            .trim()
        );
      }
    }

    // 3. Match <img src="/images/..." data-file="Name.ext">
    const htmlImgRegex =
      /<img[^>]+(?:src=["'](?:[^"']*\/images\/[^"']*\/([^"'/?#]+))|data-file=["']([^"']+)["'])/gi;
    while ((match = htmlImgRegex.exec(content)) !== null) {
      const raw = match[1] || match[2];
      if (raw) {
        const clean = decodeURIComponent(raw).replace(/^(\d+px-)/i, "");
        foundFilenames.add(clean);
      }
    }

    let registeredCount = 0;
    for (const filename of foundFilenames) {
      try {
        await this.registerAsset({ filename, originBaseUrl });
        registeredCount++;
      } catch {
        // Continue on error
      }
    }

    return registeredCount;
  }
}
