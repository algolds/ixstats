/**
 * media-asset-service.ts — WikiOS Native Media & Asset Engine
 *
 * Canonical service for resolving, registering, and querying media assets
 * directly from PostgreSQL `wiki_assets` with MD5 shard path computation.
 */

import { db } from "~/server/db";
import crypto from "crypto";
import { DEFAULT_MEDIAWIKI_URL } from "../config";
import { BlurHashService } from "./blurhash-service";

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
  createdAt: Date;
  updatedAt: Date;
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
  static getMd5ShardPath(filename: string): { shard: string; fullPath: string; hash: string; cleanName: string } {
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
    const clean = filenameOrSlug.replace(/^(?:File|Image):/i, "").replace(/ /g, "_").trim();
    if (!clean) return null;

    const slug = clean.toLowerCase();
    const { hash } = this.getMd5ShardPath(clean);

    try {
      const asset = await (db as any).wikiAsset.findFirst({
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

    const cleanNames = filenames.map((f) => f.replace(/^(?:File|Image):/i, "").replace(/ /g, "_").trim()).filter(Boolean);
    const hashes = cleanNames.map((n) => this.getMd5ShardPath(n).hash);

    try {
      const assets: MediaAssetRecord[] = await (db as any).wikiAsset.findMany({
        where: {
          OR: [
            { filename: { in: cleanNames } },
            { md5Hash: { in: hashes } },
          ],
        },
      });

      for (const asset of assets) {
        map.set(asset.filename, asset);
        map.set(asset.filename.toLowerCase(), asset);
        map.set(asset.slug, asset);
        map.set(asset.md5Hash, asset);
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
    const { shard, fullPath, hash, cleanName } = this.getMd5ShardPath(data.filename);
    const title = data.title || cleanName.replace(/_/g, " ");
    let slug = cleanName.toLowerCase();
    
    const baseUrl = (data.originBaseUrl || DEFAULT_MEDIAWIKI_URL).replace(/\/+$/, "");
    const canonicalUrl = data.url || `${baseUrl}/images/${fullPath}`;
    const canonicalThumb = data.thumbnailUrl || `${baseUrl}/images/thumb/${fullPath}/300px-${encodeURIComponent(cleanName)}`;

    try {
      // 1. Check if asset already exists by md5Hash
      const existingByHash = await (db as any).wikiAsset.findUnique({
        where: { md5Hash: hash },
      });

      if (existingByHash) {
        return await (db as any).wikiAsset.update({
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
        });
      }

      // 2. Check if an asset exists by slug
      const existingBySlug = await (db as any).wikiAsset.findUnique({
        where: { slug },
      });

      if (existingBySlug) {
        // If it's the exact same filename, this is an updated version of the file
        if (existingBySlug.filename.toLowerCase() === cleanName.toLowerCase()) {
          return await (db as any).wikiAsset.update({
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
          });
        }

        // Different file name that collided on slug — disambiguate slug with hash prefix
        const dotIndex = cleanName.lastIndexOf(".");
        const baseName = dotIndex !== -1 ? cleanName.slice(0, dotIndex) : cleanName;
        const ext = dotIndex !== -1 ? cleanName.slice(dotIndex) : "";
        slug = `${baseName.toLowerCase()}_${hash.slice(0, 6)}${ext.toLowerCase()}`;
      }

      // 3. Create new record
      return await (db as any).wikiAsset.create({
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
      });
    } catch (err: any) {
      // Fallback: in case of race conditions, try safe update
      const fallback = await (db as any).wikiAsset.findFirst({
        where: { OR: [{ md5Hash: hash }, { filename: cleanName }] },
      });
      if (fallback) {
        return fallback as MediaAssetRecord;
      }
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
    const infoboxParamRegex = /\|\s*(?:image|logo|flag|coat_of_arms|seal|map|photo)\s*=\s*([^|\n\r]+)/gi;
    while ((match = infoboxParamRegex.exec(content)) !== null) {
      const raw = match[1]?.trim();
      if (raw && !raw.startsWith("{{") && /\.(?:png|jpg|jpeg|svg|gif|webp)$/i.test(raw)) {
        foundFilenames.add(raw.replace(/^\[\[(?:File|Image):/i, "").replace(/\]\].*$/, "").trim());
      }
    }

    // 3. Match <img src="/images/..." data-file="Name.ext">
    const htmlImgRegex = /<img[^>]+(?:src=["'](?:[^"']*\/images\/[^"']*\/([^"'\/?#]+))|data-file=["']([^"']+)["'])/gi;
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
