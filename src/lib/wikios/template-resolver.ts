// src/lib/wikios/template-resolver.ts
// Server-side resolver for WikiOS custom templates (CountryData, BusinessData).
// Reads live data from the IxStats database, eliminating the need for synced
// Template: pages on MediaWiki.
//
// Used by the getArticleHtml endpoint to pre-resolve templates before
// sending HTML to the client, and by syncCustomTemplates as a fallback.

import { prisma } from "~/server/db";
import { safeDecodeURI } from "~/lib/wikios/safe-decode";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateKey {
  /** Full template key, e.g. "CountryData:Burgundie:population" */
  key: string;
  /** Category: "mycountry", "countrydata", "businessdata" */
  category: "mycountry" | "countrydata" | "businessdata";
  /** Country or business name part */
  target: string;
  /** Stat field name */
  field: string;
}

export interface ResolvedTemplate {
  key: string;
  value: string;
  /** Optional metadata (tier color, flag URL, etc.) */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Pattern extraction
// ---------------------------------------------------------------------------

/** Extract template keys from rendered HTML (Template: anchor patterns). */
export function extractTemplateKeys(html: string): TemplateKey[] {
  const keys = new Map<string, TemplateKey>();
  const linkRegex =
    /Template(?::|%3a)((?:MyCountry|CountryData|BusinessData)(?::|%3a)[^"|?#&]+)/gi;
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
  let category: TemplateKey["category"];

  if (categoryRaw === "mycountry") {
    category = "mycountry";
    const field = parts[1]!;
    return { key: `MyCountry:${field}`, category, target: "", field };
  }

  if (categoryRaw === "countrydata") {
    category = "countrydata";
    if (parts.length < 3) return null;
    const target = parts[1]!.trim();
    const field = parts.slice(2).join(":");
    return { key: `CountryData:${target}:${field}`, category, target, field };
  }

  if (categoryRaw === "businessdata") {
    category = "businessdata";
    if (parts.length < 3) return null;
    const target = parts[1]!.trim();
    const field = parts.slice(2).join(":");
    return { key: `BusinessData:${target}:${field}`, category, target, field };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Resolution engine
// ---------------------------------------------------------------------------

interface ResolveOptions {
  /** Active user's country ID for resolving MyCountry: templates */
  activeCountryId?: string | null;
}

export async function resolveTemplates(
  keys: TemplateKey[],
  opts: ResolveOptions = {}
): Promise<Map<string, ResolvedTemplate>> {
  const results = new Map<string, ResolvedTemplate>();

  if (keys.length === 0) return results;

  const myCountryKeys = keys.filter((k) => k.category === "mycountry");
  const countryKeys = keys.filter((k) => k.category === "countrydata");
  const businessKeys = keys.filter((k) => k.category === "businessdata");

  // Deduplicate country/business names
  const countryNames = new Set(countryKeys.map((k) => k.target).filter(Boolean));
  const businessNames = new Set(businessKeys.map((k) => k.target).filter(Boolean));

  // Batch fetch from DB
  const [userCountry, countries, pois] = await Promise.all([
    opts.activeCountryId
      ? prisma.country.findUnique({
          where: { id: opts.activeCountryId },
          include: { nationalIdentity: true },
        })
      : null,
    countryNames.size > 0
      ? prisma.country.findMany({
          where: { name: { in: Array.from(countryNames) } },
          include: { nationalIdentity: true },
        })
      : [],
    businessNames.size > 0
      ? prisma.pointOfInterest.findMany({
          where: { name: { in: Array.from(businessNames) }, status: "approved" },
        })
      : [],
  ]);

  // Resolve MyCountry: templates
  for (const key of myCountryKeys) {
    if (userCountry) {
      const value = resolveCountryField(userCountry, key.field);
      results.set(key.key, { key: key.key, value });
    } else {
      results.set(key.key, { key: key.key, value: "\u2014" }); // em-dash
    }
  }

  // Resolve CountryData:Name:field templates
  const countryMap = new Map(countries.map((c) => [c.name.toLowerCase(), c]));
  for (const key of countryKeys) {
    const country = countryMap.get(key.target.toLowerCase());
    if (country) {
      const value = resolveCountryField(country, key.field);
      results.set(key.key, { key: key.key, value });
    } else {
      results.set(key.key, { key: key.key, value: "N/A" });
    }
  }

  // Resolve BusinessData:Name:field templates
  const businessMap = new Map(pois.map((p) => [p.name.toLowerCase(), p]));
  for (const key of businessKeys) {
    const poi = businessMap.get(key.target.toLowerCase());
    if (poi) {
      const value = resolveBusinessField(poi, key.field);
      results.set(key.key, { key: key.key, value });
    } else {
      results.set(key.key, { key: key.key, value: "N/A" });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Field resolvers
// ---------------------------------------------------------------------------

function resolveCountryField(country: any, field: string): string {
  const f = field.toLowerCase();
  if (f === "population") return fmtNum(country.currentPopulation ?? country.population ?? 0);
  if (f === "gdp") return fmtCurrency(country.currentTotalGdp ?? country.gdp ?? 0);
  if (f === "gdp_per_capita" || f === "gdppercapita")
    return fmtCurrency(
      country.currentTotalGdp && country.currentPopulation
        ? country.currentTotalGdp / country.currentPopulation
        : 0
    );
  if (f === "tier" || f === "economictier")
    return country.economicTier ?? country.nationalIdentity?.economicTier ?? "N/A";
  if (f === "leader" || f === "leadername")
    return country.leaderName ?? country.nationalIdentity?.leaderName ?? "N/A";
  if (f === "government" || f === "governmenttype")
    return country.governmentType ?? country.nationalIdentity?.governmentType ?? "N/A";
  if (f === "motto")
    return country.motto ?? country.nationalIdentity?.motto ?? "N/A";
  if (f === "capital" || f === "capitalcity")
    return country.capitalCity ?? country.nationalIdentity?.capitalCity ?? "N/A";
  if (f === "currency")
    return country.currency ?? country.nationalIdentity?.currency ?? "N/A";
  if (f === "currencysymbol")
    return country.currencySymbol ?? country.nationalIdentity?.currencySymbol ?? "N/A";
  if (f === "land_area" || f === "landarea")
    return fmtNum(country.landArea ?? 0) + " km\u00B2";
  if (f === "name")
    return country.name ?? "N/A";
  if (f === "flag_url" || f === "flagurl")
    return country.flagUrl ?? "";

  // Try direct property access as fallback
  if (country[f] != null) {
    const v = country[f];
    if (typeof v === "number") return fmtNum(v);
    return String(v);
  }
  return "N/A";
}

function resolveBusinessField(poi: any, field: string): string {
  const f = field.toLowerCase();
  if (f === "revenue") return "Data unavailable";
  if (f === "employees") return "Data unavailable";
  if (f === "sector" || f === "industry") return poi.category ?? poi.type ?? "N/A";
  if (f === "founded") return poi.founded ?? "N/A";
  return "N/A";
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
  let style = CHIP_STYLES["countrydata"];
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
    (_match, templateName: string, _label: string) => {
      const key = safeDecodeURI(templateName);
      const entry = resolved.get(key);
      if (entry) {
        return makeChip(key, entry.value);
      }
      // Return the original anchor if not resolved
      return _match;
    }
  );

  // 2. Replace raw {{CountryData:...}}, {{BusinessData:...}}, {{MyCountry:...}} wikitext
  result = result.replace(
    /\{\{(MyCountry|CountryData|BusinessData):([^|}]+)\}\}/g,
    (_match, _prefix: string, rest: string) => {
      const key = `${_prefix}:${rest}`;
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

function fmtNum(n: number): string {
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString("en-US");
}

function fmtCurrency(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${n.toLocaleString("en-US")}`;
}

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
