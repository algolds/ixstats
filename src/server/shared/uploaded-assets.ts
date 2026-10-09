/**
 * uploaded-assets.ts — records of images written under `uploadsDir()` (the image repository's "My uploads" and
 * "Forum" sources). `registerUploadedAsset` is a published contract (the forum attachment import calls it), so its
 * shape is a contract. Both functions degrade gracefully when the `uploaded_assets` table has not been applied yet.
 *
 * `registerUploadedAsset` never throws; it returns `{ ok: false, reason, retryable }` on failure: `table-missing` and
 * `error` are retryable (apply the migration, try again), `invalid-input`, `unreadable-file` and `conflict` are not.
 * Only `visibility: "public"` forum assets are listed by `listUploadedAssets({ source: "forum" })`: register attachments
 * of staff-only boards as `"restricted"`.
 */
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import {
  canComputeBlurhash,
  computeBlurhash,
  DECODE_TIMEOUT_SECONDS,
} from "~/lib/wiki-os/services/image-blurhash";
import { getMaxImageArea } from "~/lib/wiki-os/config";
import { UPLOADS_URL_PREFIX, uploadsDir } from "~/server/shared/upload-storage";

export type UploadedAssetSource = "upload" | "forum";
export type UploadedAssetVisibility = "public" | "restricted";

export interface RegisterUploadedAssetInput {
  /** Absolute path of the file already written under uploadsDir(). */
  filePath: string;
  /** Public URL as served (e.g. "/images/uploads/forum/123-photo.jpg", no basePath). */
  url: string;
  mimeType: string;
  source: UploadedAssetSource;
  /** Clerk user id of the uploader; null for imports. */
  uploaderClerkId?: string | null;
  /** Idempotency key within a source (forum: the XenForo attachment id). */
  sourceRef?: string | null;
  /** Display name; defaults to the file name. */
  title?: string | null;
  /** "restricted" keeps the asset out of the public Forum listing. Defaults to "public". */
  visibility?: UploadedAssetVisibility;
}

export type RegisterUploadedAssetFailure = "table-missing" | "invalid-input" | "unreadable-file" | "conflict" | "error";

export type RegisterUploadedAssetResult =
  | { ok: true; record: UploadedAssetRecord }
  | { ok: false; reason: RegisterUploadedAssetFailure; retryable: boolean };

export interface UploadedAssetRecord {
  id: string;
  url: string;
  thumbUrl: string | null;
  title: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  blurhash: string | null;
  source: UploadedAssetSource;
  visibility: UploadedAssetVisibility;
  createdAt: Date;
}

const THUMB_SUFFIX = ".thumb.webp";
const THUMB_MAX_SIDE = 640;
const THUMB_QUALITY = 80;
const MISSING_TABLE_CODE = "P2021";
const UNIQUE_CONFLICT_CODE = "P2002";
const MISSING_TABLE_WARNING =
  "[uploaded-assets] table missing — apply prisma/migrations/20261010030000_uploaded_assets";

let warnedMissingTable = false;

function isMissingTable(error: Error): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === MISSING_TABLE_CODE;
}

function isConflict(error: Error): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONFLICT_CODE;
}

/** Logs a failure; a missing table is warned about once per process, anything else every time. */
function reportFailure(context: string, error: Error): void {
  if (isMissingTable(error)) {
    if (!warnedMissingTable) {
      warnedMissingTable = true;
      console.warn(MISSING_TABLE_WARNING);
    }
    return;
  }
  console.error(`[uploaded-assets] ${context} failed:`, error);
}

interface Dimensions {
  width: number;
  height: number;
}

function svgDimensions(svg: string): Dimensions {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
  const attr = (name: string): string | undefined =>
    new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(root)?.[1];
  const length = (value: string | undefined): number => {
    const parsed = value && !value.includes("%") ? Number.parseFloat(value) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
  };
  const width = length(attr("width"));
  const height = length(attr("height"));
  if (width > 0 && height > 0) return { width, height };
  const box = attr("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (box && box.length === 4 && box.every(Number.isFinite)) {
    const boxWidth = Math.round(box[2] ?? 0);
    const boxHeight = Math.round(box[3] ?? 0);
    if (boxWidth > 0 && boxHeight > 0) return { width: boxWidth, height: boxHeight };
  }
  return { width: 0, height: 0 };
}

/** Sharp's input options for upload bytes: the same pixel ceiling the blurhash decode has. */
function boundedInput(): sharp.SharpOptions {
  return { limitInputPixels: getMaxImageArea(), failOn: "error" };
}

async function rasterDimensions(bytes: Buffer): Promise<Dimensions> {
  const meta = await sharp(bytes, boundedInput()).metadata();
  const swapped = (meta.orientation ?? 1) >= 5;
  const width = (swapped ? meta.height : meta.width) ?? 0;
  const height = (swapped ? meta.width : meta.height) ?? 0;
  return { width, height };
}

/** Writes `<file>.thumb.webp` beside the file; null when the thumbnail cannot be made (the record is kept). */
async function writeThumbnail(bytes: Buffer, filePath: string, url: string): Promise<string | null> {
  try {
    await sharp(bytes, boundedInput())
      .timeout({ seconds: DECODE_TIMEOUT_SECONDS })
      .rotate()
      .resize({ width: THUMB_MAX_SIDE, height: THUMB_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toFile(`${filePath}${THUMB_SUFFIX}`);
    return `${url}${THUMB_SUFFIX}`;
  } catch (error) {
    console.warn("[uploaded-assets] thumbnail failed:", error);
    return null;
  }
}

interface RowLike {
  id: string;
  url: string;
  thumbUrl: string | null;
  title: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  blurhash: string | null;
  source: string;
  visibility?: string | null;
  createdAt: Date;
}

function toRecord(row: RowLike): UploadedAssetRecord {
  return {
    id: row.id,
    url: row.url,
    thumbUrl: row.thumbUrl,
    title: row.title,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    sizeBytes: row.sizeBytes,
    blurhash: row.blurhash,
    source: row.source === "forum" ? "forum" : "upload",
    visibility: row.visibility === "restricted" ? "restricted" : "public",
    createdAt: row.createdAt,
  };
}

function failure(reason: RegisterUploadedAssetFailure): RegisterUploadedAssetResult {
  return { ok: false, reason, retryable: reason === "table-missing" || reason === "error" };
}

/** Whether `filePath` is a file inside uploadsDir() and `url` is a local uploads URL. */
function isLocalUpload(filePath: string, url: string): boolean {
  const root = path.resolve(uploadsDir());
  const resolved = path.resolve(filePath);
  return (
    resolved.startsWith(`${root}${path.sep}`) && url.startsWith(UPLOADS_URL_PREFIX) && !url.includes("..")
  );
}

function failureReason(error: Error): RegisterUploadedAssetFailure {
  if (isMissingTable(error)) return "table-missing";
  return isConflict(error) ? "conflict" : "error";
}

/**
 * Records (or, for the same source+sourceRef or url, updates) an uploaded image. Never throws. The file must sit
 * inside uploadsDir() and the url under UPLOADS_URL_PREFIX (no "..") or nothing is read or written.
 */
export async function registerUploadedAsset(
  input: RegisterUploadedAssetInput
): Promise<RegisterUploadedAssetResult> {
  if (!isLocalUpload(input.filePath, input.url)) {
    console.error("[uploaded-assets] register refused: file outside uploadsDir() or url outside the uploads prefix");
    return failure("invalid-input");
  }
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(input.filePath);
  } catch (error) {
    console.error("[uploaded-assets] register: file unreadable:", error);
    return failure("unreadable-file");
  }
  try {
    const mimeType = input.mimeType.toLowerCase();
    const isSvg = mimeType.startsWith("image/svg");
    const raster = canComputeBlurhash(mimeType);

    let dims: Dimensions = { width: 0, height: 0 };
    let thumbUrl: string | null = null;
    let blurhash: string | null = null;
    if (raster) {
      dims = await rasterDimensions(bytes).catch(() => dims);
      thumbUrl = await writeThumbnail(bytes, input.filePath, input.url);
      blurhash = await computeBlurhash(bytes, mimeType);
    } else if (isSvg) {
      dims = svgDimensions(bytes.toString("utf-8"));
    }

    const data = {
      source: input.source,
      sourceRef: input.sourceRef ?? null,
      url: input.url,
      filePath: input.filePath,
      thumbUrl,
      title: input.title?.trim() || path.basename(input.filePath),
      mimeType,
      sizeBytes: bytes.length,
      width: dims.width,
      height: dims.height,
      blurhash,
      uploaderClerkId: input.uploaderClerkId ?? null,
      visibility: input.visibility === "restricted" ? "restricted" : "public",
    };

    const row = input.sourceRef
      ? await db.uploadedAsset.upsert({
          where: { source_sourceRef: { source: input.source, sourceRef: input.sourceRef } },
          create: data,
          update: data,
        })
      : await db.uploadedAsset.upsert({
          where: { url: input.url },
          create: data,
          update: data,
        });
    return { ok: true, record: toRecord(row) };
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    reportFailure("register", cause);
    return failure(failureReason(cause));
  }
}

function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, "utf-8").toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
  const split = decoded.indexOf("|");
  if (split < 0) return null;
  const createdAt = new Date(decoded.slice(0, split));
  const id = decoded.slice(split + 1);
  return Number.isNaN(createdAt.getTime()) || !id ? null : { createdAt, id };
}

export interface ListUploadedAssetsOptions {
  source: UploadedAssetSource;
  uploaderClerkId?: string;
  query?: string;
  cursor?: string | null;
  limit: number;
}

/** Newest first, keyset-paged. The Forum source lists public assets only ("mine" lists the caller's own regardless). A missing table (or any failure) gives an empty page. */
export async function listUploadedAssets(
  opts: ListUploadedAssetsOptions
): Promise<{ items: UploadedAssetRecord[]; nextCursor: string | null }> {
  try {
    const where: Prisma.UploadedAssetWhereInput = { source: opts.source };
    if (opts.uploaderClerkId) where.uploaderClerkId = opts.uploaderClerkId;
    else if (opts.source === "forum") where.visibility = "public";
    const query = opts.query?.trim();
    if (query) where.title = { contains: query, mode: "insensitive" };
    const after = opts.cursor ? decodeCursor(opts.cursor) : null;
    if (after) {
      where.AND = [
        {
          OR: [
            { createdAt: { lt: after.createdAt } },
            { createdAt: after.createdAt, id: { lt: after.id } },
          ],
        },
      ];
    }
    const rows = await db.uploadedAsset.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: opts.limit + 1,
    });
    const page = rows.slice(0, opts.limit);
    const last = page[page.length - 1];
    return {
      items: page.map(toRecord),
      nextCursor: rows.length > opts.limit && last ? encodeCursor(last) : null,
    };
  } catch (error) {
    reportFailure("list", error instanceof Error ? error : new Error(String(error)));
    return { items: [], nextCursor: null };
  }
}
