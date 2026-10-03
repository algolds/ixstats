/**
 * Parses government attributes from wiki prose for component matching.
 * Uses keyword-based regex matching with evidence collection and confidence scoring.
 */

import { extractEvidence, findBestMatch, type PatternMatch } from "./wiki-pattern-utils";

export interface WikiGovernmentAttributes {
  powerStructure: "centralized" | "federal" | "confederate" | "unitary" | null;
  powerStructureConfidence: number;
  powerEvidence: string[];
  decisionProcess: "democratic" | "autocratic" | "technocratic" | "consensus" | "oligarchic" | null;
  decisionProcessConfidence: number;
  decisionEvidence: string[];
  legitimacySources: Array<{
    type:
      "electoral" | "traditional" | "performance" | "charismatic" | "religious" | "institutional";
    confidence: number;
    evidence: string;
  }>;
  institutions: Array<{
    type:
      | "independent_judiciary"
      | "professional_bureaucracy"
      | "military_administration"
      | "partisan_institutions"
      | "technocratic_agencies"
      | "digital_government";
    confidence: number;
    evidence: string;
  }>;
  controlMechanisms: Array<{
    type:
      | "rule_of_law"
      | "surveillance_system"
      | "economic_incentives"
      | "social_pressure"
      | "military_enforcement";
    confidence: number;
    evidence: string;
  }>;
  economicGovernance: Array<{
    type:
      | "free_market"
      | "planned_economy"
      | "mixed_economy"
      | "corporatist"
      | "social_market"
      | "state_capitalism"
      | "resource_based"
      | "knowledge_economy";
    confidence: number;
    evidence: string;
  }>;
  socialPolicies: Array<{
    type:
      | "welfare_state"
      | "universal_healthcare"
      | "public_education"
      | "social_safety_net"
      | "worker_protection"
      | "environmental_protection"
      | "cultural_preservation"
      | "minority_rights";
    confidence: number;
    evidence: string;
  }>;
  administrativeFeatures: Array<{
    type:
      | "digital_government"
      | "e_governance"
      | "administrative_decentralization"
      | "merit_based_system"
      | "performance_management"
      | "strategic_planning";
    confidence: number;
    evidence: string;
  }>;
  internationalPosture: "multilateral" | "bilateral" | "regional" | "isolationist" | null;
  internationalConfidence: number;
  internationalEvidence: string[];
  overallConfidence: number;
}

type DetectedType<K extends keyof WikiGovernmentAttributes> =
  WikiGovernmentAttributes[K] extends Array<{
    type: infer T;
  }>
    ? T & string
    : never;

const POWER_PATTERNS: PatternMatch[] = [
  ["federal", 85, /federal system|federal republic|federation of|federal structure/i],
  ["unitary", 85, /unitary state|unitary republic|unitary government/i],
  ["centralized", 80, /centralized government|centralized state|highly centralized/i],
  ["confederate", 80, /confederation|confederal|loose union of/i],
];

const DECISION_PATTERNS: PatternMatch[] = [
  [
    "democratic",
    80,
    /parliament|congress|elections|democratic process|democratic governance|free and fair elections/i,
  ],
  ["autocratic", 85, /dictator|absolute power|authoritarian rule|one-man rule|supreme leader/i],
  ["technocratic", 80, /technocrats|expert rule|rule by experts|technocratic council/i],
  ["consensus", 75, /consensus-based|consensus decision|deliberative democracy/i],
  ["oligarchic", 80, /oligarchy|ruling elite|powerful families|plutocracy/i],
];

const INTL_PATTERNS: PatternMatch[] = [
  [
    "multilateral",
    80,
    /UN\b|multilateral|international organizations|global governance|United Nations/i,
  ],
  ["bilateral", 75, /bilateral treaties|bilateral agreements|bilateral relations/i],
  ["regional", 75, /regional bloc|regional organization|regional integration|regional power/i],
  ["isolationist", 75, /non-aligned|isolationist|non-interference|closed country|self-reliance/i],
];

const LEGITIMACY_PATTERNS: Array<PatternMatch<DetectedType<"legitimacySources">>> = [
  ["electoral", 80, /elections|voting|popular mandate|electoral process|ballot/i],
  ["traditional", 75, /royal|hereditary|dynasty|monarch|bloodline|divine right/i],
  ["performance", 70, /economic growth|development|prosperity|rising living standards/i],
  [
    "charismatic",
    70,
    /charismatic leader|cult of personality|founding father|revolutionary leader/i,
  ],
  ["religious", 80, /state religion|theocracy|religious law|divine mandate|mandate of heaven/i],
  ["institutional", 70, /constitutional|legal framework|rule of law|institutional continuity/i],
];

const INSTITUTION_PATTERNS: Array<PatternMatch<DetectedType<"institutions">>> = [
  [
    "independent_judiciary",
    85,
    /independent judiciary|supreme court|constitutional court|judicial independence/i,
  ],
  [
    "professional_bureaucracy",
    80,
    /civil service|merit-based bureaucracy|professional civil service|career bureaucrats/i,
  ],
  ["military_administration", 85, /military rule|junta|military government|armed forces in power/i],
  ["partisan_institutions", 80, /one-party state|ruling party|dominant party|party-state/i],
  [
    "technocratic_agencies",
    75,
    /technocratic agency|expert commission|independent regulator|regulatory body/i,
  ],
  [
    "digital_government",
    75,
    /digital government|e-government|online services|digital transformation of government/i,
  ],
];

const CONTROL_PATTERNS: Array<PatternMatch<DetectedType<"controlMechanisms">>> = [
  ["rule_of_law", 80, /rule of law|constitutional government|due process|legal framework/i],
  [
    "surveillance_system",
    80,
    /surveillance|monitoring citizens|mass surveillance|security apparatus|intelligence services/i,
  ],
  ["economic_incentives", 70, /tax incentives|subsidies|economic incentives|fiscal policy/i],
  [
    "social_pressure",
    65,
    /social pressure|conformity|social control|peer pressure|community enforcement/i,
  ],
  [
    "military_enforcement",
    80,
    /military enforcement|martial law|armed enforcement|security forces/i,
  ],
];

const ECONOMIC_PATTERNS: Array<PatternMatch<DetectedType<"economicGovernance">>> = [
  ["free_market", 80, /free market|market economy|laissez-faire|market-driven/i],
  ["planned_economy", 85, /planned economy|central planning|command economy|state planning/i],
  ["mixed_economy", 80, /mixed economy|mixed market/i],
  ["corporatist", 75, /corporatist|corporatism|tripartite/i],
  ["social_market", 80, /social market|social market economy/i],
  [
    "state_capitalism",
    80,
    /state-owned|state capitalism|nationalized industries|state-controlled economy/i,
  ],
  ["resource_based", 75, /resource-based economy|resource-dependent|commodity-driven/i],
  ["knowledge_economy", 75, /knowledge economy|innovation-driven|tech economy|digital economy/i],
];

const SOCIAL_PATTERNS: Array<PatternMatch<DetectedType<"socialPolicies">>> = [
  ["welfare_state", 80, /welfare state|social safety net|social welfare/i],
  [
    "universal_healthcare",
    85,
    /universal healthcare|national health service|NHS|publicly funded healthcare/i,
  ],
  [
    "public_education",
    80,
    /free education|public education|universal education|state-funded education/i,
  ],
  [
    "social_safety_net",
    75,
    /social safety net|social security|unemployment benefits|social insurance/i,
  ],
  [
    "worker_protection",
    75,
    /labor rights|worker protection|workers' rights|employment protection/i,
  ],
  [
    "environmental_protection",
    75,
    /environmental protection|green policy|environmental regulation|climate policy/i,
  ],
  [
    "cultural_preservation",
    70,
    /cultural preservation|heritage protection|cultural policy|national identity/i,
  ],
  ["minority_rights", 75, /minority rights|indigenous rights|equal rights|anti-discrimination/i],
];

const ADMINISTRATIVE_PATTERNS: Array<PatternMatch<DetectedType<"administrativeFeatures">>> = [
  ["digital_government", 80, /e-government|digital services|online government services/i],
  ["e_governance", 75, /e-governance|digital governance|government technology/i],
  [
    "administrative_decentralization",
    80,
    /decentralization|local government|devolution|regional autonomy/i,
  ],
  ["merit_based_system", 80, /merit-based civil service|meritocracy|competitive examination/i],
  ["performance_management", 70, /performance management|KPIs|performance metrics|results-based/i],
  [
    "strategic_planning",
    75,
    /strategic planning|five-year plan|national development plan|long-term strategy/i,
  ],
];

function collectAllMatches<T extends string>(
  content: string,
  patterns: Array<PatternMatch<T>>,
  results: Array<{ type: T; confidence: number; evidence: string }>
) {
  for (const [value, confidence, pattern] of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match) {
      const evidenceSnippet = extractEvidence(content, match.index, match[0].length);
      results.push({ type: value, confidence, evidence: evidenceSnippet });
    }
  }
}

export function parseGovernmentAttributes(
  pages: { title: string; content: string }[],
  infoboxGovType?: string
): WikiGovernmentAttributes {
  const combinedContent = pages.map((p) => p.content).join("\n\n");

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
  const powerResult = findBestMatch(combinedContent, POWER_PATTERNS, result.powerEvidence);
  result.powerStructure = powerResult.value as WikiGovernmentAttributes["powerStructure"];
  result.powerStructureConfidence = powerResult.confidence;

  // Cross-reference with infoboxGovType (only when there's prose content)
  const hasContent = combinedContent.trim().length > 0;
  if (infoboxGovType && hasContent) {
    const lowerInfobox = infoboxGovType.toLowerCase();
    if (lowerInfobox.includes("federal") && result.powerStructure !== "federal") {
      result.powerStructure = "federal";
      result.powerStructureConfidence = Math.max(result.powerStructureConfidence, 60);
      result.powerEvidence.push(`Infobox indicates: ${infoboxGovType}`);
    } else if (lowerInfobox.includes("unitary") && result.powerStructure !== "unitary") {
      result.powerStructure = "unitary";
      result.powerStructureConfidence = Math.max(result.powerStructureConfidence, 60);
      result.powerEvidence.push(`Infobox indicates: ${infoboxGovType}`);
    } else if (lowerInfobox.includes("central") && result.powerStructure !== "centralized") {
      result.powerStructure = "centralized";
      result.powerStructureConfidence = Math.max(result.powerStructureConfidence, 55);
      result.powerEvidence.push(`Infobox indicates: ${infoboxGovType}`);
    }
  }

  // Decision process
  const decisionResult = findBestMatch(combinedContent, DECISION_PATTERNS, result.decisionEvidence);
  result.decisionProcess = decisionResult.value as WikiGovernmentAttributes["decisionProcess"];
  result.decisionProcessConfidence = decisionResult.confidence;

  // Legitimacy sources
  collectAllMatches(combinedContent, LEGITIMACY_PATTERNS, result.legitimacySources);

  // Institutions
  collectAllMatches(combinedContent, INSTITUTION_PATTERNS, result.institutions);

  // Control mechanisms
  collectAllMatches(combinedContent, CONTROL_PATTERNS, result.controlMechanisms);

  // Economic governance
  collectAllMatches(combinedContent, ECONOMIC_PATTERNS, result.economicGovernance);

  // Social policies
  collectAllMatches(combinedContent, SOCIAL_PATTERNS, result.socialPolicies);

  // Administrative features
  collectAllMatches(combinedContent, ADMINISTRATIVE_PATTERNS, result.administrativeFeatures);

  // International posture
  const intlResult = findBestMatch(combinedContent, INTL_PATTERNS, result.internationalEvidence);
  result.internationalPosture =
    intlResult.value as WikiGovernmentAttributes["internationalPosture"];
  result.internationalConfidence = intlResult.confidence;

  // Overall confidence is a weighted average of each area's best confidence
  const best = (items: Array<{ confidence: number }>) =>
    Math.max(0, ...items.map((item) => item.confidence));
  const weights: Array<[weight: number, confidence: number]> = [
    [15, result.powerStructureConfidence],
    [15, result.decisionProcessConfidence],
    [10, best(result.legitimacySources)],
    [15, best(result.institutions)],
    [10, best(result.controlMechanisms)],
    [10, best(result.economicGovernance)],
    [10, best(result.socialPolicies)],
    [10, best(result.administrativeFeatures)],
    [5, result.internationalConfidence],
  ];

  const totalWeight = weights.reduce((sum, [weight]) => sum + weight, 0);
  const weightedSum = weights.reduce((sum, [weight, confidence]) => sum + weight * confidence, 0);
  result.overallConfidence = Math.round(weightedSum / totalWeight);

  return result;
}
