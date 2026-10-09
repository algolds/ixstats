/**
 * API endpoint for uploading images (flags, coat of arms, etc.)
 *
 * SECURITY:
 * - Requires Clerk authentication
 * - Rate limited to prevent abuse (10 uploads per minute per user)
 * - File type validation (whitelist)
 * - File size validation (5MB max)
 * - Safe filename generation
 * - SVG files are sanitized to remove potential XSS vectors
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { rateLimiter } from "~/lib/cache";
import { uploadsDir as getUploadsDir, UPLOADS_URL_PREFIX } from "~/server/shared/upload-storage";
import { registerUploadedAsset } from "~/server/shared/uploaded-assets";
import { sanitizeSvg } from "~/lib/media/svg-sanitize";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// SECURITY: Only allow specific image types
// Note: SVG support is limited due to XSS risks - consider removing if not needed
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  // SVG is allowed but sanitized - see sanitizeSvg in ~/lib/media/svg-sanitize
  "image/svg+xml",
  "image/svg",
];

function generateSafeFileName(originalName: string, userId: string): string {
  // Create a hash combining user ID and timestamp for uniqueness
  const hash = crypto
    .createHash("md5")
    .update(`${userId}-${Date.now()}-${originalName}`)
    .digest("hex");
  const timestamp = Date.now();
  // Sanitize original name
  const safeName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .substring(0, 50);
  return `uploaded_${timestamp}_${hash.substring(0, 8)}_${safeName}`;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY: Rate limit file uploads
    const rateLimitResult = await rateLimiter.check(userId, "file_upload");
    if (!rateLimitResult.success) {
      console.warn(`[SECURITY] Rate limit exceeded for file upload: userId=${userId}`);
      const retryAfter = Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please try again later.", retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file type. Allowed types: PNG, JPG, GIF, WEBP, SVG",
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "File size exceeds 5MB limit" },
        { status: 400 }
      );
    }

    // Generate safe file name and ensure no directory traversal
    const fileName = path.basename(generateSafeFileName(file.name, userId));

    // Ensure uploads directory exists
    const uploadsDir = getUploadsDir();
    await mkdir(uploadsDir, { recursive: true });

    // Get file content
    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    // SECURITY: Sanitize SVG files to remove XSS vectors
    const isSvg = file.type === "image/svg+xml" || file.type === "image/svg";
    if (isSvg) {
      const svgContent = buffer.toString("utf-8");
      const sanitizedSvg = sanitizeSvg(svgContent);
      if (sanitizedSvg === null) {
        return NextResponse.json(
          { success: false, error: "SVG could not be sanitised" },
          { status: 400 }
        );
      }
      buffer = Buffer.from(sanitizedSvg, "utf-8");
      console.log(`[ImageUpload] Sanitized SVG file for user ${userId}: ${file.name}`);
    }

    // Save the file to disk
    const filePath = path.join(uploadsDir, fileName);
    await writeFile(filePath, buffer);

    // Generate public URL without base path (dynamic base path resolved on frontend)
    const publicUrl = `${UPLOADS_URL_PREFIX}${fileName}`;

    // Record the upload for the image repository; the result never changes the response.
    await registerUploadedAsset({
      filePath,
      url: publicUrl,
      mimeType: isSvg ? "image/svg+xml" : file.type === "image/jpg" ? "image/jpeg" : file.type,
      source: "upload",
      uploaderClerkId: userId,
      title: file.name,
    });

    console.log(
      `[ImageUpload] Successfully saved ${file.name} as ${fileName} (${file.size} bytes) for user ${userId} at ${publicUrl}`
    );

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: fileName,
      originalFileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: Date.now(),
    });
  } catch (error) {
    const formData = await request.formData().catch(() => new FormData());
    const file = formData.get("file") as File | null;

    console.error("[ImageUpload] Error:", error);
    console.error("[ImageUpload] Error details:", {
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check authentication status
export async function GET() {
  try {
    const { userId } = await auth();
    return NextResponse.json({
      authenticated: !!userId,
      maxFileSize: MAX_FILE_SIZE,
      allowedTypes: ALLOWED_TYPES,
    });
  } catch {
    return NextResponse.json(
      {
        authenticated: false,
        error: "Failed to check authentication",
      },
      { status: 500 }
    );
  }
}
