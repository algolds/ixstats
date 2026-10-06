// src/lib/wiki-os/template-resolver.ts
// Pluggable server-side resolver for WikiOS custom templates (Workstream C4).
// Pure, lightweight template parser & replacer. Decoupled from host DB schemas.

import { safeDecodeURI } from "~/lib/wiki-os/transformers/safe-decode";
import { forwardFinder } from "../wikitext/forward-finder";

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

function getRegisteredProviders(): readonly TemplateDataProvider[] {
  return Array.from(registeredProviders);
}

// ---------------------------------------------------------------------------
// Pattern extraction
// ---------------------------------------------------------------------------

/** A `{{MyCountry:gdp}}`, `{{CountryData:Name:field}}` or `{{BusinessData:Name:field}}` in text. */
export interface RawChip {
  /** The index of its `{{`. */
  readonly index: number;
  /** The whole chip. */
  readonly text: string;
  /** `MyCountry`, `CountryData` or `BusinessData`. */
  readonly prefix: string;
  /** What follows the colon: at least one character, none of them `|` or `}`. */
  readonly rest: string;
}

/**
 * The raw chips of `text`, in order (what `/\{\{(MyCountry|CountryData|BusinessData):([^|}]+)\}\}/g` finds). The
 * first `|` or `}` after an opener is the only place its chip can close, so it is looked for once however many
 * openers (`{{MyCountry:` and nothing closing it) come before it.
 */
export function* rawChipsIn(text: string): Generator<RawChip> {
  const nextStop = forwardFinder(text, /[|}]/g);
  const opener = /\{\{(MyCountry|CountryData|BusinessData):/g;
  for (let found = opener.exec(text); found; found = opener.exec(text)) {
    const start = found.index + found[0].length;
    const stop = nextStop(start);
    if (stop === -1) return; // nothing closes any later chip either
    if (stop > start && text.startsWith("}}", stop)) {
      yield {
        index: found.index,
        text: text.slice(found.index, stop + 2),
        prefix: found[1]!,
        rest: text.slice(start, stop),
      };
      opener.lastIndex = stop + 2;
    }
  }
}

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
  for (const chip of rawChipsIn(html)) {
    const parsed = parseKey(`${chip.prefix}:${chip.rest}`);
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

const CHIP_STYLES: Record<string, { className: string; icon: string }> = {
  mycountry: { className: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: "📊" },
  countrydata: { className: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: "📈" },
  businessdata: { className: "bg-teal-500/10 text-teal-400 border-teal-500/20", icon: "💼" },
};

export function makeChip(key: string, value: string): string {
  let style = CHIP_STYLES["countrydata"]!;
  if (key.startsWith("MyCountry:")) style = CHIP_STYLES["mycountry"]!;
  else if (key.startsWith("BusinessData:")) style = CHIP_STYLES["businessdata"]!;

  return (
    `<span class="wikios-stat-resolved inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-mono font-medium align-middle my-0 mx-0.5 whitespace-nowrap ${style.className}" data-key="${escapeAttr(key)}">` +
    `<span class="opacity-70 text-xs">${style.icon}</span> ` +
    `${escapeHtml(value)}</span>`
  );
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
