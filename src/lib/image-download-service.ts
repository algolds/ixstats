// Service for downloading external images and converting to base64 data URLs
// Used when users select images from wiki/Unsplash repositories

export interface DownloadedImage {
  dataUrl: string;
  originalUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  downloadedAt: number;
}

/**
 * Downloads an external image and converts it to a base64 data URL
 * Supports CORS-enabled images from wikis and Unsplash
 */
export async function downloadAndConvertImage(imageUrl: string): Promise<DownloadedImage> {
  console.log(`[ImageDownloadService] Starting download: ${imageUrl}`);
  
  try {
    // Use our API endpoint to download the image with proper CORS handling
    const response = await fetch('/api/download/external-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to download image');
    }

    const result = await response.json();
    
    if (!result.success || !result.dataUrl) {
      throw new Error('Invalid response from download service');
    }

    console.log(`[ImageDownloadService] Successfully downloaded: ${result.fileName} (${result.fileSize} bytes)`);
    
    return {
      dataUrl: result.dataUrl,
      originalUrl: imageUrl,
      fileName: result.fileName,
      fileSize: result.fileSize,
      fileType: result.fileType,
      downloadedAt: result.downloadedAt,
    };
  } catch (error) {
    console.error('[ImageDownloadService] Download failed:', error);
    throw error;
  }
}

/**
 * Determines if a URL is external and needs to be downloaded
 * Returns false for data URLs (already base64) and relative URLs
 */
export function isExternalImageUrl(url: string): boolean {
  if (!url) return false;
  
  // Already a data URL - no download needed
  if (url.startsWith('data:')) return false;
  
  // Relative URLs don't need download
  if (url.startsWith('/')) return false;
  
  // External HTTP(S) URLs need to be downloaded
  return url.startsWith('http://') || url.startsWith('https://');
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
      options?.onProgress?.('Downloading image...');
      
      const downloaded = await downloadAndConvertImage(imageUrl);
      
      options?.onProgress?.('Image downloaded successfully');
      
      return downloaded.dataUrl;
    } else {
      // Already a data URL or relative path - use as-is
      return imageUrl;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error : new Error('Unknown error');
    options?.onError?.(errorMessage as Error);
    throw error;
  }
}

/**
 * Batch download multiple images
 * Useful for downloading both flag and coat of arms at once
 */
export async function downloadMultipleImages(
  urls: string[]
): Promise<DownloadedImage[]> {
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

