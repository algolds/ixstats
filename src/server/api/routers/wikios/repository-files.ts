/**
 * repository-files.ts — the image repository's file browser: one paged list over the wikis' files (IxWiki, iiwiki),
 * the forum's imported images and the signed-in user's own uploads. `searchFiles` (search.ts) stays the unpaged
 * array result the editor's picker uses.
 */

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter } from "~/server/api/trpc";
import { assetUrl } from "~/lib/base-path";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";
import {
  fetchSisterFileInfo,
  fetchSisterFilePage,
  type RepositoryFile,
} from "~/lib/wiki-os/sister-wiki-files";
import { requireWikiAuthId } from "~/lib/wiki-os/auth";
import { listUploadedAssets, type UploadedAssetRecord } from "~/server/shared/uploaded-assets";
import { sisterWikiProcedure } from "./search";

export type { RepositoryFile };

interface RepositoryFilePage {
  files: RepositoryFile[];
  nextCursor: string | null;
}

/**
 * An IxWiki cursor is a decimal offset; this bounds how deep a client can page.
 * ponytail: `MediaAssetService.search` walks the table from row 0 to skip `offset` rows (about two queries per 50
 * rows), so paging deeper than 2000 costs too much on a public procedure. Upgrade path: a keyset cursor over
 * (title, id), which the existing orderBy already supports, instead of an offset.
 */
const MAX_OFFSET = 2000;
/** The IxWiki file-type filter's mime types. */
const FILE_TYPE_MIMES = {
  jpg: ["image/jpeg"],
  png: ["image/png"],
  svg: ["image/svg+xml"],
} as const;
/** A MediaWiki continuation carries a few short keys; anything beyond that is not one. */
const MAX_CONTINUE_KEYS = 10;
/** The continuation keys MediaWiki returns for the three request shapes (search, categorymembers, allimages + imageinfo). */
const CONTINUE_KEYS: ReadonlySet<string> = new Set([
  "continue",
  "gsroffset",
  "gcmcontinue",
  "gaicontinue",
  "iicontinue",
]);

function badCursor(): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message: "Invalid cursor" });
}

function parseOffset(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  if (!/^\d{1,6}$/.test(cursor)) throw badCursor();
  const offset = Number(cursor);
  if (offset > MAX_OFFSET) throw badCursor();
  return offset;
}

function parseContinue(cursor: string | null | undefined): Record<string, string> {
  if (!cursor) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
  } catch {
    throw badCursor();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw badCursor();
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length > MAX_CONTINUE_KEYS) throw badCursor();
  const params: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!CONTINUE_KEYS.has(key) || (typeof value !== "string" && typeof value !== "number")) {
      throw badCursor();
    }
    params[key] = String(value);
  }
  return params;
}

function encodeContinue(next: unknown): string | null {
  if (typeof next !== "object" || next === null || Object.keys(next).length === 0) return null;
  return Buffer.from(JSON.stringify(next), "utf-8").toString("base64url");
}

function fromUploadedAsset(record: UploadedAssetRecord): RepositoryFile {
  return {
    name: record.title,
    title: `File:${record.title}`,
    url: assetUrl(record.url) ?? record.url,
    thumbUrl: record.thumbUrl ? (assetUrl(record.thumbUrl) ?? record.thumbUrl) : null,
    size: record.sizeBytes,
    width: record.width,
    height: record.height,
    mime: record.mimeType,
    blurhash: record.blurhash,
  };
}

async function ixwikiPage(input: {
  query?: string;
  category?: string;
  fileType?: keyof typeof FILE_TYPE_MIMES;
  cursor?: string | null;
  limit: number;
}): Promise<RepositoryFilePage> {
  const offset = parseOffset(input.cursor);
  const assets = await MediaAssetService.search({
    query: input.query,
    category: input.category,
    fileTypes: input.fileType ? FILE_TYPE_MIMES[input.fileType] : undefined,
    limit: input.limit,
    offset,
  });
  return {
    files: assets.map((a) => ({
      name: a.filename || a.title,
      title: `File:${a.title}`,
      url: assetUrl(a.url) ?? a.url,
      thumbUrl: a.thumbnailUrl ? (assetUrl(a.thumbnailUrl) ?? a.thumbnailUrl) : null,
      size: a.sizeBytes || 0,
      width: a.width ?? 0,
      height: a.height ?? 0,
      mime: a.mimeType || "image/png",
      blurhash: a.blurhash ?? null,
    })),
    nextCursor:
      assets.length >= input.limit && offset + input.limit < MAX_OFFSET
        ? String(offset + input.limit)
        : null,
  };
}

async function iiwikiPage(input: {
  query?: string;
  category?: string;
  cursor?: string | null;
  limit: number;
}): Promise<RepositoryFilePage> {
  const { files, next } = await fetchSisterFilePage({
    query: input.query,
    category: input.category,
    limit: input.limit,
    continueParams: parseContinue(input.cursor),
  });
  return { files, nextCursor: encodeContinue(next) };
}

export const wikiosRepositoryFilesRouter = createTRPCRouter({
  /** One page of the image repository's files for a source; `nextCursor` is null on the last page. */
  repositoryFiles: sisterWikiProcedure
    .input(
      z.object({
        source: z.enum(["ixwiki", "iiwiki", "forum", "mine"]),
        query: z.string().max(200).optional(),
        category: z.string().max(200).optional(),
        /** IxWiki only: keep one kind of picture. The other sources ignore it. */
        fileType: z.enum(["jpg", "png", "svg"]).optional(),
        cursor: z.string().max(2000).nullish(),
        limit: z.number().int().min(1).max(50).default(40),
      })
    )
    .query(async ({ ctx, input }): Promise<RepositoryFilePage> => {
      if (input.source === "ixwiki") return ixwikiPage(input);
      if (input.source === "iiwiki") return iiwikiPage(input);

      const uploaderClerkId = input.source === "mine" ? requireWikiAuthId(ctx) : undefined;
      const page = await listUploadedAssets({
        source: input.source === "mine" ? "upload" : "forum",
        uploaderClerkId,
        query: input.query,
        cursor: input.cursor,
        limit: input.limit,
      });
      return { files: page.items.map(fromUploadedAsset), nextCursor: page.nextCursor };
    }),

  /** The named iiwiki files in one call, keyed by the requested title (absent when the wiki has no such file). */
  sisterFileInfo: sisterWikiProcedure
    .input(
      z.object({
        wiki: z.literal("iiwiki"),
        titles: z
          .array(
            z
              .string()
              .min(1)
              .max(255)
              .refine((title) => !title.includes("|"), "A title cannot contain |")
          )
          .min(1)
          .max(50),
      })
    )
    .query(async ({ input }): Promise<{ files: Record<string, RepositoryFile> }> => ({
      files: await fetchSisterFileInfo(input.titles),
    })),
});
