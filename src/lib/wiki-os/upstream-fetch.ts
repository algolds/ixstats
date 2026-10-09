/**
 * upstream-fetch.ts: the one way server code calls a MediaWiki-family `api.php` (Commons, sister wikis).
 *
 * Every call gets a timeout, a real error (never an empty result that looks like "no results"), and an
 * optional short-lived in-process cache so a hot query does not hit the upstream twice.
 */

import { TRPCError } from "@trpc/server";
import { Cache } from "~/lib/cache/cache";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";

const DEFAULT_TIMEOUT_MS = 8000;

export interface FetchMediaWikiJsonOptions {
  /** Sent as `User-Agent` and `Api-User-Agent`; defaults to the allow-listed `IxStats-Builder`. */
  userAgent?: string;
  /** Abort the request after this long; defaults to 8 seconds. */
  timeoutMs?: number;
  /** When set, a successful response is cached by URL for this long (ms). */
  cacheTtlMs?: number;
}

// Bounded LRU: callers can submit arbitrary queries, so the key space is open.
const responseCache = new Cache<unknown>({
  maxSize: 1000,
  defaultTtlMs: 300_000,
  namespace: "mediawiki-upstream",
});

function isTimeoutError(error: unknown): boolean {
  // Duck-typed: a DOMException is not always an `Error` instance across realms (jest, undici).
  const name = (error as { name?: unknown } | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
}

function apiErrorCode(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const error = (body as { error: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : null;
}

async function requestJson(url: string, ua: string, timeoutMs: number): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": ua, "Api-User-Agent": ua },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new TRPCError({ code: "TIMEOUT", message: "Upstream wiki timed out" });
    }
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Upstream wiki request failed",
      cause: error,
    });
  }

  if (res.status === 429) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Upstream wiki rate limited us" });
  }
  if (!res.ok) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Upstream wiki responded with HTTP ${res.status}`,
    });
  }

  try {
    return (await res.json()) as unknown;
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new TRPCError({ code: "TIMEOUT", message: "Upstream wiki timed out" });
    }
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Upstream wiki returned a response that is not JSON",
      cause: error,
    });
  }
}

/** GET `url` and return its parsed JSON, or throw a `TRPCError` that says what went wrong. */
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
