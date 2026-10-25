/**
 * upstream-fetch.ts: the one way server code calls a MediaWiki-family `api.php` (Commons, sister wikis).
 *
 * Every call goes through the upstream guard (upstream-guard.ts: a timeout, a breaker and a limiter per host) and
 * gets a real error, never an empty result that looks like "no results":
 *   - a timeout, a network error, HTTP 403 or 5xx, or an answer that is not JSON (a Cloudflare challenge) is
 *     WikiUnavailableError (SERVICE_UNAVAILABLE); HTTP 429, or our own limiter, is its `busy` form (TOO_MANY_REQUESTS);
 *   - another status the wiki answered is BAD_GATEWAY;
 *   - an API error in a 200 is TOO_MANY_REQUESTS for `ratelimited` and `maxlag`, BAD_GATEWAY otherwise.
 * An optional short-lived in-process cache keeps a hot query from hitting the upstream twice; a failure is never cached.
 * Only sister wikis and Commons are called through here, never IxWiki's own loopback.
 */

import { TRPCError } from "@trpc/server";
import { Cache } from "~/lib/cache/cache";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { upstreamGuard, WikiUnavailableError, wikiNameForUrl } from "~/lib/wiki-os/upstream-guard";

const DEFAULT_TIMEOUT_MS = 8000;

export interface FetchMediaWikiJsonOptions {
  /** Sent as `User-Agent` and `Api-User-Agent`; defaults to the allow-listed `IxStats-Builder`. */
  userAgent?: string;
  /** Abort the request after this long; defaults to 8 seconds. */
  timeoutMs?: number;
  /** When set, a successful response is cached by URL for this long (ms). */
  cacheTtlMs?: number;
}

/** What any api.php answer may carry besides its data: an API error, in a 200. */
interface ApiAnswer {
  error?: { code?: string } | null;
}

// Bounded LRU: callers can submit arbitrary queries, so the key space is open.
const responseCache = new Cache<ApiAnswer>({
  maxSize: 1000,
  defaultTtlMs: 300_000,
  namespace: "mediawiki-upstream",
});

function apiErrorCode(body: ApiAnswer | null): string | null {
  const code = body?.error?.code;
  return typeof code === "string" && code.length > 0 ? code : null;
}

async function requestJson(url: string, userAgent: string, timeoutMs: number): Promise<ApiAnswer> {
  const res = await upstreamGuard.fetch(url, { timeoutMs, userAgent });
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Upstream wiki responded with HTTP ${res.status}`,
    });
  }
  try {
    return (await res.json()) as ApiAnswer;
  } catch {
    // A body cut short (the timeout fired while it was read) or JSON that does not parse: no usable answer.
    throw new WikiUnavailableError(wikiNameForUrl(url), "unreachable");
  }
}

/** GET `url` and return its parsed JSON, or throw an error that says what went wrong (see the header). */
export async function fetchMediaWikiJson<T>(
  url: string,
  opts: FetchMediaWikiJsonOptions = {}
): Promise<T> {
  if (opts.cacheTtlMs !== undefined) {
    const cached = responseCache.get(url);
    if (cached !== undefined) return cached as T;
  }

  const body = await requestJson(
    url,
    opts.userAgent ?? DEFAULT_USER_AGENT,
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  const code = apiErrorCode(body);
  if (code !== null) {
    throw new TRPCError({
      code: code === "ratelimited" || code === "maxlag" ? "TOO_MANY_REQUESTS" : "BAD_GATEWAY",
      message: `Upstream wiki error: ${code}`,
    });
  }

  if (opts.cacheTtlMs !== undefined) responseCache.set(url, body, opts.cacheTtlMs);
  return body as T;
}
