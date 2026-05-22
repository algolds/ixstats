/**
 * Parses government attributes from wiki prose for component matching.
 * Uses keyword-based regex matching with evidence collection and confidence scoring.
 */

export interface WikiGovernmentAttributes {
  powerStructure: "centralized" | "federal" | "confederate" | "unitary" | null;
  powerStructureConfidence: number;
  powerEvidence: string[];
  decisionProcess: "democratic" | "autocratic" | "technocratic" | "consensus" | "oligarchic" | null;
  decisionProcessConfidence: number;
  decisionEvidence: string[];
  legitimacySources: Array<{ type: "electoral" | "traditional" | "performance" | "charismatic" | "religious" | "institutional"; confidence: number; evidence: string }>;
  institutions: Array<{ type: "independent_judiciary" | "professional_bureaucracy" | "military_administration" | "partisan_institutions" | "technocratic_agencies" | "digital_government"; confidence: number; evidence: string }>;
  controlMechanisms: Array<{ type: "rule_of_law" | "surveillance_system" | "economic_incentives" | "social_pressure" | "military_enforcement"; confidence: number; evidence: string }>;
  economicGovernance: Array<{ type: "free_market" | "planned_economy" | "mixed_economy" | "corporatist" | "social_market" | "state_capitalism" | "resource_based" | "knowledge_economy"; confidence: number; evidence: string }>;
  socialPolicies: Array<{ type: "welfare_state" | "universal_healthcare" | "public_education" | "social_safety_net" | "worker_protection" | "environmental_protection" | "cultural_preservation" | "minority_rights"; confidence: number; evidence: string }>;
  administrativeFeatures: Array<{ type: "digital_government" | "e_governance" | "administrative_decentralization" | "merit_based_system" | "performance_management" | "strategic_planning"; confidence: number; evidence: string }>;
  internationalPosture: "multilateral" | "bilateral" | "regional" | "isolationist" | null;
  internationalConfidence: number;
  internationalEvidence: string[];
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
  let snippet = content.slice(start, end).replace(/\n/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  return snippet;
}

function findBestMatch(content: string, patterns: PatternMatch[], evidence: string[]): { value: string | null; confidence: number } {
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

function collectAllMatches<T extends string>(
  content: string,
  patterns: Array<{ pattern: RegExp; value: T; confidence: number }>,
  results: Array<{ type: T; confidence: number; evidence: string }>
) {
  for (const { pattern, value, confidence } of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match) {
      const evidenceSnippet = extractEvidence(content, match);
      results.push({ type: value, confidence, evidence: evidenceSnippet });
    }
  }
}

export function parseGovernmentAttributes(pages: { title: string; content: string }[], infoboxGovType?: string): WikiGovernmentAttributes {
  const combinedContent = pages.map(p => p.content).join('\n\n');

  const result: WikiGovernmentAttributes = {
    powerStructure: null,
    powerStructureConfidence: 0,
    powerEvidence: [],
    decisionProcess: null,
    decisionProcessConfidence: 0,
    decisionEvidence: [],
    legitimacySources: [],
    institutions: [],
    controlMechanisms: [],
    economicGovernance: [],
    socialPolicies: [],
    administrativeFeatures: [],
    internationalPosture: null,
    internationalConfidence: 0,
    internationalEvidence: [],
    overallConfidence: 0,
  };

  // Power structure
  const powerPatterns: PatternMatch[] = [
    { pattern: /federal system|federal republic|federation of|federal structure/i, value: 'federal', confidence: 85 },
    { pattern: /unitary state|unitary republic|unitary government/i, value: 'unitary', confidence: 85 },
    { pattern: /centralized government|centralized state|highly centralized/i, value: 'centralized', confidence: 80 },
    { pattern: /confederation|confederal|loose union of/i, value: 'confederate', confidence: 80 },
  ];
  const powerResult = findBestMatch(combinedContent, powerPatterns, result.powerEvidence);
  result.powerStructure = powerResult.value as WikiGovernmentAttributes['powerStructure'];
  result.powerStructureConfidence = powerResult.confidence;

  // Cross-reference with infoboxGovType (only when there's prose content)
  const hasContent = combinedContent.trim().length > 0;
  if (infoboxGovType && hasContent) {
    const lowerInfobox = infoboxGovType.toLowerCase();
    if (lowerInfobox.includes('federal') && result.powerStructure !== 'federal') {
      result.powerStructure = 'federal';
      result.powerStructureConfidence = Math.max(result.powerStructureConfidence, 60);
      result.powerEvidence.push(`Infobox indicates: ${infoboxGovType}`);
    } else if (lowerInfobox.includes('unitary') && result.powerStructure !== 'unitary') {
      result.powerStructure = 'unitary';
      result.powerStructureConfidence = Math.max(result.powerStructureConfidence, 60);
      result.powerEvidence.push(`Infobox indicates: ${infoboxGovType}`);
    } else if (lowerInfobox.includes('central') && result.powerStructure !== 'centralized') {
      result.powerStructure = 'centralized';
      result.powerStructureConfidence = Math.max(result.powerStructureConfidence, 55);
      result.powerEvidence.push(`Infobox indicates: ${infoboxGovType}`);
    }
  }

  // Decision process
  const decisionPatterns: PatternMatch[] = [
    { pattern: /parliament|congress|elections|democratic process|democratic governance|free and fair elections/i, value: 'democratic', confidence: 80 },
    { pattern: /dictator|absolute power|authoritarian rule|one-man rule|supreme leader/i, value: 'autocratic', confidence: 85 },
    { pattern: /technocrats|expert rule|rule by experts|technocratic council/i, value: 'technocratic', confidence: 80 },
    { pattern: /consensus-based|consensus decision|deliberative democracy/i, value: 'consensus', confidence: 75 },
    { pattern: /oligarchy|ruling elite|powerful families|plutocracy/i, value: 'oligarchic', confidence: 80 },
  ];
  const decisionResult = findBestMatch(combinedContent, decisionPatterns, result.decisionEvidence);
  result.decisionProcess = decisionResult.value as WikiGovernmentAttributes['decisionProcess'];
  result.decisionProcessConfidence = decisionResult.confidence;

  // Legitimacy sources
  collectAllMatches(combinedContent, [
    { pattern: /elections|voting|popular mandate|electoral process|ballot/i, value: 'electoral', confidence: 80 },
    { pattern: /royal|hereditary|dynasty|monarch|bloodline|divine right/i, value: 'traditional', confidence: 75 },
    { pattern: /economic growth|development|prosperity|rising living standards/i, value: 'performance', confidence: 70 },
    { pattern: /charismatic leader|cult of personality|founding father|revolutionary leader/i, value: 'charismatic', confidence: 70 },
    { pattern: /state religion|theocracy|religious law|divine mandate|mandate of heaven/i, value: 'religious', confidence: 80 },
    { pattern: /constitutional|legal framework|rule of law|institutional continuity/i, value: 'institutional', confidence: 70 },
  ], result.legitimacySources);

  // Institutions
  collectAllMatches(combinedContent, [
    { pattern: /independent judiciary|supreme court|constitutional court|judicial independence/i, value: 'independent_judiciary', confidence: 85 },
    { pattern: /civil service|merit-based bureaucracy|professional civil service|career bureaucrats/i, value: 'professional_bureaucracy', confidence: 80 },
    { pattern: /military rule|junta|military government|armed forces in power/i, value: 'military_administration', confidence: 85 },
    { pattern: /one-party state|ruling party|dominant party|party-state/i, value: 'partisan_institutions', confidence: 80 },
    { pattern: /technocratic agency|expert commission|independent regulator|regulatory body/i, value: 'technocratic_agencies', confidence: 75 },
    { pattern: /digital government|e-government|online services|digital transformation of government/i, value: 'digital_government', confidence: 75 },
  ], result.institutions);

  // Control mechanisms
  collectAllMatches(combinedContent, [
    { pattern: /rule of law|constitutional government|due process|legal framework/i, value: 'rule_of_law', confidence: 80 },
    { pattern: /surveillance|monitoring citizens|mass surveillance|security apparatus|intelligence services/i, value: 'surveillance_system', confidence: 80 },
    { pattern: /tax incentives|subsidies|economic incentives|fiscal policy/i, value: 'economic_incentives', confidence: 70 },
    { pattern: /social pressure|conformity|social control|peer pressure|community enforcement/i, value: 'social_pressure', confidence: 65 },
    { pattern: /military enforcement|martial law|armed enforcement|security forces/i, value: 'military_enforcement', confidence: 80 },
  ], result.controlMechanisms);

  // Economic governance
  collectAllMatches(combinedContent, [
    { pattern: /free market|market economy|laissez-faire|market-driven/i, value: 'free_market', confidence: 80 },
    { pattern: /planned economy|central planning|command economy|state planning/i, value: 'planned_economy', confidence: 85 },
    { pattern: /mixed economy|mixed market/i, value: 'mixed_economy', confidence: 80 },
    { pattern: /corporatist|corporatism|tripartite/i, value: 'corporatist', confidence: 75 },
    { pattern: /social market|social market economy/i, value: 'social_market', confidence: 80 },
    { pattern: /state-owned|state capitalism|nationalized industries|state-controlled economy/i, value: 'state_capitalism', confidence: 80 },
    { pattern: /resource-based economy|resource-dependent|commodity-driven/i, value: 'resource_based', confidence: 75 },
    { pattern: /knowledge economy|innovation-driven|tech economy|digital economy/i, value: 'knowledge_economy', confidence: 75 },
  ], result.economicGovernance);

  // Social policies
  collectAllMatches(combinedContent, [
    { pattern: /welfare state|social safety net|social welfare/i, value: 'welfare_state', confidence: 80 },
    { pattern: /universal healthcare|national health service|NHS|publicly funded healthcare/i, value: 'universal_healthcare', confidence: 85 },
    { pattern: /free education|public education|universal education|state-funded education/i, value: 'public_education', confidence: 80 },
    { pattern: /social safety net|social security|unemployment benefits|social insurance/i, value: 'social_safety_net', confidence: 75 },
    { pattern: /labor rights|worker protection|workers' rights|employment protection/i, value: 'worker_protection', confidence: 75 },
    { pattern: /environmental protection|green policy|environmental regulation|climate policy/i, value: 'environmental_protection', confidence: 75 },
    { pattern: /cultural preservation|heritage protection|cultural policy|national identity/i, value: 'cultural_preservation', confidence: 70 },
    { pattern: /minority rights|indigenous rights|equal rights|anti-discrimination/i, value: 'minority_rights', confidence: 75 },
  ], result.socialPolicies);

  // Administrative features
  collectAllMatches(combinedContent, [
    { pattern: /e-government|digital services|online government services/i, value: 'digital_government', confidence: 80 },
    { pattern: /e-governance|digital governance|government technology/i, value: 'e_governance', confidence: 75 },
    { pattern: /decentralization|local government|devolution|regional autonomy/i, value: 'administrative_decentralization', confidence: 80 },
    { pattern: /merit-based civil service|meritocracy|competitive examination/i, value: 'merit_based_system', confidence: 80 },
    { pattern: /performance management|KPIs|performance metrics|results-based/i, value: 'performance_management', confidence: 70 },
    { pattern: /strategic planning|five-year plan|national development plan|long-term strategy/i, value: 'strategic_planning', confidence: 75 },
  ], result.administrativeFeatures);

  // International posture
  const intlPatterns: PatternMatch[] = [
    { pattern: /UN\b|multilateral|international organizations|global governance|United Nations/i, value: 'multilateral', confidence: 80 },
    { pattern: /bilateral treaties|bilateral agreements|bilateral relations/i, value: 'bilateral', confidence: 75 },
    { pattern: /regional bloc|regional organization|regional integration|regional power/i, value: 'regional', confidence: 75 },
    { pattern: /non-aligned|isolationist|non-interference|closed country|self-reliance/i, value: 'isolationist', confidence: 75 },
  ];
  const intlResult = findBestMatch(combinedContent, intlPatterns, result.internationalEvidence);
  result.internationalPosture = intlResult.value as WikiGovernmentAttributes['internationalPosture'];
  result.internationalConfidence = intlResult.confidence;

  // Calculate overall confidence as weighted average
  const weights: { key: string; weight: number; confidence: number }[] = [
    { key: 'power', weight: 15, confidence: result.powerStructureConfidence },
    { key: 'decision', weight: 15, confidence: result.decisionProcessConfidence },
    { key: 'legitimacy', weight: 10, confidence: result.legitimacySources.length > 0 ? Math.max(...result.legitimacySources.map(l => l.confidence)) : 0 },
    { key: 'institutions', weight: 15, confidence: result.institutions.length > 0 ? Math.max(...result.institutions.map(i => i.confidence)) : 0 },
    { key: 'control', weight: 10, confidence: result.controlMechanisms.length > 0 ? Math.max(...result.controlMechanisms.map(c => c.confidence)) : 0 },
    { key: 'economic', weight: 10, confidence: result.economicGovernance.length > 0 ? Math.max(...result.economicGovernance.map(e => e.confidence)) : 0 },
    { key: 'social', weight: 10, confidence: result.socialPolicies.length > 0 ? Math.max(...result.socialPolicies.map(s => s.confidence)) : 0 },
    { key: 'administrative', weight: 10, confidence: result.administrativeFeatures.length > 0 ? Math.max(...result.administrativeFeatures.map(a => a.confidence)) : 0 },
    { key: 'international', weight: 5, confidence: result.internationalConfidence },
  ];

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  const weightedSum = weights.reduce((sum, w) => sum + w.weight * w.confidence, 0);
  result.overallConfidence = Math.round(weightedSum / totalWeight);

  return result;
}
