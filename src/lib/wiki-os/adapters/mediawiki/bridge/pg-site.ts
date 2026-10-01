/**
 * pg-site.ts — ixwiki media metadata, site statistics and compatibility shims.
 *
 * Split out of pg-reader.ts (which re-exports it); ixwiki reads from PostgreSQL.
 */

import { db } from "~/server/db";
import { MediaAssetService } from "~/lib/wiki-os/core";

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
    countOrNull(() => db.wikiRevision.count({ where: { source: "ixwiki" } })),
    countOrNull(() => db.wikiAsset.count()),
    countOrNull(() => db.user.count({ where: { wikiUsername: { not: null } } })),
    countOrNull(async () => {
      const editors = await db.wikiRevision.groupBy({
        by: ["author"],
        where: { source: "ixwiki", author: { not: null }, createdAt: { gte: since } },
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
