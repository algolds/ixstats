// src/lib/wiki-os/http-cache.ts
// Which tRPC reads a shared cache (the CDN in front of the app) may keep for a moment.
//
// Only the two reads that give an anonymous reader the page's content, and only to a request that
// carries no credentials: a signed-in reader's answer (their country's chips) is theirs, and is not
// stored for anyone. The page's own HTML cannot be shared this way: it carries the request's CSP
// nonce on its inline scripts, so a cached copy would hand the next reader a nonce the browser
// refuses (see the ponytail note in app/(wiki-os)/wiki/[...slug]/page.tsx).
//
// Two limits of the shared cache, both handled by what this file sends and refuses:
//  - A streamed (jsonl) response commits its headers before any procedure has run, so `responseMeta`
//    cannot know the answer will fail: a streamed request therefore gets no shared-cache headers.
//  - Cloudflare ignores `Vary: Cookie` (it varies only on Accept-Encoding, and on Accept for images),
//    so this header alone does not keep a signed-in reader's answer out of the cache. The CDN's cache
//    rule MUST bypass the cache when a `__session*` or `__client_uat*` cookie (or an `Authorization`
//    header) is present; the app additionally refuses to send the headers to such a request.

import { hasClerkSessionCookie, type CookieEntry } from "./chrome-prefs";

/**
 * Fresh 30 s at the edge, then served stale for up to 30 s more while one request refreshes it. This
 * is the ceiling on how long an edited page can show its old text there: a save purges the page's own
 * URLs (CloudflareGuardian), never these tRPC read URLs, so they only expire. Hence the short window
 * after s-maxage, not a longer one.
 */
export const PUBLIC_READ_CACHE_CONTROL =
  "public, max-age=0, s-maxage=30, stale-while-revalidate=30";

/** The procedures whose anonymous answer is the same for every anonymous reader. */
const SHARED_CACHE_PATHS: ReadonlySet<string> = new Set([
  "wikios.getArticleHtml",
  "wikios.getMainPage",
]);

/** The cookies of a `Cookie` request header. */
export function parseCookieHeader(header: string | null): CookieEntry[] {
  if (!header) return [];
  return header
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const at = pair.indexOf("=");
      return at === -1
        ? { name: pair, value: "" }
        : { name: pair.slice(0, at), value: pair.slice(at + 1) };
    });
}

export interface ReadCacheRequest {
  /** "query" for a read. */
  type: string;
  /** The procedures the request calls (a batch has several). */
  paths: readonly string[] | undefined;
  /** Whether any of them failed: an error is never kept. */
  failed: boolean;
  headers: Headers;
}

/**
 * The response headers that let a shared cache keep this read for a few seconds, or null: it is not
 * a read of the two procedures (every one of a batch must be), it failed, it is streamed (see above),
 * or it is a signed-in reader's (an `Authorization` header, a Clerk session cookie, an impersonation
 * header).
 */
export function sharedReadCacheHeaders({
  type,
  paths,
  failed,
  headers,
}: ReadCacheRequest): Record<string, string> | null {
  if (type !== "query" || failed || !paths || paths.length === 0) return null;
  if (!paths.every((path) => SHARED_CACHE_PATHS.has(path))) return null;
  if (headers.get("trpc-accept")?.includes("jsonl")) return null;

  if (headers.get("authorization") || headers.get("x-play-as-user")) return null;
  if (hasClerkSessionCookie(parseCookieHeader(headers.get("cookie")))) return null;
  return {
    "Cache-Control": PUBLIC_READ_CACHE_CONTROL,
    Vary: "Cookie, Authorization, Accept, trpc-accept",
  };
}

/** The tRPC handler's `responseMeta` for a request: the headers above, or none. */
export function readCacheResponseMeta(req: Request) {
  return ({
    type,
    paths,
    errors,
  }: {
    type: string;
    paths?: readonly string[];
    errors: readonly unknown[];
  }) => {
    const headers = sharedReadCacheHeaders({
      type,
      paths,
      failed: errors.length > 0,
      headers: req.headers,
    });
    return headers ? { headers } : {};
  };
}
