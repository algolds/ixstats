/**
 * SVG Upload API Route
 *
 * Handles large SVG file uploads via multipart FormData.
 * Bypasses the default tRPC body size limit (~10MB).
 * Stores the SVG content in the database and returns the upload ID.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isSystemOwner } from "~/lib/auth";
import { db } from "~/server/db";
import { createHash } from "crypto";
import { extractSvgMetadata } from "~/lib/flags/svg-parser";

const VALID_LAYER_TYPES = [
  "political",
  "climate",
  "altitudes",
  "rivers",
  "lakes",
  "icecaps",
  "background",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!isSystemOwner(session.userId)) {
      const role = (session.sessionClaims?.metadata as any)?.role;
      if (!["admin", "owner", "staff"].includes(role as string)) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const layerType = formData.get("layerType") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!layerType || !VALID_LAYER_TYPES.includes(layerType)) {
      return NextResponse.json(
        { error: `Invalid layer type. Must be one of: ${VALID_LAYER_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!file.name.endsWith(".svg")) {
      return NextResponse.json({ error: "File must be an SVG" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    // Read file content as text
    const svgContent = await file.text();

    // Hash for dedup check
    const svgHash = createHash("sha256").update(svgContent).digest("hex");

    const existingUpload = await db.svgUpload.findFirst({
      where: { svgHash, layerType, status: { not: "rolled_back" } },
    });
    if (existingUpload) {
      return NextResponse.json(
        {
          error: `This SVG has already been uploaded (ID: ${existingUpload.id}, status: ${existingUpload.status})`,
        },
        { status: 409 }
      );
    }

    // Extract metadata
    const metadata = extractSvgMetadata(svgContent);

    // Create upload record
    const upload = await db.svgUpload.create({
      data: {
        layerType,
        fileName: file.name,
        fileSizeBytes: file.size,
        svgHash,
        status: "pending",
        uploadedBy: session.userId,
        svgContent,
        svgMetadata: metadata as unknown as Record<string, unknown> as any,
      },
    });

    return NextResponse.json({
      id: upload.id,
      fileName: upload.fileName,
      fileSizeBytes: upload.fileSizeBytes,
      layerType: upload.layerType,
      svgMetadata: metadata as any,
    });
  } catch (error) {
    console.error("[UploadSVG] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

// App Router uses FormData natively — no body parser config needed.
// The 50MB limit is enforced in the handler above.
