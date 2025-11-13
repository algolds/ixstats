/**
 * NationStates Image Proxy Utilities
 * 
 * Converts direct NationStates image URLs to proxied URLs
 * to bypass hotlinking restrictions (403 errors).
 */

/**
 * Converts a NationStates image URL to use our proxy endpoint
 * 
 * @param nsImageUrl - Direct NS image URL (e.g., https://www.nationstates.net/uploads/...)
 * @returns Proxied URL through our API route
 * 
 * @example
 * ```ts
 * const proxied = proxyNSImage('https://www.nationstates.net/uploads/card_123.jpg');
 * // Returns: '/api/proxy-ns-image?url=https%3A%2F%2F...'
 * ```
 */
export function proxyNSImage(nsImageUrl: string | null | undefined): string {
  // Return placeholder if no URL provided
  if (!nsImageUrl) {
    return "/images/placeholder-card.png";
  }

  // If already a relative URL or not from NS, return as-is
  if (nsImageUrl.startsWith("/") || !nsImageUrl.includes("nationstates.net")) {
    return nsImageUrl;
  }

  // Encode the NS URL and route through our proxy
  const encodedUrl = encodeURIComponent(nsImageUrl);
  return `/api/proxy-ns-image?url=${encodedUrl}`;
}

/**
 * Checks if a URL is from NationStates and needs proxying
 */
export function isNSImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("nationstates.net/images/") || 
         url.includes("nationstates.net/uploads/");
}

/**
 * Batch convert multiple NS URLs to proxied URLs
 */
export function proxyNSImages(urls: (string | null | undefined)[]): string[] {
  return urls.map(proxyNSImage);
}

