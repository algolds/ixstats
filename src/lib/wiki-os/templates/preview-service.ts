/**
 * preview-service.ts — Template preview rendering (CLIENT-SAFE).
 *
 * In-memory LRU + network tier. Do NOT import Node-only modules here — this
 * file is part of the client bundle via useWikiVisualFormatting. The Redis
 * tier lives in preview-service.server.ts and is wired into the tRPC
 * `wikios.getTemplatePreview` route.
 *
 * Tier 1 (offline): known families render as React components at the UI layer
 *   (`VisualInfoboxPreviewCard` for `Infobox …`, engine chips via
 *   template-resolver providers) — see isKnownInfoboxFamily().
 * Tier 2: hash-keyed cache — memory here; Redis server-side
 *   (preview-service.server.ts via the getTemplatePreview route).
 * Tier 3: direct MediaWiki action=parse render.
 */

import { getTemplatePreview } from "./template-registry";

export type PreviewSource = "network" | "cache";
export interface TemplatePreview {
  html: string;
  source: PreviewSource;
  /** true when served from cache without network */
  cached: boolean;
}

const TTL_MS = 60 * 60 * 24 * 1000; // 24h

// ─── Keys & classification ──────────────────────────────────────────────────

/** Stable cache key: canonical name + sorted params (order-insensitive). */
export function previewCacheKey(templateName: string, params: Record<string, string>): string {
  const canonical = JSON.stringify([
    templateName
      .replace(/^Template:/i, "")
      .trim()
      .toLowerCase(),
    Object.keys(params)
      .sort()
      .map((k) => [k, params[k]]),
  ]);
  let h = 0;
  for (let i = 0; i < canonical.length; i++) {
    h = ((h << 5) - h + canonical.charCodeAt(i)) | 0;
  }
  return `tplprev:${(h >>> 0).toString(36)}`;
}

/** Tier-1 heuristic: templates the UI renders as React components, offline. */
export function isKnownInfoboxFamily(templateName: string): boolean {
  return /^infobox[\s_-]/i.test(templateName.replace(/^Template:/i, "").trim());
}

// ─── Memory LRU ─────────────────────────────────────────────────────────────

const MAX_ENTRIES = 200;
const memoryCache = new Map<string, { data: string; expiry: number }>();

function memoryGet(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    memoryCache.delete(key);
    return null;
  }
  // LRU touch
  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry.data;
}

function memorySet(key: string, value: string): void {
  if (memoryCache.size >= MAX_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { data: value, expiry: Date.now() + TTL_MS });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Render a template invocation to HTML through the memory+network tiers.
 * Never throws — total failure returns empty HTML so callers can degrade.
 * The Redis tier wraps this server-side via the getTemplatePreview route.
 */
export async function renderTemplateCached(
  templateName: string,
  params: Record<string, string>
): Promise<TemplatePreview> {
  const key = previewCacheKey(templateName, params);

  const memHit = memoryGet(key);
  if (memHit !== null) return { html: memHit, source: "cache", cached: true };

  try {
    const html = await getTemplatePreview(templateName, params);
    if (html) memorySet(key, html);
    return { html, source: "network", cached: false };
  } catch {
    return { html: "", source: "network", cached: false };
  }
}
