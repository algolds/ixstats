/**
 * upload-api.ts — the browser's side of `POST /api/wiki/upload` (plan 411): the limits the form states, the request, and the answer.
 *
 * The file is the request body itself (never a multipart form, never base64): one pass over the bytes on the server,
 * counted as they stream in, and no encoding overhead against Next's `proxyClientMaxBodySize`. The name and the
 * description page's fields travel in the query string, which is why they are short (the URL has to survive every proxy).
 * Client-safe: nothing here imports a server or MediaWiki module.
 */

import { withBasePath } from "~/lib/base-path";
import { MAX_UPLOAD_BYTES } from "~/lib/wiki-os/config";

export const UPLOAD_ROUTE = "/api/wiki/upload";

/** Characters (categories: how many and how long) the route accepts for each field. */
export const UPLOAD_FIELD_LIMITS = {
  filename: 255,
  description: 1000,
  license: 300,
  comment: 200,
  categories: 10,
  category: 60,
} as const;

export interface UploadFields {
  filename: string;
  description?: string;
  license?: string;
  categories?: readonly string[];
  comment?: string;
  /** Upload anyway: accept MediaWiki's warnings (the name is taken, the same bytes are under another name). */
  ignoreWarnings?: boolean;
}

/** What MediaWiki's upload API warns about (see services/upload-service.ts). */
export interface UploadWarnings {
  exists?: string;
  nochange?: true;
  duplicate?: string[];
}

export interface UploadedFileInfo {
  filename: string;
  title: string;
  /** Where the file is served from: a path on this site, until MediaWiki holds it too. Give it to `assetUrl`. */
  url: string;
  descriptionUrl: string;
  width: number | null;
  height: number | null;
  size: number;
  mime: string;
  sha1: string;
  replaced: boolean;
  noChange: boolean;
}

export type UploadResponse =
  | ({ result: "Success" } & UploadedFileInfo)
  | { result: "Warning"; filename: string; title: string; warnings: UploadWarnings };

/** A refusal, with the code MediaWiki would give it (`filetype-mime-mismatch`, `permissiondenied`, ...). */
export class UploadFailed extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "UploadFailed";
  }
}

/** The query string of an upload: only what is set. */
export function uploadQuery(fields: UploadFields): string {
  const query = new URLSearchParams({ filename: fields.filename });
  for (const key of ["description", "license", "comment"] as const) {
    const value = fields[key]?.trim();
    if (value) query.set(key, value);
  }
  for (const category of fields.categories ?? []) {
    if (category.trim()) query.append("category", category.trim());
  }
  if (fields.ignoreWarnings) query.set("ignorewarnings", "1");
  return query.toString();
}

/** Whether `file` is within the size limit, as a sentence when it is not: the form says so before the file is sent. */
export function uploadSizeProblem(file: { size: number }): string | null {
  return file.size > MAX_UPLOAD_BYTES
    ? `The file is larger than the ${MAX_UPLOAD_BYTES / 1_000_000} MB limit.`
    : null;
}

/** MediaWiki's warnings as sentences for the uploader. */
export function describeWarnings(warnings: UploadWarnings): string[] {
  const lines: string[] = [];
  if (warnings.nochange) {
    lines.push(
      `"${warnings.exists ?? "This file"}" already has exactly this file as its current version.`
    );
  } else if (warnings.exists) {
    lines.push(
      `A file called "${warnings.exists}" already exists. Uploading will replace it with a new version.`
    );
  }
  if (warnings.duplicate?.length) {
    lines.push(
      `The same file is already uploaded as ${warnings.duplicate.map((name) => `"${name}"`).join(", ")}.`
    );
  }
  return lines;
}

interface ErrorBody {
  error?: string;
  code?: string;
}

/**
 * Upload `file`. Resolves to the file, or to the warnings the user has to accept (send it again with `ignoreWarnings`);
 * rejects with `UploadFailed` for everything MediaWiki would refuse, and with the network's own error otherwise.
 */
export async function postUpload(file: Blob, fields: UploadFields): Promise<UploadResponse> {
  const problem = uploadSizeProblem(file);
  if (problem) throw new UploadFailed("file-too-large", problem);
  const response = await fetch(`${withBasePath(UPLOAD_ROUTE)}?${uploadQuery(fields)}`, {
    method: "POST",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  const body = (await response.json().catch(() => ({}))) as UploadResponse | ErrorBody;
  if (!response.ok || !("result" in body)) {
    const error = body as ErrorBody;
    throw new UploadFailed(
      error.code ?? "upload-failed",
      error.error ?? `The upload failed (${response.status}).`
    );
  }
  return body;
}
