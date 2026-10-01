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

/** An editor counts as active when they edited within this many days (MediaWiki's own definition). */
const ACTIVE_USER_DAYS = 30;

/** Counts of what the wiki holds. A count that could not be read is null, never a made-up number. */
export interface SiteStats {
  articles: number | null;
  pages: number | null;
  edits: number | null;
  images: number | null;
  users: number | null;
  activeUsers: number | null;
}

/** `read()`'s result, or null when it failed: one broken count does not blank the others. */
async function countOrNull(read: () => Promise<number>): Promise<number | null> {
  try {
    return await read();
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.warn("[WikiOS:pg-reader]", err);
    return null;
  }
}

export async function ixwikiGetSiteStats(): Promise<SiteStats> {
  const since = new Date(Date.now() - ACTIVE_USER_DAYS * 24 * 60 * 60 * 1000);
  const [articles, pages, edits, images, users, activeUsers] = await Promise.all([
    countOrNull(() =>
      db.wikiArticle.count({ where: { source: "ixwiki", namespace: 0, status: "PUBLISHED" } })
    ),
    countOrNull(() => db.wikiArticle.count({ where: { source: "ixwiki", status: "PUBLISHED" } })),
    // A parked edit (a MediaWiki edit that conflicted and never went live) is not an edit of the wiki
    countOrNull(() => db.wikiRevision.count({ where: { source: "ixwiki", parked: false } })),
    countOrNull(() => db.wikiAsset.count()),
    countOrNull(() => db.user.count({ where: { wikiUsername: { not: null } } })),
    countOrNull(async () => {
      const editors = await db.wikiRevision.groupBy({
        by: ["author"],
        where: {
          source: "ixwiki",
          parked: false,
          author: { not: null },
          createdAt: { gte: since },
        },
      });
      return editors.length;
    }),
  ]);
  return { articles, pages, edits, images, users, activeUsers };
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
