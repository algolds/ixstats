/**
 * template-registry.ts — WikiOS Template Registry.
 *
 * Syncs TemplateData schemas from MediaWiki, caches them in Prisma,
 * and provides lookup/search for the editor's template inserter.
 */

import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateParam {
  name?: string; // palette presets use this; registry lookups key by map key
  label?: string;
  description?: string;
  type?: string; // string, number, boolean, date, wiki-page-name, etc.
  default?: string;
  required?: boolean;
  suggested?: boolean;
  example?: string;
  autovalue?: string;
  aliases?: string[];
  variantOnly?: string[]; // palette presets filter by variant
}

export interface TemplateDataInfo {
  title: string;
  description?: string;
  params: Record<string, TemplateParam>;
  paramOrder?: string[];
  format?: string; // inline, block
  sets?: Array<{ label: string; params: string[] }>;
}

// ---------------------------------------------------------------------------
// Fetch from MediaWiki
// ---------------------------------------------------------------------------

/**
 * Fetch TemplateData for one or more templates from MediaWiki.
 * Uses the templatedata API action.
 */
function normalizeString(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    const obj = val as Record<string, string>;
    return obj.en || Object.values(obj)[0] || undefined;
  }
  return undefined;
}

export async function fetchTemplateData(titles: string[]): Promise<Map<string, TemplateDataInfo>> {
  const result = new Map<string, TemplateDataInfo>();
  if (titles.length === 0) return result;

  // MediaWiki API accepts up to 50 titles at once
  const batches: string[][] = [];
  for (let i = 0; i < titles.length; i += 50) {
    batches.push(titles.slice(i, i + 50));
  }

  for (const batch of batches) {
    const normalizedTitles = batch.map((t) => (t.startsWith("Template:") ? t : `Template:${t}`));
    const params = new URLSearchParams({
      action: "templatedata",
      titles: normalizedTitles.join("|"),
      formatversion: "2",
      format: "json",
    });

    try {
      const mwApi = getMediaWikiApiUrl("ixwiki");
      const res = await fetch(`${mwApi}?${params}`, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          "Api-User-Agent": DEFAULT_USER_AGENT,
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;

      const rawText = await res.text();
      if (!rawText.trim().startsWith("{")) continue;

      const data = JSON.parse(rawText) as {
        pages?: Record<
          string,
          {
            title?: string;
            description?: unknown;
            params?: Record<string, any>;
            paramOrder?: string[];
            format?: string;
            sets?: Array<{ label: string; params: string[] }>;
            notemplatedata?: boolean;
          }
        >;
      };

      if (data.pages) {
        for (const [, page] of Object.entries(data.pages)) {
          if (!page.title || page.notemplatedata) continue;
          // Strip "Template:" prefix for storage
          const cleanName = page.title.replace(/^Template:/, "");
          const normalizedParams: Record<string, TemplateParam> = {};

          if (page.params) {
            for (const [pKey, pVal] of Object.entries(page.params)) {
              normalizedParams[pKey] = {
                ...pVal,
                label: normalizeString(pVal?.label),
                description: normalizeString(pVal?.description),
              };
            }
          }

          result.set(cleanName, {
            title: cleanName,
            description: normalizeString(page.description),
            params: normalizedParams,
            paramOrder: page.paramOrder,
            format: page.format,
            sets: page.sets,
          });
        }
      }
    } catch {
      // Continue next batch
    }
  }

  return result;
}

/**
 * Search for templates by name prefix using MediaWiki's prefix search.
 */
export async function searchTemplatesFromWiki(
  query: string,
  limit = 20
): Promise<Array<{ title: string; ns: number }>> {
  const params = new URLSearchParams({
    action: "query",
    list: "prefixsearch",
    pssearch: query,
    psnamespace: "10", // Template namespace
    pslimit: String(limit),
    formatversion: "2",
    format: "json",
  });

  try {
    const mwApi = getMediaWikiApiUrl("ixwiki");
    const res = await fetch(`${mwApi}?${params}`, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Api-User-Agent": DEFAULT_USER_AGENT,
      },
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json()) as {
      query?: {
        prefixsearch?: Array<{ ns: number; title: string; pageid: number }>;
      };
    };
    return (data.query?.prefixsearch ?? []).map((p) => ({
      title: p.title.replace(/^Template:/, ""),
      ns: p.ns,
    }));
  } catch {
    return [];
  }
}

/**
 * Get a rendered preview of a template with given parameters.
 */
export async function getTemplatePreview(
  templateName: string,
  params: Record<string, string>
): Promise<string> {
  // Build wikitext from template name + params
  const paramParts = Object.entries(params)
    .filter(([, v]) => v.trim() !== "")
    .map(([k, v]) => `|${k}=${v}`);
  const wikitext = `{{${templateName}${paramParts.join("")}}}`;

  const apiParams = new URLSearchParams({
    action: "parse",
    text: wikitext,
    contentmodel: "wikitext",
    prop: "text",
    disablelimitreport: "1",
    formatversion: "2",
    format: "json",
  });

  try {
    const mwApi = getMediaWikiApiUrl("ixwiki");
    const res = await fetch(`${mwApi}?${apiParams}`, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Api-User-Agent": DEFAULT_USER_AGENT,
      },
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json()) as {
      parse?: { text?: string };
    };
    return data.parse?.text ?? "";
  } catch {
    return `<p class="error">Failed to render template preview</p>`;
  }
}

/**
 * Noise filter predicate to exclude internal MediaWiki macros, doc subpages, and stubs.
 */
export function isNoiseTemplate(name: string): boolean {
  const clean = name.replace(/^Template:/i, "").trim();
  // Exclude subpages (/doc, /sandbox, /testcases, /styles.css, etc.)
  if (clean.includes("/")) return true;
  // Exclude punctuation, symbols, and single-character macros
  if (/^[^a-zA-Z0-9]+$/.test(clean) || /^[0-9]+[a-z]?$/i.test(clean)) return true;
  // Exclude internal string/parser function macros
  if (
    /^(str|trim|pad|void|null|nowrap|nobr|clear|bullet|hash|anchor|nbsp|sp|break|line|br|space|mdash|ndash|bull|middot|dot|para|section|tag|tl|tlx|mxt|xt|mono|code|samp|kbd|var|syntaxhighlight)/i.test(
      clean
    )
  ) {
    return true;
  }
  // Exclude maintenance, stub, and dispute templates
  if (
    /^(stub|expand|cleanup|merge|delete|disambig|refimprove|citation needed|dead link|unref|wip|under construction|orphan|neutrality|dispute|coi|hoax|copy edit|advert|notability|prose|update|expert|verify|original research|tone|lead|sources|blp|wikify|talk|userbox|tracking|notice)/i.test(
      clean
    )
  ) {
    return true;
  }
  // Exclude internal backend Lua/style wrappers
  if (/^(ambox|citation|navbox|infobox)\/(core|doc|sandbox)/i.test(clean)) {
    return true;
  }
  return false;
}

/**
 * Categorize a template into a canonical domain tier based on its name/description.
 */
export function categorizeTemplate(name: string, description?: string): string {
  const lower = (name + " " + (description ?? "")).toLowerCase();

  // 1. IxStates Native Engine Data Connectors
  if (
    lower.includes("countrydata") ||
    lower.includes("businessdata") ||
    lower.includes("defensedata") ||
    lower.includes("vitalitydata") ||
    lower.includes("stabilitydata")
  ) {
    return "engine";
  }

  // 2. Sovereign, Realms, Nations & Settlements
  if (
    lower.includes("country") ||
    lower.includes("settlement") ||
    lower.includes("city") ||
    lower.includes("subdivision") ||
    lower.includes("province") ||
    lower.includes("state") ||
    lower.includes("territory") ||
    lower.includes("caphirian province") ||
    lower.includes("kirstate") ||
    lower.includes("cartadania") ||
    lower.includes("former country")
  ) {
    return "sovereign";
  }

  // 3. Biography, Leaders, Monarchs, Nobles & Scientists
  if (
    lower.includes("person") ||
    lower.includes("monarch") ||
    lower.includes("imperator") ||
    lower.includes("officeholder") ||
    lower.includes("noble") ||
    lower.includes("royalty") ||
    lower.includes("scientist") ||
    lower.includes("academic") ||
    lower.includes("philosopher") ||
    lower.includes("saint") ||
    lower.includes("religious biography") ||
    lower.includes("bishop") ||
    lower.includes("military person") ||
    lower.includes("military personnel") ||
    lower.includes("biography")
  ) {
    return "biography";
  }

  // 4. Military, Security, Fleet, Ordnance & War
  if (
    lower.includes("conflict") ||
    lower.includes("war") ||
    lower.includes("battle") ||
    lower.includes("military unit") ||
    lower.includes("national military") ||
    lower.includes("ship") ||
    lower.includes("naval") ||
    lower.includes("vessel") ||
    lower.includes("submarine") ||
    lower.includes("aircraft") ||
    lower.includes("weapon") ||
    lower.includes("missile") ||
    lower.includes("military installation") ||
    lower.includes("fort") ||
    lower.includes("defense")
  ) {
    return "defense";
  }

  // 5. Economy, Companies, Banks, Infrastructure & Trade
  if (
    lower.includes("company") ||
    lower.includes("enterprise") ||
    lower.includes("corporation") ||
    lower.includes("central bank") ||
    lower.includes("currency") ||
    lower.includes("bank") ||
    lower.includes("airport") ||
    lower.includes("port") ||
    lower.includes("rail") ||
    lower.includes("power station") ||
    lower.includes("mine") ||
    lower.includes("pipeline") ||
    lower.includes("bridge") ||
    lower.includes("road") ||
    lower.includes("infrastructure")
  ) {
    return "economy";
  }

  // 6. Science, Lore, Conlangs, Faith, Culture & Media
  if (
    lower.includes("spacecraft") ||
    lower.includes("rocket") ||
    lower.includes("invention") ||
    lower.includes("software") ||
    lower.includes("language") ||
    lower.includes("conlang") ||
    lower.includes("religion") ||
    lower.includes("church") ||
    lower.includes("heritage") ||
    lower.includes("historical era") ||
    lower.includes("historical event") ||
    lower.includes("bilateral relations") ||
    lower.includes("book") ||
    lower.includes("film") ||
    lower.includes("sports team")
  ) {
    return "lore";
  }

  // 7. Citations & Bibliography
  if (lower.includes("citation") || lower.includes("cite") || lower.includes("ref")) {
    return "citation";
  }

  // 8. Navigation & Sidebars
  if (lower.includes("navbox") || lower.includes("navigation") || lower.includes("sidebar")) {
    return "navigation";
  }

  // 9. Editorial Formatting & Quotes
  if (
    lower.includes("quote") ||
    lower.includes("hatnote") ||
    lower.includes("timeline") ||
    lower.includes("gallery")
  ) {
    return "formatting";
  }

  // 10. Spatial Coordinates, Maps, Weather & Flags
  if (
    lower.includes("map") ||
    lower.includes("coord") ||
    lower.includes("location") ||
    lower.includes("weather") ||
    lower.includes("climate")
  ) {
    return "geographic";
  }

  if (
    lower.includes("flag") ||
    lower.includes("coat of arms") ||
    lower.includes("icon") ||
    lower.includes("heraldry")
  ) {
    return "icon";
  }

  if (lower.includes("infobox")) return "sovereign";
  return "general";
}
