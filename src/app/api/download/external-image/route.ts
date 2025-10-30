// API endpoint for downloading external images and converting to base64
// Handles CORS issues and validates downloaded images
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

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
  };
  return typeMap[contentType] || "png";
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
    const imageResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": "IxStats/1.0 (Country Builder)",
        Accept: "image/*",
      },
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    });

    if (!imageResponse.ok) {
      throw new Error(`HTTP ${imageResponse.status}: ${imageResponse.statusText}`);
    }

    // Get content type
    const contentType = imageResponse.headers.get("content-type") || "image/png";

    // Validate content type
    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file type: ${contentType}. Allowed types: PNG, JPG, GIF, WEBP, SVG`,
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

    // Convert to base64
    const buffer = Buffer.from(imageBuffer);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    // Generate file name
    const originalFileName = getFileNameFromUrl(imageUrl);
    const extension = getFileExtensionFromType(contentType);
    const fileName = originalFileName.includes(".")
      ? originalFileName
      : `${originalFileName}.${extension}`;

    console.log(
      `[ExternalImageDownload] Successfully downloaded: ${fileName} (${imageBuffer.byteLength} bytes)`
    );

    return NextResponse.json({
      success: true,
      dataUrl,
      originalUrl: imageUrl,
      fileName,
      fileSize: imageBuffer.byteLength,
      fileType: contentType,
      downloadedAt: Date.now(),
    });
  } catch (error) {
    console.error("[ExternalImageDownload] Error:", error);

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
