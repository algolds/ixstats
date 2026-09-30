/**
 * src/app/api/wiki/import/route.ts — admin-only import of a MediaWiki XML dump
 *
 * POST: the dump is the raw request body, `Content-Type: application/xml` (or text/xml) or
 * `application/gzip` / `application/x-gzip`. It is streamed, never buffered: through a byte counter
 * that fails past the limit (9.5 MiB by default, whatever Content-Length says), through gunzip for
 * gzip (the expanded size is bounded too), into the importer page by page. `?dryRun=false` writes;
 * anything else, or no `dryRun`, only reads and reports what would happen. Responds with the import
 * summary as JSON. A larger dump is imported with `scripts/wikios-import-xml.ts`.
 *
 * GET answers whether the caller may import at all (and the size limit), for the import page.
 *
 * The limit sits below Next.js's own `experimental.proxyClientMaxBodySize` (10 MiB by default):
 * Next clones request bodies for its proxy and silently truncates the clone at that size, so a
 * limit above it could never be told apart from a cut-off dump. Raise both together
 * (docs/operations/wikios-v1-cutover.md) through WIKIOS_IMPORT_MAX_BYTES.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isWikiAdmin } from "~/lib/wiki-os/auth";
import { readExport } from "~/lib/wiki-os/xml/import-reader";
import { DEFAULT_MAX_UPLOAD_BYTES, uploadKind } from "~/lib/wiki-os/xml/import-request";
import { importExport, type ImportSummary } from "~/lib/wiki-os/xml/importer";
import { openUpload, PayloadTooLargeError } from "~/lib/wiki-os/xml/upload-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A gzip dump may expand to this much: MediaWiki text compresses about 10 to 20 times. */
const MAX_EXPANDED_BYTES = 256 * 1024 * 1024;
const MAX_ITEMS_REPORTED = 200;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** The upload limit: WIKIOS_IMPORT_MAX_BYTES when it is a positive number, else the default. */
function maxUploadBytes(): number {
  const configured = Number(process.env.WIKIOS_IMPORT_MAX_BYTES);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_UPLOAD_BYTES;
}

/** The failure response for a caller who may not import, or null for a wiki admin. */
async function adminFailure(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) return fail("Authentication required", 401);
  return isWikiAdmin({ auth: { userId } }) ? null : fail("Wiki admin access required", 403);
}

/** The summary as the route reports it: long lists cut, with their full counts. */
function report(summary: ImportSummary, dryRun: boolean) {
  return {
    dryRun,
    ...summary,
    errors: summary.errors.slice(0, MAX_ITEMS_REPORTED),
    errorCount: summary.errors.length,
    warnings: summary.warnings.slice(0, MAX_ITEMS_REPORTED),
    warningCount: summary.warnings.length,
  };
}

/** Whether the caller may import: 200 (with the size limit) for a wiki admin, 401 or 403 otherwise. */
export async function GET() {
  return (await adminFailure()) ?? NextResponse.json({ admin: true, maxBytes: maxUploadBytes() });
}

export async function POST(req: NextRequest) {
  const denied = await adminFailure();
  if (denied) return denied;

  const kind = uploadKind(req.headers.get("content-type"));
  if (!kind) {
    return fail(
      "Send the dump as the request body with Content-Type application/xml, or application/gzip for a gzipped dump",
      415
    );
  }
  const body = req.body;
  if (!body) return fail("The request has no body", 400);

  const maxBytes = maxUploadBytes();
  const tooLarge = `The dump is larger than ${maxBytes} bytes: import it with scripts/wikios-import-xml.ts`;
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes) return fail(tooLarge, 413);

  // Only an explicit dryRun=false writes.
  const dryRun = req.nextUrl.searchParams.get("dryRun")?.toLowerCase() !== "false";
  let exceeded = false;
  const chunks = async function* (): AsyncGenerator<Uint8Array> {
    try {
      yield* openUpload(body, {
        gzip: kind === "gzip",
        maxBytes,
        maxExpandedBytes: MAX_EXPANDED_BYTES,
      });
    } catch (error) {
      exceeded = error instanceof PayloadTooLargeError;
      throw error;
    }
  };

  const summary = await importExport(readExport(chunks()), { dryRun });
  // A body with no Content-Length (chunked) is only found too large while it streams: the pages
  // before that point were imported (each page is atomic), and the summary says which.
  if (exceeded)
    return NextResponse.json({ error: tooLarge, ...report(summary, dryRun) }, { status: 413 });
  return NextResponse.json(report(summary, dryRun));
}
