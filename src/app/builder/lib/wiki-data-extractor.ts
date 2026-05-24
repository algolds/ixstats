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
  const match = text.match(/([\d,\.]+)\s*(trillion|billion|million|thousand|k|m|b|t)?/i);
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

export function extractDataFromWikiSections(
  sections: { title: string; content: string }[]
): ExtractedBuilderData {
  const extracted: ExtractedBuilderData = {};

  for (const section of sections) {
    const lowerTitle = section.title.toLowerCase();
    const content = section.content;

    // ECONOMY
    if (lowerTitle.includes("economy") || lowerTitle.includes("economic")) {
      let conf = 0;
      const economy: NonNullable<ExtractedBuilderData["economy"]> = {
        confidence: 0,
        majorIndustries: [],
      };

      // GDP Nominal
      const gdpMatch = content.match(
        /GDP\s*(?:nominal)?\s*(?:is|of|stood at|reached|was)?\s*(?:around|approximately)?\s*(?:[\$€£])?\s*([\d,\.]+\s*(?:trillion|billion|million)?)/i
      );
      if (gdpMatch && gdpMatch[1]) {
        const val = parseNumericValue(gdpMatch[1]);
        if (val) {
          economy.gdpNominal = val;
          conf += 30;
        }
      }

      // GDP Per Capita
      const perCapitaMatch = content.match(
        /per capita\s*(?:is|of|stood at)?\s*(?:[\$€£])?\s*([\d,\.]+)/i
      );
      if (perCapitaMatch && perCapitaMatch[1]) {
        const val = parseNumericValue(perCapitaMatch[1]);
        if (val) {
          economy.gdpPerCapita = val;
          conf += 20;
        }
      }

      // Inflation
      const inflationMatch = content.match(
        /inflation\s*(?:rate)?\s*(?:is|of|stood at)?\s*([\d,\.]+)\s*%/i
      );
      if (inflationMatch && inflationMatch[1]) {
        const val = parseFloat(inflationMatch[1]);
        if (!isNaN(val)) {
          economy.inflationRate = val;
          conf += 15;
        }
      }

      // Unemployment
      const unemploymentMatch = content.match(
        /unemployment\s*(?:rate)?\s*(?:is|of|stood at)?\s*([\d,\.]+)\s*%/i
      );
      if (unemploymentMatch && unemploymentMatch[1]) {
        const val = parseFloat(unemploymentMatch[1]);
        if (!isNaN(val)) {
          economy.unemploymentRate = val;
          conf += 15;
        }
      }

      // Industries
      const industriesMatch = content.match(
        /(?:major|primary|key) industries (?:include|are) ([^\.]+)\./i
      );
      if (industriesMatch && industriesMatch[1]) {
        economy.majorIndustries = industriesMatch[1]
          .split(/,|\band\b/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.length < 30);
        if (economy.majorIndustries.length > 0) conf += 20;
      }

      // Economic system
      const econSystemMatch = content.match(
        /(mixed economy|free market|market economy|planned economy|state capitalism|social market economy)/i
      );
      if (econSystemMatch && econSystemMatch[1]) {
        economy.economicSystem = econSystemMatch[1].toLowerCase();
        conf += 15;
      }

      // Central bank
      const centralBankMatch = content.match(
        /(?:central bank|reserve bank|monetary authority) (?:is |called |known as )?(?:the )?([A-Z][a-zA-Z\s]+?Bank[^,\.]*|[A-Z][a-zA-Z\s]+?Reserve[^,\.]*)/i
      );
      if (centralBankMatch && centralBankMatch[1]) {
        economy.centralBank = centralBankMatch[1].trim();
        conf += 10;
      }

      // State-owned enterprises
      const soeMatch = content.match(
        /state-owned enterprises|nationalized industries|public sector (?:dominates|controls|owns)/i
      );
      economy.hasStateOwnedEnterprises = !!soeMatch;
      if (economy.hasStateOwnedEnterprises) conf += 10;

      // Free trade zones
      const ftzMatch = content.match(
        /free trade zone|special economic zone|export processing zone/i
      );
      economy.hasFreeTradeZones = !!ftzMatch;
      if (economy.hasFreeTradeZones) conf += 5;

      // Major exports
      const exportsMatch = content.match(/(?:major|primary|key) exports (?:include|are) ([^\.]+)/i);
      if (exportsMatch && exportsMatch[1]) {
        economy.majorExports = exportsMatch[1]
          .split(/,|\band\b/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.length < 50);
        if (economy.majorExports.length > 0) conf += 10;
      }

      // Major imports
      const importsMatch = content.match(/(?:major|primary|key) imports (?:include|are) ([^\.]+)/i);
      if (importsMatch && importsMatch[1]) {
        economy.majorImports = importsMatch[1]
          .split(/,|\band\b/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.length < 50);
        if (economy.majorImports.length > 0) conf += 10;
      }

      // Trade partners
      const tradeMatch = content.match(
        /(?:major|primary|key) trade partners (?:include|are) ([^\.]+)/i
      );
      if (tradeMatch && tradeMatch[1]) {
        economy.tradePartners = tradeMatch[1]
          .split(/,|\band\b/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.length < 50);
        if (economy.tradePartners.length > 0) conf += 10;
      }

      // Welfare programs
      const welfareMatch = content.match(
        /universal healthcare|national health service|free education|welfare state|social safety net/i
      );
      economy.hasWelfarePrograms = !!welfareMatch;
      if (economy.hasWelfarePrograms) conf += 10;

      // Universal healthcare
      const healthcareMatch = content.match(
        /universal healthcare|national health service|publicly funded healthcare/i
      );
      economy.hasUniversalHealthcare = !!healthcareMatch;
      if (economy.hasUniversalHealthcare) conf += 5;

      // Public education
      const educationMatch = content.match(
        /free education|public education|universal education|state-funded education/i
      );
      economy.hasPublicEducation = !!educationMatch;
      if (economy.hasPublicEducation) conf += 5;

      economy.confidence = Math.min(100, conf);
      if (economy.confidence > 0) extracted.economy = economy;
    }

    // GOVERNMENT & POLITICS
    if (lowerTitle.includes("government") || lowerTitle.includes("politics")) {
      let conf = 0;
      const gov: NonNullable<ExtractedBuilderData["government"]> = {
        confidence: 0,
        departments: [],
      };

      // Government Type
      const typeMatch = content.match(
        /is a (federal republic|constitutional monarchy|unitary republic|dictatorship|theocracy|absolute monarchy)[,\.]/i
      );
      if (typeMatch && typeMatch[1]) {
        gov.governmentType = typeMatch[1].toLowerCase();
        conf += 30;
      }

      // Legislature
      const legMatch = content.match(
        /(?:legislature|parliament) is (?:the|called the)? ([A-Z][a-zA-Z\s]+?)(?:[,\.]| and)/
      );
      if (legMatch && legMatch[1]) {
        gov.legislature = legMatch[1].trim();
        conf += 20;
      }

      // Departments and ministers
      const deptRegex =
        /(?:ministry|department|secretariat|bureau)\s+(?:of\s+)?([A-Z][a-zA-Z\s]+?)(?:,|\.|and|;|$)/gi;
      let deptMatch;
      const deptMap = new Map<string, { name: string; minister?: string }>();
      while ((deptMatch = deptRegex.exec(content)) !== null) {
        const name = deptMatch[1]?.trim();
        if (name && name.length > 2 && name.length < 60) {
          deptMap.set(name.toLowerCase(), { name });
        }
      }

      const ministerRegex =
        /(?:minister|secretary|head)\s+(?:of\s+)?(?:the\s+)?([A-Z][a-zA-Z\s]+?)\s*(?:is|was|:)\s*([A-Z][a-zA-Z\s.]+)/gi;
      let minMatch;
      while ((minMatch = ministerRegex.exec(content)) !== null) {
        const deptName = minMatch[1]?.trim().toLowerCase();
        const personName = minMatch[2]?.trim();
        if (deptName && personName) {
          const existing = deptMap.get(deptName);
          if (existing) {
            existing.minister = personName;
          } else {
            deptMap.set(deptName, { name: minMatch[1]?.trim() || "", minister: personName });
          }
        }
      }
      gov.departments = Array.from(deptMap.values());
      if (gov.departments.length > 0) conf += 15;

      // Judicial system
      const judicialMatch = content.match(
        /(?:has |features |maintains )?(an? )?(independent judiciary|supreme court|constitutional court|federal court system|judicial branch)[,\.]?/i
      );
      if (judicialMatch && judicialMatch[2]) {
        gov.judicialSystem = judicialMatch[2].toLowerCase();
        conf += 10;
      }

      // Electoral system
      const electoralMatch = content.match(
        /(?:uses |employs |operates under )?(proportional representation|first-past-the-post|single transferable vote|mixed member proportional|ranked choice voting|two-round system)[,\.]?/i
      );
      if (electoralMatch && electoralMatch[1]) {
        gov.electoralSystem = electoralMatch[1].toLowerCase();
        conf += 10;
      }

      // Constitution
      const constitutionMatch = content.match(
        /(?:has |governed by |operates under )(a |an )?(written constitution|codified constitution|uncodified constitution|constitutional framework)/i
      );
      gov.hasConstitution = !!constitutionMatch;
      if (gov.hasConstitution) conf += 10;

      // Political parties
      const partiesMatch = content.match(
        /(?:political parties|major parties|leading parties) (?:include|are) ([^\.]+)/i
      );
      if (partiesMatch && partiesMatch[1]) {
        gov.politicalParties = partiesMatch[1]
          .split(/,|\band\b/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.length < 50);
        if (gov.politicalParties.length > 0) conf += 10;
      }

      // Separation of powers
      const sepPowersMatch = content.match(
        /separation of powers|checks and balances|three branches of government/i
      );
      gov.hasSeparationOfPowers = !!sepPowersMatch;
      if (gov.hasSeparationOfPowers) conf += 10;

      // Federal structure
      const federalMatch = content.match(
        /federal structure|federal system|federation of|states and territories|provincial governments/i
      );
      gov.hasFederalStructure = !!federalMatch;
      if (gov.hasFederalStructure) conf += 10;

      // Local government
      const localGovMatch = content.match(
        /local government|municipal authorities|local councils|regional assemblies/i
      );
      gov.hasLocalGovernment = !!localGovMatch;
      if (gov.hasLocalGovernment) conf += 5;

      gov.confidence = Math.min(100, conf);
      if (gov.confidence > 0) extracted.government = gov;
    }

    // DEMOGRAPHICS
    if (lowerTitle.includes("demographic") || lowerTitle.includes("population")) {
      let conf = 0;
      const demo: NonNullable<ExtractedBuilderData["demographics"]> = { confidence: 0 };

      const popMatch = content.match(
        /population (?:of|is|was|estimated at) ([\d,\.]+\s*(?:million|billion|thousand)?)/i
      );
      if (popMatch && popMatch[1]) {
        const val = parseNumericValue(popMatch[1]);
        if (val) {
          demo.population = val;
          conf += 40;
        }
      }

      const lifeMatch = content.match(/life expectancy (?:is|of) ([\d,\.]+)/i);
      if (lifeMatch && lifeMatch[1]) {
        const val = parseFloat(lifeMatch[1]);
        if (!isNaN(val)) {
          demo.lifeExpectancy = val;
          conf += 20;
        }
      }

      demo.confidence = Math.min(100, conf);
      if (demo.confidence > 0) extracted.demographics = demo;
    }
  }

  return extracted;
}
