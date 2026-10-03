/**
 * Utility for extracting structured builder data from raw wiki text.
 * Uses regex heuristics to find common patterns in nation-states wiki pages.
 */

export interface ExtractedBuilderData {
  government?: {
    headOfState?: string;
    headOfGovernment?: string;
    governmentType?: string;
    legislature?: string;
    departments?: Array<{ name: string; minister?: string }>;
    judicialSystem?: string;
    electoralSystem?: string;
    hasConstitution?: boolean;
    politicalParties?: string[];
    hasSeparationOfPowers?: boolean;
    hasFederalStructure?: boolean;
    hasLocalGovernment?: boolean;
    confidence: number;
  };
  economy?: {
    gdpNominal?: number;
    gdpPPP?: number;
    gdpPerCapita?: number;
    inflationRate?: number;
    unemploymentRate?: number;
    majorIndustries?: string[];
    economicSystem?: string;
    centralBank?: string;
    hasStateOwnedEnterprises?: boolean;
    hasFreeTradeZones?: boolean;
    majorExports?: string[];
    majorImports?: string[];
    tradePartners?: string[];
    hasWelfarePrograms?: boolean;
    hasUniversalHealthcare?: boolean;
    hasPublicEducation?: boolean;
    confidence: number;
  };
  demographics?: {
    population?: number;
    lifeExpectancy?: number;
    literacyRate?: number;
    urbanization?: number;
    ethnicGroups?: string[];
    confidence: number;
  };
  geography?: {
    area?: number;
    continent?: string;
    climate?: string;
    confidence: number;
  };
}

/**
 * Extracts numeric values with multipliers (e.g., "1.2 trillion", "500 million")
 */
function parseNumericValue(text: string): number | undefined {
  const match = text.match(/([\d,.]+)\s*(trillion|billion|million|thousand|k|m|b|t)?/i);
  if (!match) return undefined;

  const numStr = match[1]?.replace(/,/g, "") || "0";
  let num = parseFloat(numStr);

  const multiplier = match[2]?.toLowerCase();
  if (multiplier === "trillion" || multiplier === "t") num *= 1000000000000;
  else if (multiplier === "billion" || multiplier === "b") num *= 1000000000;
  else if (multiplier === "million" || multiplier === "m") num *= 1000000;
  else if (multiplier === "thousand" || multiplier === "k") num *= 1000;

  return isNaN(num) ? undefined : num;
}

type Match = RegExpMatchArray;
/** Pulls a value out of a rule's match; undefined means the rule found nothing usable. */
type Extract = (match: Match) => unknown;

interface Rule {
  key: string;
  pattern: RegExp;
  weight: number;
  /** Omitted for yes/no rules, which store whether the pattern matched at all. */
  extract?: Extract;
}

const scaled: Extract = (m) => (m[1] ? parseNumericValue(m[1]) || undefined : undefined);
const plain: Extract = (m) => {
  const value = m[1] ? parseFloat(m[1]) : NaN;
  return Number.isNaN(value) ? undefined : value;
};
const lower =
  (group = 1): Extract =>
  (m) =>
    m[group]?.toLowerCase() || undefined;
const trimmed: Extract = (m) => m[1]?.trim() || undefined;
const list =
  (maxLength: number): Extract =>
  (m) =>
    m[1]
      ?.split(/,|\band\b/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < maxLength);

const ECONOMY_RULES: Rule[] = [
  {
    key: "gdpNominal",
    pattern:
      /(?:GDP|gross domestic product)\s*(?:nominal)?\s*(?:of [^$€£\d]+?)?\s*(?:is|of|stood at|reached|was)?\s*(?:around|approximately)?\s*(?:[$€£])?\s*([\d,.]+\s*(?:trillion|billion|million)?)/i,
    weight: 30,
    extract: scaled,
  },
  {
    key: "gdpPerCapita",
    pattern: /per capita\s*(?:is|of|stood at)?\s*(?:[$€£])?\s*([\d,.]+)/i,
    weight: 20,
    extract: scaled,
  },
  {
    key: "inflationRate",
    pattern: /inflation\s*(?:rate)?\s*(?:is|of|stood at)?\s*([\d,.]+)\s*%/i,
    weight: 15,
    extract: plain,
  },
  {
    key: "unemploymentRate",
    pattern: /unemployment\s*(?:rate)?\s*(?:is|of|stood at)?\s*([\d,.]+)\s*%/i,
    weight: 15,
    extract: plain,
  },
  {
    key: "majorIndustries",
    pattern: /(?:major|primary|key) industries (?:include|are) ([^.]+)\./i,
    weight: 20,
    extract: list(30),
  },
  {
    key: "economicSystem",
    pattern:
      /(mixed economy|free market|market economy|planned economy|state capitalism|social market economy)/i,
    weight: 15,
    extract: lower(),
  },
  {
    key: "centralBank",
    pattern:
      /(?:central bank|reserve bank|monetary authority) (?:is |called |known as )?(?:the )?([A-Z][a-zA-Z\s]+?Bank[^,.]*|[A-Z][a-zA-Z\s]+?Reserve[^,.]*)/i,
    weight: 10,
    extract: trimmed,
  },
  {
    key: "hasStateOwnedEnterprises",
    pattern:
      /state-owned enterprises|nationalized industries|public sector (?:dominates|controls|owns)/i,
    weight: 10,
  },
  {
    key: "hasFreeTradeZones",
    pattern: /free trade zone|special economic zone|export processing zone/i,
    weight: 5,
  },
  {
    key: "majorExports",
    pattern: /(?:major|primary|key) exports (?:include|are) ([^.]+)/i,
    weight: 10,
    extract: list(50),
  },
  {
    key: "majorImports",
    pattern: /(?:major|primary|key) imports (?:include|are) ([^.]+)/i,
    weight: 10,
    extract: list(50),
  },
  {
    key: "tradePartners",
    pattern: /(?:major|primary|key) trade partners (?:include|are) ([^.]+)/i,
    weight: 10,
    extract: list(50),
  },
  {
    key: "hasWelfarePrograms",
    pattern:
      /universal healthcare|national health service|free education|welfare state|social safety net/i,
    weight: 10,
  },
  {
    key: "hasUniversalHealthcare",
    pattern: /universal healthcare|national health service|publicly funded healthcare/i,
    weight: 5,
  },
  {
    key: "hasPublicEducation",
    pattern: /free education|public education|universal education|state-funded education/i,
    weight: 5,
  },
];

const GOVERNMENT_RULES: Rule[] = [
  {
    key: "governmentType",
    pattern:
      /is a (federal republic|constitutional monarchy|unitary republic|dictatorship|theocracy|absolute monarchy)[,.]/i,
    weight: 30,
    extract: lower(),
  },
  {
    key: "legislature",
    pattern: /(?:legislature|parliament) is (?:the|called the)? ([A-Z][a-zA-Z\s]+?)(?:[,.]| and)/,
    weight: 20,
    extract: trimmed,
  },
  {
    key: "judicialSystem",
    pattern:
      /(?:has |features |maintains )?(an? )?(independent judiciary|supreme court|constitutional court|federal court system|judicial branch)[,.]?/i,
    weight: 10,
    extract: lower(2),
  },
  {
    key: "electoralSystem",
    pattern:
      /(?:uses |employs |operates under )?(proportional representation|first-past-the-post|single transferable vote|mixed member proportional|ranked choice voting|two-round system)[,.]?/i,
    weight: 10,
    extract: lower(),
  },
  {
    key: "hasConstitution",
    pattern:
      /(?:has |governed by |operates under )(a |an )?(written constitution|codified constitution|uncodified constitution|constitutional framework)/i,
    weight: 10,
  },
  {
    key: "politicalParties",
    pattern: /(?:political parties|major parties|leading parties) (?:include|are) ([^.]+)/i,
    weight: 10,
    extract: list(50),
  },
  {
    key: "hasSeparationOfPowers",
    pattern: /separation of powers|checks and balances|three branches of government/i,
    weight: 10,
  },
  {
    key: "hasFederalStructure",
    pattern:
      /federal structure|federal system|federation of|states and territories|provincial governments/i,
    weight: 10,
  },
  {
    key: "hasLocalGovernment",
    pattern: /local government|municipal authorities|local councils|regional assemblies/i,
    weight: 5,
  },
];

const DEMOGRAPHICS_RULES: Rule[] = [
  {
    key: "population",
    pattern: /population (?:of|is|was|estimated at) ([\d,.]+\s*(?:million|billion|thousand)?)/i,
    weight: 40,
    extract: scaled,
  },
  {
    key: "lifeExpectancy",
    pattern: /life expectancy (?:is|of) ([\d,.]+)/i,
    weight: 20,
    extract: plain,
  },
];

/** Runs the rules over `content`, storing hits on `target`; returns the summed rule weights. */
function applyRules(content: string, rules: Rule[], target: Record<string, unknown>): number {
  let confidence = 0;
  for (const { key, pattern, weight, extract } of rules) {
    const match = content.match(pattern);
    if (!extract) {
      target[key] = !!match;
      if (match) confidence += weight;
      continue;
    }
    const value = match && extract(match);
    if (value === undefined || value === null) continue;
    target[key] = value;
    // Lists are always stored but only count when non-empty
    if (!Array.isArray(value) || value.length > 0) confidence += weight;
  }
  return confidence;
}

const DEPARTMENT_REGEX =
  /(?:ministry|department|secretariat|bureau)\s+(?:of\s+)?([A-Z][a-zA-Z\s]+?)(?:,|\.|and|;|$)/gi;
const MINISTER_REGEX =
  /(?:minister|secretary|head)\s+(?:of\s+)?(?:the\s+)?([A-Z][a-zA-Z\s]+?)\s*(?:is|was|:)\s*([A-Z][a-zA-Z\s.]+)/gi;

/** Ministries / departments, each paired with its minister when one is named. */
function extractDepartments(content: string) {
  const departments = new Map<string, { name: string; minister?: string }>();
  for (const [, rawName] of content.matchAll(DEPARTMENT_REGEX)) {
    const name = rawName?.trim();
    if (name && name.length > 2 && name.length < 60) departments.set(name.toLowerCase(), { name });
  }
  for (const [, rawDept, rawPerson] of content.matchAll(MINISTER_REGEX)) {
    const deptName = rawDept?.trim();
    const minister = rawPerson?.trim();
    if (!deptName || !minister) continue;
    const existing = departments.get(deptName.toLowerCase());
    if (existing) existing.minister = minister;
    else departments.set(deptName.toLowerCase(), { name: deptName, minister });
  }
  return Array.from(departments.values());
}

const SECTIONS = [
  { key: "economy", titles: ["economy", "economic"], rules: ECONOMY_RULES },
  { key: "government", titles: ["government", "politics"], rules: GOVERNMENT_RULES },
  { key: "demographics", titles: ["demographic", "population"], rules: DEMOGRAPHICS_RULES },
] as const;

export function extractDataFromWikiSections(
  sections: { title: string; content: string }[]
): ExtractedBuilderData {
  const extracted: ExtractedBuilderData = {};

  for (const { title, content } of sections) {
    const lowerTitle = title.toLowerCase();
    for (const { key, titles, rules } of SECTIONS) {
      if (!titles.some((t) => lowerTitle.includes(t))) continue;

      const data: Record<string, unknown> & { confidence: number } = {
        confidence: 0,
        ...(key === "economy" && { majorIndustries: [] }),
        ...(key === "government" && { departments: [] }),
      };
      let weight = applyRules(content, rules, data);
      if (key === "government") {
        const departments = extractDepartments(content);
        data.departments = departments;
        if (departments.length > 0) weight += 15;
      }

      data.confidence = Math.min(100, weight);
      if (data.confidence > 0) (extracted as Record<string, unknown>)[key] = data;
    }
  }

  return extracted;
}
