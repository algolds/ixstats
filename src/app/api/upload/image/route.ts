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
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import { rateLimiter } from "~/lib/rate-limiter";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const UPLOAD_RATE_LIMIT = 10; // Max uploads per minute per user

// SECURITY: Only allow specific image types
// Note: SVG support is limited due to XSS risks - consider removing if not needed
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  // SVG is allowed but sanitized - see sanitizeSvg function
  "image/svg+xml",
  "image/svg",
];

/**
 * SECURITY: Sanitize SVG content to remove potential XSS vectors
 * Removes script tags, event handlers, and dangerous attributes
 */
function sanitizeSvg(svgContent: string): string {
  // Remove script tags and their content
  let sanitized = svgContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Remove event handler attributes (onclick, onload, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, "");

  // Remove javascript: and data: URLs in href/xlink:href/src attributes
  sanitized = sanitized.replace(/(href|xlink:href|src)\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, "");
  sanitized = sanitized.replace(
    /(href|xlink:href|src)\s*=\s*["']?\s*data:text\/html[^"'\s>]*/gi,
    ""
  );

  // Remove foreignObject elements (can embed HTML)
  sanitized = sanitized.replace(
    /<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi,
    ""
  );

  // Remove use elements with external references (can load external content)
  sanitized = sanitized.replace(/<use\b[^>]*xlink:href\s*=\s*["'][^#][^"']*["'][^>]*>/gi, "");

  return sanitized;
}

function generateSafeFileName(originalName: string, userId: string, fileType: string): string {
  // Create a hash combining user ID and timestamp for uniqueness
  const hash = crypto
    .createHash("md5")
    .update(`${userId}-${Date.now()}-${originalName}`)
    .digest("hex");
  const extension = fileType.split("/")[1] || "png";
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
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000)
            ),
          },
        }
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
        {
          success: false,
          error: "File size exceeds 5MB limit",
        },
        { status: 400 }
      );
    }

    // Generate safe file name and ensure no directory traversal
    const fileName = path.basename(generateSafeFileName(file.name, userId, file.type));

    // Ensure uploads directory exists
    const uploadsDir =
      process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "images", "uploads");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
      console.log(`[ImageUpload] Created directory: ${uploadsDir}`);
    }

    // Get file content
    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    // SECURITY: Sanitize SVG files to remove XSS vectors
    const isSvg = file.type === "image/svg+xml" || file.type === "image/svg";
    if (isSvg) {
      const svgContent = buffer.toString("utf-8");
      const sanitizedSvg = sanitizeSvg(svgContent);
      buffer = Buffer.from(sanitizedSvg, "utf-8");
      console.log(`[ImageUpload] Sanitized SVG file for user ${userId}: ${file.name}`);
    }

    // Save the file to disk
    const filePath = path.join(uploadsDir, fileName);
    await writeFile(filePath, buffer);

    // Generate public URL without base path (dynamic base path resolved on frontend)
    const publicUrl = `/images/uploads/${fileName}`;

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
  } catch (error) {
    return NextResponse.json(
      {
        authenticated: false,
        error: "Failed to check authentication",
      },
      { status: 500 }
    );
  }
}
