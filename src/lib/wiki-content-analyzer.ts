/**
 * wiki-content-analyzer.ts — Semantic analyzer for extracted wiki content.
 *
 * Takes WikiExtractedContent and applies keyword matching and heuristic parsing
 * to extract structured country data from prose sections (beyond infobox).
 *
 * Pure functions — no side effects, no database, no fetch.
 */

import type { WikiExtractedContent, WikiSection } from "./wiki-content-extractor";

// ── Types ──

export interface AnalyzedField<T = string> {
  value: T;
  /** 0-1 confidence score */
  confidence: number;
  /** Where this data came from */
  source: "infobox" | "section" | "table" | "list" | "intro" | "category";
  /** Which section title it was extracted from */
  sectionTitle?: string;
}

export interface WikiAnalyzedData {
  // ── National Identity ──
  name?: AnalyzedField;
  officialName?: AnalyzedField;
  motto?: AnalyzedField;
  anthem?: AnalyzedField;
  governmentType?: AnalyzedField;
  capital?: AnalyzedField;
  officialLanguages?: AnalyzedField;
  currency?: AnalyzedField;
  demonym?: AnalyzedField;
  leader?: AnalyzedField;
  flag?: AnalyzedField;
  coatOfArms?: AnalyzedField;

  // ── Geography ──
  coordinates?: AnalyzedField<[number, number]>;
  landArea?: AnalyzedField<number>;
  climate?: AnalyzedField;
  terrain?: AnalyzedField;
  borders?: AnalyzedField<string[]>;
  continent?: AnalyzedField;
  region?: AnalyzedField;

  // ── Demographics ──
  population?: AnalyzedField<number>;
  populationDensity?: AnalyzedField<number>;
  ethnicGroups?: AnalyzedField<string[]>;
  religions?: AnalyzedField<string[]>;
  languages?: AnalyzedField<string[]>;
  urbanization?: AnalyzedField;
  lifeExpectancy?: AnalyzedField;

  // ── Economy ──
  gdp?: AnalyzedField<number>;
  gdpPerCapita?: AnalyzedField<number>;
  majorIndustries?: AnalyzedField<string[]>;
  tradePartners?: AnalyzedField<string[]>;
  economicDescription?: AnalyzedField;

  // ── Government ──
  governmentDescription?: AnalyzedField;
  executiveStructure?: AnalyzedField;
  legislativeBody?: AnalyzedField;
  judicialSystem?: AnalyzedField;
  politicalParties?: AnalyzedField<string[]>;

  // ── Military/Defense ──
  militaryDescription?: AnalyzedField;
  militaryBranches?: AnalyzedField<string[]>;

  // ── History ──
  foundingDate?: AnalyzedField;
  historicalPeriods?: AnalyzedField<string[]>;
  historyDescription?: AnalyzedField;

  // ── Metadata ──
  wikiCategories?: string[];
  sectionCount?: number;
  extractedSections?: string[];
}

// ── Section Context Keywords ──
// Reused from useWikiSectionMap.ts SECTION_CONTEXT_MAP

const SECTION_KEYWORDS: Record<string, string[]> = {
  economy: ["economy", "trade", "industry", "agriculture", "energy", "currency", "finance", "banking", "commerce", "mining", "manufacturing", "economic"],
  government: ["government", "politics", "executive", "legislature", "judicial", "constitution", "law", "administration", "governance"],
  demographics: ["demograph", "population", "ethnic", "language", "religion", "society", "people", "culture"],
  geography: ["geography", "climate", "terrain", "topography", "environment", "land", "area", "border", "location"],
  military: ["military", "army", "navy", "air force", "defense", "defence", "armed", "war", "security", "force"],
  history: ["history", "historical", "founding", "independence", "establishment", "ancient", "modern", "colonial", "medieval"],
  diplomacy: ["foreign", "relations", "diplomacy", "treaty", "alliance", "international", "ambassador"],
  education: ["education", "university", "school", "literacy", "academic"],
  infrastructure: ["transport", "infrastructure", "railway", "highway", "airport", "port", "communication"],
};

// ── Helpers ──

function matchSection(section: WikiSection, context: string): boolean {
  const keywords = SECTION_KEYWORDS[context];
  if (!keywords) return false;
  const title = section.title.toLowerCase();
  return keywords.some((kw) => title.includes(kw));
}

function getSectionsForContext(sections: WikiSection[], context: string): WikiSection[] {
  return sections.filter((s) => s.level === 2 && matchSection(s, context));
}

function extractFirstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.substring(0, 200);
}

function extractNumberFromText(text: string): number | null {
  // Try "X billion/million/thousand"
  const billMatch = text.match(/([\d,.]+)\s*(billion|trillion)/i);
  if (billMatch) {
    const num = parseFloat(billMatch[1]!.replace(/,/g, ""));
    if (billMatch[2]!.toLowerCase() === "trillion") return num * 1e12;
    return num * 1e9;
  }
  const millMatch = text.match(/([\d,.]+)\s*million/i);
  if (millMatch) return parseFloat(millMatch[1]!.replace(/,/g, "")) * 1e6;
  const thousMatch = text.match(/([\d,.]+)\s*thousand/i);
  if (thousMatch) return parseFloat(thousMatch[1]!.replace(/,/g, "")) * 1e3;

  // Try bare numbers with $ or currency prefix
  const dollarMatch = text.match(/\$\s*([\d,.]+)/);
  if (dollarMatch) return parseFloat(dollarMatch[1]!.replace(/,/g, ""));

  return null;
}

function extractListItemsFromSection(section: WikiSection): string[] {
  return section.content
    .split("\n")
    .filter((line) => line.trim().startsWith("*") || line.trim().startsWith("#"))
    .map((line) => line.replace(/^[*#]+\s*/, "").trim())
    .map((item) => item.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1"))
    .filter((item) => item.length > 0 && item.length < 200);
}

function extractLinkedItemsFromText(text: string): string[] {
  const matches = text.matchAll(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g);
  const items: string[] = [];
  for (const match of matches) {
    const item = match[1]!.trim();
    if (item && !item.includes(":") && item.length < 100) {
      items.push(item);
    }
  }
  return items;
}

// ── Main Analyzer ──

export function analyzeWikiContent(extracted: WikiExtractedContent): WikiAnalyzedData {
  const { infobox, sections, categories, coordinates } = extracted;
  const data: WikiAnalyzedData = {};

  // ── From Infobox (highest confidence) ──
  if (infobox) {
    const getField = (key: string) =>
      infobox.fields.find((f) => f.key.toLowerCase() === key.toLowerCase());
    const getFieldValue = (key: string) => getField(key)?.cleanValue;
    const getFieldTyped = (key: string) => getField(key)?.typedValue;

    const name = getFieldValue("common_name") || getFieldValue("name");
    if (name) data.name = { value: name, confidence: 0.95, source: "infobox" };

    const officialName = getFieldValue("conventional_long_name") || getFieldValue("official_name");
    if (officialName) data.officialName = { value: officialName, confidence: 0.95, source: "infobox" };

    const motto = getFieldValue("national_motto") || getFieldValue("motto");
    if (motto) data.motto = { value: motto, confidence: 0.9, source: "infobox" };

    const anthem = getFieldValue("national_anthem") || getFieldValue("anthem");
    if (anthem) data.anthem = { value: anthem, confidence: 0.9, source: "infobox" };

    const govType = getFieldValue("government_type");
    if (govType) data.governmentType = { value: govType, confidence: 0.9, source: "infobox" };

    const capital = getFieldValue("capital");
    if (capital) data.capital = { value: capital, confidence: 0.95, source: "infobox" };

    const langs = getFieldValue("official_languages") || getFieldValue("languages");
    if (langs) data.officialLanguages = { value: langs, confidence: 0.9, source: "infobox" };

    const currency = getFieldValue("currency");
    if (currency) data.currency = { value: currency, confidence: 0.9, source: "infobox" };

    const demonym = getFieldValue("demonym");
    if (demonym) data.demonym = { value: demonym, confidence: 0.9, source: "infobox" };

    const leader = getFieldValue("leader_name1") || getFieldValue("leader_name");
    if (leader) data.leader = { value: leader, confidence: 0.85, source: "infobox" };

    const flag = getFieldValue("image_flag");
    if (flag) data.flag = { value: flag, confidence: 0.95, source: "infobox" };

    const coa = getFieldValue("image_coat");
    if (coa) data.coatOfArms = { value: coa, confidence: 0.95, source: "infobox" };

    // Numeric fields
    const pop = getFieldTyped("population_estimate") || getFieldTyped("population_census") || getFieldTyped("population");
    if (typeof pop === "number") data.population = { value: pop, confidence: 0.9, source: "infobox" };

    const area = getFieldTyped("area_km2") || getFieldTyped("area_total_km2");
    if (typeof area === "number") data.landArea = { value: area, confidence: 0.9, source: "infobox" };

    const gdpNom = getFieldTyped("gdp_nominal");
    if (typeof gdpNom === "number") data.gdp = { value: gdpNom, confidence: 0.85, source: "infobox" };

    const gdpPc = getFieldTyped("gdp_nominal_per_capita");
    if (typeof gdpPc === "number") data.gdpPerCapita = { value: gdpPc, confidence: 0.85, source: "infobox" };
  }

  // ── Coordinates ──
  if (coordinates) {
    data.coordinates = { value: coordinates, confidence: 0.9, source: "infobox" };
  }

  // ── From Sections (moderate confidence) ──

  // Economy
  const econSections = getSectionsForContext(sections, "economy");
  if (econSections.length > 0) {
    const econText = econSections.map((s) => s.cleanContent).join(" ");
    data.economicDescription = {
      value: econText.substring(0, 500),
      confidence: 0.7,
      source: "section",
      sectionTitle: econSections[0]!.title,
    };

    // Extract industries from lists
    for (const section of econSections) {
      const items = extractListItemsFromSection(section);
      if (items.length > 0 && !data.majorIndustries) {
        data.majorIndustries = {
          value: items.slice(0, 10),
          confidence: 0.6,
          source: "list",
          sectionTitle: section.title,
        };
      }
    }

    // Try to extract GDP from prose if not in infobox
    if (!data.gdp) {
      const gdpNum = extractNumberFromText(econText);
      if (gdpNum && gdpNum > 1e6) {
        data.gdp = { value: gdpNum, confidence: 0.4, source: "section", sectionTitle: econSections[0]!.title };
      }
    }

    // Extract trade partners from links in economy sections
    const tradeLinks = econSections.flatMap((s) => extractLinkedItemsFromText(s.content));
    if (tradeLinks.length > 0) {
      data.tradePartners = {
        value: [...new Set(tradeLinks)].slice(0, 10),
        confidence: 0.4,
        source: "section",
      };
    }
  }

  // Government
  const govSections = getSectionsForContext(sections, "government");
  if (govSections.length > 0) {
    const govText = govSections.map((s) => s.cleanContent).join(" ");
    data.governmentDescription = {
      value: govText.substring(0, 500),
      confidence: 0.7,
      source: "section",
      sectionTitle: govSections[0]!.title,
    };

    // Look for legislature/parliament mentions
    const legMatch = govText.match(/(?:parliament|congress|legislature|assembly|diet|senate|chamber)\s+(?:of\s+)?[A-Z]\w+/i);
    if (legMatch) {
      data.legislativeBody = { value: legMatch[0], confidence: 0.6, source: "section" };
    }

    // Extract political parties from lists
    for (const section of govSections) {
      const items = extractListItemsFromSection(section);
      if (items.length > 1 && section.title.toLowerCase().includes("part")) {
        data.politicalParties = { value: items.slice(0, 10), confidence: 0.6, source: "list", sectionTitle: section.title };
      }
    }
  }

  // Demographics
  const demoSections = getSectionsForContext(sections, "demographics");
  if (demoSections.length > 0) {
    // Ethnic groups
    for (const section of demoSections) {
      if (section.title.toLowerCase().includes("ethnic") || section.title.toLowerCase().includes("people")) {
        const items = extractListItemsFromSection(section);
        if (items.length > 0) {
          data.ethnicGroups = { value: items.slice(0, 10), confidence: 0.6, source: "list", sectionTitle: section.title };
        }
      }
      if (section.title.toLowerCase().includes("religion")) {
        const items = extractListItemsFromSection(section);
        if (items.length > 0) {
          data.religions = { value: items.slice(0, 10), confidence: 0.6, source: "list", sectionTitle: section.title };
        }
      }
      if (section.title.toLowerCase().includes("language")) {
        const items = extractListItemsFromSection(section);
        if (items.length > 0 && !data.languages) {
          data.languages = { value: items.slice(0, 10), confidence: 0.6, source: "list", sectionTitle: section.title };
        }
      }
    }
  }

  // Geography
  const geoSections = getSectionsForContext(sections, "geography");
  if (geoSections.length > 0) {
    const geoText = geoSections.map((s) => s.cleanContent).join(" ");

    // Climate extraction
    const climateSection = geoSections.find((s) => s.title.toLowerCase().includes("climate"));
    if (climateSection) {
      data.climate = {
        value: extractFirstSentence(climateSection.cleanContent),
        confidence: 0.7,
        source: "section",
        sectionTitle: climateSection.title,
      };
    }

    // Terrain
    data.terrain = {
      value: extractFirstSentence(geoText),
      confidence: 0.5,
      source: "section",
      sectionTitle: geoSections[0]!.title,
    };

    // Borders from linked countries in geography section
    const borderLinks = geoSections.flatMap((s) => extractLinkedItemsFromText(s.content));
    if (borderLinks.length > 0) {
      data.borders = {
        value: [...new Set(borderLinks)].slice(0, 10),
        confidence: 0.4,
        source: "section",
      };
    }
  }

  // Military
  const milSections = getSectionsForContext(sections, "military");
  if (milSections.length > 0) {
    data.militaryDescription = {
      value: milSections.map((s) => s.cleanContent).join(" ").substring(0, 500),
      confidence: 0.7,
      source: "section",
      sectionTitle: milSections[0]!.title,
    };

    // Extract military branches from lists
    for (const section of milSections) {
      const items = extractListItemsFromSection(section);
      if (items.length > 0) {
        data.militaryBranches = { value: items.slice(0, 10), confidence: 0.6, source: "list", sectionTitle: section.title };
        break;
      }
    }
  }

  // History
  const histSections = getSectionsForContext(sections, "history");
  if (histSections.length > 0) {
    data.historyDescription = {
      value: histSections.map((s) => s.cleanContent).join(" ").substring(0, 500),
      confidence: 0.7,
      source: "section",
      sectionTitle: histSections[0]!.title,
    };

    // Extract historical periods from subsection titles
    const periods = histSections
      .filter((s) => s.level === 3)
      .map((s) => s.title);
    if (periods.length > 0) {
      data.historicalPeriods = { value: periods, confidence: 0.6, source: "section" };
    }
  }

  // ── From Categories ──
  if (categories.length > 0) {
    data.wikiCategories = categories;

    // Try to infer continent from categories
    const continentKeywords: Record<string, string> = {
      europe: "Europe", asia: "Asia", africa: "Africa",
      "north america": "North America", "south america": "South America",
      oceania: "Oceania", antarctica: "Antarctica",
    };
    for (const cat of categories) {
      const lower = cat.toLowerCase();
      for (const [kw, continent] of Object.entries(continentKeywords)) {
        if (lower.includes(kw)) {
          data.continent = { value: continent, confidence: 0.6, source: "category" };
          break;
        }
      }
      if (data.continent) break;
    }
  }

  // ── Metadata ──
  data.sectionCount = sections.length;
  data.extractedSections = sections.filter((s) => s.level === 2).map((s) => s.title);

  return data;
}
