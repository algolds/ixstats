/**
 * preview-service.server.ts — SERVER-ONLY Redis tier for template previews.
 *
 * Wraps the universal preview service with a Redis cache (primary) and
 * delegates to it on miss. Imported exclusively by the wikios templates
 * router; never import from client components (ioredis is Node-only).
 */

import { Redis } from "ioredis";
import { getTemplatePreview } from "./template-registry";
import { previewCacheKey } from "./preview-service";

export type PreviewSource = "redis" | "network";
export interface ServerTemplatePreview {
  html: string;
  source: PreviewSource;
  cached: boolean;
}

const TTL_SECONDS = 60 * 60 * 24; // 24h

let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redis) return redis;
  const redisUrl = process.env.REDIS_URL;
  const redisEnabled = process.env.REDIS_ENABLED === "true";
  if (redisUrl && redisEnabled) {
    try {
      redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
      redis.on("error", () => {
        /* degrade to network */
      });
      return redis;
    } catch {
      return null;
    }
  }
  return null;
}

/** Render a template invocation with a server-side Redis cache. Never throws. */
export async function renderTemplateWithRedisCache(
  templateName: string,
  params: Record<string, string>
): Promise<ServerTemplatePreview> {
  const key = previewCacheKey(templateName, params);

  try {
    const r = getRedisClient();
    if (r) {
      const hit = await r.get(key);
      if (hit) return { html: hit, source: "redis", cached: true };
    }
  } catch {
    /* fall through to network */
  }

  try {
    const html = await getTemplatePreview(templateName, params);
    if (html) {
      try {
        const r = getRedisClient();
        if (r) await r.set(key, html, "EX", TTL_SECONDS);
      } catch {
        /* ignore cache write failures */
      }
    }
    return { html, source: "network", cached: false };
  } catch {
    return { html: "", source: "network", cached: false };
  }
}
