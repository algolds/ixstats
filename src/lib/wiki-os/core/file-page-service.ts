/**
 * file-page-service.ts — where the file behind a `File:` page lives: WikiOS's own `wiki_assets` row
 * when there is one, else the path MediaWiki's MD5-sharded `images/` directory keeps it at; and what a `File:`
 * page shows below the file (plan 411): the upload history and the pages that use the file.
 */

import { z } from "zod";
import { db } from "~/server/db";
import { getImageUrl } from "../transformers/image-url";
import { archivedTitlesAmong } from "./archived-titles";
import { ArticleRepository } from "./article-repository";
import { MediaAssetService } from "./media-asset-service";
import { canonicalizeTitle } from "./title";

export interface FileInfo {
  /** The file name without the `File:` prefix, spaces not underscores. */
  name: string;
  url: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  sizeBytes: number | null;
}

/**
 * The file called `rawName` ("Flag of Eurth.svg", with or without `File:`), or null when WikiOS has
 * neither an asset row for it nor a description page: a file can only be told from a missing one by
 * one of the two, because the `images/` path is computed, not looked up. A file whose description
 * page was deleted is gone for everyone: its asset row is not a way back to it.
 */
export async function getFileInfo(rawName: string): Promise<FileInfo | null> {
  const page = canonicalizeTitle(`File:${rawName.replace(/^(?:file|image):/i, "")}`);
  if (!page) return null;

  if ((await archivedTitlesAmong([page.title])).size > 0) return null;

  const asset = await MediaAssetService.findAsset(page.base);
  if (asset) {
    return {
      name: page.base,
      url: asset.url,
      thumbUrl: asset.thumbnailUrl ?? null,
      width: asset.width ?? null,
      height: asset.height ?? null,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
    };
  }

  const described = (await ArticleRepository.findMissingTitles([page.title])).length === 0;
  if (!described) return null;
  return {
    name: page.base,
    url: getImageUrl(page.base),
    thumbUrl: null,
    width: null,
    height: null,
    mimeType: null,
    sizeBytes: null,
  };
}

// ---------------------------------------------------------------------------
// What a File: page shows below the file
// ---------------------------------------------------------------------------

/** Versions of the upload history, and pages of "File usage", a File: page lists. */
export const FILE_HISTORY_SHOWN = 50;
export const FILE_USAGE_SHOWN = 100;

/** One upload of the file: who, when, and what the version was. */
export interface FileVersion {
  /** ISO time of the upload. */
  at: string;
  user: string;
  comment: string | null;
  /** `upload` the first version, `overwrite` a new one. */
  action: string;
  width: number | null;
  height: number | null;
  size: number | null;
  mime: string | null;
}

/** A page that uses the file. */
export interface FileUsage {
  title: string;
  urlPath: string;
}

export interface FileDetails {
  /** Newest first (the current version is the first). Empty for a file WikiOS has no upload log of: one registered from MediaWiki's files. */
  history: FileVersion[];
  /** The live pages that use the file, by title, at most `FILE_USAGE_SHOWN`. */
  usage: FileUsage[];
  usageTotal: number;
}

/** What an upload's log entry records of its version (`upload-service.ts`); a row of another shape reads as unknown facts. */
const uploadParamsSchema = z.object({
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  size: z.number().nullable().optional(),
  mime: z.string().nullable().optional(),
});

/**
 * The upload history and the usage of the file called `rawName`; null when its `File:` page was deleted (the file is
 * gone for everyone, as in `getFileInfo`) or the name is no file name.
 */
export async function getFileDetails(rawName: string): Promise<FileDetails | null> {
  const page = canonicalizeTitle(`File:${rawName.replace(/^(?:file|image):/i, "")}`);
  if (!page || (await archivedTitlesAmong([page.title])).size > 0) return null;

  const usageWhere = {
    fileName: page.base,
    article: { source: "ixwiki", status: { not: "ARCHIVED" } },
  };
  const [logs, usage, usageTotal] = await Promise.all([
    db.wikiLog.findMany({
      where: { logType: "upload", title: page.title },
      orderBy: { createdAt: "desc" },
      take: FILE_HISTORY_SHOWN,
      select: { createdAt: true, actorName: true, comment: true, action: true, params: true },
    }),
    db.wikiImageLink.findMany({
      where: usageWhere,
      orderBy: { article: { title: "asc" } },
      take: FILE_USAGE_SHOWN,
      select: { article: { select: { title: true } } },
    }),
    db.wikiImageLink.count({ where: usageWhere }),
  ]);

  return {
    history: logs.map((log) => {
      const facts = uploadParamsSchema.safeParse(log.params).data;
      return {
        at: log.createdAt.toISOString(),
        user: log.actorName,
        comment: log.comment,
        action: log.action,
        width: facts?.width ?? null,
        height: facts?.height ?? null,
        size: facts?.size ?? null,
        mime: facts?.mime ?? null,
      };
    }),
    usage: usage.map(({ article }) => ({
      title: article.title,
      urlPath:
        canonicalizeTitle(article.title)?.urlPath ??
        encodeURIComponent(article.title.replace(/ /g, "_")),
    })),
    usageTotal,
  };
}
