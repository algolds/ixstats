/**
 * Infobox parser with template processing, shared by IxWiki, IIWiki and AltHistory Wiki.
 *
 * Pipeline: extract the infobox (infobox-parser.ts), process templates (Switcher, convert, flag,
 * formatnum, ...), and return structured UnifiedInfoboxData.
 */

import {
  parseInfobox,
  parsePopulation,
  extractCoordsFromFields,
  cleanWikiValue,
} from "~/lib/wiki-os/transformers/infobox-parser";
import { resolveImageUrl } from "~/lib/wiki-os/transformers/image-url";
import { splitBalancedPipes } from "~/lib/wiki-os/wikitext/parameter-parser";

export { resolveImageUrl };

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
  categories?: string[];
  rawWikitext?: string;

  // Raw infobox for interactive display
  rawInfobox?: Record<string, string>;
  templateName?: string;
}

type Rule = readonly [RegExp, string];

const applyRules = (value: string, rules: readonly Rule[]): string =>
  rules.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);

const STRIP_MARKUP_RULES: Rule[] = [
  [/<!--[\s\S]*?-->/g, ""],
  [/<nowiki[^>]*>([\s\S]*?)<\/nowiki>/gi, "$1"],
];

const SIMPLE_TEMPLATE_RULES: Rule[] = [
  [/\{\{flag\|([^}|]+)[^}]*\}\}/g, "$1"],
  [/\{\{formatnum[:|]([^}]+)\}\}/g, "$1"],
  [/\{\{nts\|([^}]+)\}\}/g, "$1"],
  [/\{\{val\|([^|]+)\|unit=([^}]+)\}\}/g, "$1 $2"],
  [/\{\{val\|([^}]+)\}\}/g, "$1"],
  [/\{\{start date\|(\d{4})\|(\d{1,2})\|(\d{1,2})[^}]*\}\}/g, "$1-$2-$3"],
  [/\{\{start date\|(\d{4})[^}]*\}\}/g, "$1"],
  [/\{\{increase\}\}/g, ""],
  [/\{\{decrease\}\}/g, ""],
  [/\{\{flagicon\|[^}]*\}\}/g, ""],
  [/\{\{flag\|[^}]*\}\}/g, ""],
];

const DISPLAY_TEMPLATE_RULES: Rule[] = [
  [/\{\{sort\|[^|]*\|([^}]+)\}\}/g, "$1"],
  [/\{\{sort\|([^}]+)\}\}/g, "$1"],
  [/\{\{dts\|(\d{4})\|(\d{1,2})\|(\d{1,2})[^}]*\}\}/g, "$1-$2-$3"],
  [/\{\{dts\|([^}]+)\}\}/g, "$1"],
  [/\{\{color\|[^|]*\|([^}]+)\}\}/g, "$1"],
  [/\{\{colour\|[^|]*\|([^}]+)\}\}/g, "$1"],
  [/\{\{lang\|[^|]*\|([^}]+)\}\}/g, "$1"],
  [/\{\{langx\|[^|]*\|([^}]+)\}\}/g, "$1"],
  [/\{\{wp\|([^}|]+)[^}]*\}\}/g, "$1"],
  [/\{\{abbr\|([^|]+)\|[^}]*\}\}/g, "$1"],
  [/\{\{nobold\|([^}]+)\}\}/g, "$1"],
  [/\{\{plainlist\|([\s\S]*?)\}\}/g, "$1"],
  [/\{\{flatlist\|([\s\S]*?)\}\}/g, "$1"],
  [/\{\{unbulleted list\|([\s\S]*?)\}\}/g, "$1"],
  [/\{\{bulleted list\|([\s\S]*?)\}\}/g, "$1"],
];

/** Applied once every template has been stripped. */
const CLEANUP_RULES: Rule[] = [
  [/<ref[^>]*>[\s\S]*?<\/ref>/gi, ""],
  [/<ref[^/>]*\/>/gi, ""],
  [/<ref[^>]*>[\s\S]*/gi, ""],
  [/<small[^>]*>[\s\S]*?<\/small>/gi, ""],
  [/<br\s*\/?>/gi, ", "],
  [/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1"],
  [/'{2,3}/g, ""],
  [/&\w+;/g, " "],
  [/\s+/g, " "],
  [/\s*,\s*,/g, ","],
  [/,\s*$/, ""],
];

const isFileRef = (text: string): boolean => /^(?:File|Image|file):/.test(text);

function processSwitcher(value: string): string {
  const match = /\{\{\s*[Ss]witcher\s*\|([\s\S]*?)\}\}/.exec(value);
  if (!match) return value;
  const parts = splitBalancedPipes(match[1]!).map((part) => part.trim());
  const first = parts[0] ?? "";
  // A file switcher shows its first non-file entry; any other switcher shows its first entry.
  return cleanWikiValue(
    isFileRef(first) ? (parts.find((part) => !isFileRef(part)) ?? first) : first
  );
}

function processConvert(value: string): string {
  return value
    .replace(
      /\{\{convert\|([^|]+)\|([^|]+)[|]?[^}]*\}\}/g,
      (_m, num, unit) => `${num.trim()} ${unit.trim()}`
    )
    .replace(
      /\{\{convert\|([^|]+)\|([^}]+)\}\}/g,
      (_m, num, unit) => `${num.trim()} ${unit.trim()}`
    );
}

function processHdi(value: string): string {
  const hdiMatch =
    /\{\{HDI data\|[^|]*\|[^|]*\|([^}|]+)[^}]*\}\}/.exec(value) ??
    /\{\{HDI ranking\|[^|]*\|[^|]*\|([^}|]+)[^}]*\}\}/.exec(value);
  return hdiMatch ? hdiMatch[1]! : value;
}

function processCompose(value: string): string {
  return value.replace(/\{\{compose\|([\s\S]*?)\}\}/g, (_match, content) =>
    splitBalancedPipes(content)
      .map((p) => cleanWikiValue(p.trim()))
      .filter(Boolean)
      .join(", ")
  );
}

function stripNestedTemplates(value: string): string {
  let result = value;
  let previous;
  do {
    previous = result;
    result = result.replace(/\{\{[^{}]*\}\}/g, "");
  } while (result !== previous);
  return result;
}

function processTemplates(value: string): string {
  const steps = [
    (text: string) => applyRules(text, STRIP_MARKUP_RULES),
    processSwitcher,
    processConvert,
    (text: string) => applyRules(text, SIMPLE_TEMPLATE_RULES),
    processHdi,
    (text: string) => applyRules(text, DISPLAY_TEMPLATE_RULES),
    processCompose,
    stripNestedTemplates,
    (text: string) => applyRules(text, CLEANUP_RULES),
  ];
  return steps.reduce((text, step) => step(text), value).trim();
}

/** Infobox keys that are already canonical field names (matched case-insensitively). */
const CANONICAL_FIELDS = `
  conventional_long_name native_name common_name official_name image_flag flag image_coat
  coat_of_arms locator_map image_map capital largest_city area_total area_km2 area_rank
  continent climate government_type leader_title1 leader_name1 leader_title2 leader_name2
  leader_title3 leader_name3 leader_title4 leader_name4 head_of_state head_of_government
  deputy_leader legislature upper_house lower_house currency currency_code
  population_estimate population_census population population_density life_expectancy
  literacy_rate urbanization official_languages languages ethnic_groups religion demonym
  national_anthem motto national_motto established established_event1 established_date1
  established_event2 established_date2 established_event3 established_date3
  independence_date time_zone drives_on calling_code internet_tld iso_code electricity
  hdi patron_saint
`
  .trim()
  .split(/\s+/);

/** Normalized infobox key to canonical field name. */
const FIELD_ALIASES: Record<string, string> = {
  ...Object.fromEntries(CANONICAL_FIELDS.map((field) => [field, field])),
  officialname: "official_name",
  coatofarms: "coat_of_arms",
  capital_city: "capital",
  largestcity: "largest_city",
  area: "area_total",
  government: "government_type",
  gov_type: "government_type",
  headofstate: "head_of_state",
  headofgovernment: "head_of_government",
  gdp_ppp: "GDP_PPP",
  gdp_ppp_per_capita: "GDP_PPP_per_capita",
  gdp_nominal: "GDP_nominal",
  gdp: "GDP_nominal",
  gdp_total: "GDP_nominal",
  gdp_nominal_per_capita: "GDP_nominal_per_capita",
  gdp_per_capita: "GDP_nominal_per_capita",
  population_est: "population_estimate",
  pop_estimate: "population_estimate",
  population_total: "population",
  pop: "population",
  pop_total: "population",
  population_data: "population",
  pop_density: "population_density",
  life_expect: "life_expectancy",
  literacy: "literacy_rate",
  urban_pop: "urbanization",
  official_language: "official_languages",
  language: "languages",
  ethnicity: "ethnic_groups",
  anthem: "national_anthem",
  independence: "independence_date",
  timezone: "time_zone",
  drives: "drives_on",
  driving_side: "drives_on",
  tld: "internet_tld",
  iso: "iso_code",
  englishmotto: "motto",
};

const NUMERIC_FIELDS = new Set([
  "population",
  "population_estimate",
  "population_census",
  "area_km2",
  "GDP_nominal",
  "GDP_PPP",
  "GDP_nominal_per_capita",
  "GDP_PPP_per_capita",
  "life_expectancy",
  "literacy_rate",
  "urbanization",
]);

const IMAGE_FIELDS = new Set([
  "image_flag",
  "flag",
  "image_coat",
  "coat_of_arms",
  "locator_map",
  "image_map",
]);

function extractFilename(value: string): string {
  if (!value) return "";
  const clean = value.replace(/<!--[\s\S]*?-->/g, "").trim();

  // External URLs are returned as is.
  if (/^https?:\/\//i.test(clean) || clean.startsWith("//")) return clean;

  // [[File:Filename.png|options]], [[Image:Filename.png|options]] or plain [[Filename.png]]
  const link =
    /\[\[(?:File|Image):\s*([^|\]]+)/i.exec(clean)?.[1] ?? /\[\[\s*([^|\]]+)/.exec(clean)?.[1];
  if (link) return link.trim();

  const switcher = /\{\{\s*[Ss]witcher\s*\|\s*([^|]+)/i.exec(clean)?.[1];
  if (switcher) return extractFilename(switcher);

  // Strip general templates and formatting
  const plain = clean
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
    .trim();

  return plain.split("|")[0]!.trim();
}

const HEAD_OF_STATE_TITLE = /president|monarch|king|queen|emperor|sultan/;
const HEAD_OF_GOVERNMENT_TITLE = /prime minister|chancellor|premier/;

/** Fills head_of_state / head_of_government from the numbered leader fields when absent. */
function inferHeads(result: UnifiedInfoboxData): void {
  if (!result.head_of_state && result.leader_title1 && result.leader_name1) {
    const title = result.leader_title1.toLowerCase();
    const isGovernmentHead =
      !HEAD_OF_STATE_TITLE.test(title) && HEAD_OF_GOVERNMENT_TITLE.test(title);
    result[isGovernmentHead ? "head_of_government" : "head_of_state"] = result.leader_name1;
  }
  if (!result.head_of_government && result.leader_name2) {
    result.head_of_government = result.leader_name2;
  }
}

/** Numeric mirrors of the textual GDP fields. */
const GDP_MIRRORS = [
  ["GDP_nominal", "gdp_nominal"],
  ["GDP_PPP", "gdp_ppp"],
  ["GDP_nominal_per_capita", "gdpPerCapita"],
] as const;

export function parseInfoboxWithTemplates(
  wikitext: string,
  countryName?: string
): UnifiedInfoboxData | null {
  // Guard against excessively large wikitext (potential regex DoS)
  if (wikitext.length > 500_000) return null;

  const parsed = parseInfobox(wikitext);
  if (!parsed) return null;

  const result: UnifiedInfoboxData = { name: countryName || "" };
  const fields = result as unknown as Record<string, string | number>;
  const rawInfobox: Record<string, string> = {};

  for (const field of parsed.fields) {
    const unifiedKey = FIELD_ALIASES[field.key.toLowerCase().replace(/[\s-]/g, "_")];
    const processedValue =
      unifiedKey && IMAGE_FIELDS.has(unifiedKey)
        ? extractFilename(field.rawValue)
        : processTemplates(field.rawValue);
    if (!processedValue) continue;

    rawInfobox[field.key] = processedValue;
    if (!unifiedKey) continue;

    fields[unifiedKey] = NUMERIC_FIELDS.has(unifiedKey)
      ? (parsePopulation(field.rawValue) ?? processedValue)
      : processedValue;
  }

  const coords = extractCoordsFromFields(parsed.fields);
  if (coords) result.coordinates = coords;

  inferHeads(result);

  for (const [source, target] of GDP_MIRRORS) {
    const value = fields[source];
    const mirrored = typeof value === "string" ? parsePopulation(value) : value;
    if (typeof mirrored === "number") result[target] = mirrored;
  }

  result.name ||= result.common_name || result.conventional_long_name || "";
  result.rawInfobox = rawInfobox;
  result.templateName = parsed.templateName;

  return result;
}
