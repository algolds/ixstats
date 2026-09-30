/**
 * src/app/api/wiki/import/route.ts — admin-only import of a MediaWiki XML dump
 *
 * POST multipart/form-data: `xml` (the dump, at most 100 MB) and `dryRun` ("1" or "true": read and
 * report what would happen, write nothing). Responds with the import summary as JSON. A full-wiki
 * dump is too big for one request (proxies cut requests off): use `scripts/wikios-import-xml.ts`.
 * GET answers whether the caller is allowed to import at all.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isWikiAdmin } from "~/lib/wiki-os/auth";
import { chunksOfStream, readExport } from "~/lib/wiki-os/xml/import-reader";
import { importExport } from "~/lib/wiki-os/xml/importer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
/** Multipart framing around the file: a body much larger than the limit is refused unread. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const MAX_ERRORS_REPORTED = 200;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** The failure response for a caller who may not import, or null for a wiki admin. */
async function adminFailure(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) return fail("Authentication required", 401);
  return isWikiAdmin({ auth: { userId } }) ? null : fail("Wiki admin access required", 403);
}

/** Whether the caller may import: 200 for a wiki admin, 401 or 403 otherwise (the import page asks). */
export async function GET() {
  return (await adminFailure()) ?? NextResponse.json({ admin: true });
}

export async function POST(req: NextRequest) {
  const denied = await adminFailure();
  if (denied) return denied;

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return fail("The dump is larger than 100 MB: import it with scripts/wikios-import-xml.ts", 413);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("xml");
  if (!form || !file || typeof file === "string") {
    return fail('Upload the dump as multipart form field "xml"', 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail("The dump is larger than 100 MB: import it with scripts/wikios-import-xml.ts", 413);
  }

  const dryRun = ["1", "true"].includes(String(form.get("dryRun")));
  const summary = await importExport(readExport(chunksOfStream(file.stream())), { dryRun });
  return NextResponse.json({
    dryRun,
    ...summary,
    errors: summary.errors.slice(0, MAX_ERRORS_REPORTED),
    errorCount: summary.errors.length,
  });
}
