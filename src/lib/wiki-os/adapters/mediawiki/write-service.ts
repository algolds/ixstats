/**
 * write-service.ts — the Action API calls of the WikiOS mirror, made as its bot account.
 *
 * `postMediaWikiAction` / `getMediaWikiAction` send one parsed, schema-checked call; an API error is a
 * `MediaWikiApiError` carrying MediaWiki's error code, so callers can tell "already done" from "refused".
 * The mirror worker (services/mirror-worker.ts) is the only writer: pages (mirror-revision.ts, mirror-page-ops.ts)
 * and uploaded files (mirror-upload.ts, plan 411) all go out through these helpers.
 */

import { z } from "zod";
import { DEFAULT_USER_AGENT, wikiosConfig } from "~/lib/wiki-os/config";
import { requestSignal } from "~/lib/wiki-os/adapters/mediawiki/attempt-scope";
import {
  getBotSessionAndToken,
  invalidateCsrfToken,
  readApiBody,
} from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";

const REQUEST_TIMEOUT_MS = 30_000;
/**
 * A call with a file part is longer: an import updates MediaWiki's link tables and caches for every revision it makes
 * the page's current one, so a batch of revisions of a big page takes a while; an upload sends up to 10 MB and has
 * MediaWiki check and store it.
 */
const IMPORT_TIMEOUT_MS = 120_000;

/** MediaWiki answered with an `error` object: its `code` ("badtoken", "missingtitle", "cantimport", ...) and info. */
export class MediaWikiApiError extends Error {
  constructor(
    readonly code: string,
    info: string
  ) {
    super(`MediaWiki ${code}${info ? `: ${info}` : ""}`);
    this.name = "MediaWikiApiError";
  }
}

const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), info: z.string().optional() }),
});

/** A file sent as a multipart part: the XML of an `action=import`, or the bytes of an `action=upload`. */
export interface UploadPart {
  field: string;
  filename: string;
  contentType: string;
  content: string | Uint8Array<ArrayBuffer>;
}

export interface MediaWikiWriteResult {
  success: boolean;
  pageId?: number;
  title?: string;
  revisionId?: number;
  noChange?: boolean;
  result: WriteResponse;
}

const writeResponseSchema = z.looseObject({
  edit: z
    .looseObject({
      result: z.string(),
      pageid: z.number().optional(),
      title: z.string().optional(),
      newrevid: z.number().optional(),
      nochange: z.boolean().optional(),
      oldrevid: z.number().optional(),
    })
    .optional(),
});
type WriteResponse = z.infer<typeof writeResponseSchema>;

/** The POST body: the call's fields, the file if any, and the CSRF token last (MediaWiki wants it after everything else). */
function postBody(
  fields: Record<string, string>,
  csrfToken: string,
  file: UploadPart | undefined
): URLSearchParams | FormData {
  if (!file) return new URLSearchParams({ ...fields, token: csrfToken });
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set(file.field, new Blob([file.content], { type: file.contentType }), file.filename);
  form.set("token", csrfToken);
  return form;
}

async function send<T>(
  method: "GET" | "POST",
  params: Record<string, string>,
  schema: z.ZodType<T>,
  file?: UploadPart
): Promise<T> {
  const { cookies, csrfToken } = await getBotSessionAndToken();
  const fields = { ...params, format: "json", formatversion: "2" };
  const headers = {
    "User-Agent": DEFAULT_USER_AGENT,
    ...(cookies.length > 0 ? { Cookie: cookies.join("; ") } : {}),
  };
  const signal = requestSignal(file ? IMPORT_TIMEOUT_MS : REQUEST_TIMEOUT_MS);

  let res: Response;
  if (method === "GET") {
    const url = new URL(wikiosConfig.mediawiki.writeApiUrl);
    for (const [key, value] of Object.entries(fields)) url.searchParams.set(key, value);
    res = await fetch(url.toString(), { headers, signal });
  } else {
    res = await fetch(wikiosConfig.mediawiki.writeApiUrl, {
      method: "POST",
      headers,
      body: postBody(fields, csrfToken, file),
      signal,
    });
  }
  const body = await readApiBody(res, params.action ?? "request");
  const apiError = apiErrorSchema.safeParse(body);
  if (apiError.success) {
    throw new MediaWikiApiError(apiError.data.error.code, apiError.data.error.info ?? "");
  }
  return schema.parse(body);
}

/** One read of api.php as the mirror account; throws `MediaWikiApiError` on an API error. */
export function getMediaWikiAction<T>(
  params: Record<string, string>,
  schema: z.ZodType<T>
): Promise<T> {
  return send("GET", params, schema);
}

/**
 * One write to api.php as the mirror account (the CSRF token is added). A token that expired is renewed and the
 * call made once more.
 */
export async function postMediaWikiAction<T>(
  params: Record<string, string>,
  schema: z.ZodType<T>,
  file?: UploadPart
): Promise<T> {
  try {
    return await send("POST", params, schema, file);
  } catch (error) {
    if (!(error instanceof MediaWikiApiError) || error.code !== "badtoken") throw error;
    invalidateCsrfToken();
    return send("POST", params, schema, file);
  }
}

export async function executeMediaWikiWrite(
  params: Record<string, string | number>
): Promise<MediaWikiWriteResult> {
  const fields = Object.fromEntries(Object.entries(params).map(([key, val]) => [key, String(val)]));
  const data = await postMediaWikiAction(fields, writeResponseSchema);
  const edit = data.edit;

  return {
    success: edit?.result === "Success",
    pageId: edit?.pageid,
    title: edit?.title,
    revisionId: edit?.newrevid,
    noChange: edit?.nochange,
    result: data,
  };
}
