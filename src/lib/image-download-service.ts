// Service for downloading external images and saving to server filesystem
// Used when users select images from wiki/Unsplash repositories

import { withBasePath } from "~/lib/base-path";

export interface DownloadedImage {
  url: string;
  originalUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  downloadedAt: number;
}

/**
 * Downloads an external image and saves it to the server filesystem
 * Supports CORS-enabled images from wikis and Unsplash
 * Returns a local URL to the saved image
 */
export async function downloadAndConvertImage(imageUrl: string): Promise<DownloadedImage> {
  console.log(`[ImageDownloadService] Starting download: ${imageUrl}`);

  try {
    // Use our API endpoint to download the image with proper CORS handling
    const response = await fetch(withBasePath("/api/download/external-image"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl }),
    });

    console.log(`[ImageDownloadService] API response status: ${response.status}, Content-Type: ${response.headers.get("content-type")}`);

    if (!response.ok) {
      // Try to parse error response
      const contentType = response.headers.get("content-type");
      let errorMessage = `Failed to download image (HTTP ${response.status})`;
      let errorCode = "DOWNLOAD_ERROR";

      try {
        // Check if response is HTML (Cloudflare or server error page)
        if (contentType?.includes("text/html")) {
          const htmlText = await response.text();
          console.error(`[ImageDownloadService] Received HTML error page: ${htmlText.substring(0, 500)}`);

          if (htmlText.toLowerCase().includes("cloudflare")) {
            errorMessage = "The image source is protected by Cloudflare and cannot be downloaded. Please try a different image or source.";
            errorCode = "CLOUDFLARE_BLOCKED";
          } else {
            errorMessage = "Server returned an error page instead of downloading the image. Please try again or use a different image.";
            errorCode = "SERVER_ERROR";
          }
        } else if (contentType?.includes("application/json")) {
          // Try to parse JSON error
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          errorCode = errorData.code || errorCode;
          console.error(`[ImageDownloadService] API error response:`, errorData);
        } else {
          // Unknown content type
          const errorText = await response.text();
          console.error(`[ImageDownloadService] Unexpected response: ${errorText.substring(0, 500)}`);
          errorMessage = `Unexpected response from download service: ${errorText.substring(0, 100)}`;
        }
      } catch (parseError) {
        console.error("[ImageDownloadService] Failed to parse error response:", parseError);
      }

      const error = new Error(errorMessage);
      (error as any).code = errorCode;
      (error as any).statusCode = response.status;
      (error as any).originalUrl = imageUrl;
      throw error;
    }

    const result = await response.json();
    console.log(`[ImageDownloadService] API response:`, result);

    if (!result.success || !result.url) {
      const error = new Error("Invalid response from download service - missing success flag or URL");
      (error as any).code = "INVALID_RESPONSE";
      (error as any).originalUrl = imageUrl;
      throw error;
    }

    console.log(
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
    console.error("[ImageDownloadService] Download failed:", error);

    // Re-throw errors with codes
    if (error instanceof Error && (error as any).code) {
      throw error;
    }

    // Wrap unknown errors
    if (error instanceof Error) {
      const wrappedError = new Error(`Failed to download image: ${error.message}`);
      (wrappedError as any).code = "DOWNLOAD_ERROR";
      (wrappedError as any).originalUrl = imageUrl;
      (wrappedError as any).originalError = error;
      throw wrappedError;
    }

    // Unknown error type
    const unknownError = new Error("Failed to download image: Unknown error");
    (unknownError as any).code = "UNKNOWN_ERROR";
    (unknownError as any).originalUrl = imageUrl;
    throw unknownError;
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
  }
): Promise<string> {
  try {
    // Check if URL needs downloading
    if (isExternalImageUrl(imageUrl)) {
      options?.onProgress?.("Downloading image...");

      const downloaded = await downloadAndConvertImage(imageUrl);

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

/**
 * Batch download multiple images
 * Useful for downloading both flag and coat of arms at once
 */
export async function downloadMultipleImages(urls: string[]): Promise<DownloadedImage[]> {
  const results: DownloadedImage[] = [];

  for (const url of urls) {
    if (isExternalImageUrl(url)) {
      try {
        const downloaded = await downloadAndConvertImage(url);
        results.push(downloaded);
      } catch (error) {
        console.error(`[ImageDownloadService] Failed to download ${url}:`, error);
        // Continue with other downloads even if one fails
      }
    }
  }

  return results;
}
