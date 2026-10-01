/**
 * upload-service.ts — a file uploaded to WikiOS (plan 411, owner decision D7): checked, kept, recorded and queued for
 * MediaWiki. The one path an upload takes, whoever asks (the `POST /api/wiki/upload` route of the browser, api.php's
 * `action=upload` of a bot).
 *
 * What happens to an upload:
 *   1. the caller must hold `upload` (and `reupload` for a name that is taken), checked against `File:<name>`;
 *   2. the BYTES decide what it is (core/file-sniff.ts): PNG, JPEG, GIF, WebP, SVG or PDF, at most 10 MB, and the
 *      name's extension must be right for the type; an unsafe SVG is refused;
 *   3. MediaWiki's warnings are returned instead of saving, unless the uploader says to ignore them: `exists` (the name is
 *      taken by other content), `duplicate` (the same bytes are under another name). The same bytes under the same name
 *      are a no-op whatever the uploader says: nothing is stored, logged or queued;
 *   4. the bytes are kept under their SHA-1 in the staging directory (upload-staging.ts) and the file is served from
 *      WikiOS at once (`/api/wiki/file/<name>`);
 *   5. a new file gets its `File:` description page through the ordinary save (its own revision job and render);
 *   6. one transaction records the asset, the upload log entry and the `upload` mirror job, which puts the same bytes in
 *      MediaWiki (mirror-upload.ts) and then switches the asset's URL to MediaWiki's `/images/` path.
 *
 * The description page is saved first, so its revision job precedes the upload job in the title's order: MediaWiki
 * has the page when the file arrives.
 */

import { db } from "~/server/db";
import { getWikiActorLabel, type WikiAuthContext } from "../auth";
import { MAX_UPLOAD_BYTES, UPLOAD_EXTENSIONS } from "../config";
import { extensionMatches, fileExtension, sniffFile, type SniffedFile } from "../core/file-sniff";
import { hashFile, sha1Base36ToHex } from "../core/file-hash";
import { MediaAssetService, type MediaAssetRecord } from "../core/media-asset-service";
import { canonicalizeTitle } from "../core/title";
import { CloudflareGuardian } from "../guardian/cloudflare-guardian";
import { authorizeAction, requireRight, requireUploadTitle } from "../permissions";
import { commitWikitextSave, deletedPage } from "./edit-service";
import { enqueueUploadJob, scheduleMirrorKick } from "./mirror-outbox";
import { UploadError } from "./upload-error";
import { stageBytes } from "./upload-staging";

export interface UploadRequest {
  ctx: WikiAuthContext;
  bytes: Uint8Array;
  /** The name the uploader gave: a path before it, and a `File:` prefix, are cut as MediaWiki cuts them. */
  filename: string;
  /** The "Summary" section of the new `File:` page. */
  description?: string;
  /** The "Licensing" section: a template such as `{{PD-self}}`, or a sentence. */
  license?: string;
  /** Category names (with or without `Category:`). */
  categories?: readonly string[];
  /** The whole text of the new `File:` page, used as given instead of the three fields above (api.php's `text`). */
  pageText?: string;
  /** The comment of the upload (its log entry and, in MediaWiki, the file version). */
  comment?: string;
  ignoreWarnings?: boolean;
}

/** What MediaWiki's upload API warns about, in its own words. */
export interface UploadWarnings {
  /** The name is taken (by other content, or the same: then `nochange` too). */
  exists?: string;
  /** The same bytes are already the current version of this name: nothing would change. */
  nochange?: true;
  /** Other file names that hold the same bytes. */
  duplicate?: string[];
}

export interface UploadedFile {
  /** The file's name, spaces as in the title. */
  filename: string;
  /** `File:<name>`. */
  title: string;
  /** Where the file is served from: a path on this site until MediaWiki holds the bytes too, then MediaWiki's URL. */
  url: string;
  /** The `File:` page on this site. */
  descriptionUrl: string;
  width: number | null;
  height: number | null;
  size: number;
  mime: string;
  /** 40 hex digits, as MediaWiki's `imageinfo` writes it. */
  sha1: string;
}

export type UploadResult =
  | ({
      result: "Success";
      /** The name was taken: this is a new version of the file. */
      replaced: boolean;
      /** The same bytes were there already, so nothing was stored. */
      noChange: boolean;
    } & UploadedFile)
  | { result: "Warning"; filename: string; title: string; warnings: UploadWarnings };

const DEFAULT_COMMENT = "Uploaded via WikiOS";
/** `wiki_logs.comment` holds 1000 characters and MediaWiki's summary limit is 500. */
const COMMENT_LIMIT = 500;
const MEGABYTE = 1_000_000;

// ---------------------------------------------------------------------------
// The file
// ---------------------------------------------------------------------------

/** What the bytes are, or the `UploadError` that says why they may not be uploaded under `name`. */
function checkedFile(bytes: Uint8Array, name: string): SniffedFile {
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      "file-too-large",
      `The file is larger than the ${MAX_UPLOAD_BYTES / MEGABYTE} MB limit.`
    );
  }
  const sniffed = sniffFile(bytes);
  if (!sniffed.ok) throw new UploadError(sniffed.code, sniffed.reason);
  const extension = fileExtension(name);
  if (!extension) throw new UploadError("filetype-missing", "The file name has no extension.");
  if (!(UPLOAD_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new UploadError(
      "filetype-banned",
      `Files with the extension ".${extension}" cannot be uploaded (${UPLOAD_EXTENSIONS.join(", ")}).`
    );
  }
  if (!extensionMatches(sniffed.file.kind, name)) {
    throw new UploadError(
      "filetype-mime-mismatch",
      `The file extension ".${extension}" does not match the file's type (${sniffed.file.mime}).`
    );
  }
  return sniffed.file;
}

// ---------------------------------------------------------------------------
// The File: page's text
// ---------------------------------------------------------------------------

/** A category name as `[[Category:Name]]`, or null when MediaWiki would refuse it. */
function categoryLink(raw: string): string | null {
  const canon = canonicalizeTitle(`Category:${raw.replace(/^\s*category\s*:/i, "")}`);
  return canon && canon.namespaceId === 14 ? `[[Category:${canon.base}]]` : null;
}

/** The text of a new `File:` page: `== Summary ==`, `== Licensing ==` and the categories. */
export function descriptionWikitext(
  request: Pick<UploadRequest, "description" | "license" | "categories" | "pageText">
): string {
  if (request.pageText !== undefined) return request.pageText;
  const categories = (request.categories ?? []).flatMap((name) => categoryLink(name) ?? []);
  return [
    "== Summary ==",
    (request.description ?? "").trim(),
    "== Licensing ==",
    (request.license ?? "").trim(),
    ...categories,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// What is there already
// ---------------------------------------------------------------------------

interface CurrentFile {
  asset: MediaAssetRecord | null;
  /** The `File:` page's row, a deleted one included. */
  page: { id: string; status: string } | null;
}

async function currentFile(title: string, name: string): Promise<CurrentFile> {
  const [asset, page] = await Promise.all([
    MediaAssetService.findByFileName(name),
    db.wikiArticle.findUnique({
      where: { source_title: { source: "ixwiki", title } },
      select: { id: true, status: true },
    }),
  ]);
  return { asset, page };
}

/** A file is taken when WikiOS has an asset for the name, or a live `File:` page (a file MediaWiki holds that was imported as a page). */
const isTaken = ({ asset, page }: CurrentFile): boolean =>
  asset !== null || (page !== null && page.status !== "ARCHIVED");

async function warningsOf(
  current: CurrentFile,
  name: string,
  sha1: string
): Promise<UploadWarnings> {
  const warnings: UploadWarnings = {};
  if (isTaken(current)) warnings.exists = name;
  if (current.asset?.sha1 === sha1) warnings.nochange = true;
  const duplicates = await MediaAssetService.findDuplicates(sha1, name);
  if (duplicates.length > 0) warnings.duplicate = duplicates;
  return warnings;
}

function factsOf(title: string, name: string, asset: MediaAssetRecord, sha1: string): UploadedFile {
  const canon = canonicalizeTitle(title);
  return {
    filename: name,
    title,
    url: asset.url,
    descriptionUrl: `/wiki/${canon?.urlPath ?? encodeURIComponent(title)}`,
    width: asset.width,
    height: asset.height,
    size: asset.sizeBytes,
    mime: asset.mimeType,
    sha1: sha1Base36ToHex(sha1),
  };
}

// ---------------------------------------------------------------------------
// The upload
// ---------------------------------------------------------------------------

/** The asset row, the log entry and the mirror job, in one transaction. */
function recordUpload(
  request: UploadRequest,
  upload: {
    title: string;
    name: string;
    file: SniffedFile;
    sha1: string;
    articleId: string | null;
    replaced: boolean;
    comment: string;
  }
): Promise<MediaAssetRecord> {
  const { ctx, bytes } = request;
  const { title, name, file, sha1, articleId, replaced, comment } = upload;
  return db.$transaction(async (tx) => {
    const asset = await MediaAssetService.recordUpload(tx, {
      name,
      mimeType: file.mime,
      sizeBytes: bytes.length,
      width: file.width,
      height: file.height,
      sha1,
      uploaderId: ctx.user?.id ?? null,
    });
    const log = await tx.wikiLog.create({
      data: {
        logType: "upload",
        action: replaced ? "overwrite" : "upload",
        title,
        actorName: getWikiActorLabel(ctx),
        comment,
        params: {
          filename: name,
          sha1,
          size: bytes.length,
          width: file.width,
          height: file.height,
          mime: file.mime,
        },
        userId: ctx.user?.id ?? null,
        articleId,
      },
      select: { id: true },
    });
    await enqueueUploadJob(tx, { title, articleId, logId: log.id, sha1, comment });
    return asset;
  });
}

/** The id of the `File:` page of this upload: the one there is, or the one the upload creates. */
async function descriptionPageId(
  request: UploadRequest,
  title: string,
  page: CurrentFile["page"],
  comment: string
): Promise<string> {
  if (page) return page.id;
  const saved = await commitWikitextSave(request.ctx, {
    title,
    wikitext: descriptionWikitext(request),
    summary: comment,
    minor: false,
  });
  return saved.article.id;
}

/**
 * Take an uploaded file: see the module comment. Resolves to the file (a `Success`, which may be a no-op for the same
 * bytes) or to the warnings the uploader has to accept first; throws FORBIDDEN for rights, an `UploadError` for a file that may
 * not be uploaded, PRECONDITION_FAILED for a deleted file name.
 */
export async function uploadFile(request: UploadRequest): Promise<UploadResult> {
  const { ctx } = request;
  // The name MediaWiki will store it under: the rights are checked against that, not the raw text.
  const title = requireUploadTitle(request.filename);
  const name = title.slice("File:".length);
  await authorizeAction(ctx, "upload", title);

  const file = checkedFile(request.bytes, name);
  const { base36: sha1 } = hashFile(request.bytes);
  const current = await currentFile(title, name);
  if (current.page?.status === "ARCHIVED") throw deletedPage();
  const replaced = isTaken(current);
  if (replaced) await requireRight(ctx, "reupload");

  const warnings = await warningsOf(current, name, sha1);
  if (!request.ignoreWarnings && Object.keys(warnings).length > 0) {
    return { result: "Warning", filename: name, title, warnings };
  }
  // The same bytes under the same name change nothing: whatever the uploader says, nothing is stored, logged or queued.
  if (warnings.nochange && current.asset) {
    return {
      result: "Success",
      replaced,
      noChange: true,
      ...factsOf(title, name, current.asset, sha1),
    };
  }

  await stageBytes(sha1, request.bytes);
  const comment = (request.comment?.trim() || DEFAULT_COMMENT).slice(0, COMMENT_LIMIT);
  const articleId = await descriptionPageId(request, title, current.page, comment);
  const asset = await recordUpload(request, {
    title,
    name,
    file,
    sha1,
    articleId,
    replaced,
    comment,
  });
  // The job is committed: let the mirror worker send it to MediaWiki in a moment, not at the next cron minute.
  scheduleMirrorKick();
  if (replaced) void CloudflareGuardian.purgeArticleEdgeCache(title);
  return {
    result: "Success",
    replaced,
    noChange: false,
    ...factsOf(title, name, asset, sha1),
  };
}
