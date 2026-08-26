/**
 * preview-service.ts — Three-tier template preview rendering.
 *
 * Tier 1 (offline): known families render as React components at the UI layer
 *   (`VisualInfoboxPreviewCard` for `Infobox …`, engine chips via
 *   template-resolver providers) — see isKnownInfoboxFamily().
 * Tier 2: hash-keyed cache (Redis primary, in-memory fallback) of server
 *   renders, 24h TTL.
 * Tier 3: network render via MediaWiki action=parse (getTemplatePreview).
 */

import { createHash } from "crypto";
import { Redis } from "ioredis";
import { getTemplatePreview } from "./template-registry";

export type PreviewSource = "network" | "cache";
export interface TemplatePreview {
  html: string;
  source: PreviewSource;
  /** true when served from cache without network */
  cached: boolean;
}

const TTL_SECONDS = 60 * 60 * 24; // 24h

// ── Cache backend (lazy Redis + in-memory fallback, mirrors trpc-cache.ts) ──

let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redis) return redis;
  const redisUrl = process.env.REDIS_URL;
  const redisEnabled = process.env.REDIS_ENABLED === "true";
  if (redisUrl && redisEnabled) {
    try {
      redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
      redis.on("error", () => {
        /* degrade to memory */
      });
      return redis;
    } catch {
      return null;
    }
  }
  return null;
}

const memoryCache = new Map<string, { data: string; expiry: number }>();

function memoryGet(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function memorySet(key: string, value: string, ttlSeconds: number): void {
  if (memoryCache.size > 500) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { data: value, expiry: Date.now() + ttlSeconds * 1000 });
}

// ─── Keys & classification ──────────────────────────────────────────────────

export function cacheKey(templateName: string, params: Record<string, string>): string {
  const canonical = JSON.stringify([
    templateName.replace(/^Template:/i, "").trim().toLowerCase(),
    Object.keys(params).sort().map((k) => [k, params[k]]),
  ]);
  return `tplprev:${createHash("sha256").update(canonical).digest("hex").slice(0, 32)}`;
}

/** Tier-1 heuristic: templates the UI renders as React components, offline. */
export function isKnownInfoboxFamily(templateName: string): boolean {
  return /^infobox[\s_-]/i.test(templateName.replace(/^Template:/i, "").trim());
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Render a template invocation to HTML through the tiered pipeline.
 * Never throws — total failure returns empty HTML so callers can degrade.
 */
export async function renderTemplateCached(
  templateName: string,
  params: Record<string, string>
): Promise<TemplatePreview> {
  const key = cacheKey(templateName, params);

  try {
    const r = getRedisClient();
    if (r) {
      const hit = await r.get(key);
      if (hit) return { html: hit, source: "cache", cached: true };
    }
  } catch {
    /* fall through to memory/network */
  }

  const memHit = memoryGet(key);
  if (memHit !== null) return { html: memHit, source: "cache", cached: true };

  try {
    const html = await getTemplatePreview(templateName, params);
    try {
      const r = getRedisClient();
      if (r && html) await r.set(key, html, "EX", TTL_SECONDS);
    } catch {
      /* ignore cache write failures */
    }
    if (html) memorySet(key, html, TTL_SECONDS);
    return { html, source: "network", cached: false };
  } catch {
    return { html: "", source: "network", cached: false };
  }
}
