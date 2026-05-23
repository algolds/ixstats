/**
 * unified-wiki-parser.ts — Comprehensive wiki infobox parser with template processing.
 *
 * Unified entry point for all wiki parsing across the app.
 * Handles IxWiki, IIWiki, and AltHistory Wiki uniformly.
 *
 * Pipeline:
 * 1. Fetch wikitext via WikiBridge
 * 2. Extract infobox via brace-depth parser (wiki-infobox-parser.ts)
 * 3. Process templates (Switcher, convert, flag, formatnum, etc.)
 * 4. Return structured UnifiedInfoboxData with 80+ typed fields
 */

import { parseInfobox, parsePopulation, extractCoordsFromFields } from "./wiki-infobox-parser";
import { resolveImageUrl } from "./wiki-image-url";
import type { WikiSource } from "./mediawiki-config";

export { resolveImageUrl };

// ─── Unified Infobox Data Interface ───────────────────────────────────────────

export interface UnifiedInfoboxData {
  // Core identification
  name: string;
  conventional_long_name?: string;
  native_name?: string;
  common_name?: string;
  official_name?: string;

  // Visual elements
  image_flag?: string;
  flag?: string;
  flagUrl?: string;
  image_coat?: string;
  coat_of_arms?: string;
  coatOfArmsUrl?: string;
  locator_map?: string;
  image_map?: string;

  // Geographic data
  capital?: string;
  largest_city?: string;
  area_total?: string;
  area_km2?: number;
  area_rank?: string;
  continent?: string;
  coordinates?: [number, number];
  climate?: string;

  // Government data
  government_type?: string;
  leader_title1?: string;
  leader_name1?: string;
  leader_title2?: string;
  leader_name2?: string;
  leader_title3?: string;
  leader_name3?: string;
  leader_title4?: string;
  leader_name4?: string;
  head_of_state?: string;
  head_of_government?: string;
  deputy_leader?: string;
  legislature?: string;
  upper_house?: string;
  lower_house?: string;

  // Economic data
  GDP_PPP?: string;
  GDP_PPP_per_capita?: string;
  GDP_nominal?: string;
  GDP_nominal_per_capita?: string;
  gdp?: number;
  gdp_ppp?: number;
  gdp_nominal?: number;
  gdpPerCapita?: number;
  currency?: string;
  currency_code?: string;

  // Population data
  population?: number;
  population_estimate?: number;
  population_census?: number;
  population_density?: string;
  life_expectancy?: number;
  literacy_rate?: number;
  urbanization?: number;

  // Cultural data
  official_languages?: string;
  languages?: string;
  ethnic_groups?: string;
  religion?: string;
  demonym?: string;
  national_anthem?: string;
  motto?: string;

  // Historical data
  established?: string;
  established_event1?: string;
  established_date1?: string;
  established_event2?: string;
  established_date2?: string;
  established_event3?: string;
  established_date3?: string;
  independence_date?: string;

  // Technical data
  time_zone?: string;
  drives_on?: string;
  calling_code?: string;
  internet_tld?: string;
  iso_code?: string;
  electricity?: string;

  // Additional
  hdi?: string;
  patron_saint?: string;
  national_motto?: string;
  wikiIntro?: string;

  // Raw infobox for interactive display
  rawInfobox?: Record<string, string>;
  templateName?: string;
}

// ─── Template Processing Functions ────────────────────────────────────────────

function splitByPipe(content: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let linkDepth = 0;
  let start = 0;

  for (let i = 0; i < content.length; i++) {
    if (content[i] === "{" && i + 1 < content.length && content[i + 1] === "{") {
      depth++;
      i++;
    } else if (content[i] === "}" && i + 1 < content.length && content[i + 1] === "}") {
      depth--;
      i++;
    } else if (content[i] === "[" && i + 1 < content.length && content[i + 1] === "[") {
      linkDepth++;
      i++;
    } else if (content[i] === "]" && i + 1 < content.length && content[i + 1] === "]") {
      linkDepth--;
      i++;
    } else if (content[i] === "|" && depth === 0 && linkDepth === 0) {
      parts.push(content.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(content.slice(start));
  return parts;
}

function cleanWikiValue(raw: string): string {
  let s = raw;
  s = s.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");
  s = s.replace(/'{2,3}/g, "");
  // Iterate to strip nested templates from innermost out
  let prev;
  do { prev = s; s = s.replace(/\{\{[^{}]*\}\}/g, ''); } while (s !== prev);
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&\w+;/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function processSwitcher(value: string): string {
  const match = /\{\{\s*[Ss]witcher\s*\|([\s\S]*?)\}\}/.exec(value);
  if (!match) return value;
  const content = match[1]!;
  const parts = splitByPipe(content);
  const first = parts[0]?.trim() || "";
  if (first.startsWith("File:") || first.startsWith("Image:") || first.startsWith("file:")) {
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed.startsWith("File:") && !trimmed.startsWith("Image:") && !trimmed.startsWith("file:")) {
        return cleanWikiValue(trimmed);
      }
    }
    return cleanWikiValue(first);
  }
  return cleanWikiValue(first);
}

function processConvert(value: string): string {
  return value
    .replace(/\{\{convert\|([^|]+)\|([^|]+)[\|]?[^}]*\}\}/g, (_m, num, unit) => `${num.trim()} ${unit.trim()}`)
    .replace(/\{\{convert\|([^|]+)\|([^}]+)\}\}/g, (_m, num, unit) => `${num.trim()} ${unit.trim()}`);
}

function processFlag(value: string): string {
  return value.replace(/\{\{flag\|([^}|]+)[^}]*\}\}/g, "$1");
}

function processFormatnum(value: string): string {
  return value.replace(/\{\{formatnum[:|]([^}]+)\}\}/g, "$1");
}

function processNts(value: string): string {
  return value.replace(/\{\{nts\|([^}]+)\}\}/g, "$1");
}

function processVal(value: string): string {
  return value
    .replace(/\{\{val\|([^|]+)\|unit=([^}]+)\}\}/g, "$1 $2")
    .replace(/\{\{val\|([^}]+)\}\}/g, "$1");
}

function processStartDate(value: string): string {
  return value
    .replace(/\{\{start date\|(\d{4})\|(\d{1,2})\|(\d{1,2})[^}]*\}\}/g, "$1-$2-$3")
    .replace(/\{\{start date\|(\d{4})[^}]*\}\}/g, "$1");
}

function processGdp(value: string): string {
  let result = value;
  result = result.replace(/\{\{increase\}\}/g, "").replace(/\{\{decrease\}\}/g, "");
  result = result.replace(/\{\{flagicon\|[^}]*\}\}/g, "").replace(/\{\{flag\|[^}]*\}\}/g, "");
  return result;
}

function processHdi(value: string): string {
  const hdiMatch = /\{\{HDI data\|[^|]*\|[^|]*\|([^}|]+)[^}]*\}\}/.exec(value);
  if (hdiMatch) return hdiMatch[1]!;
  const rankMatch = /\{\{HDI ranking\|[^|]*\|[^|]*\|([^}|]+)[^}]*\}\}/.exec(value);
  if (rankMatch) return rankMatch[1]!;
  return value;
}

function processWikilinks(value: string): string {
  return value.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");
}

function processRefs(value: string): string {
  return value
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^/>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*/gi, "");
}

function processBr(value: string): string {
  return value.replace(/<br\s*\/?>/gi, ", ");
}

function processSmall(value: string): string {
  return value.replace(/<small[^>]*>[\s\S]*?<\/small>/gi, "");
}

function processComments(value: string): string {
  return value.replace(/<!--[\s\S]*?-->/g, "");
}

function processSort(value: string): string {
  return value
    .replace(/\{\{sort\|[^|]*\|([^}]+)\}\}/g, "$1")
    .replace(/\{\{sort\|([^}]+)\}\}/g, "$1");
}

function processDts(value: string): string {
  return value
    .replace(/\{\{dts\|(\d{4})\|(\d{1,2})\|(\d{1,2})[^}]*\}\}/g, "$1-$2-$3")
    .replace(/\{\{dts\|([^}]+)\}\}/g, "$1");
}

function processNowiki(value: string): string {
  return value.replace(/<nowiki[^>]*>([\s\S]*?)<\/nowiki>/gi, "$1");
}

function processColor(value: string): string {
  return value
    .replace(/\{\{color\|[^|]*\|([^}]+)\}\}/g, "$1")
    .replace(/\{\{colour\|[^|]*\|([^}]+)\}\}/g, "$1");
}

function processLang(value: string): string {
  return value
    .replace(/\{\{lang\|[^|]*\|([^}]+)\}\}/g, "$1")
    .replace(/\{\{langx\|[^|]*\|([^}]+)\}\}/g, "$1");
}

function processWp(value: string): string {
  return value.replace(/\{\{wp\|([^}|]+)[^}]*\}\}/g, "$1");
}

function processAbbr(value: string): string {
  return value.replace(/\{\{abbr\|([^|]+)\|[^}]*\}\}/g, "$1");
}

function processNobold(value: string): string {
  return value.replace(/\{\{nobold\|([^}]+)\}\}/g, "$1");
}

function processList(value: string): string {
  return value
    .replace(/\{\{plainlist\|([\s\S]*?)\}\}/g, "$1")
    .replace(/\{\{flatlist\|([\s\S]*?)\}\}/g, "$1")
    .replace(/\{\{unbulleted list\|([\s\S]*?)\}\}/g, "$1")
    .replace(/\{\{bulleted list\|([\s\S]*?)\}\}/g, "$1");
}

function processCompose(value: string): string {
  return value.replace(/\{\{compose\|([\s\S]*?)\}\}/g, (_match, content) => {
    return splitByPipe(content).map(p => cleanWikiValue(p.trim())).filter(Boolean).join(", ");
  });
}

function processTemplates(value: string): string {
  let result = value;
  result = processComments(result);
  result = processNowiki(result);
  result = processSwitcher(result);
  result = processConvert(result);
  result = processFlag(result);
  result = processFormatnum(result);
  result = processNts(result);
  result = processVal(result);
  result = processStartDate(result);
  result = processGdp(result);
  result = processHdi(result);
  result = processSort(result);
  result = processDts(result);
  result = processColor(result);
  result = processLang(result);
  result = processWp(result);
  result = processAbbr(result);
  result = processNobold(result);
  result = processList(result);
  result = processCompose(result);
  // Iterate to strip nested templates from innermost out
  let prevTemplate;
  do { prevTemplate = result; result = result.replace(/\{\{[^{}]*\}\}/g, ''); } while (result !== prevTemplate);
  result = processRefs(result);
  result = processSmall(result);
  result = processBr(result);
  result = processWikilinks(result);
  result = result.replace(/'{2,3}/g, "");
  result = result.replace(/&\w+;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*,/g, ",")
    .replace(/,\s*$/, "")
    .trim();
  return result;
}

// ─── Field Mapping ────────────────────────────────────────────────────────────

const FIELD_ALIASES: Record<string, keyof UnifiedInfoboxData> = {
  conventional_long_name: "conventional_long_name",
  native_name: "native_name",
  common_name: "common_name",
  official_name: "official_name",
  officialname: "official_name",
  image_flag: "image_flag",
  flag: "flag",
  image_coat: "image_coat",
  coat_of_arms: "coat_of_arms",
  coatofarms: "coat_of_arms",
  locator_map: "locator_map",
  image_map: "image_map",
  capital: "capital",
  capital_city: "capital",
  largest_city: "largest_city",
  largestcity: "largest_city",
  area_total: "area_total",
  area_km2: "area_km2",
  area: "area_total",
  area_rank: "area_rank",
  continent: "continent",
  climate: "climate",
  government_type: "government_type",
  government: "government_type",
  gov_type: "government_type",
  leader_title1: "leader_title1",
  leader_name1: "leader_name1",
  leader_title2: "leader_title2",
  leader_name2: "leader_name2",
  leader_title3: "leader_title3",
  leader_name3: "leader_name3",
  leader_title4: "leader_title4",
  leader_name4: "leader_name4",
  head_of_state: "head_of_state",
  headofstate: "head_of_state",
  head_of_government: "head_of_government",
  headofgovernment: "head_of_government",
  deputy_leader: "deputy_leader",
  legislature: "legislature",
  upper_house: "upper_house",
  lower_house: "lower_house",
  GDP_PPP: "GDP_PPP",
  gdp_ppp: "GDP_PPP",
  GDP_PPP_per_capita: "GDP_PPP_per_capita",
  gdp_ppp_per_capita: "GDP_PPP_per_capita",
  GDP_nominal: "GDP_nominal",
  gdp_nominal: "GDP_nominal",
  GDP: "GDP_nominal",
  gdp: "GDP_nominal",
  GDP_total: "GDP_nominal",
  gdp_total: "GDP_nominal",
  GDP_nominal_per_capita: "GDP_nominal_per_capita",
  gdp_nominal_per_capita: "GDP_nominal_per_capita",
  GDP_per_capita: "GDP_nominal_per_capita",
  gdp_per_capita: "GDP_nominal_per_capita",
  currency: "currency",
  currency_code: "currency_code",
  population_estimate: "population_estimate",
  population_est: "population_estimate",
  pop_estimate: "population_estimate",
  population_census: "population_census",
  population: "population",
  population_total: "population",
  pop: "population",
  pop_total: "population",
  population_data: "population",
  population_density: "population_density",
  pop_density: "population_density",
  life_expectancy: "life_expectancy",
  life_expect: "life_expectancy",
  literacy_rate: "literacy_rate",
  literacy: "literacy_rate",
  urbanization: "urbanization",
  urban_pop: "urbanization",
  official_languages: "official_languages",
  official_language: "official_languages",
  languages: "languages",
  language: "languages",
  ethnic_groups: "ethnic_groups",
  ethnicity: "ethnic_groups",
  religion: "religion",
  demonym: "demonym",
  national_anthem: "national_anthem",
  anthem: "national_anthem",
  motto: "motto",
  national_motto: "national_motto",
  established: "established",
  established_event1: "established_event1",
  established_date1: "established_date1",
  established_event2: "established_event2",
  established_date2: "established_date2",
  established_event3: "established_event3",
  established_date3: "established_date3",
  independence_date: "independence_date",
  independence: "independence_date",
  time_zone: "time_zone",
  timezone: "time_zone",
  drives_on: "drives_on",
  drives: "drives_on",
  driving_side: "drives_on",
  calling_code: "calling_code",
  callingCode: "calling_code",
  internet_tld: "internet_tld",
  internetTld: "internet_tld",
  tld: "internet_tld",
  iso_code: "iso_code",
  iso: "iso_code",
  electricity: "electricity",
  HDI: "hdi",
  hdi: "hdi",
  patron_saint: "patron_saint",
  englishmotto: "motto",
};

const NUMERIC_FIELDS = new Set([
  "population", "population_estimate", "population_census",
  "area_km2", "GDP_nominal", "GDP_PPP",
  "GDP_nominal_per_capita", "GDP_PPP_per_capita",
  "life_expectancy", "literacy_rate", "urbanization",
]);

// Also track lowercase versions since FIELD_ALIASES values are case-sensitive
const NUMERIC_FIELDS_LOWER = new Set([
  "population", "population_estimate", "population_census",
  "area_km2", "gdp_nominal", "gdp_ppp",
  "gdp_nominal_per_capita", "gdp_ppp_per_capita",
  "life_expectancy", "literacy_rate", "urbanization",
]);

// ─── Image/File Extraction Helpers ──────────────────────────────────────────

const IMAGE_FIELDS = new Set<string>([
  "image_flag",
  "flag",
  "image_coat",
  "coat_of_arms",
  "locator_map",
  "image_map",
]);

function extractFilename(value: string): string {
  if (!value) return "";
  // Trim comments first
  let clean = value.replace(/<!--[\s\S]*?-->/g, "").trim();

  // If it's an external URL, return as is
  if (/^https?:\/\//i.test(clean) || clean.startsWith("//")) {
    return clean;
  }

  // Handle [[File:Filename.png|options]] or [[Image:Filename.png|options]]
  const fileLinkMatch = /\[\[(?:File|Image|file|image):\s*([^|\]]+)/i.exec(clean);
  if (fileLinkMatch && fileLinkMatch[1]) {
    return fileLinkMatch[1].trim();
  }

  // Handle plain [[Filename.png]] (without File: prefix)
  const plainLinkMatch = /\[\[\s*([^|\]]+)/i.exec(clean);
  if (plainLinkMatch && plainLinkMatch[1]) {
    return plainLinkMatch[1].trim();
  }

  // Handle switcher template
  const switcherMatch = /\{\{\s*[Ss]witcher\s*\|\s*([^|]+)/i.exec(clean);
  if (switcherMatch && switcherMatch[1]) {
    return extractFilename(switcherMatch[1]);
  }

  // Strip general templates and formatting
  let plain = clean
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
    .trim();

  if (plain.includes("|")) {
    plain = plain.split("|")[0]!.trim();
  }

  return plain;
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

export function parseInfoboxWithTemplates(
  wikitext: string,
  countryName?: string
): UnifiedInfoboxData | null {
  // Guard against excessively large wikitext (potential regex DoS)
  if (wikitext.length > 500_000) return null;

  const parsed = parseInfobox(wikitext);
  if (!parsed) return null;

  const result: UnifiedInfoboxData = {
    name: countryName || "",
  };
  const rawInfobox: Record<string, string> = {};

  for (const field of parsed.fields) {
    const rawKey = field.key;
    const unifiedKey = FIELD_ALIASES[rawKey.toLowerCase().replace(/[\s-]/g, "_")];
    
    // Determine if it is an image field
    const isImageField = unifiedKey && IMAGE_FIELDS.has(unifiedKey);
    const processedValue = isImageField 
      ? extractFilename(field.rawValue)
      : processTemplates(field.rawValue);
      
    if (!processedValue) continue;

    rawInfobox[rawKey] = processedValue;

    if (unifiedKey) {
      const isNumeric = NUMERIC_FIELDS.has(unifiedKey) || NUMERIC_FIELDS_LOWER.has(unifiedKey);
      if (isNumeric) {
        const num = parsePopulation(field.rawValue);
        if (num !== null) {
          (result as any)[unifiedKey] = num;
        } else {
          (result as any)[unifiedKey] = processedValue;
        }
      } else {
        (result as any)[unifiedKey] = processedValue;
      }
    }
  }

  const coords = extractCoordsFromFields(parsed.fields);
  if (coords) result.coordinates = coords;

  if (!result.head_of_state && result.leader_title1 && result.leader_name1) {
    const title = (result.leader_title1 || "").toLowerCase();
    if (title.includes("president") || title.includes("monarch") || title.includes("king") || title.includes("queen") || title.includes("emperor") || title.includes("sultan")) {
      result.head_of_state = result.leader_name1;
    } else if (title.includes("prime minister") || title.includes("chancellor") || title.includes("premier")) {
      result.head_of_government = result.leader_name1;
    } else {
      result.head_of_state = result.leader_name1;
    }
  }
  if (!result.head_of_government && result.leader_name2) {
    result.head_of_government = result.leader_name2;
  }

  if (typeof result.GDP_nominal === "string") {
    const gdpNum = parsePopulation(result.GDP_nominal);
    if (gdpNum !== null) result.gdp_nominal = gdpNum;
  } else if (typeof result.GDP_nominal === "number") {
    result.gdp_nominal = result.GDP_nominal;
  }
  if (typeof result.GDP_PPP === "string") {
    const gdpPppNum = parsePopulation(result.GDP_PPP);
    if (gdpPppNum !== null) result.gdp_ppp = gdpPppNum;
  } else if (typeof result.GDP_PPP === "number") {
    result.gdp_ppp = result.GDP_PPP;
  }
  if (typeof result.GDP_nominal_per_capita === "string") {
    const gdpPcNum = parsePopulation(result.GDP_nominal_per_capita);
    if (gdpPcNum !== null) result.gdpPerCapita = gdpPcNum;
  } else if (typeof result.GDP_nominal_per_capita === "number") {
    result.gdpPerCapita = result.GDP_nominal_per_capita;
  }

  if (!result.name && result.common_name) result.name = result.common_name;
  if (!result.name && result.conventional_long_name) result.name = result.conventional_long_name;

  result.rawInfobox = rawInfobox;
  result.templateName = parsed.templateName;

  return result;
}

export async function fetchAndParseInfobox(
  pageName: string,
  wikiSource: WikiSource = "ixwiki"
): Promise<UnifiedInfoboxData | null> {
  try {
    const { getArticleWikitext } = await import("./wiki-bridge");
    const wikitext = await getArticleWikitext(pageName, wikiSource);
    if (!wikitext) return null;
    return parseInfoboxWithTemplates(wikitext.wikitext, pageName);
  } catch {
    return null;
  }
}
