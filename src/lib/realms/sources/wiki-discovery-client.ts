/**
 * The throttled api.php reader world discovery uses (`iiwiki-discovery.ts`). One request at a time, a pause
 * between requests, Retry-After honoured, a request cap, and no exception for a refusal: when the wiki blocks
 * (HTTP 403, a Cloudflare challenge page) or keeps rate-limiting, the client stops and records why, and every
 * later query stops at once, so the caller returns what it gathered with `blocked` set.
 *
 * It never marks the host offline for the rest of the app (the bridge reader's `markExternalHostOffline` does,
 * for five minutes): a refused discovery says nothing about whether readers can see the wiki's pages.
 */
import type { z } from "zod";
import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";
import type { RealmWikiSource } from "~/lib/realms/realm-wiki-settings";
import type { WikiQuery } from "~/lib/realms/lore-import";

/** Why a discovery stopped before it finished. */
export type DiscoveryStopKind = "blocked" | "rate-limited" | "unreachable" | "error" | "cap";

export interface DiscoveryStop {
  kind: DiscoveryStopKind;
  /** The HTTP status that stopped it, when there was one. */
  status: number | null;
  message: string;
}

/** Thrown by a query once the client has stopped; phases catch it and keep what they gathered. */
export class DiscoveryStopped extends Error {
  constructor(public readonly stop: DiscoveryStop) {
    super(stop.message);
    this.name = "DiscoveryStopped";
  }
}

export interface DiscoveryClientOptions {
  fetchImpl?: typeof fetch;
  /** Waits; tests pass a recorder. */
  sleep?: (ms: number) => Promise<void>;
  /** The pause before every request but the first. */
  delayMs?: number;
  /** The most requests one client makes. */
  maxRequests?: number;
  /** The longest Retry-After the client waits out; a longer one stops it as rate-limited. */
  maxRetryAfterMs?: number;
  /** How many times one request is retried after a 429 or 503. */
  maxRetries?: number;
  timeoutMs?: number;
  /** The api.php to read; defaults to the wiki's configured one (iiwiki's development proxy when set). */
  apiUrl?: string;
}

export const DISCOVERY_DELAY_MS = 400;
export const DISCOVERY_MAX_REQUESTS = 60;
export const DISCOVERY_MAX_RETRY_AFTER_MS = 20_000;
const DEFAULT_RETRY_AFTER_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 15_000;

export interface DiscoveryClient {
  source: RealmWikiSource;
  /** An `action=query` read (formatversion 2), parsed by `schema`. Throws DiscoveryStopped once stopped. */
  query: WikiQuery;
  requests(): number;
  stopped(): DiscoveryStop | null;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Retry-After in milliseconds: delta-seconds or an HTTP date; null when absent or unreadable. */
export function retryAfterMs(header: string | null, now: number = Date.now()): number | null {
  if (!header) return null;
  const value = header.trim();
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

const CLOUDFLARE_PAGE = /cloudflare|cf-chl|challenge-platform|just a moment/i;

export function createDiscoveryClient(
  source: RealmWikiSource,
  options: DiscoveryClientOptions = {}
): DiscoveryClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? realSleep;
  const delayMs = options.delayMs ?? DISCOVERY_DELAY_MS;
  const maxRequests = options.maxRequests ?? DISCOVERY_MAX_REQUESTS;
  const maxRetryAfterMs = options.maxRetryAfterMs ?? DISCOVERY_MAX_RETRY_AFTER_MS;
  const maxRetries = options.maxRetries ?? 2;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const apiUrl = options.apiUrl ?? getMediaWikiApiUrl(source);
  let count = 0;
  let stop: DiscoveryStop | null = null;

  const halt = (next: DiscoveryStop): never => {
    stop = next;
    throw new DiscoveryStopped(next);
  };

  async function send(url: URL): Promise<Response> {
    if (count >= maxRequests) {
      halt({ kind: "cap", status: null, message: `Stopped after ${maxRequests} requests (the discovery cap)` });
    }
    if (count > 0 && delayMs > 0) await sleep(delayMs);
    count++;
    try {
      return await fetchImpl(url.toString(), {
        headers: { "User-Agent": DEFAULT_USER_AGENT, "Api-User-Agent": DEFAULT_USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return halt({
        kind: "unreachable",
        status: null,
        message: `${source} did not answer: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /** One request, retried after a 429 or 503 while the wiki's Retry-After is short enough. */
  async function fetchJson(url: URL): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      const res = await send(url);
      if (res.status === 429 || res.status === 503) {
        const wait = retryAfterMs(res.headers.get("Retry-After")) ?? DEFAULT_RETRY_AFTER_MS;
        await res.body?.cancel().catch(() => undefined);
        if (attempt >= maxRetries || wait > maxRetryAfterMs) {
          return halt({
            kind: "rate-limited",
            status: res.status,
            message: `${source} is rate-limiting requests (HTTP ${res.status}); try again later`,
          });
        }
        await sleep(wait);
        continue;
      }
      if (res.status === 403) {
        await res.body?.cancel().catch(() => undefined);
        return halt({
          kind: "blocked",
          status: 403,
          message: `${source} refused the request (HTTP 403). It is reachable from the production server only`,
        });
      }
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.includes("json")) {
        const body = await res.text().catch(() => "");
        const challenge = res.ok && CLOUDFLARE_PAGE.test(body);
        return halt({
          kind: challenge ? "blocked" : "error",
          status: res.status,
          message: challenge
            ? `${source} answered with a Cloudflare challenge page instead of data`
            : `${source} answered HTTP ${res.status}`,
        });
      }
      return res.json();
    }
  }

  /** Queries run one after another even when a caller starts several at once. */
  let queue: Promise<unknown> = Promise.resolve();
  const query: WikiQuery = <T>(params: Record<string, string>, schema: z.ZodType<T>): Promise<T> => {
    const run = queue.then(() => readOne(params, schema));
    queue = run.catch(() => undefined);
    return run;
  };

  async function readOne<T>(params: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
    if (stop) throw new DiscoveryStopped(stop);
    const url = new URL(apiUrl);
    for (const [key, value] of Object.entries({ action: "query", format: "json", formatversion: "2", ...params })) {
      url.searchParams.set(key, value);
    }
    const data = await fetchJson(url);
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const apiError = (data as { error?: { info?: unknown } } | null)?.error?.info;
      return halt({
        kind: "error",
        status: null,
        message: typeof apiError === "string" ? `${source}: ${apiError}` : `${source} returned an unexpected response`,
      });
    }
    return parsed.data;
  }

  return { source, query, requests: () => count, stopped: () => stop };
}
