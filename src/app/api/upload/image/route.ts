// API endpoint for uploading images (flags, coat of arms, etc.)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/svg", // Support browsers that send image/svg for SVG files
];

// Get base path for production deployments (e.g., /projects/ixstats)
const BASE_PATH = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "";

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

    // Generate safe file name
    const fileName = generateSafeFileName(file.name, userId, file.type);

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "public", "images", "uploads");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
      console.log(`[ImageUpload] Created directory: ${uploadsDir}`);
    }

    // Save the file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(uploadsDir, fileName);
    await writeFile(filePath, buffer);

    // Generate public URL with base path for production
    const publicUrl = BASE_PATH ? `${BASE_PATH}/images/uploads/${fileName}` : `/images/uploads/${fileName}`;

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
