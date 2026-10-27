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

const MULTIPLIERS: Record<string, number> = {
  trillion: 1e12,
  t: 1e12,
  billion: 1e9,
  b: 1e9,
  million: 1e6,
  m: 1e6,
  thousand: 1e3,
  k: 1e3,
};

/** Extracts numeric values with multipliers (e.g., "1.2 trillion", "500 million"). */
function parseNumericValue(text: string): number | undefined {
  const match = text.match(/([\d,.]+)\s*(trillion|billion|million|thousand|k|m|b|t)?/i);
  if (!match) return undefined;

  const num =
    parseFloat(match[1]?.replace(/,/g, "") || "0") *
    (MULTIPLIERS[match[2]?.toLowerCase() ?? ""] ?? 1);
  return isNaN(num) ? undefined : num;
}

type Department = { name: string; minister?: string };
type FieldValue = string | number | boolean | string[] | Department[];

/**
 * One heuristic: when `pattern` matches, `read` turns the captured text into the field's value
 * and `weight` points are added to the section's confidence. A rule without `read` is a flag:
 * the field is always set to whether the pattern matched.
 */
interface Rule {
  field: string;
  pattern: RegExp;
  weight: number;
  read?: (text: string) => FieldValue | undefined;
  /** Capture group to read; defaults to 1. */
  group?: number;
}

const asNumber = (text: string) => parseNumericValue(text) || undefined;
const asFloat = (text: string) => {
  const value = parseFloat(text);
  return isNaN(value) ? undefined : value;
};
const asText = (text: string) => text.trim();
const asLowerText = (text: string) => text.toLowerCase();
const asList = (maxLength: number) => (text: string) =>
  text
    .split(/,|\band\b/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < maxLength);

const ECONOMY_RULES: Rule[] = [
  {
    field: "gdpNominal",
    pattern:
      /(?:GDP|gross domestic product)\s*(?:nominal)?\s*(?:of [^$€£\d]+?)?\s*(?:is|of|stood at|reached|was)?\s*(?:around|approximately)?\s*(?:[$€£])?\s*([\d,.]+\s*(?:trillion|billion|million)?)/i,
    weight: 30,
    read: asNumber,
  },
  {
    field: "gdpPerCapita",
    pattern: /per capita\s*(?:is|of|stood at)?\s*(?:[$€£])?\s*([\d,.]+)/i,
    weight: 20,
    read: asNumber,
  },
  {
    field: "inflationRate",
    pattern: /inflation\s*(?:rate)?\s*(?:is|of|stood at)?\s*([\d,.]+)\s*%/i,
    weight: 15,
    read: asFloat,
  },
  {
    field: "unemploymentRate",
    pattern: /unemployment\s*(?:rate)?\s*(?:is|of|stood at)?\s*([\d,.]+)\s*%/i,
    weight: 15,
    read: asFloat,
  },
  {
    field: "majorIndustries",
    pattern: /(?:major|primary|key) industries (?:include|are) ([^.]+)\./i,
    weight: 20,
    read: asList(30),
  },
  {
    field: "economicSystem",
    pattern:
      /(mixed economy|free market|market economy|planned economy|state capitalism|social market economy)/i,
    weight: 15,
    read: asLowerText,
  },
  {
    field: "centralBank",
    pattern:
      /(?:central bank|reserve bank|monetary authority) (?:is |called |known as )?(?:the )?([A-Z][a-zA-Z\s]+?Bank[^,.]*|[A-Z][a-zA-Z\s]+?Reserve[^,.]*)/i,
    weight: 10,
    read: asText,
  },
  {
    field: "hasStateOwnedEnterprises",
    pattern:
      /state-owned enterprises|nationalized industries|public sector (?:dominates|controls|owns)/i,
    weight: 10,
  },
  {
    field: "hasFreeTradeZones",
    pattern: /free trade zone|special economic zone|export processing zone/i,
    weight: 5,
  },
  {
    field: "majorExports",
    pattern: /(?:major|primary|key) exports (?:include|are) ([^.]+)/i,
    weight: 10,
    read: asList(50),
  },
  {
    field: "majorImports",
    pattern: /(?:major|primary|key) imports (?:include|are) ([^.]+)/i,
    weight: 10,
    read: asList(50),
  },
  {
    field: "tradePartners",
    pattern: /(?:major|primary|key) trade partners (?:include|are) ([^.]+)/i,
    weight: 10,
    read: asList(50),
  },
  {
    field: "hasWelfarePrograms",
    pattern:
      /universal healthcare|national health service|free education|welfare state|social safety net/i,
    weight: 10,
  },
  {
    field: "hasUniversalHealthcare",
    pattern: /universal healthcare|national health service|publicly funded healthcare/i,
    weight: 5,
  },
  {
    field: "hasPublicEducation",
    pattern: /free education|public education|universal education|state-funded education/i,
    weight: 5,
  },
];

const GOVERNMENT_RULES: Rule[] = [
  {
    field: "governmentType",
    pattern:
      /is a (federal republic|constitutional monarchy|unitary republic|dictatorship|theocracy|absolute monarchy)[,.]/i,
    weight: 30,
    read: asLowerText,
  },
  {
    field: "legislature",
    pattern: /(?:legislature|parliament) is (?:the|called the)? ([A-Z][a-zA-Z\s]+?)(?:[,.]| and)/,
    weight: 20,
    read: asText,
  },
  {
    field: "judicialSystem",
    pattern:
      /(?:has |features |maintains )?(an? )?(independent judiciary|supreme court|constitutional court|federal court system|judicial branch)[,.]?/i,
    weight: 10,
    group: 2,
    read: asLowerText,
  },
  {
    field: "electoralSystem",
    pattern:
      /(?:uses |employs |operates under )?(proportional representation|first-past-the-post|single transferable vote|mixed member proportional|ranked choice voting|two-round system)[,.]?/i,
    weight: 10,
    read: asLowerText,
  },
  {
    field: "hasConstitution",
    pattern:
      /(?:has |governed by |operates under )(a |an )?(written constitution|codified constitution|uncodified constitution|constitutional framework)/i,
    weight: 10,
  },
  {
    field: "politicalParties",
    pattern: /(?:political parties|major parties|leading parties) (?:include|are) ([^.]+)/i,
    weight: 10,
    read: asList(50),
  },
  {
    field: "hasSeparationOfPowers",
    pattern: /separation of powers|checks and balances|three branches of government/i,
    weight: 10,
  },
  {
    field: "hasFederalStructure",
    pattern:
      /federal structure|federal system|federation of|states and territories|provincial governments/i,
    weight: 10,
  },
  {
    field: "hasLocalGovernment",
    pattern: /local government|municipal authorities|local councils|regional assemblies/i,
    weight: 5,
  },
];

const DEMOGRAPHICS_RULES: Rule[] = [
  {
    field: "population",
    pattern: /population (?:of|is|was|estimated at) ([\d,.]+\s*(?:million|billion|thousand)?)/i,
    weight: 40,
    read: asNumber,
  },
  {
    field: "lifeExpectancy",
    pattern: /life expectancy (?:is|of) ([\d,.]+)/i,
    weight: 20,
    read: asFloat,
  },
];

/** Applies the rules to `content`, filling `target`; returns the confidence points earned. */
function applyRules(content: string, rules: Rule[], target: Record<string, FieldValue>): number {
  let confidence = 0;
  for (const { field, pattern, weight, read, group = 1 } of rules) {
    const match = content.match(pattern);
    if (!read) {
      target[field] = !!match;
      if (match) confidence += weight;
      continue;
    }
    const captured = match?.[group];
    const value = captured ? read(captured) : undefined;
    if (value === undefined) continue;
    target[field] = value;
    if (!Array.isArray(value) || value.length > 0) confidence += weight;
  }
  return confidence;
}

/** Ministries and departments named in the text, with their ministers where one is given. */
function extractDepartments(content: string): Department[] {
  const departments = new Map<string, Department>();

  const deptRegex =
    /(?:ministry|department|secretariat|bureau)\s+(?:of\s+)?([A-Z][a-zA-Z\s]+?)(?:,|\.|and|;|$)/gi;
  for (const match of content.matchAll(deptRegex)) {
    const name = match[1]?.trim();
    if (name && name.length > 2 && name.length < 60) departments.set(name.toLowerCase(), { name });
  }

  const ministerRegex =
    /(?:minister|secretary|head)\s+(?:of\s+)?(?:the\s+)?([A-Z][a-zA-Z\s]+?)\s*(?:is|was|:)\s*([A-Z][a-zA-Z\s.]+)/gi;
  for (const match of content.matchAll(ministerRegex)) {
    const deptName = match[1]?.trim();
    const personName = match[2]?.trim();
    if (!deptName || !personName) continue;
    const existing = departments.get(deptName.toLowerCase());
    if (existing) existing.minister = personName;
    else departments.set(deptName.toLowerCase(), { name: deptName, minister: personName });
  }
  return Array.from(departments.values());
}

const SECTIONS: Array<{
  key: keyof ExtractedBuilderData;
  titles: string[];
  rules: Rule[];
  initial?: Record<string, FieldValue>;
  /** Extraction beyond the rules; returns the confidence points it earned. */
  extra?: (content: string, target: Record<string, FieldValue>) => number;
}> = [
  {
    key: "economy",
    titles: ["economy", "economic"],
    rules: ECONOMY_RULES,
    initial: { majorIndustries: [] },
  },
  {
    key: "government",
    titles: ["government", "politics"],
    rules: GOVERNMENT_RULES,
    extra: (content, target) => {
      const departments = extractDepartments(content);
      target.departments = departments;
      return departments.length > 0 ? 15 : 0;
    },
  },
  { key: "demographics", titles: ["demographic", "population"], rules: DEMOGRAPHICS_RULES },
];

export function extractDataFromWikiSections(
  sections: { title: string; content: string }[]
): ExtractedBuilderData {
  const extracted: ExtractedBuilderData = {};

  for (const { title, content } of sections) {
    const lowerTitle = title.toLowerCase();
    for (const { key, titles, rules, initial, extra } of SECTIONS) {
      if (!titles.some((t) => lowerTitle.includes(t))) continue;

      const data: Record<string, FieldValue> = { ...initial };
      const confidence = applyRules(content, rules, data) + (extra?.(content, data) ?? 0);
      data.confidence = Math.min(100, confidence);
      if (confidence > 0) Object.assign(extracted, { [key]: data });
    }
  }

  return extracted;
}
