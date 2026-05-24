/**
 * Parses economic governance indicators from wiki prose for component matching.
 * Uses keyword-based regex matching with evidence collection and confidence scoring.
 */

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

interface PatternMatch {
  pattern: RegExp;
  value: string;
  confidence: number;
}

function extractEvidence(content: string, match: RegExpExecArray, contextChars = 80): string {
  const start = Math.max(0, match.index - contextChars);
  const end = Math.min(content.length, match.index + match[0].length + contextChars);
  let snippet = content.slice(start, end).replace(/\n/g, " ").trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";
  return snippet;
}

function findBestMatch(
  content: string,
  patterns: PatternMatch[],
  evidence: string[]
): { value: string | null; confidence: number } {
  let bestValue: string | null = null;
  let bestConfidence = 0;

  for (const { pattern, value, confidence } of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match && confidence > bestConfidence) {
      bestValue = value;
      bestConfidence = confidence;
      const evidenceSnippet = extractEvidence(content, match);
      if (!evidence.includes(evidenceSnippet)) {
        evidence.push(evidenceSnippet);
      }
    }
  }

  return { value: bestValue, confidence: bestConfidence };
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
      const evidenceSnippet = extractEvidence(content, match, contextChars);
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
    { pattern: /mixed economy|mixed market/i, value: "mixed", confidence: 90 },
    { pattern: /social market economy|social market/i, value: "social_market", confidence: 85 },
    {
      pattern: /state capitalism|state-controlled economy/i,
      value: "state_capitalism",
      confidence: 85,
    },
    {
      pattern: /planned economy|central planning|command economy/i,
      value: "planned",
      confidence: 85,
    },
    { pattern: /corporatist economy|corporatism/i, value: "corporatist", confidence: 80 },
    {
      pattern: /resource-based economy|resource-dependent economy/i,
      value: "resource_based",
      confidence: 80,
    },
    {
      pattern: /knowledge economy|innovation-driven economy/i,
      value: "knowledge_economy",
      confidence: 80,
    },
    { pattern: /free market|market economy|laissez-faire/i, value: "free_market", confidence: 75 },
  ];
  const systemResult = findBestMatch(
    combinedContent,
    systemPatterns,
    result.economicSystemEvidence
  );
  result.economicSystem = systemResult.value as WikiEconomyAttributes["economicSystem"];
  result.economicSystemConfidence = systemResult.confidence;

  // State-owned enterprises
  const soePattern =
    /(state-owned enterprises|nationalized industries|public sector companies|government-owned)/gi;
  let soeMatch;
  while ((soeMatch = soePattern.exec(combinedContent)) !== null) {
    result.hasStateOwnedEnterprises = true;
    const evidenceSnippet = extractEvidence(combinedContent, soeMatch);
    if (!result.stateOwnedEvidence.includes(evidenceSnippet)) {
      result.stateOwnedEvidence.push(evidenceSnippet);
    }
  }

  // Free trade zones
  const ftzPattern = /(free trade zone|special economic zone|export processing zone|free port)/gi;
  let ftzMatch;
  while ((ftzMatch = ftzPattern.exec(combinedContent)) !== null) {
    result.hasFreeTradeZones = true;
    const evidenceSnippet = extractEvidence(combinedContent, ftzMatch);
    if (!result.freeTradeEvidence.includes(evidenceSnippet)) {
      result.freeTradeEvidence.push(evidenceSnippet);
    }
  }

  // Central bank
  const centralBankPattern =
    /central bank (?:of|is|called|named)?\s*(?:the\s+)?([A-Z][a-zA-Z\s]+?)(?:,|\.|is|was)/gi;
  const cbMatch = centralBankPattern.exec(combinedContent);
  if (cbMatch && cbMatch[1]) {
    result.centralBank = cbMatch[1].trim();
  }

  // Major exports
  const exportsPattern = /(?:major|primary|main) exports (?:include|are) ([^\.]+)\./gi;
  result.majorExports = collectAllMatches(
    combinedContent,
    exportsPattern,
    result.economicSystemEvidence
  );

  // Major imports
  const importsPattern = /(?:major|primary|main) imports (?:include|are) ([^\.]+)\./gi;
  result.majorImports = collectAllMatches(
    combinedContent,
    importsPattern,
    result.economicSystemEvidence
  );

  // Trade partners
  const tradePattern = /(?:largest|main|primary) trading partners (?:include|are) ([^\.]+)\./gi;
  result.tradePartners = collectAllMatches(
    combinedContent,
    tradePattern,
    result.economicSystemEvidence
  );

  // Welfare programs
  const welfarePattern =
    /(universal healthcare|national health service|free education|public education|welfare state|social safety net|universal basic income)/gi;
  let welfareMatch;
  while ((welfareMatch = welfarePattern.exec(combinedContent)) !== null) {
    result.hasWelfarePrograms = true;
    const matched = welfareMatch[1].toLowerCase();
    if (matched.includes("healthcare") || matched.includes("health service")) {
      result.hasUniversalHealthcare = true;
    }
    if (matched.includes("education")) {
      result.hasPublicEducation = true;
    }
    const evidenceSnippet = extractEvidence(combinedContent, welfareMatch);
    if (!result.socialPolicyEvidence.includes(evidenceSnippet)) {
      result.socialPolicyEvidence.push(evidenceSnippet);
    }
  }

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
