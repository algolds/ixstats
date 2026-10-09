import { withBasePath } from "~/lib/base-path";
import { isWikimediaCommonsUrl, getCommonsProxyUrl } from "~/lib/wiki-os/transformers/image-url";

interface DownloadedImage {
  url: string;
  originalUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  downloadedAt: number;
}

const isDev = process.env.NODE_ENV === "development";

function debugLog(...args: (string | number | object)[]): void {
  if (isDev) console.log(...args);
}

function debugError(...args: (string | number | object)[]): void {
  if (isDev) console.error(...args);
}

/** A failed image download, tagged with a machine-readable code. */
class ImageDownloadError extends Error {
  code: string;
  statusCode?: number;
  originalUrl: string;
  originalError?: Error;

  constructor(message: string, code: string, originalUrl: string) {
    super(message);
    this.name = "ImageDownloadError";
    this.code = code;
    this.originalUrl = originalUrl;
  }
}

function isAbortError(error: Error): boolean {
  return error.name === "AbortError";
}

/**
 * Downloads an external image and saves it to the server filesystem
 * Supports CORS-enabled images from wikis and Unsplash
 * Returns a local URL to the saved image
 */
async function downloadAndConvertImage(
  imageUrl: string,
  signal?: AbortSignal
): Promise<DownloadedImage> {
  debugLog(`[ImageDownloadService] Starting download: ${imageUrl}`);

  try {
    // Use our API endpoint to download the image with proper CORS handling
    const response = await fetch(withBasePath("/api/download/external-image"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl }),
      signal,
    });

    debugLog(
      `[ImageDownloadService] API response status: ${response.status}, Content-Type: ${response.headers.get("content-type")}`
    );

    if (!response.ok) {
      // Try to parse error response
      const contentType = response.headers.get("content-type");
      let errorMessage = `Failed to download image (HTTP ${response.status})`;
      let errorCode = "DOWNLOAD_ERROR";

      try {
        // Check if response is HTML (Cloudflare or server error page)
        if (contentType?.includes("text/html")) {
          const htmlText = await response.text();
          debugError(
            `[ImageDownloadService] Received HTML error page: ${htmlText.substring(0, 500)}`
          );

          if (htmlText.toLowerCase().includes("cloudflare")) {
            errorMessage =
              "The image source is protected by Cloudflare and cannot be downloaded. Please try a different image or source.";
            errorCode = "CLOUDFLARE_BLOCKED";
          } else {
            errorMessage =
              "Server returned an error page instead of downloading the image. Please try again or use a different image.";
            errorCode = "SERVER_ERROR";
          }
        } else if (contentType?.includes("application/json")) {
          // Try to parse JSON error
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          errorCode = errorData.code || errorCode;
          debugError(`[ImageDownloadService] API error response:`, errorData);
        } else {
          // Unknown content type
          const errorText = await response.text();
          debugError(`[ImageDownloadService] Unexpected response: ${errorText.substring(0, 500)}`);
          errorMessage = `Unexpected response from download service: ${errorText.substring(0, 100)}`;
        }
      } catch (parseError) {
        debugError("[ImageDownloadService] Failed to parse error response:", parseError);
      }

      const error = new ImageDownloadError(errorMessage, errorCode, imageUrl);
      error.statusCode = response.status;
      throw error;
    }

    const result = await response.json();
    debugLog(`[ImageDownloadService] API response:`, result);

    if (!result.success || !result.url) {
      throw new ImageDownloadError(
        "Invalid response from download service - missing success flag or URL",
        "INVALID_RESPONSE",
        imageUrl
      );
    }

    debugLog(
      `[ImageDownloadService] Successfully downloaded: ${result.fileName} (${result.fileSize} bytes) to ${result.url}`
    );

    return {
      url: result.url,
      originalUrl: imageUrl,
      fileName: result.fileName,
      fileSize: result.fileSize,
      fileType: result.fileType,
      downloadedAt: result.downloadedAt,
    };
  } catch (error) {
    // A cancelled download is not a failure; let the caller see the abort as is.
    if (error instanceof Error && isAbortError(error)) throw error;

    console.error("[ImageDownloadService] Download failed:", error);

    // Re-throw errors with codes
    if (error instanceof ImageDownloadError) {
      throw error;
    }

    // Wrap unknown errors
    if (error instanceof Error) {
      const wrappedError = new ImageDownloadError(
        `Failed to download image: ${error.message}`,
        "DOWNLOAD_ERROR",
        imageUrl
      );
      wrappedError.originalError = error;
      throw wrappedError;
    }

    // Unknown error type
    throw new ImageDownloadError(
      "Failed to download image: Unknown error",
      "UNKNOWN_ERROR",
      imageUrl
    );
  }
}

/**
 * Determines if a URL is external and needs to be downloaded
 * Returns false for data URLs (already base64) and relative URLs
 */
export function isExternalImageUrl(url: string): boolean {
  if (!url) return false;

  // Already a data URL - no download needed
  if (url.startsWith("data:")) return false;

  // Relative URLs don't need download
  if (url.startsWith("/")) return false;

  // External HTTP(S) URLs need to be downloaded
  return url.startsWith("http://") || url.startsWith("https://");
}

/**
 * Smart image handler that downloads external URLs and passes through data URLs
 * Use this wrapper around image selection callbacks
 */
export async function processImageSelection(
  imageUrl: string,
  options?: {
    onProgress?: (message: string) => void;
    onError?: (error: Error) => void;
    signal?: AbortSignal;
  }
): Promise<string> {
  try {
    // If it is a Wikimedia Commons image, route it from the repository proxy
    if (isWikimediaCommonsUrl(imageUrl)) {
      options?.onProgress?.("Routing from image repository...");
      const proxyUrl = getCommonsProxyUrl(imageUrl);
      options?.onProgress?.("Routed from image repository successfully");
      return proxyUrl;
    }

    // SVGs are never copied to our origin (they can carry script); hotlink them instead.
    // An SVG rendered through <img> cannot run script.
    if (isExternalImageUrl(imageUrl) && new URL(imageUrl).pathname.toLowerCase().endsWith(".svg")) {
      return imageUrl;
    }

    // Check if URL needs downloading
    if (isExternalImageUrl(imageUrl)) {
      options?.onProgress?.("Downloading image...");

      const downloaded = await downloadAndConvertImage(imageUrl, options?.signal);

      options?.onProgress?.("Image downloaded successfully");

      return downloaded.url;
    } else {
      // Already a data URL or relative path - use as-is
      return imageUrl;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error : new Error("Unknown error");
    options?.onError?.(errorMessage as Error);
    throw error;
  }
}
