import { withBasePath } from "./base-path";

/**
 * Converts a card artwork URL to use our proxy endpoint if needed.
 * Supports:
 * 1. NationStates images (proxied via /api/proxy-ns-image)
 * 2. Wiki images (ixwiki, iiwiki, althistory proxied via their respective mediawiki proxies)
 * 3. Relative URLs (returns as-is, prepended with basePath)
 */
export function proxyCardArtwork(artworkUrl: string | null | undefined): string {
  // Return placeholder if no URL provided
  if (!artworkUrl) {
    return "/images/cards/lore-placeholder.svg";
  }

  // If relative URL, return prepended with basePath
  if (artworkUrl.startsWith("/")) {
    return withBasePath(artworkUrl);
  }

  // Handle Wiki URLs
  const ixwikiMatch = artworkUrl.match(/^https?:\/\/(?:www\.)?ixwiki\.com\/(.+)$/i);
  if (ixwikiMatch) {
    return withBasePath(`/api/mediawiki/ixwiki/${ixwikiMatch[1]}`);
  }

  const iiwikiMatch = artworkUrl.match(/^https?:\/\/(?:www\.)?iiwiki\.(?:com|org|us|net)\/(.+)$/i);
  if (iiwikiMatch) {
    return withBasePath(`/api/mediawiki/iiwiki/${iiwikiMatch[1]}`);
  }

  const althistoryMatch = artworkUrl.match(/^https?:\/\/(?:www\.)?althistory\.fandom\.com\/(.+)$/i);
  if (althistoryMatch) {
    return withBasePath(`/api/mediawiki/althistory/${althistoryMatch[1]}`);
  }

  // Handle NationStates URLs
  if (artworkUrl.includes("nationstates.net")) {
    const encodedUrl = encodeURIComponent(artworkUrl);
    return withBasePath(`/api/proxy-ns-image?url=${encodedUrl}`);
  }

  // Return other external URLs as is
  return artworkUrl;
}

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
  return proxyCardArtwork(nsImageUrl);
}

/**
 * Checks if a URL is from NationStates and needs proxying
 */
export function isNSImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("nationstates.net/images/") || url.includes("nationstates.net/uploads/");
}

/**
 * Batch convert multiple NS URLs to proxied URLs
 */
export function proxyNSImages(urls: (string | null | undefined)[]): string[] {
  return urls.map(proxyNSImage);
}
