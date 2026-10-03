/**
 * Parses economic governance indicators from wiki prose for component matching.
 * Uses keyword-based regex matching with evidence collection and confidence scoring.
 */

import {
  extractEvidence,
  findBestMatch,
  scanMatches,
  type PatternMatch,
} from "./wiki-pattern-utils";

export interface WikiEconomyAttributes {
  economicSystem:
    | "free_market"
    | "planned"
    | "mixed"
    | "corporatist"
    | "social_market"
    | "state_capitalism"
    | "resource_based"
    | "knowledge_economy"
    | null;
  economicSystemConfidence: number;
  economicSystemEvidence: string[];
  hasStateOwnedEnterprises: boolean;
  stateOwnedEvidence: string[];
  hasFreeTradeZones: boolean;
  freeTradeEvidence: string[];
  centralBank?: string;
  majorExports: string[];
  majorImports: string[];
  tradePartners: string[];
  hasWelfarePrograms: boolean;
  hasUniversalHealthcare: boolean;
  hasPublicEducation: boolean;
  socialPolicyEvidence: string[];
  overallConfidence: number;
}

function collectAllMatches(
  content: string,
  pattern: RegExp,
  evidence: string[],
  contextChars = 80
): string[] {
  const results: string[] = [];
  pattern.lastIndex = 0;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    if (match[1]) {
      const items = match[1]
        .split(/,|\band\b/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length < 50);
      results.push(...items);
      const evidenceSnippet = extractEvidence(content, match.index, match[0].length, contextChars);
      if (!evidence.includes(evidenceSnippet)) {
        evidence.push(evidenceSnippet);
      }
    }
  }
  return results;
}

export function parseEconomyAttributes(
  pages: { title: string; content: string }[]
): WikiEconomyAttributes {
  const combinedContent = pages.map((p) => p.content).join("\n\n");

  const result: WikiEconomyAttributes = {
    economicSystem: null,
    economicSystemConfidence: 0,
    economicSystemEvidence: [],
    hasStateOwnedEnterprises: false,
    stateOwnedEvidence: [],
    hasFreeTradeZones: false,
    freeTradeEvidence: [],
    majorExports: [],
    majorImports: [],
    tradePartners: [],
    hasWelfarePrograms: false,
    hasUniversalHealthcare: false,
    hasPublicEducation: false,
    socialPolicyEvidence: [],
    overallConfidence: 0,
  };

  // Economic system - ordered by specificity (more specific = higher confidence)
  const systemPatterns: PatternMatch[] = [
    ["mixed", 90, /mixed economy|mixed market/i],
    ["social_market", 85, /social market economy|social market/i],
    ["state_capitalism", 85, /state capitalism|state-controlled economy/i],
    ["planned", 85, /planned economy|central planning|command economy/i],
    ["corporatist", 80, /corporatist economy|corporatism/i],
    ["resource_based", 80, /resource-based economy|resource-dependent economy/i],
    ["knowledge_economy", 80, /knowledge economy|innovation-driven economy/i],
    ["free_market", 75, /free market|market economy|laissez-faire/i],
  ];
  const systemResult = findBestMatch(
    combinedContent,
    systemPatterns,
    result.economicSystemEvidence
  );
  result.economicSystem = systemResult.value as WikiEconomyAttributes["economicSystem"];
  result.economicSystemConfidence = systemResult.confidence;

  const soePattern =
    /(state-owned enterprises|nationalized industries|public sector companies|government-owned)/gi;
  scanMatches(combinedContent, soePattern, result.stateOwnedEvidence, () => {
    result.hasStateOwnedEnterprises = true;
  });

  const ftzPattern = /(free trade zone|special economic zone|export processing zone|free port)/gi;
  scanMatches(combinedContent, ftzPattern, result.freeTradeEvidence, () => {
    result.hasFreeTradeZones = true;
  });

  const centralBankPattern =
    /central bank (?:of|is|called|named)?\s*(?:the\s+)?([A-Z][a-zA-Z\s]+?)(?:,|\.|is|was)/gi;
  const cbMatch = centralBankPattern.exec(combinedContent);
  if (cbMatch && cbMatch[1]) {
    result.centralBank = cbMatch[1].trim();
  }

  // Major exports
  const exportsPattern = /(?:major|primary|main) exports (?:include|are) ([^.]+)\./gi;
  result.majorExports = collectAllMatches(
    combinedContent,
    exportsPattern,
    result.economicSystemEvidence
  );

  // Major imports
  const importsPattern = /(?:major|primary|main) imports (?:include|are) ([^.]+)\./gi;
  result.majorImports = collectAllMatches(
    combinedContent,
    importsPattern,
    result.economicSystemEvidence
  );

  // Trade partners
  const tradePattern = /(?:largest|main|primary) trading partners (?:include|are) ([^.]+)\./gi;
  result.tradePartners = collectAllMatches(
    combinedContent,
    tradePattern,
    result.economicSystemEvidence
  );

  // Welfare programs
  const welfarePattern =
    /(universal healthcare|national health service|free education|public education|welfare state|social safety net|universal basic income)/gi;
  scanMatches(combinedContent, welfarePattern, result.socialPolicyEvidence, (match) => {
    result.hasWelfarePrograms = true;
    const matched = match[1].toLowerCase();
    if (matched.includes("healthcare") || matched.includes("health service")) {
      result.hasUniversalHealthcare = true;
    }
    if (matched.includes("education")) result.hasPublicEducation = true;
  });

  // Calculate overall confidence
  let totalConfidence = 0;
  let factorCount = 0;

  if (result.economicSystemConfidence > 0) {
    totalConfidence += result.economicSystemConfidence;
    factorCount++;
  }
  if (result.hasStateOwnedEnterprises) {
    totalConfidence += 70;
    factorCount++;
  }
  if (result.hasFreeTradeZones) {
    totalConfidence += 60;
    factorCount++;
  }
  if (result.centralBank) {
    totalConfidence += 65;
    factorCount++;
  }
  if (result.majorExports.length > 0) {
    totalConfidence += 75;
    factorCount++;
  }
  if (result.majorImports.length > 0) {
    totalConfidence += 75;
    factorCount++;
  }
  if (result.tradePartners.length > 0) {
    totalConfidence += 70;
    factorCount++;
  }
  if (result.hasWelfarePrograms) {
    totalConfidence += 70;
    factorCount++;
  }

  result.overallConfidence = factorCount > 0 ? Math.round(totalConfidence / factorCount) : 0;

  return result;
}
