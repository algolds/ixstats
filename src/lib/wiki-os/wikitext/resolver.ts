/**
 * src/lib/wiki-os/wikitext/resolver.ts — Pure Template Semantic Classification.
 *
 * Invariant 8: Grammar and WikiOS semantics stay strictly separate.
 * The core parser understands syntax; template classification lives only here.
 */

import type { TemplateClassification } from "./types";

export function classifyTemplate(
  name: string,
  _params?: Record<string, string>
): TemplateClassification {
  const normalized = name.replace(/^Template:/i, "").trim();

  // 1. Infobox Classification
  if (/^infobox(\s+|_|$)/i.test(normalized)) {
    return "infobox";
  }

  // 2. Engine Data Chips
  if (/^(CountryData|BusinessData|DefenseData|MyCountry)(:|\s+|_|$)/i.test(normalized)) {
    return "chip-engine";
  }

  // 3. Coordinate Chips
  if (/^(coord|coordinates|coords)$/i.test(normalized)) {
    return "chip-coord";
  }

  // 4. Standard / Known Templates
  const STANDARD_TEMPLATES = new Set([
    "quote",
    "main",
    "see also",
    "seealso",
    "flag",
    "flagicon",
    "flagcountry",
    "nowrap",
    "lang",
    "convert",
    "cite",
    "citation",
    "ref",
    "reflist",
    "clear",
    "columns-list",
    "navbox",
    "sidebar",
    "notice",
    "stub",
    "disambiguation",
    "about",
  ]);

  if (STANDARD_TEMPLATES.has(normalized.toLowerCase())) {
    return "standard";
  }

  // 5. Custom / User Templates
  return "custom";
}
