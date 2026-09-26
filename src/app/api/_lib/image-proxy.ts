/**
 * Shared pieces for the image proxy routes (`/api/proxy-discord-image`, `/api/proxy-ns-image`).
 * Underscore-prefixed folders are not routed by Next.js.
 */
import { NextResponse } from "next/server";

export const IMAGE_PROXY_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cross-Origin-Resource-Policy": "cross-origin",
} as const;

export const IMAGE_PROXY_USER_AGENT = "IxStats/1.0 (https://ixwiki.com; contact: admin@ixwiki.com)";

export function corsPreflight() {
  return new NextResponse(null, { status: 200, headers: IMAGE_PROXY_CORS });
}

/** Parse and host-check a `?url=` parameter. */
export function parseAllowedUrl(raw: string | null, allowedHosts: readonly string[]): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return allowedHosts.includes(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

export interface FetchedImage {
  buffer: ArrayBuffer;
  contentType: string;
}

/** Fetch an image with the proxy UA; null on any failure. */
export async function fetchImage(
  url: string,
  init: { timeoutMs?: number; next?: { revalidate: number } } = {}
): Promise<FetchedImage | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": IMAGE_PROXY_USER_AGENT,
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      signal: init.timeoutMs ? AbortSignal.timeout(init.timeoutMs) : undefined,
      next: init.next,
    });
    if (!response.ok) return null;
    return {
      buffer: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") ?? "image/jpeg",
    };
  } catch {
    return null;
  }
}

export function imageResponse(image: FetchedImage, maxAgeSeconds: number, extra: Record<string, string> = {}) {
  return new NextResponse(image.buffer, {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": `public, max-age=${maxAgeSeconds}, immutable`,
      ...extra,
      ...IMAGE_PROXY_CORS,
    },
  });
}
