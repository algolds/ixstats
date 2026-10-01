/**
 * template-registry.ts — WikiOS Template Registry.
 *
 * The TemplateData types, the admin-triggered refresh of TemplateData from MediaWiki (`fetchTemplateData`),
 * and the template preview (rendered by MediaWiki as a private engine). A reader gets TemplateData from
 * Postgres (`template-data-reader.ts`), never from MediaWiki.
 *
 * CLIENT-SAFE: `preview-service.ts` is part of the client bundle, so nothing here may import the database.
 */

import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";
import { renderArticleViaMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { transformWikiLinks } from "~/lib/wiki-os/transformers/url-compat";
import { transformImages, stripConflictingStyles } from "~/lib/wiki-os/transformers/html-transformer";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";

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

/** A TemplateData text that is a string or an object of strings by language: the English one, else the first. */
export function normalizeString(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    const obj = val as Record<string, string>;
    return obj.en || Object.values(obj)[0] || undefined;
  }
  return undefined;
}

/**
 * Fetch TemplateData for one or more templates from MediaWiki (the `templatedata` API action).
 * ADMIN-TRIGGERED REFRESH ONLY (the admin template sync): a reader's TemplateData comes from Postgres.
 */
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

const INVALID_PARAMETER_PREVIEW = "Invalid parameter";
/** A key containing these could end the parameter name early or open a second parameter. */
const UNSAFE_PARAM_KEY = /[|={}\n\r]/;

/**
 * A parameter value made safe to place inside `{{name|key=<value>}}`, or null when it could break out.
 * Balanced nested `{{…}}` and `[[…]]` are kept as written (a nested `{{flag|X}}` previews); braces or
 * brackets that do not pair up are refused, since they would close or open a call around the value.
 * A `|` is escaped as `{{!}}` only at nesting depth 0; inside a nested call or link it is that
 * construct's own separator.
 */
function escapeParamValue(value: string): string | null {
  const closers: string[] = [];
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const pair = value.slice(i, i + 2);
    if (pair === "{{" || pair === "[[") {
      closers.push(pair === "{{" ? "}}" : "]]");
    } else if (pair === "}}" || pair === "]]") {
      if (closers.pop() !== pair) return null;
    } else {
      out += value[i] === "|" && closers.length === 0 ? "{{!}}" : value[i];
      continue;
    }
    out += pair;
    i++;
  }
  return closers.length === 0 ? out : null;
}

/**
 * `{{name|k=v}}` for the given params, or null when a key or value could break out of the call.
 * Empty values are skipped.
 */
function buildTemplateInvocation(
  templateName: string,
  params: Record<string, string>
): string | null {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value.trim() === "") continue;
    const safeValue = escapeParamValue(value);
    if (safeValue === null || UNSAFE_PARAM_KEY.test(key)) return null;
    parts.push(`|${key}=${safeValue}`);
  }
  return `{{${templateName}${parts.join("")}}}`;
}

/** The page a template preview is rendered as (the parse context: `{{PAGENAME}}` and the like). */
const PREVIEW_PAGE_TITLE = "Template preview";

/**
 * Get a rendered preview of a template with given parameters. MediaWiki renders it as a private engine
 * (the render service's own non-persisting call, which uses the internal URL when one is configured);
 * when it cannot, the in-process compiler does.
 */
export async function getTemplatePreview(
  templateName: string,
  params: Record<string, string>
): Promise<string> {
  const wikitext = buildTemplateInvocation(templateName, params);
  if (wikitext === null) return INVALID_PARAMETER_PREVIEW;

  const rendered = await renderArticleViaMediaWiki(wikitext, PREVIEW_PAGE_TITLE);
  if (rendered) {
    return transformWikiLinks(transformImages(stripConflictingStyles(rendered.html), "ixwiki"));
  }

  const localHtml = parseWikitextToHtml(wikitext, "ixwiki");
  return transformWikiLinks(transformImages(localHtml, "ixwiki"));
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
