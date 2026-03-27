/**
 * Province Upload API Route
 *
 * Handles province SVG/PNG file uploads via multipart FormData.
 * Country-owner accessible (not admin-only like the world SVG upload).
 * Stores the file content in the database and returns the upload ID.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { db } from "~/server/db";
import { createHash } from "crypto";
import { extractSvgMetadata } from "~/lib/svg-parser";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB (smaller than world map's 50MB)
const VALID_EXTENSIONS = [".svg", ".png"];

export async function POST(request: NextRequest) {
  try {
    // Auth check — country owner or admin
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const countryId = formData.get("countryId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!countryId) {
      return NextResponse.json({ error: "Country ID required" }, { status: 400 });
    }

    // Validate file extension
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!VALID_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Invalid file type. Must be one of: ${VALID_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
    }

    // Verify country ownership (unless system owner or admin)
    if (!isSystemOwner(session.userId)) {
      const role = (session.sessionClaims?.metadata as Record<string, unknown>)?.role;
      const isAdmin = ["admin", "owner", "staff"].includes(role as string);

      if (!isAdmin) {
        // Check if user owns this country
        const country = await db.country.findUnique({
          where: { id: countryId },
          select: { ownerId: true },
        });

        if (!country) {
          return NextResponse.json({ error: "Country not found" }, { status: 404 });
        }
        if (country.ownerId !== session.userId) {
          return NextResponse.json({ error: "You do not own this country" }, { status: 403 });
        }
      }
    }

    // Read file content
    const fileBuffer = await file.arrayBuffer();
    const fileContent = ext === ".svg"
      ? new TextDecoder().decode(fileBuffer)
      : Buffer.from(fileBuffer).toString("base64"); // Base64 encode PNG

    // Hash for dedup check
    const fileHash = createHash("sha256").update(Buffer.from(fileBuffer)).digest("hex");

    // Dedup check — if the same file was already uploaded, return it
    const existingUpload = await db.svgUpload.findFirst({
      where: { svgHash: fileHash, layerType: "province", status: { not: "rolled_back" } },
    });
    if (existingUpload) {
      // Return the existing upload so the wizard can reuse it
      return NextResponse.json({
        id: existingUpload.id,
        fileName: existingUpload.fileName,
        fileSizeBytes: existingUpload.fileSizeBytes,
        fileType: ext.slice(1),
        countryId,
        metadata: existingUpload.svgMetadata ?? {},
        reused: true,
      });
    }

    // Extract metadata for SVG files
    let metadata: Record<string, unknown> = { fileType: ext.slice(1), countryId };
    if (ext === ".svg") {
      try {
        const svgMeta = extractSvgMetadata(fileContent);
        metadata = { ...metadata, ...svgMeta };
      } catch {
        // Non-critical — metadata extraction failure is OK
      }
    } else {
      metadata.fileSize = file.size;
      metadata.encoding = "base64";
    }

    // Create upload record
    const upload = await db.svgUpload.create({
      data: {
        layerType: "province",
        fileName: file.name,
        fileSizeBytes: file.size,
        svgHash: fileHash,
        status: "pending",
        uploadedBy: session.userId,
        svgContent: fileContent,
        svgMetadata: metadata,
      },
    });

    return NextResponse.json({
      id: upload.id,
      fileName: upload.fileName,
      fileSizeBytes: upload.fileSizeBytes,
      fileType: ext.slice(1),
      countryId,
      metadata,
    });
  } catch (error) {
    console.error("[UploadProvince] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
