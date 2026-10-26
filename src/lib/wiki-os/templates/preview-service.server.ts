/**
 * preview-service.server.ts — SERVER-ONLY Redis tier for template previews.
 *
 * Caches `getTemplatePreview` (MediaWiki as a private render engine, `template-engine.server.ts`) in Redis
 * and renders on a miss. Imported exclusively by the wikios templates router (`wikios.getTemplatePreview`,
 * which the editor calls too: a browser never asks MediaWiki, and keeps no render tier of its own).
 *
 * The key names the template as MediaWiki does (`templatePageTitle`: first letter upper-cased, underscores as
 * spaces, the rest of its case kept, so "Infobox Country" and "Infobox country" are two templates) and its latest
 * revision in WikiOS: an edit to the template is a new key, so a preview is never served from before it.
 */

import { createHash } from "node:crypto";
import { Redis } from "ioredis";
import { getHeadRevisionRefs } from "~/lib/wiki-os/core/edit-conflict";
import { canonicalOrTrimmedTitle } from "~/lib/wiki-os/core/title";
import { getTemplatePreview } from "./template-engine.server";

type PreviewSource = "redis" | "network";
interface ServerTemplatePreview {
  html: string;
  source: PreviewSource;
  cached: boolean;
}

const TTL_SECONDS = 60 * 60 * 24; // 24h

/** The template's page as MediaWiki titles it ("infobox_country" is "Template:Infobox country"). */
export function templatePageTitle(templateName: string): string {
  return canonicalOrTrimmedTitle(`Template:${templateName.replace(/^Template:/i, "").trim()}`);
}

/**
 * Canonical, order-insensitive form of a template invocation (page title, the template's revision, sorted
 * params): the input of the SHA-256 Redis key (`previewCacheKey`).
 */
export function canonicalPreviewInput(
  templateName: string,
  params: Record<string, string>,
  revision = ""
): string {
  return JSON.stringify([
    templatePageTitle(templateName),
    revision,
    Object.keys(params)
      .sort()
      .map((k) => [k, params[k]]),
  ]);
}

/**
 * Shared Redis key for a template invocation at the template's `revision`: SHA-256 over the canonical
 * input, so two different invocations can never share (and poison) a cached preview.
 */
export function previewCacheKey(
  templateName: string,
  params: Record<string, string>,
  revision = ""
): string {
  const digest = createHash("sha256")
    .update(canonicalPreviewInput(templateName, params, revision))
    .digest("hex");
  return `tplprev:v3:${digest}`;
}

/** The template's latest revision in WikiOS ("none" when it has no page here), or null when it cannot be read. */
async function templateRevision(templateName: string): Promise<string | null> {
  try {
    return (await getHeadRevisionRefs(templatePageTitle(templateName)))?.revisionRef ?? "none";
  } catch {
    return null;
  }
}

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

/**
 * Render a template invocation with a server-side Redis cache. Never throws. When the template's revision
 * cannot be read, the preview is rendered and not cached (a key without it could outlive an edit).
 */
export async function renderTemplateWithRedisCache(
  templateName: string,
  params: Record<string, string>
): Promise<ServerTemplatePreview> {
  const r = getRedisClient();
  const revision = r ? await templateRevision(templateName) : null;
  const key = revision === null ? null : previewCacheKey(templateName, params, revision);

  try {
    if (r && key) {
      const hit = await r.get(key);
      if (hit) return { html: hit, source: "redis", cached: true };
    }
  } catch {
    /* fall through to network */
  }

  try {
    const html = await getTemplatePreview(templateName, params);
    if (html && r && key) {
      try {
        await r.set(key, html, "EX", TTL_SECONDS);
      } catch {
        /* ignore cache write failures */
      }
    }
    return { html, source: "network", cached: false };
  } catch {
    return { html: "", source: "network", cached: false };
  }
}
