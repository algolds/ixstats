import { NextResponse } from "next/server";

/** Room for the multipart boundaries and the form's other fields on top of the file itself. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/**
 * A 413 response when the request's Content-Length says its multipart body is larger than a `maxFileBytes` file
 * (plus the form's overhead), otherwise null. Check it before `request.formData()`, which buffers the whole body:
 * an oversize upload is then refused without reading it. A body sent without a Content-Length (chunked) is only
 * held to the handler's own file-size check after parsing.
 */
export function oversizedUploadResponse(
  request: Request,
  maxFileBytes: number
): NextResponse | null {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declared) || declared <= maxFileBytes + MULTIPART_OVERHEAD_BYTES)
    return null;
  return NextResponse.json(
    { error: `File too large (max ${Math.round(maxFileBytes / 1024 / 1024)}MB)` },
    { status: 413 }
  );
}
