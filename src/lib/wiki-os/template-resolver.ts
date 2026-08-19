// src/lib/wiki-os/template-resolver.ts
// Pluggable server-side resolver for WikiOS custom templates (Workstream C4).
// Pure, lightweight template parser & replacer. Decoupled from host DB schemas.

import { safeDecodeURI } from "~/lib/wiki-os/safe-decode";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateKey {
  /** Full template key, e.g. "CountryData:Burgundie:population" */
  readonly key: string;
  /** Category, e.g. "mycountry", "countrydata", "businessdata" */
  readonly category: string;
  /** Target identifier (entity name, country name, etc.) */
  readonly target: string;
  /** Stat or field name */
  readonly field: string;
}

export interface ResolvedTemplate {
  readonly key: string;
  readonly value: string;
  /** Optional metadata (tier color, flag URL, etc.) */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ResolveOptions {
  /** Active user's entity/country ID for context-sensitive templates (e.g. MyCountry) */
  activeCountryId?: string | null;
  /** Optional extensible context bag for custom providers */
  context?: Readonly<Record<string, unknown>>;
}

export interface TemplateDataProvider {
  /** Unique provider name */
  readonly name: string;
  /** Predicate testing whether this provider handles the template category */
  canHandle(category: string): boolean;
  /** Batch resolver for matching template keys */
  resolve(
    keys: readonly TemplateKey[],
    opts?: ResolveOptions
  ): Promise<Map<string, ResolvedTemplate>>;
}

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

const registeredProviders = new Set<TemplateDataProvider>();

/** Register a template data provider. Returns an unsubscribe function. */
export function registerTemplateProvider(provider: TemplateDataProvider): () => void {
  registeredProviders.add(provider);
  return () => {
    registeredProviders.delete(provider);
  };
}

export function getRegisteredProviders(): readonly TemplateDataProvider[] {
  return Array.from(registeredProviders);
}

// ---------------------------------------------------------------------------
// Pattern extraction
// ---------------------------------------------------------------------------

/** Extract template keys from rendered HTML (Template: anchor patterns and wikitext braces). */
export function extractTemplateKeys(html: string): TemplateKey[] {
  const keys = new Map<string, TemplateKey>();
  const linkRegex = /Template(?::|%3a)((?:MyCountry|CountryData|BusinessData)(?::|%3a)[^"|?#&]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const raw = safeDecodeURI(match[1]!);
    const parsed = parseKey(raw);
    if (parsed && !keys.has(parsed.key)) {
      keys.set(parsed.key, parsed);
    }
  }

  // Also scan for raw wikitext patterns (in case they survive parsing)
  const rawRegex = /\{\{(MyCountry|CountryData|BusinessData):([^|}]+)\}\}/g;
  while ((match = rawRegex.exec(html)) !== null) {
    const raw = `${match[1]}:${match[2]}`;
    const parsed = parseKey(raw);
    if (parsed && !keys.has(parsed.key)) {
      keys.set(parsed.key, parsed);
    }
  }

  return Array.from(keys.values());
}

function parseKey(raw: string): TemplateKey | null {
  const parts = raw.split(":");
  if (parts.length < 2) return null;

  const categoryRaw = parts[0]!.toLowerCase();

  if (categoryRaw === "mycountry") {
    const field = parts[1]!;
    return { key: `MyCountry:${field}`, category: "mycountry", target: "", field };
  }

  if (categoryRaw === "countrydata") {
    if (parts.length < 3) return null;
    const target = parts[1]!.trim();
    const field = parts.slice(2).join(":");
    return { key: `CountryData:${target}:${field}`, category: "countrydata", target, field };
  }

  if (categoryRaw === "businessdata") {
    if (parts.length < 3) return null;
    const target = parts[1]!.trim();
    const field = parts.slice(2).join(":");
    return { key: `BusinessData:${target}:${field}`, category: "businessdata", target, field };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Resolution engine
// ---------------------------------------------------------------------------

export async function resolveTemplates(
  keys: readonly TemplateKey[],
  opts: ResolveOptions = {}
): Promise<Map<string, ResolvedTemplate>> {
  const results = new Map<string, ResolvedTemplate>();
  if (keys.length === 0) return results;

  const providers = getRegisteredProviders();

  // Group keys by matching provider
  for (const provider of providers) {
    const handledKeys = keys.filter((k) => provider.canHandle(k.category));
    if (handledKeys.length > 0) {
      try {
        const resolved = await provider.resolve(handledKeys, opts);
        for (const [k, v] of resolved) {
          results.set(k, v);
        }
      } catch (err) {
        console.error(
          `[TemplateResolver] Provider "${provider.name}" failed to resolve:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// HTML replacement
// ---------------------------------------------------------------------------

const CHIP_STYLES: Record<string, { bg: string; color: string; icon: string }> = {
  mycountry: { bg: "rgba(245,158,11,0.12)", color: "#fbbf24", icon: "📊" },
  countrydata: { bg: "rgba(59,130,246,0.12)", color: "#93c5fd", icon: "📈" },
  businessdata: { bg: "rgba(20,184,166,0.12)", color: "#2dd4bf", icon: "💼" },
};

function makeChip(key: string, value: string): string {
  let style = CHIP_STYLES["countrydata"]!;
  if (key.startsWith("MyCountry:")) style = CHIP_STYLES["mycountry"]!;
  else if (key.startsWith("BusinessData:")) style = CHIP_STYLES["businessdata"]!;

  return (
    `<span class="wikios-stat-resolved" data-key="${escapeAttr(key)}" ` +
    `style="display:inline-flex;align-items:center;gap:4px;padding:1px 8px;` +
    `border-radius:999px;border:1px solid rgba(255,255,255,0.06);` +
    `background:${style.bg};color:${style.color};font-size:11.5px;line-height:1.5;` +
    `vertical-align:middle;margin:0 1px;white-space:nowrap;">` +
    `<span style="opacity:0.7;font-size:10px;">${style.icon}</span> ` +
    `${escapeHtml(value)}</span>`
  );
}

/**
 * Replace recognised template anchor patterns in HTML with pre-resolved chips.
 * This handles both `<a href="...Template:...">` patterns and raw `{{...}}` wikitext.
 */
export function applyResolvedTemplates(
  html: string,
  resolved: Map<string, ResolvedTemplate>
): string {
  let result = html;

  // 1. Replace Template: anchor links with resolved chips
  result = result.replace(
    /<a[^>]*href="[^"]*Template(?::|%3a)([^"|?#&]+)[^"]*"[^>]*>(.*?)<\/a>/gi,
    (_match, templateName: string) => {
      const key = safeDecodeURI(templateName);
      const entry = resolved.get(key);
      if (entry) {
        return makeChip(key, entry.value);
      }
      return _match;
    }
  );

  // 2. Replace raw {{CountryData:...}}, {{BusinessData:...}}, {{MyCountry:...}} wikitext
  result = result.replace(
    /\{\{(MyCountry|CountryData|BusinessData):([^|}]+)\}\}/g,
    (_match, prefix: string, rest: string) => {
      const key = `${prefix}:${rest}`;
      const entry = resolved.get(key);
      if (entry) {
        return makeChip(key, entry.value);
      }
      return _match;
    }
  );

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}
