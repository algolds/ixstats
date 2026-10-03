/**
 * Parse MediaWiki infobox templates into structured data.
 *
 * Handles common infobox formats used on IxWiki:
 * - {{Infobox country|...}}, {{Infobox settlement|...}}, {{Infobox city|...}}
 * - {{coord|lat|N|lng|W|...}} coordinate templates
 * - Nested templates and wiki markup in values
 *
 * Pure functions — no side effects, no database, no fetch.
 */

export interface InfoboxField {
  value: unknown;
  key: string;
  /** Raw wiki markup value */
  rawValue: string;
  /** Cleaned plain-text value (templates/links stripped) */
  cleanValue: string;
  /** Parsed typed value if applicable */
  typedValue?: number | [number, number] | string;
  /** Semantic type hint for auto-fill */
  fieldType: "text" | "number" | "coordinates" | "date" | "unknown";
}

interface ParsedInfobox {
  templateName: string;
  fields: InfoboxField[];
}

/**
 * Parse a {{coord}} template or lat/lon degree fields into [lng, lat].
 * Handles formats:
 * - {{coord|40|26|N|79|58|W}}
 * - {{coord|40.4333|N|79.9667|W}}
 * - {{coord|40.4333|-79.9667}}
 * - latd=40|latm=26|latNS=N|longd=79|longm=58|longEW=W
 */
export function parseCoordTemplate(text: string): [number, number] | null {
  // {{coord|...}} format
  const coordMatch = text.match(/\{\{coord\|([^}]+)\}\}/i);
  if (coordMatch) {
    const parts = coordMatch[1]!.split("|").map((s) => s.trim());
    return parseCoordParts(parts);
  }

  // Try bare numeric coords
  const numMatch = text.match(/(-?\d+\.?\d*)\s*[,|]\s*(-?\d+\.?\d*)/);
  if (numMatch) {
    const a = parseFloat(numMatch[1]!);
    const b = parseFloat(numMatch[2]!);
    if (!isNaN(a) && !isNaN(b)) {
      // Heuristic: if first is lat range (-90 to 90), second is lng
      if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [b, a]; // [lng, lat]
      if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return [a, b];
    }
  }

  return null;
}

function parseCoordParts(parts: string[]): [number, number] | null {
  // Filter out display/format params like "display=inline,title", "type:city"
  const clean = parts.filter(
    (p) =>
      !p.includes("=") &&
      !p.startsWith("type:") &&
      !p.startsWith("region:") &&
      !p.startsWith("display")
  );

  if (clean.length < 2) return null;

  // Try DMS: lat_d, lat_m, lat_s, N/S, lng_d, lng_m, lng_s, E/W
  const nsIdx = clean.findIndex((p) => /^[NS]$/i.test(p));
  const ewIdx = clean.findIndex((p) => /^[EW]$/i.test(p));

  if (nsIdx >= 1 && ewIdx > nsIdx) {
    const latParts = clean.slice(0, nsIdx).map(Number);
    const lngParts = clean.slice(nsIdx + 1, ewIdx).map(Number);
    const ns = clean[nsIdx]!.toUpperCase();
    const ew = clean[ewIdx]!.toUpperCase();

    let lat = dmsToDecimal(latParts);
    let lng = dmsToDecimal(lngParts);
    if (isNaN(lat) || isNaN(lng)) return null;

    if (ns === "S") lat = -lat;
    if (ew === "W") lng = -lng;

    return [lng, lat];
  }

  // Try decimal: two numbers
  const nums = clean.map(Number).filter((n) => !isNaN(n));
  if (nums.length >= 2) {
    const [a, b] = nums;
    // Assume lat, lng order
    if (Math.abs(a!) <= 90 && Math.abs(b!) <= 180) return [b!, a!];
  }

  return null;
}

function dmsToDecimal(parts: number[]): number {
  if (parts.length === 0) return NaN;
  const d = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  return d + m / 60 + s / 3600;
}

/** Parse population strings like "1,234,567", "12.5 million", "{{formatnum:1234567}}" */
export function parsePopulation(text: string): number | null {
  // Strip wiki templates
  let clean = text.replace(/\{\{[^}]*\}\}/g, "").trim();

  // "12.5 million" / "1.2 billion"
  const millMatch = clean.match(/([\d,.]+)\s*(million|billion|thousand)/i);
  if (millMatch) {
    const num = parseFloat(millMatch[1]!.replace(/,/g, ""));
    const mult = millMatch[2]!.toLowerCase();
    if (!isNaN(num)) {
      if (mult === "billion") return Math.round(num * 1e9);
      if (mult === "million") return Math.round(num * 1e6);
      if (mult === "thousand") return Math.round(num * 1e3);
    }
  }

  // Extract {{formatnum:1234567}} or {{formatnum|1234567}} value
  const fmtMatch = text.match(/\{\{formatnum[:|](\d[\d,]*)\}\}/i);
  if (fmtMatch) clean = fmtMatch[1]!;

  // Plain numeric
  const num = parseFloat(clean.replace(/[,\s]/g, ""));
  return !isNaN(num) && num > 0 ? Math.round(num) : null;
}

/** Strip wiki markup from a value: [[links]], '''bold''', templates, HTML */
export function cleanWikiValue(raw: string): string {
  let s = raw;
  // [[Link|Display]] → Display; [[Link]] → Link
  s = s.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");
  // '''bold''' / ''italic''
  s = s.replace(/'{2,3}/g, "");
  // Strip remaining templates (but keep their first arg for simple ones)
  s = s.replace(/\{\{[^}]*\}\}/g, "");
  // HTML tags
  s = s.replace(/<[^>]+>/g, "");
  // &nbsp; etc
  s = s.replace(/&\w+;/g, " ");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Known field names and their semantic types */
const FIELD_TYPE_MAP: Record<string, InfoboxField["fieldType"]> = {
  population: "number",
  population_total: "number",
  population_estimate: "number",
  population_census: "number",
  area: "number",
  area_km2: "number",
  area_total_km2: "number",
  area_land_km2: "number",
  elevation_m: "number",
  elevation: "number",
  gdp_nominal: "number",
  gdp_nominal_per_capita: "number",
  coordinates: "coordinates",
  latd: "coordinates",
  longd: "coordinates",
  established: "date",
  established_date: "date",
  founded: "date",
  founded_date: "date",
  established_title: "text",
  leader_name: "text",
  leader_title: "text",
  leader_name1: "text",
  government_type: "text",
  official_name: "text",
  native_name: "text",
  capital: "text",
  largest_city: "text",
  currency: "text",
  official_languages: "text",
  type: "text",
  subdivision_type: "text",
  subdivision_name: "text",
};

function inferFieldType(key: string): InfoboxField["fieldType"] {
  const normalized = key.toLowerCase().replace(/[\s-]/g, "_");
  return FIELD_TYPE_MAP[normalized] ?? "unknown";
}

/** Index just past the `}}` closing the `{{` at `start`, or -1 when it is never closed. */
function findInfoboxEnd(wikitext: string, start: number): number {
  let depth = 0;
  for (let i = start; i < wikitext.length - 1; i++) {
    const pair = wikitext.slice(i, i + 2);
    if (pair === "{{") {
      depth++;
      i++;
    } else if (pair === "}}") {
      depth--;
      i++;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Nesting change per bracket pair: [template depth, link depth]. */
const NESTING_DELTAS: Record<string, [number, number]> = {
  "{{": [1, 0],
  "}}": [-1, 0],
  "[[": [0, 1],
  "]]": [0, -1],
};

/** Splits at every `|` that is outside nested `{{ }}` and `[[ ]]`. */
function splitTopLevelFields(text: string): string[] {
  const parts: string[] = [];
  let templateDepth = 0;
  let linkDepth = 0;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const delta = NESTING_DELTAS[text.slice(i, i + 2)];
    if (delta) {
      templateDepth += delta[0];
      linkDepth += delta[1];
      i++;
    } else if (text[i] === "|" && templateDepth === 0 && linkDepth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/**
 * Parse the first infobox template from wikitext (typically the main one), handling nested
 * templates inside {{Infobox ...| ...}}.
 */
export function parseInfobox(wikitext: string): ParsedInfobox | null {
  const infoboxStart = wikitext.search(/\{\{[Ii]nfobox[\s_]/);
  if (infoboxStart === -1) return null;

  const infoboxEnd = findInfoboxEnd(wikitext, infoboxStart);
  if (infoboxEnd === -1) return null;

  const infoboxContent = wikitext.slice(infoboxStart + 2, infoboxEnd - 2);

  // Template name: everything before the first pipe
  const firstPipe = infoboxContent.indexOf("|");
  const templateName = (
    firstPipe >= 0 ? infoboxContent.slice(0, firstPipe) : infoboxContent
  ).trim();
  if (firstPipe === -1) return { templateName, fields: [] };

  const fields = splitTopLevelFields(infoboxContent.slice(firstPipe + 1))
    .map(parseField)
    .filter((field): field is InfoboxField => field !== null);

  return { templateName, fields };
}

function parseField(fieldStr: string): InfoboxField | null {
  const eqIdx = fieldStr.indexOf("=");
  if (eqIdx === -1) return null;

  const key = fieldStr.slice(0, eqIdx).trim();
  const rawValue = fieldStr.slice(eqIdx + 1).trim();

  if (!key || !rawValue) return null;

  const cleanValue = cleanWikiValue(rawValue);
  const fieldType = inferFieldType(key);

  let typedValue: InfoboxField["typedValue"] = undefined;

  if (fieldType === "number") {
    const num = parsePopulation(rawValue);
    if (num !== null) typedValue = num;
  } else if (fieldType === "coordinates") {
    const coords = parseCoordTemplate(rawValue);
    if (coords) typedValue = coords;
  } else if (fieldType === "text" && cleanValue) {
    typedValue = cleanValue;
  }

  return { key, value: cleanValue, rawValue, cleanValue, typedValue, fieldType };
}

/**
 * Build coordinate pair from separate latd/latm/longd/longm fields.
 * Call after parsing all fields to check for split coordinate fields.
 */
export function extractCoordsFromFields(fields: InfoboxField[]): [number, number] | null {
  const find = (key: string) => fields.find((f) => f.key.toLowerCase() === key);
  const get = (key: string) => parseFloat(find(key)?.cleanValue ?? "");
  const getStr = (key: string) => find(key)?.cleanValue?.toUpperCase() ?? "";

  const latd = get("latd");
  const longd = get("longd");
  if (isNaN(latd) || isNaN(longd)) return null;

  const latm = get("latm") || 0;
  const lats = get("lats") || 0;
  const longm = get("longm") || 0;
  const longs = get("longs") || 0;

  let lat = latm / 60 + lats / 3600 + latd;
  let lng = longm / 60 + longs / 3600 + longd;

  if (getStr("latns") === "S") lat = -lat;
  if (getStr("longew") === "W") lng = -lng;

  return [lng, lat];
}

/**
 * Renders a parsed infobox into a clean, styled MediaWiki-compatible HTML table.
 */
function renderInfoboxHtml(parsed: ParsedInfobox): string {
  if (!parsed || parsed.fields.length === 0) return "";

  const titleField = parsed.fields.find((f) =>
    ["name", "common_name", "conventional_long_name", "title"].includes(f.key.toLowerCase())
  );

  const imageField = parsed.fields.find((f) =>
    ["image", "image_flag", "image_coat", "photo", "flag", "logo", "coa"].includes(
      f.key.toLowerCase()
    )
  );

  const headerTitle = titleField
    ? titleField.cleanValue
    : parsed.templateName.replace(/^Infobox\s*/i, "");

  let rows = "";

  // If there is an image field, render lead image
  if (imageField && imageField.cleanValue) {
    const cleanImgName = imageField.cleanValue
      .replace(/^\[\[(?:File|Image):/i, "")
      .replace(/\|.*$/i, "")
      .replace(/\]\]$/, "")
      .trim();
    if (cleanImgName) {
      const imgSrc = cleanImgName.startsWith("http")
        ? cleanImgName
        : `/api/mediawiki/ixwiki/${cleanImgName.replace(/ /g, "_")}`;
      rows += `<tr class="infobox-image-row"><td colspan="2" class="p-3 text-center"><img src="${imgSrc}" alt="${cleanImgName}" class="mx-auto max-h-48 rounded-xl object-contain shadow-xs border border-border/30" loading="lazy" /></td></tr>`;
    }
  }

  for (const f of parsed.fields) {
    if (!f.cleanValue || f === titleField || f === imageField) continue;
    const label = f.key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // Format wiki links inside clean value: [[Target|Label]] -> <a href="/wiki/Target">Label</a>
    const formattedVal = f.cleanValue
      .replace(
        /\[\[([^|\]]+)\|([^\]]+)\]\]/g,
        '<a href="/wiki/$1" class="text-wiki hover:underline font-medium">$2</a>'
      )
      .replace(
        /\[\[([^\]]+)\]\]/g,
        '<a href="/wiki/$1" class="text-wiki hover:underline font-medium">$1</a>'
      );

    rows += `<tr class="infobox-row border-b border-border/20 last:border-b-0 hover:bg-muted/15 transition-colors"><th scope="row" class="infobox-label py-1.5 px-2.5 text-left text-xs font-semibold text-muted-foreground align-top w-2/5">${label}</th><td class="infobox-data py-1.5 px-2.5 text-left text-xs text-foreground align-top leading-relaxed">${formattedVal}</td></tr>`;
  }

  return `<table class="infobox wikios-infobox ib-${parsed.templateName.toLowerCase().replace(/[\s_]+/g, "-")} my-4 w-full max-w-sm rounded-2xl border border-border/40 bg-card/80 shadow-md backdrop-blur-md p-3 text-sm"><caption class="infobox-title text-base font-bold text-foreground py-2.5 px-3 border-b border-border/40 text-center tracking-tight font-brand">${headerTitle}</caption><tbody>${rows}</tbody></table>`;
}

/**
 * Helper that extracts the infobox from wikitext and converts it directly to HTML.
 */
export function parseInfoboxToHtml(wikitext: string): string {
  const parsed = parseInfobox(wikitext);
  return parsed ? renderInfoboxHtml(parsed) : "";
}
