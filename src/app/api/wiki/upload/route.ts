/**
 * src/app/api/wiki/upload/route.ts — upload a file to WikiOS (plan 411): the browser's way in; api.php's `action=upload`
 * is the bots'. Both end in `uploadFile` (services/upload-service.ts).
 *
 * POST: the file is the raw request body (not multipart: no overhead, one pass), counted as it streams in and refused
 * past 10,000,000 bytes whatever Content-Length says. That is below `experimental.proxyClientMaxBodySize` (10 MiB by
 * default): Next clones the body of a request that passes through src/proxy.ts and silently truncates the clone at that
 * size, so a limit above it could not be told from a cut-off file. Raise both together (docs/operations/wikios-v1-cutover.md).
 * The name and the description page's fields are in the query string (`filename`, `description`, `license`, repeated
 * `category`, `comment`, `ignorewarnings`; see lib/wiki-os/upload-api.ts for their lengths).
 *
 * The answer is 200 with `result: "Success"` (the file, its URL and facts) or `result: "Warning"` and the warnings to accept
 * first, or `{ error, code }` with 400 (a file that may not be uploaded, MediaWiki's code), 401, 403 (the rights engine's
 * reason code first), 409 (a deleted file name), 413, 415 or 429.
 *
 * A form post cannot be forged across sites: the body must not be of a type a form can send (a cross-site fetch with
 * another type needs a CORS preflight, which this route never allows).
 *
 * GET: whether the caller may upload at all, and the limits, for the upload page.
 */

import { NextRequest, NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { rateLimiter } from "~/lib/cache/rate-limiter";
import { MAX_UPLOAD_BYTES, UPLOAD_EXTENSIONS } from "~/lib/wiki-os/config";
import { UPLOAD_FIELD_LIMITS } from "~/lib/wiki-os/upload-api";
import { getWikiPermissions } from "~/lib/wiki-os/rights";
import { UploadError } from "~/lib/wiki-os/services/upload-error";
import { uploadFile } from "~/lib/wiki-os/services/upload-service";
import { byteLimit, PayloadTooLargeError } from "~/lib/wiki-os/xml/upload-stream";
import { createTRPCContext } from "~/server/api/trpc/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOADS_PER_MINUTE = 20;
/** The body types an HTML form can send across sites. */
const FORM_TYPES = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];

const querySchema = z.object({
  filename: z.string().min(1).max(UPLOAD_FIELD_LIMITS.filename),
  description: z.string().max(UPLOAD_FIELD_LIMITS.description).optional(),
  license: z.string().max(UPLOAD_FIELD_LIMITS.license).optional(),
  comment: z.string().max(UPLOAD_FIELD_LIMITS.comment).optional(),
  category: z
    .array(z.string().min(1).max(UPLOAD_FIELD_LIMITS.category))
    .max(UPLOAD_FIELD_LIMITS.categories),
});

const fail = (status: number, error: string, code?: string) =>
  NextResponse.json({ error, ...(code ? { code } : {}) }, { status });

/** The refusal of `uploadFile` as the answer the route gives; null for an error that is not one. */
function refusal(error: unknown): NextResponse | null {
  if (error instanceof UploadError) {
    return fail(error.code === "file-too-large" ? 413 : 400, error.message, error.code);
  }
  if (!(error instanceof TRPCError)) return null;
  // The rights engine writes its reason code first ("protectedpage: ...").
  const code = /^([a-z-]+):/.exec(error.message)?.[1];
  const status = { FORBIDDEN: 403, UNAUTHORIZED: 401, BAD_REQUEST: 400, PRECONDITION_FAILED: 409 }[
    error.code as string
  ];
  return status ? fail(status, error.message, code) : null;
}

/** The request body, counted as it streams: past the limit the stream stops and `null` comes back. */
async function readBody(req: NextRequest): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  try {
    const reader = req.body.pipeThrough(byteLimit(MAX_UPLOAD_BYTES, "The upload")).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return null;
    throw error;
  }
  return Buffer.concat(chunks);
}

export async function GET(req: NextRequest) {
  const ctx = await createTRPCContext({ headers: req.headers, req });
  const canUpload = ctx.user ? (await getWikiPermissions(ctx)).rights.has("upload") : false;
  return NextResponse.json({
    signedIn: Boolean(ctx.user),
    canUpload,
    maxBytes: MAX_UPLOAD_BYTES,
    extensions: UPLOAD_EXTENSIONS,
  });
}

export async function POST(req: NextRequest) {
  const ctx = await createTRPCContext({ headers: req.headers, req });
  if (!ctx.user) return fail(401, "You must be signed in to upload a file.", "mustbeloggedin");

  const type = (req.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (type === "" || FORM_TYPES.includes(type)) {
    return fail(415, "Send the file as the request body, with its own Content-Type.");
  }

  const limit = await rateLimiter.check(ctx.rateLimitIdentifier, "wiki_upload", {
    maxRequests: UPLOADS_PER_MINUTE,
    windowMs: 60_000,
  });
  if (!limit.success) return fail(429, "Too many uploads: try again in a minute.", "ratelimited");

  const params = req.nextUrl.searchParams;
  const query = querySchema.safeParse({
    filename: params.get("filename") ?? "",
    description: params.get("description") ?? undefined,
    license: params.get("license") ?? undefined,
    comment: params.get("comment") ?? undefined,
    category: params.getAll("category"),
  });
  if (!query.success) {
    return fail(
      400,
      `Invalid upload parameters: ${query.error.issues[0]?.message ?? "see the limits"}.`,
      "badparams"
    );
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) {
    return fail(
      413,
      `The file is larger than the ${MAX_UPLOAD_BYTES / 1_000_000} MB limit.`,
      "file-too-large"
    );
  }
  const bytes = await readBody(req);
  if (!bytes) {
    return fail(
      413,
      `The file is larger than the ${MAX_UPLOAD_BYTES / 1_000_000} MB limit.`,
      "file-too-large"
    );
  }

  try {
    const { category, ...fields } = query.data;
    const result = await uploadFile({
      ctx,
      bytes,
      ...fields,
      categories: category,
      ignoreWarnings: params.has("ignorewarnings"),
    });
    return NextResponse.json(result);
  } catch (error) {
    const known = refusal(error);
    if (known) return known;
    console.error("[wiki upload] failed:", error);
    return fail(500, "The upload failed.");
  }
}
