// API endpoint for downloading external images and saving to server filesystem
// Handles CORS issues, validates downloaded images, and caches them locally
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
  "image/svg", // Support browsers/CDNs that send image/svg for SVG files
];

// SVG files may be served with these content-types
const SVG_CONTENT_TYPES = ["image/svg+xml", "image/svg", "text/xml", "application/xml"];

// Get base path for production deployments (e.g., /projects/ixstats)
const BASE_PATH = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "";

// Trusted domains for image downloads
const TRUSTED_DOMAINS = [
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "images.unsplash.com",
  "ixwiki.com",
  "iiwiki.com",
  "cdn.discordapp.com",
];

function isTrustedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return TRUSTED_DOMAINS.some((domain) => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

function getFileNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.split("/").pop() || "image";
    return fileName;
  } catch {
    return "image";
  }
}

function getFileExtensionFromType(contentType: string): string {
  const typeMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/svg": "svg",
    "text/xml": "svg", // SVG files sometimes served as text/xml
    "application/xml": "svg", // SVG files sometimes served as application/xml
  };
  return typeMap[contentType] || "png";
}

function isSvgByUrl(url: string): boolean {
  return url.toLowerCase().endsWith(".svg");
}

function generateSafeFileName(originalUrl: string, contentType: string): string {
  // Create a hash of the URL to ensure uniqueness
  const hash = crypto.createHash("md5").update(originalUrl).digest("hex");
  const extension = getFileExtensionFromType(contentType);
  const timestamp = Date.now();
  return `downloaded_${timestamp}_${hash}.${extension}`;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ success: false, error: "Invalid image URL" }, { status: 400 });
    }

    // Validate URL format
    if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
      return NextResponse.json({ success: false, error: "Invalid URL protocol" }, { status: 400 });
    }

    // Check if domain is trusted
    if (!isTrustedDomain(imageUrl)) {
      return NextResponse.json(
        { success: false, error: "Untrusted image source" },
        { status: 400 }
      );
    }

    console.log(`[ExternalImageDownload] Downloading: ${imageUrl}`);

    // Download the image with proper headers
    // CRITICAL: Must use "IxStats-Builder" user agent for IIWiki compatibility
    const imageResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": "IxStats-Builder",
        Accept: "image/*",
      },
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    });

    if (!imageResponse.ok) {
      throw new Error(`HTTP ${imageResponse.status}: ${imageResponse.statusText}`);
    }

    // Get content type
    let contentType = imageResponse.headers.get("content-type") || "image/png";

    // Handle SVG files that may have ambiguous content-types
    // If URL ends in .svg and content-type is XML-based, treat as SVG
    const isSvgFile = isSvgByUrl(imageUrl);
    if (isSvgFile && SVG_CONTENT_TYPES.includes(contentType)) {
      contentType = "image/svg+xml"; // Normalize to standard SVG MIME type
    }

    // Validate content type
    if (!ALLOWED_TYPES.includes(contentType) && !(isSvgFile && SVG_CONTENT_TYPES.includes(contentType))) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file type: ${contentType}. Allowed types: PNG, JPG, GIF, WEBP, SVG. URL: ${imageUrl}`,
        },
        { status: 400 }
      );
    }

    // Download image as buffer
    const imageBuffer = await imageResponse.arrayBuffer();

    // Validate file size
    if (imageBuffer.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "Image exceeds 5MB limit",
        },
        { status: 400 }
      );
    }

    // Generate safe file name
    const fileName = generateSafeFileName(imageUrl, contentType);

    // Ensure images directory exists
    const imagesDir = path.join(process.cwd(), "public", "images", "downloaded");
    if (!existsSync(imagesDir)) {
      await mkdir(imagesDir, { recursive: true });
      console.log(`[ExternalImageDownload] Created directory: ${imagesDir}`);
    }

    // Save the file to disk
    const filePath = path.join(imagesDir, fileName);
    const buffer = Buffer.from(imageBuffer);
    await writeFile(filePath, buffer);

    // Generate public URL with base path for production
    const publicUrl = BASE_PATH ? `${BASE_PATH}/images/downloaded/${fileName}` : `/images/downloaded/${fileName}`;

    console.log(
      `[ExternalImageDownload] Successfully saved: ${fileName} (${imageBuffer.byteLength} bytes) to ${publicUrl}`
    );

    return NextResponse.json({
      success: true,
      url: publicUrl,
      originalUrl: imageUrl,
      fileName,
      fileSize: imageBuffer.byteLength,
      fileType: contentType,
      downloadedAt: Date.now(),
    });
  } catch (error) {
    console.error("[ExternalImageDownload] Error:", error);
    console.error("[ExternalImageDownload] Error details:", {
      imageUrl,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return NextResponse.json(
          {
            success: false,
            error: "Download timeout - image took too long to download",
          },
          { status: 408 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to download image",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check trusted domains
export async function GET() {
  try {
    const { userId } = await auth();
    return NextResponse.json({
      authenticated: !!userId,
      trustedDomains: TRUSTED_DOMAINS,
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
