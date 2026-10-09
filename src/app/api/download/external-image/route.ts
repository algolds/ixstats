// API endpoint for downloading external images and saving to server filesystem
// Handles CORS issues, validates downloaded images, and caches them locally
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { writeFile, mkdir, access, rename, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
import { rateLimiter } from "~/lib/cache";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_REDIRECTS = 3;
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

// Vector images can carry script, and files land in public/ on the app origin: raster only.

// Get base path for production deployments (e.g., /projects/ixstats)
const BASE_PATH = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "";

const ALLOWED_TYPES = Object.keys(EXTENSION_BY_TYPE);

// Trusted domains for image downloads
const TRUSTED_DOMAINS = [
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "images.unsplash.com",
  new URL(mediaWikiOrigin()).hostname,
  "iiwiki.com",
  "cdn.discordapp.com",
];

function isTrustedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return false;
    }
    return TRUSTED_DOMAINS.some(
      (domain) => urlObj.hostname === domain || urlObj.hostname.endsWith("." + domain)
    );
  } catch {
    return false;
  }
}

type TrustedFetchResult = { ok: true; response: Response } | { ok: false; error: string };

/** Fetch `url`, following at most MAX_REDIRECTS redirects, each re-checked against TRUSTED_DOMAINS. */
async function fetchFromTrustedHosts(url: string): Promise<TrustedFetchResult> {
  const signal = AbortSignal.timeout(10000);
  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // CRITICAL: Must use "IxStats-Builder" user agent for IIWiki compatibility
    const response = await fetch(currentUrl, {
      headers: { "User-Agent": "IxStats-Builder", Accept: "image/*" },
      redirect: "manual",
      signal,
    });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      return { ok: true, response };
    }
    const nextUrl = new URL(location, currentUrl).toString();
    if (!isTrustedDomain(nextUrl)) {
      return { ok: false, error: "Redirect to untrusted host" };
    }
    currentUrl = nextUrl;
  }
  return { ok: false, error: "Too many redirects" };
}

/** Read the body, giving up (and cancelling the stream) as soon as it exceeds `maxBytes`. */
async function readBodyCapped(response: Response, maxBytes: number): Promise<Buffer | null> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function badRequest(error: string): NextResponse {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Content-addressed name: identical bytes always map to one file, changed bytes to a new one. */
function generateSafeFileName(content: Buffer, contentType: string): string {
  const hash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 32);
  const extension = EXTENSION_BY_TYPE[contentType] || "png";
  return `downloaded_${hash}.${extension}`;
}

function startsWithBytes(buffer: Buffer, bytes: number[], offset = 0): boolean {
  return bytes.every((byte, i) => buffer[offset + i] === byte);
}

const ASCII = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

/** True when the leading bytes are a PNG, JPEG, GIF or WEBP signature that matches `contentType`. */
function matchesDeclaredSignature(buffer: Buffer, contentType: string): boolean {
  switch (EXTENSION_BY_TYPE[contentType]) {
    case "png":
      return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
      return startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
    case "gif":
      return startsWithBytes(buffer, ASCII("GIF87a")) || startsWithBytes(buffer, ASCII("GIF89a"));
    case "webp":
      return startsWithBytes(buffer, ASCII("RIFF")) && startsWithBytes(buffer, ASCII("WEBP"), 8);
    default:
      return false;
  }
}

/** Write via a temp file in the same directory and rename, so readers never see a partial file. */
async function writeAtomically(filePath: string, buffer: Buffer): Promise<void> {
  const tempPath = `${filePath}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  try {
    await writeFile(tempPath, buffer);
    await rename(tempPath, filePath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  let imageUrl = "unknown";
  try {
    // Authenticate the request
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY: each call fetches from a remote host and writes to disk, so it has its own tighter limit
    const rateLimitResult = await rateLimiter.check(userId, "external_image_download", {
      maxRequests: 20,
      windowMs: 60_000,
    });
    if (!rateLimitResult.success) {
      console.warn(`[SECURITY] Rate limit exceeded for external image download: userId=${userId}`);
      const retryAfter = Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please try again later.", retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const body = (await request.json()) as { imageUrl?: string | null };
    if (!body.imageUrl || typeof body.imageUrl !== "string") {
      return badRequest("Invalid image URL");
    }
    imageUrl = body.imageUrl;

    // Validate URL format
    if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
      return badRequest("Invalid URL protocol");
    }

    // Check if domain is trusted
    if (!isTrustedDomain(imageUrl)) {
      return badRequest("Untrusted image source");
    }
    if (new URL(imageUrl).port !== "") {
      return badRequest("Explicit ports are not allowed");
    }

    console.log(`[ExternalImageDownload] Downloading: ${imageUrl}`);

    const fetched = await fetchFromTrustedHosts(imageUrl);
    if (!fetched.ok) {
      return badRequest(fetched.error);
    }
    const imageResponse = fetched.response;

    if (!imageResponse.ok) {
      throw new Error(`HTTP ${imageResponse.status}: ${imageResponse.statusText}`);
    }

    const contentType = imageResponse.headers.get("content-type") || "image/png";
    if (/svg/i.test(contentType)) return badRequest("SVG images are not supported for download");
    if (!ALLOWED_TYPES.includes(contentType)) {
      return badRequest(
        `Invalid file type: ${contentType}. Allowed types: PNG, JPG, GIF, WEBP. URL: ${imageUrl}`
      );
    }

    const declaredLength = Number(imageResponse.headers.get("content-length"));
    if (declaredLength > MAX_FILE_SIZE) {
      return badRequest("Image exceeds 5MB limit");
    }
    const buffer = await readBodyCapped(imageResponse, MAX_FILE_SIZE);
    if (!buffer) {
      return badRequest("Image exceeds 5MB limit");
    }

    if (!matchesDeclaredSignature(buffer, contentType)) {
      return badRequest("File contents do not match the declared image type");
    }

    // Name the file by its content
    const fileName = generateSafeFileName(buffer, contentType);

    // Ensure images directory exists
    const imagesDir = path.join(process.cwd(), "public", "images", "downloaded");
    await mkdir(imagesDir, { recursive: true });

    // Save the file to disk (identical bytes find it already there)
    const filePath = path.join(imagesDir, fileName);
    if (!(await fileExists(filePath))) {
      await writeAtomically(filePath, buffer);
    }

    // Generate public URL with base path for production
    const publicUrl = BASE_PATH
      ? `${BASE_PATH}/images/downloaded/${fileName}`
      : `/images/downloaded/${fileName}`;

    console.log(
      `[ExternalImageDownload] Successfully saved: ${fileName} (${buffer.byteLength} bytes) to ${publicUrl}`
    );

    return NextResponse.json({
      success: true,
      url: publicUrl,
      originalUrl: imageUrl,
      fileName,
      fileSize: buffer.byteLength,
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

    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      return NextResponse.json(
        { success: false, error: "Download timeout - image took too long to download" },
        { status: 408 }
      );
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
