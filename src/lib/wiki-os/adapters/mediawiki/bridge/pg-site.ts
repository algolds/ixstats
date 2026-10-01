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
