/**
 * Media Search Type Definitions
 *
 * Types for media search functionality across Unsplash, WikiCommons, and Wiki sources.
 */

/**
 * Base image result shared across all sources
 */
export interface BaseImageResult {
  /** Unique identifier for the image */
  id: string;

  /** URL to the image file */
  url: string;

  /** Photographer or creator attribution */
  photographer: string;

  /** Optional description of the image */
  description?: string;
}

/**
 * Unsplash image search result
 */
export interface UnsplashImageResult extends BaseImageResult {
  /** Unsplash-specific metadata */
  source: "unsplash";

  /** Thumbnail URL for preview */
  thumbnailUrl?: string;

  /** Full resolution URL */
  fullUrl?: string;

  /** Image dimensions */
  width?: number;
  height?: number;

  /** Color palette */
  color?: string;
}

/**
 * WikiCommons image search result
 */
export interface WikiCommonsImageResult extends BaseImageResult {
  /** WikiCommons-specific metadata */
  source: "wikicommons";

  /** License information */
  license?: string;

  /** Attribution requirements */
  attribution?: string;
}

/**
 * Wiki image search result (IxWiki/IiWiki)
 */
export interface WikiImageResult {
  /** File path in wiki */
  path: string;

  /** Display name */
  name: string;

  /** Direct URL to image */
  url?: string;

  /** Optional description */
  description?: string;
}

/**
 * Response from searchUnsplashImages query
 */
export interface MediaSearchResponse {
  /** Array of image results */
  results: BaseImageResult[];

  /** Total number of results */
  total?: number;

  /** Current page number */
  page?: number;

  /** Items per page */
  perPage?: number;

  /** Whether there are more pages */
  hasMore?: boolean;
}

/**
 * Infinite query response structure
 */
export interface InfiniteMediaSearchResponse {
  /** Current page of results */
  pages: MediaSearchResponse[];

  /** Cursor for next page */
  pageParams: unknown[];
}
