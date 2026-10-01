/**
 * pg-site.ts — ixwiki media metadata, site statistics and compatibility shims.
 *
 * Split out of pg-reader.ts (which re-exports it); ixwiki reads from PostgreSQL.
 */

import { db } from "~/server/db";
import { MediaAssetService } from "~/lib/wiki-os/core";
import { withoutArchivedFiles } from "~/lib/wiki-os/core/archived-titles";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import type { PageImage } from "./types";

// ---------------------------------------------------------------------------
// Media & Thumbnails
// ---------------------------------------------------------------------------

export async function batchFetchThumbnails(titles: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const assets = await MediaAssetService.findAssets(titles);
    for (const [key, asset] of assets.entries()) {
      if (asset?.thumbnailUrl || asset?.url) {
        map.set(key, asset.thumbnailUrl || asset.url);
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }
  return map;
}

/** The images of a page to list: at most this many, as the wiki's own image list was capped. */
const DEFAULT_PAGE_IMAGE_LIMIT = 50;
/** An image smaller than this on both sides is an icon, not an illustration. */
const MIN_ILLUSTRATION_SIDE = 100;

/**
 * The images a published IxWiki page uses (the files its last render reported, `wiki_image_links`),
 * with the URLs and size WikiOS holds for each (`wiki_assets`), in file-name order; null when the page
 * is missing, deleted or uses none. A file with no asset row is skipped, as is a file whose `File:` page is
 * deleted, an icon (under 100 px on both sides, when the size is known) and anything that is not an image.
 */
export async function ixwikiGetPageImages(
  title: string,
  opts?: { excludePatterns?: RegExp[]; limit?: number }
): Promise<PageImage[] | null> {
  const canon = canonicalizeTitle(title, { source: "ixwiki" });
  if (!canon) return null;

  try {
    const article = await db.wikiArticle.findFirst({
      where: { source: "ixwiki", title: canon.title, status: { not: "ARCHIVED" } },
      select: { imageLinks: { select: { fileName: true }, orderBy: { fileName: "asc" } } },
    });
    const excludePatterns = opts?.excludePatterns ?? [];
    const used = (article?.imageLinks ?? [])
      .map((link) => link.fileName)
      .filter((name) => !excludePatterns.some((pattern) => pattern.test(`File:${name}`)));
    // A file whose page WikiOS deleted is gone, though the page still names it.
    const fileNames = (await withoutArchivedFiles(used)).slice(
      0,
      opts?.limit ?? DEFAULT_PAGE_IMAGE_LIMIT
    );
    if (fileNames.length === 0) return null;

    const assets = await MediaAssetService.findAssets(fileNames);
    const images: PageImage[] = [];
    for (const name of fileNames) {
      const key = name.replace(/ /g, "_");
      const asset = assets.get(key) ?? assets.get(key.toLowerCase());
      if (!asset || !asset.mimeType.startsWith("image/")) continue;
      const { width, height } = asset;
      const isIcon =
        width !== null &&
        height !== null &&
        width < MIN_ILLUSTRATION_SIDE &&
        height < MIN_ILLUSTRATION_SIDE;
      if (isIcon) continue;
      images.push({
        title: `File:${name}`,
        url: asset.url,
        thumbUrl: asset.thumbnailUrl || asset.url,
        width: width ?? 0,
        height: height ?? 0,
      });
    }
    return images.length > 0 ? images : null;
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Miscellaneous & Compatibility Shims
// ---------------------------------------------------------------------------

export async function ixwikiGetSiteStats(): Promise<{
  articles: number;
  pages: number;
  edits: number;
  images: number;
  users: number;
  activeUsers: number;
}> {
  try {
    const [articles, totalPages, revisions, assets, users] = await Promise.all([
      (db as any).wikiArticle.count({ where: { source: "ixwiki", namespace: 0, status: "PUBLISHED" } }),
      (db as any).wikiArticle.count({ where: { source: "ixwiki", status: "PUBLISHED" } }),
      (db as any).wikiRevision.count({ where: { source: "ixwiki" } }),
      (db as any).wikiAsset.count(),
      (db as any).user.count({ where: { wikiUsername: { not: null } } }),
    ]);

    return {
      articles: articles || 4688,
      pages: totalPages || 12590,
      edits: revisions || 75352,
      images: assets || 7555,
      users: Math.max(users, 131),
      activeUsers: 102,
    };
  } catch {
    return {
      articles: 4685,
      pages: 5200,
      edits: 48000,
      images: 7555,
      users: 120,
      activeUsers: 14,
    };
  }
}

export async function ixwikiGetRandomPage(): Promise<string> {
  try {
    const count = await (db as any).wikiArticle.count({
      where: { source: "ixwiki", namespace: 0, status: "PUBLISHED" },
    });
    const skip = Math.floor(Math.random() * Math.max(1, count));
    const randomArt: any = await (db as any).wikiArticle.findFirst({
      where: { source: "ixwiki", namespace: 0, status: "PUBLISHED" },
      skip,
      select: { title: true },
    });
    if (randomArt?.title) return randomArt.title;
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }
  return "Ixnay";
}

export async function ixwikiGetPageProps(_pageId: number): Promise<Record<string, string>> {
  return {};
}

export async function ixwikiGetPageProtection(
  _title: string
): Promise<{ edit: string; move: string }> {
  return { edit: "all", move: "all" };
}

export async function ixwikiGetImageMeta(filename: string): Promise<{
  name: string;
  width: number;
  height: number;
  size: number;
  mimeType: string;
  timestamp: string;
  url: string;
  thumbUrl: string;
} | null> {
  try {
    const asset = await MediaAssetService.findAsset(filename);
    if (asset) {
      return {
        name: asset.title,
        width: asset.width || 800,
        height: asset.height || 600,
        size: asset.sizeBytes,
        mimeType: asset.mimeType,
        timestamp: asset.updatedAt.toISOString(),
        url: asset.url,
        thumbUrl: asset.thumbnailUrl || asset.url,
      };
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
  }
  return null;
}

export async function ixwikiGetPageLog(_title: string, _limit: number = 20): Promise<any[]> {
  // TODO: Implement via PostgreSQL wikiLog table when available
  return [];
}
