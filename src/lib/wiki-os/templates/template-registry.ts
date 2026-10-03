/**
 * template-registry.ts — WikiOS Template Registry.
 *
 * Syncs TemplateData schemas from MediaWiki, caches them in Prisma,
 * and provides lookup/search for the editor's template inserter.
 */

import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";
import { transformWikiLinks } from "~/lib/wiki-os/transformers/url-compat";
import { transformImages, stripConflictingStyles } from "~/lib/wiki-os/transformers/html-transformer";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";

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

interface TemplateDataInfo {
  title: string;
  description?: string;
  params: Record<string, TemplateParam>;
  paramOrder?: string[];
  format?: string; // inline, block
  sets?: Array<{ label: string; params: string[] }>;
}

function normalizeString(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    const obj = val as Record<string, string>;
    return obj.en || Object.values(obj)[0] || undefined;
  }
  return undefined;
}

interface RawTemplateDataPage {
  title?: string;
  description?: unknown;
  params?: Record<string, any>;
  paramOrder?: string[];
  format?: string;
  sets?: Array<{ label: string; params: string[] }>;
  notemplatedata?: boolean;
}

function toTemplateDataInfo(page: RawTemplateDataPage & { title: string }): TemplateDataInfo {
  const title = page.title.replace(/^Template:/, "");
  const params = Object.fromEntries(
    Object.entries(page.params ?? {}).map(([key, val]) => [
      key,
      { ...val, label: normalizeString(val?.label), description: normalizeString(val?.description) },
    ])
  );
  return {
    title,
    description: normalizeString(page.description),
    params,
    paramOrder: page.paramOrder,
    format: page.format,
    sets: page.sets,
  };
}

async function fetchTemplateDataBatch(batch: string[]): Promise<TemplateDataInfo[]> {
  const params = new URLSearchParams({
    action: "templatedata",
    titles: batch.map((t) => (t.startsWith("Template:") ? t : `Template:${t}`)).join("|"),
    formatversion: "2",
    format: "json",
  });
  const res = await fetch(`${getMediaWikiApiUrl("ixwiki")}?${params}`, {
    headers: { "User-Agent": DEFAULT_USER_AGENT, "Api-User-Agent": DEFAULT_USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];

  const rawText = await res.text();
  if (!rawText.trim().startsWith("{")) return [];

  const data = JSON.parse(rawText) as { pages?: Record<string, RawTemplateDataPage> };
  return Object.values(data.pages ?? {})
    .filter((page): page is RawTemplateDataPage & { title: string } => !!page.title && !page.notemplatedata)
    .map(toTemplateDataInfo);
}

export async function fetchTemplateData(titles: string[]): Promise<Map<string, TemplateDataInfo>> {
  const result = new Map<string, TemplateDataInfo>();

  // MediaWiki API accepts up to 50 titles at once
  for (let i = 0; i < titles.length; i += 50) {
    try {
      for (const info of await fetchTemplateDataBatch(titles.slice(i, i + 50))) {
        result.set(info.title, info);
      }
    } catch {
      // Continue next batch
    }
  }

  return result;
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
    pst: "1",
    disablelimitreport: "1",
    disableeditsection: "1",
    formatversion: "2",
    format: "json",
  });

  try {
    const mwApi = getMediaWikiApiUrl("ixwiki");
    const res = await fetch(mwApi, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": DEFAULT_USER_AGENT,
        "Api-User-Agent": DEFAULT_USER_AGENT,
      },
      body: apiParams.toString(),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        parse?: { text?: string };
      };
      if (data.parse?.text) {
        return transformWikiLinks(
          transformImages(stripConflictingStyles(data.parse.text), "ixwiki")
        );
      }
    }
  } catch {
    // Fall through to local compiler
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

/** Ordered keyword rules: the first category with a matching keyword wins. */
const CATEGORY_RULES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["engine", ["countrydata", "businessdata", "defensedata", "vitalitydata", "stabilitydata"]],
  [
    "sovereign",
    [
      "country",
      "settlement",
      "city",
      "subdivision",
      "province",
      "state",
      "territory",
      "caphirian province",
      "kirstate",
      "cartadania",
      "former country",
    ],
  ],
  [
    "biography",
    [
      "person",
      "monarch",
      "imperator",
      "officeholder",
      "noble",
      "royalty",
      "scientist",
      "academic",
      "philosopher",
      "saint",
      "religious biography",
      "bishop",
      "military person",
      "military personnel",
      "biography",
    ],
  ],
  [
    "defense",
    [
      "conflict",
      "war",
      "battle",
      "military unit",
      "national military",
      "ship",
      "naval",
      "vessel",
      "submarine",
      "aircraft",
      "weapon",
      "missile",
      "military installation",
      "fort",
      "defense",
    ],
  ],
  [
    "economy",
    [
      "company",
      "enterprise",
      "corporation",
      "central bank",
      "currency",
      "bank",
      "airport",
      "port",
      "rail",
      "power station",
      "mine",
      "pipeline",
      "bridge",
      "road",
      "infrastructure",
    ],
  ],
  [
    "lore",
    [
      "spacecraft",
      "rocket",
      "invention",
      "software",
      "language",
      "conlang",
      "religion",
      "church",
      "heritage",
      "historical era",
      "historical event",
      "bilateral relations",
      "book",
      "film",
      "sports team",
    ],
  ],
  ["citation", ["citation", "cite", "ref"]],
  ["navigation", ["navbox", "navigation", "sidebar"]],
  ["formatting", ["quote", "hatnote", "timeline", "gallery"]],
  ["geographic", ["map", "coord", "location", "weather", "climate"]],
  ["icon", ["flag", "coat of arms", "icon", "heraldry"]],
  ["sovereign", ["infobox"]],
];

/**
 * Categorize a template into a canonical domain tier based on its name/description.
 */
export function categorizeTemplate(name: string, description?: string): string {
  const lower = `${name} ${description ?? ""}`.toLowerCase();
  const match = CATEGORY_RULES.find(([, keywords]) => keywords.some((k) => lower.includes(k)));
  return match?.[0] ?? "general";
}
