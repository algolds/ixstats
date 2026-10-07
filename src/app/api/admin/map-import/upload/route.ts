/**
 * Map import upload: the PNG/JPEG/SVG/GeoJSON file of a realm map import, as multipart form data (field `file`),
 * for the realm in `?realm=<realm id>`. Site admins and the realm's founder. The body is refused by its
 * Content-Length before it is read when it is over the limit (MAX_MAP_IMPORT_BYTES), and again by the file's own
 * size. Returns the upload id the wizard passes to geoEditor.mapImport.start, with the file's kind and size.
 */
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { rateLimiter } from "~/lib/cache";
import { MAX_MAP_IMPORT_BYTES } from "~/lib/maps/import/options";
import { oversizedUploadResponse } from "~/server/shared/request-size";
import { requireAdminSession } from "~/server/shared/route-auth";
import { acceptMapUpload } from "~/server/modules/maps/map-import.upload";
import { MapImportError } from "~/server/modules/maps/map-import.realm";

const STATUS: Record<MapImportError["code"], number> = {
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const realmId = request.nextUrl.searchParams.get("realm") ?? "";
  const realm = realmId
    ? await db.realm.findUnique({ where: { id: realmId }, select: { id: true, ownerId: true } })
    : null;
  if (!realm) return NextResponse.json({ error: "Unknown realm" }, { status: 404 });
  if (realm.ownerId !== userId) {
    const admin = await requireAdminSession("Only site admins and the realm's founder import its map");
    if (admin instanceof NextResponse) return admin;
  }

  const limited = await rateLimiter.check(userId, "file_upload");
  if (!limited.success) {
    return NextResponse.json({ error: "Too many uploads. Try again in a minute." }, { status: 429 });
  }

  // Refuse an oversize body by its Content-Length before formData() buffers it
  const tooLarge = oversizedUploadResponse(request, MAX_MAP_IMPORT_BYTES);
  if (tooLarge) return tooLarge;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > MAX_MAP_IMPORT_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_MAP_IMPORT_BYTES / 1024 / 1024}MB)` },
        { status: 413 }
      );
    }
    const info = await acceptMapUpload(new Uint8Array(await file.arrayBuffer()), file.name);
    return NextResponse.json(info);
  } catch (error) {
    if (error instanceof MapImportError) {
      return NextResponse.json({ error: error.message }, { status: STATUS[error.code] });
    }
    console.error("[MapImportUpload] Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
