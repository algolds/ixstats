import { ComponentType } from "~/lib/enums";
import { SYNERGY_RULES, CONFLICT_RULES } from "~/lib/builder";
import type { WikiGovernmentAttributes } from "./wiki-government-parser";
import type { WikiEconomyAttributes } from "./wiki-economy-parser";

interface ComponentMatch {
  component: ComponentType;
  score: number;
  reasons: string[];
  category: string;
  confidence: "high" | "medium" | "low";
}

export interface MatchResult {
  selected: ComponentMatch[];
  suggested: ComponentMatch[];
  rejected: ComponentMatch[];
  conflicts: Array<{
    componentA: ComponentType;
    componentB: ComponentType;
    reason: string;
  }>;
  missingEssential: ComponentType[];
}

interface ComponentScoringEntry {
  component: ComponentType;
  score: number;
  reasons: string[];
  category: string;
}

const ESSENTIAL_CATEGORIES = ["power_distribution", "decision_process", "legitimacy"];

interface ScoringContext {
  government: WikiGovernmentAttributes;
  lowerInfobox: string;
}

interface ScoringRule {
  applies: (context: ScoringContext) => boolean;
  points: number;
  reason: string;
}

type ScalarAttribute = "powerStructure" | "decisionProcess" | "internationalPosture";
type ListAttribute =
  | "legitimacySources"
  | "institutions"
  | "controlMechanisms"
  | "economicGovernance"
  | "socialPolicies"
  | "administrativeFeatures";

const ATTRIBUTE_LABELS: Record<ScalarAttribute | ListAttribute, string> = {
  powerStructure: "Power structure",
  decisionProcess: "Decision process",
  internationalPosture: "International posture",
  legitimacySources: "Legitimacy source",
  institutions: "Institution",
  controlMechanisms: "Control mechanism",
  economicGovernance: "Economic governance",
  socialPolicies: "Social policy",
  administrativeFeatures: "Administrative feature",
};

/** The parsed attribute equals `value`. */
const is = (attribute: ScalarAttribute, value: string, points: number): ScoringRule => ({
  applies: ({ government }) => government[attribute] === value,
  points,
  reason: `${ATTRIBUTE_LABELS[attribute]} identified as ${value}`,
});

/** The parsed list contains an entry of `type`. */
const has = (
  attribute: ListAttribute,
  type: string,
  points: number,
  label = type.replace(/_/g, " ")
): ScoringRule => ({
  applies: ({ government }) =>
    (government[attribute] as ReadonlyArray<{ type: string }>).some((item) => item.type === type),
  points,
  reason: `${ATTRIBUTE_LABELS[attribute]} includes ${label}`,
});

/** The infobox's government type contains `word`. */
const infobox = (word: string, points: number): ScoringRule => ({
  applies: ({ lowerInfobox }) => lowerInfobox.includes(word),
  points,
  reason: `Infobox government type contains '${word}'`,
});

const COMPONENT_SCORING: Array<[ComponentType, string, ...ScoringRule[]]> = [
  [
    ComponentType.FEDERAL_SYSTEM,
    "power_distribution",
    is("powerStructure", "federal", 60),
    infobox("federal", 25),
  ],
  [
    ComponentType.UNITARY_SYSTEM,
    "power_distribution",
    is("powerStructure", "unitary", 60),
    infobox("unitary", 25),
  ],
  [ComponentType.CENTRALIZED_POWER, "power_distribution", is("powerStructure", "centralized", 60)],
  [ComponentType.CONFEDERATE_SYSTEM, "power_distribution", is("powerStructure", "confederate", 60)],
  [
    ComponentType.DEMOCRATIC_PROCESS,
    "decision_process",
    is("decisionProcess", "democratic", 60),
    has("legitimacySources", "electoral", 25),
  ],
  [ComponentType.AUTOCRATIC_PROCESS, "decision_process", is("decisionProcess", "autocratic", 40)],
  [
    ComponentType.TECHNOCRATIC_PROCESS,
    "decision_process",
    is("decisionProcess", "technocratic", 40),
  ],
  [ComponentType.CONSENSUS_PROCESS, "decision_process", is("decisionProcess", "consensus", 40)],
  [ComponentType.OLIGARCHIC_PROCESS, "decision_process", is("decisionProcess", "oligarchic", 40)],
  [ComponentType.ELECTORAL_LEGITIMACY, "legitimacy", has("legitimacySources", "electoral", 35)],
  [
    ComponentType.TRADITIONAL_LEGITIMACY,
    "legitimacy",
    has("legitimacySources", "traditional", 35),
    infobox("monarchy", 35),
  ],
  [ComponentType.PERFORMANCE_LEGITIMACY, "legitimacy", has("legitimacySources", "performance", 35)],
  [ComponentType.CHARISMATIC_LEGITIMACY, "legitimacy", has("legitimacySources", "charismatic", 35)],
  [
    ComponentType.RELIGIOUS_LEGITIMACY,
    "legitimacy",
    has("legitimacySources", "religious", 35),
    infobox("theocracy", 35),
  ],
  [
    ComponentType.INSTITUTIONAL_LEGITIMACY,
    "legitimacy",
    has("legitimacySources", "institutional", 35),
  ],
  [
    ComponentType.INDEPENDENT_JUDICIARY,
    "institution",
    has("institutions", "independent_judiciary", 35),
  ],
  [
    ComponentType.PROFESSIONAL_BUREAUCRACY,
    "institution",
    has("institutions", "professional_bureaucracy", 35),
  ],
  [
    ComponentType.MILITARY_ADMINISTRATION,
    "institution",
    has("institutions", "military_administration", 35),
  ],
  [
    ComponentType.PARTISAN_INSTITUTIONS,
    "institution",
    has("institutions", "partisan_institutions", 35),
  ],
  [
    ComponentType.TECHNOCRATIC_AGENCIES,
    "institution",
    has("institutions", "technocratic_agencies", 35),
  ],
  [ComponentType.RULE_OF_LAW, "control", has("controlMechanisms", "rule_of_law", 35)],
  [
    ComponentType.SURVEILLANCE_SYSTEM,
    "control",
    has("controlMechanisms", "surveillance_system", 35),
  ],
  [
    ComponentType.ECONOMIC_INCENTIVES,
    "control",
    has("controlMechanisms", "economic_incentives", 35),
  ],
  [
    ComponentType.FREE_MARKET_SYSTEM,
    "economic_governance",
    has("economicGovernance", "free_market", 40),
  ],
  [
    ComponentType.PLANNED_ECONOMY,
    "economic_governance",
    has("economicGovernance", "planned_economy", 40),
  ],
  [
    ComponentType.MIXED_ECONOMY,
    "economic_governance",
    has("economicGovernance", "mixed_economy", 40),
  ],
  [
    ComponentType.CORPORATIST_SYSTEM,
    "economic_governance",
    has("economicGovernance", "corporatist", 40),
  ],
  [
    ComponentType.SOCIAL_MARKET_ECONOMY,
    "economic_governance",
    has("economicGovernance", "social_market", 40),
  ],
  [
    ComponentType.STATE_CAPITALISM,
    "economic_governance",
    has("economicGovernance", "state_capitalism", 40),
  ],
  [ComponentType.WELFARE_STATE, "social_policy", has("socialPolicies", "welfare_state", 35)],
  [
    ComponentType.UNIVERSAL_HEALTHCARE,
    "social_policy",
    has("socialPolicies", "universal_healthcare", 35),
  ],
  [ComponentType.PUBLIC_EDUCATION, "social_policy", has("socialPolicies", "public_education", 35)],
  [
    ComponentType.WORKER_PROTECTION,
    "social_policy",
    has("socialPolicies", "worker_protection", 35),
  ],
  [
    ComponentType.ENVIRONMENTAL_PROTECTION,
    "social_policy",
    has("socialPolicies", "environmental_protection", 35),
  ],
  [
    ComponentType.DIGITAL_GOVERNMENT,
    "administrative",
    has("administrativeFeatures", "digital_government", 35),
  ],
  [
    ComponentType.ADMINISTRATIVE_DECENTRALIZATION,
    "administrative",
    has("administrativeFeatures", "administrative_decentralization", 35),
  ],
  [
    ComponentType.MERIT_BASED_SYSTEM,
    "administrative",
    has("administrativeFeatures", "merit_based_system", 35, "merit-based system"),
  ],
  [
    ComponentType.MULTILATERAL_DIPLOMACY,
    "international",
    is("internationalPosture", "multilateral", 35),
  ],
];

function scoreAllComponents(
  government: WikiGovernmentAttributes,
  infoboxGovType?: string
): ComponentScoringEntry[] {
  const context = { government, lowerInfobox: infoboxGovType?.toLowerCase() ?? "" };
  return COMPONENT_SCORING.map(([component, category, ...rules]) =>
    scoreComponent(component, category, rules, context)
  );
}

function scoreComponent(
  component: ComponentType,
  category: string,
  rules: ScoringRule[],
  context: ScoringContext
): ComponentScoringEntry {
  const matched = rules.filter((rule) => rule.applies(context));
  return {
    component,
    score: matched.reduce((sum, rule) => sum + rule.points, 0),
    reasons: matched.map((rule) => rule.reason),
    category,
  };
}

function applySynergies(entries: ComponentScoringEntry[]): ComponentScoringEntry[] {
  const scored = entries.filter((e) => e.score >= 60);

  for (const synergy of SYNERGY_RULES) {
    const [compA, compB] = synergy.components;
    const entryA = scored.find((e) => e.component === compA);
    const entryB = scored.find((e) => e.component === compB);

    if (entryA && entryB) {
      entryA.score = Math.min(100, entryA.score + 10);
      entryB.score = Math.min(100, entryB.score + 10);
      if (!entryA.reasons.includes("Synergy bonus applied")) {
        entryA.reasons.push("Synergy bonus applied");
      }
      if (!entryB.reasons.includes("Synergy bonus applied")) {
        entryB.reasons.push("Synergy bonus applied");
      }
    }
  }

  return entries;
}

function applyConflicts(entries: ComponentScoringEntry[]): ComponentScoringEntry[] {
  for (const conflict of CONFLICT_RULES) {
    const [compA, compB] = conflict.components;
    const entryA = entries.find((e) => e.component === compA);
    const entryB = entries.find((e) => e.component === compB);

    if (entryA && entryB) {
      if (entryA.score < entryB.score) {
        entryA.score = Math.max(0, entryA.score - 20);
      } else if (entryB.score < entryA.score) {
        entryB.score = Math.max(0, entryB.score - 20);
      } else if (entryA.score > 0 && entryB.score > 0) {
        entryB.score = Math.max(0, entryB.score - 20);
      }
    }
  }

  return entries;
}

function classifyMatch(entry: ComponentScoringEntry): ComponentMatch {
  const confidence = entry.score >= 80 ? "high" : entry.score >= 60 ? "medium" : "low";
  return {
    component: entry.component,
    score: entry.score,
    reasons: entry.reasons,
    category: entry.category,
    confidence,
  };
}

function findMissingEssentials(matches: ComponentMatch[]): ComponentType[] {
  const missing: ComponentType[] = [];

  for (const category of ESSENTIAL_CATEGORIES) {
    const hasMatch = matches.some((m) => m.category === category && m.score >= 60);
    if (!hasMatch) {
      const representative = getEssentialComponentForCategory(category);
      if (representative) {
        missing.push(representative);
      }
    }
  }

  return missing;
}

function getEssentialComponentForCategory(category: string): ComponentType | null {
  switch (category) {
    case "power_distribution":
      return ComponentType.CENTRALIZED_POWER;
    case "decision_process":
      return ComponentType.DEMOCRATIC_PROCESS;
    case "legitimacy":
      return ComponentType.ELECTORAL_LEGITIMACY;
    default:
      return null;
  }
}

function detectConflicts(selected: ComponentMatch[]): Array<{
  componentA: ComponentType;
  componentB: ComponentType;
  reason: string;
}> {
  const conflicts: Array<{ componentA: ComponentType; componentB: ComponentType; reason: string }> =
    [];

  for (const rule of CONFLICT_RULES) {
    const [compA, compB] = rule.components;
    const hasA = selected.some((m) => m.component === compA);
    const hasB = selected.some((m) => m.component === compB);

    if (hasA && hasB) {
      conflicts.push({
        componentA: compA,
        componentB: compB,
        reason: rule.description,
      });
    }
  }

  return conflicts;
}

export function matchComponents(attributes: {
  government: WikiGovernmentAttributes;
  economy: WikiEconomyAttributes;
  infoboxGovType?: string;
}): MatchResult {
  const { government, infoboxGovType } = attributes;

  let entries = scoreAllComponents(government, infoboxGovType);
  entries = applySynergies(entries);
  entries = applyConflicts(entries);

  const allMatches = entries.map(classifyMatch);

  const selected = allMatches.filter((m) => m.confidence === "high");
  const suggested = allMatches.filter((m) => m.confidence === "medium");
  const rejected = allMatches.filter((m) => m.confidence === "low");

  const conflicts = detectConflicts(selected);
  const missingEssential = findMissingEssentials(allMatches);

  return { selected, suggested, rejected, conflicts, missingEssential };
}
