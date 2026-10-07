/**
 * wiki-infobox-parser.ts — Parse MediaWiki infobox templates into structured data.
 *
 * Handles common infobox formats used on IxWiki:
 * - {{Infobox country|...}}, {{Infobox settlement|...}}, {{Infobox city|...}}
 * - {{coord|lat|N|lng|W|...}} coordinate templates
 * - Nested templates and wiki markup in values
 *
 * Pure functions — no side effects, no database, no fetch.
 */

import { isBlank } from "../wikitext/blank";
import { forwardFinder } from "../wikitext/forward-finder";
import {
  replaceInlineTemplates,
  replacePipedLinks,
  replaceSimpleLinks,
  stripComments,
  stripHtmlTags,
  unpackInternalLinks,
} from "./clean-markup-passes";

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

export interface ParsedInfobox {
  templateName: string;
  fields: InfoboxField[];
}

// ── Coordinate parsing ─────────────────────────────────────────────

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
  const coordBody = firstCoordBody(text);
  if (coordBody !== null) {
    const parts = coordBody.split("|").map((s) => s.trim());
    return parseCoordParts(parts);
  }

  // Try bare numeric coords
  const numbers = firstNumberPair(text);
  if (numbers) {
    const a = parseFloat(numbers[0]);
    const b = parseFloat(numbers[1]);
    if (!isNaN(a) && !isNaN(b)) {
      // Heuristic: if first is lat range (-90 to 90), second is lng
      if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [b, a]; // [lng, lat]
      if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return [a, b];
    }
  }

  return null;
}

/** What follows the first `{{coord|` that a `}}` closes (what `/\{\{coord\|([^}]+)\}\}/i` captures), or null. */
export function firstCoordBody(text: string): string | null {
  const nextBrace = forwardFinder(text, "}");
  const opener = /\{\{coord\|/gi;
  for (let found = opener.exec(text); found; found = opener.exec(text)) {
    const start = found.index + found[0].length;
    const close = nextBrace(start);
    if (close === -1) return null; // nothing closes any later template either
    if (close > start && text.charAt(close + 1) === "}") return text.slice(start, close);
  }
  return null;
}

const isDigit = (code: number): boolean => code >= 48 && code <= 57;

/** The end of `\d+\.?\d*` that starts at `from`, a digit. */
function numberEnd(text: string, from: number): number {
  let at = from;
  while (isDigit(text.charCodeAt(at))) at++;
  if (text.charCodeAt(at) === 46) at++;
  while (isDigit(text.charCodeAt(at))) at++;
  return at;
}

/**
 * The two numbers of the first `-?\d+\.?\d*\s*[,|]\s*-?\d+\.?\d*` in the text (what
 * `/(-?\d+\.?\d*)\s*[,|]\s*(-?\d+\.?\d*)/` captures), or null. The first number of a candidate runs as far as it
 * can, so every start inside one digit run answers alike: it is tried once, from its first digit.
 */
export function firstNumberPair(text: string): [string, string] | null {
  let at = 0;
  while (at < text.length) {
    if (!isDigit(text.charCodeAt(at))) {
      at++;
      continue;
    }
    let runEnd = at;
    while (isDigit(text.charCodeAt(runEnd))) runEnd++;
    const leftEnd = numberEnd(text, at);
    let separator = leftEnd;
    while (isBlank(text.charCodeAt(separator))) separator++;
    const code = text.charCodeAt(separator);
    if (code === 44 || code === 124) {
      let right = separator + 1;
      while (isBlank(text.charCodeAt(right))) right++;
      const digits = text.charCodeAt(right) === 45 ? right + 1 : right;
      if (isDigit(text.charCodeAt(digits))) {
        const left = text.charCodeAt(at - 1) === 45 ? at - 1 : at;
        return [text.slice(left, leftEnd), text.slice(right, numberEnd(text, digits))];
      }
    }
    at = runEnd;
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

// ── Population parsing ─────────────────────────────────────────────

/** The number written before the first million, billion or thousand (what `/([\d,.]+)\s*(million|billion|thousand)/i` captures), and that word. */
export function firstMagnitude(text: string): [number: string, word: string] | null {
  const word = /million|billion|thousand/gi;
  for (let found = word.exec(text); found; found = word.exec(text)) {
    let end = found.index;
    while (end > 0 && isBlank(text.charCodeAt(end - 1))) end--;
    let start = end;
    while (start > 0 && /[\d,.]/.test(text.charAt(start - 1))) start--;
    if (start < end) return [text.slice(start, end), found[0]];
  }
  return null;
}

/** The digits of the first `{{formatnum:1234567}}` or `{{formatnum|1,234}}` (what `/\{\{formatnum[:|](\d[\d,]*)\}\}/i` captures), or null. */
export function firstFormatnum(text: string): string | null {
  const opener = /\{\{formatnum[:|]/gi;
  for (let found = opener.exec(text); found; found = opener.exec(text)) {
    const start = found.index + found[0].length;
    if (!isDigit(text.charCodeAt(start))) continue;
    let end = start + 1;
    while (isDigit(text.charCodeAt(end)) || text.charCodeAt(end) === 44) end++;
    if (text.startsWith("}}", end)) return text.slice(start, end);
  }
  return null;
}

/** Parse population strings like "1,234,567", "12.5 million", "{{formatnum:1234567}}" */
export function parsePopulation(text: string): number | null {
  // Strip wiki templates
  let clean = replaceInlineTemplates(text, /\{\{[^}]*\}\}/, () => "").trim();

  // "12.5 million" / "1.2 billion"
  const millMatch = firstMagnitude(clean);
  if (millMatch) {
    const num = parseFloat(millMatch[0].replace(/,/g, ""));
    const mult = millMatch[1].toLowerCase();
    if (!isNaN(num)) {
      if (mult === "billion") return Math.round(num * 1e9);
      if (mult === "million") return Math.round(num * 1e6);
      if (mult === "thousand") return Math.round(num * 1e3);
    }
  }

  // Extract {{formatnum:1234567}} or {{formatnum|1234567}} value
  const formatnum = firstFormatnum(text);
  if (formatnum !== null) clean = formatnum;

  // Plain numeric
  const num = parseFloat(clean.replace(/[,\s]/g, ""));
  return !isNaN(num) && num > 0 ? Math.round(num) : null;
}

// ── Money parsing ──────────────────────────────────────────────────

/** The magnitude words and abbreviations a money figure may follow its number with ("$1.5 trillion", "€2.3bn"). */
const MAGNITUDES: Readonly<Record<string, number>> = {
  thousand: 1e3,
  k: 1e3,
  million: 1e6,
  mn: 1e6,
  m: 1e6,
  billion: 1e9,
  bn: 1e9,
  b: 1e9,
  trillion: 1e12,
  tn: 1e12,
  t: 1e12,
};

/**
 * A money figure at the start of a value: an optional "approx." or "~", an optional currency symbol or code
 * ("$", "€", "US$", "Int$", "USD", "NSD"), the number (thousands grouped by commas or spaces, an optional
 * decimal part, never followed by more digit groups it could not read) and the word after it. Anchored, so it
 * reads one figure and stops.
 */
const MONEY =
  /^(?:(?:approx\.?|approximately|about|around|c\.|ca\.|est\.|~|≈)\s*)?(?:[A-Za-z]{0,4}\s?[$€£¥₹₩₽₺₱₦¤]|[A-Z]{2,4}(?![A-Za-z]))?\s*(\d+(?:[, ]\d{3}(?!\d))*(?:\.\d+)?)(?![.,]?\d)(?:\s*([A-Za-z]+))?/;

/** A number-wrapping template (`{{formatnum:45000}}`, `{{nts|45000}}`, `{{nowrap|$45,000}}`) as its first argument. */
const NUMBER_TEMPLATE = /\{\{\s*(?:formatnum|nts|nowrap|val)\s*[:|]([^{}|]*)[^{}]*\}\}/;

/**
 * Parse a money figure such as a GDP or GDP per capita: "$45,000", "US$ 45,000", "Int$ 32,100", "€2.3 billion",
 * "$1.5 trillion", "1.5tn", "{{formatnum:45000}}", "45,000 (2025 est.)". Null when the value does not start
 * with a figure, or the figure is followed by a magnitude this does not know ("45 quadrillion"): a wrong
 * number is worse than none.
 */
export function parseMoney(text: string): number | null {
  let clean = replaceInlineTemplates(stripComments(text), NUMBER_TEMPLATE, (m) => m[1] ?? "");
  clean = replaceInlineTemplates(clean, /\{\{[^}]*\}\}/, () => "");
  clean = stripHtmlTags(unpackInternalLinks(clean))
    .replace(/&nbsp;|&#160;|[   ]/gi, " ")
    .replace(/'{2,3}/g, "")
    .trim();
  const match = MONEY.exec(clean);
  if (!match) return null;
  const num = parseFloat(match[1]!.replace(/[, ]/g, ""));
  const word = match[2]?.toLowerCase();
  const magnitude = word ? MAGNITUDES[word] : undefined;
  // An unknown "-illion" is a magnitude this cannot scale by; any other word (USD, est, dollars) is a label.
  if (word && magnitude === undefined && word.endsWith("illion")) return null;
  const amount = num * (magnitude ?? 1);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
}

// ── Wikitext cleanup ───────────────────────────────────────────────

/** Strip wiki markup from a value: [[links]], '''bold''', templates, HTML */
export function cleanWikiValue(raw: string): string {
  let s = raw;
  // [[Link|Display]] → Display; [[Link]] → Link
  s = unpackInternalLinks(s);
  // '''bold''' / ''italic''
  s = s.replace(/'{2,3}/g, "");
  // Strip remaining templates (but keep their first arg for simple ones)
  s = replaceInlineTemplates(s, /\{\{[^}]*\}\}/, () => "");
  // Line breaks separate values; other HTML tags carry no text
  s = s.replace(/<br\s*\/?>/gi, ", ");
  s = stripHtmlTags(s);
  // &nbsp; etc
  s = s.replace(/&\w+;/g, " ");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  // Adjacent or trailing breaks leave dangling separators
  return s.replace(/\s*,(?:\s*,)+/g, ",").replace(/^(?:,\s*)+|(?:\s*,)+$/g, "");
}

// ── Field type detection ───────────────────────────────────────────

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

// ── Main parser ────────────────────────────────────────────────────

/**
 * Parse all infobox templates from wikitext.
 * Returns the first infobox found (typically the main one).
 */
export function parseInfobox(wikitext: string): ParsedInfobox | null {
  // Find {{Infobox ...| ...}} — handle nested templates
  const infoboxStart = wikitext.search(/\{\{[Ii]nfobox[\s_]/);
  if (infoboxStart === -1) return null;

  // Find the matching closing }}
  let depth = 0;
  let infoboxEnd = -1;
  for (let i = infoboxStart; i < wikitext.length - 1; i++) {
    if (wikitext.charCodeAt(i) === 123 && wikitext.charCodeAt(i + 1) === 123) {
      depth++;
      i++; // skip next char
    } else if (wikitext.charCodeAt(i) === 125 && wikitext.charCodeAt(i + 1) === 125) {
      depth--;
      i++;
      if (depth === 0) {
        infoboxEnd = i + 1;
        break;
      }
    }
  }

  if (infoboxEnd === -1) return null;

  const infoboxContent = wikitext.slice(infoboxStart + 2, infoboxEnd - 2);

  // Extract template name (first line before |)
  const firstPipe = infoboxContent.indexOf("|");
  const templateName = (
    firstPipe >= 0 ? infoboxContent.slice(0, firstPipe) : infoboxContent
  ).trim();

  if (firstPipe === -1) return { templateName, fields: [] };

  // Split fields by | at depth 0 (not inside nested {{ }} or [[ ]])
  const fieldsStr = infoboxContent.slice(firstPipe + 1);
  const fields: InfoboxField[] = [];

  let templateDepth = 0;
  let linkDepth = 0;
  let fieldStart = 0;

  for (let i = 0; i < fieldsStr.length; i++) {
    const code = fieldsStr.charCodeAt(i);
    const next = fieldsStr.charCodeAt(i + 1); // NaN past the end: no pair
    if (code === 123 && next === 123) {
      templateDepth++;
      i++;
    } else if (code === 125 && next === 125) {
      templateDepth--;
      i++;
    } else if (code === 91 && next === 91) {
      linkDepth++;
      i++;
    } else if (code === 93 && next === 93) {
      linkDepth--;
      i++;
    } else if (code === 124 && templateDepth === 0 && linkDepth === 0) {
      const fieldStr = fieldsStr.slice(fieldStart, i);
      const parsed = parseField(fieldStr);
      if (parsed) fields.push(parsed);
      fieldStart = i + 1;
    }
  }

  // Last field
  const lastField = fieldsStr.slice(fieldStart);
  const parsedLast = parseField(lastField);
  if (parsedLast) fields.push(parsedLast);

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
  const get = (key: string) => {
    // oxlint-disable-next-line eslint/no-shadow -- shadowed 'f' is intentional in this scope
    const f = fields.find((f) => f.key.toLowerCase() === key);
    return f ? parseFloat(f.cleanValue) : NaN;
  };
  const getStr = (key: string) => {
    // oxlint-disable-next-line eslint/no-shadow -- shadowed 'f' is intentional in this scope
    const f = fields.find((f) => f.key.toLowerCase() === key);
    return f?.cleanValue?.toUpperCase() ?? "";
  };

  const latd = get("latd");
  const longd = get("longd");
  if (isNaN(latd) || isNaN(longd)) return null;

  const latm = get("latm") || 0;
  const lats = get("lats") || 0;
  const longm = get("longm") || 0;
  const longs = get("longs") || 0;

  let lat = (isNaN(latm) ? 0 : latm) / 60 + (isNaN(lats) ? 0 : lats) / 3600 + latd;
  let lng = (isNaN(longm) ? 0 : longm) / 60 + (isNaN(longs) ? 0 : longs) / 3600 + longd;

  if (getStr("latns") === "S") lat = -lat;
  if (getStr("longew") === "W") lng = -lng;

  return [lng, lat];
}

/**
 * ponytail: MAX_INFOBOX_ROWS, 1,000: the most rows an infobox is drawn with. An infobox has a hundred fields
 * at the most; a text of two million characters can be 200,000 `|`-separated fields, and each is a table row of
 * 500 characters of markup.
 */
const MAX_INFOBOX_ROWS = 1_000;

/**
 * Renders a parsed infobox into a clean, styled MediaWiki-compatible HTML table.
 */
export function renderInfoboxHtml(parsed: ParsedInfobox): string {
  if (!parsed || parsed.fields.length === 0) return "";

  const titleField = parsed.fields.find(
    (f) =>
      f.key.toLowerCase() === "name" ||
      f.key.toLowerCase() === "common_name" ||
      f.key.toLowerCase() === "conventional_long_name" ||
      f.key.toLowerCase() === "title"
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

  let rendered = 0;
  for (const f of parsed.fields) {
    if (!f.cleanValue || f === titleField || f === imageField) continue;
    if (++rendered > MAX_INFOBOX_ROWS) break;
    const label = f.key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // Format wiki links inside clean value: [[Target|Label]] -> <a href="/wiki/Target">Label</a>
    const formattedVal = replaceSimpleLinks(
      replacePipedLinks(
        f.cleanValue,
        (target, shown) =>
          `<a href="/wiki/${target}" class="text-wiki hover:underline font-medium">${shown}</a>`
      ),
      (target) =>
        `<a href="/wiki/${target}" class="text-wiki hover:underline font-medium">${target}</a>`
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
