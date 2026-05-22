import { ComponentType } from "~/lib/enums";
import { SYNERGY_RULES, CONFLICT_RULES } from "~/lib/atomic-builder-state";
import type { WikiGovernmentAttributes } from "./wiki-government-parser";
import type { WikiEconomyAttributes } from "./wiki-economy-parser";

export interface ComponentMatch {
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

function scoreAllComponents(
  government: WikiGovernmentAttributes,
  economy: WikiEconomyAttributes,
  infoboxGovType?: string,
): ComponentScoringEntry[] {
  const entries: ComponentScoringEntry[] = [];
  const lowerInfobox = infoboxGovType?.toLowerCase() ?? "";

  // Power Distribution
  entries.push(scoreComponent(
    ComponentType.FEDERAL_SYSTEM,
    "power_distribution",
    [
      { condition: government.powerStructure === "federal", points: 60, reason: "Power structure identified as federal" },
      { condition: lowerInfobox.includes("federal"), points: 25, reason: "Infobox government type contains 'federal'" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.UNITARY_SYSTEM,
    "power_distribution",
    [
      { condition: government.powerStructure === "unitary", points: 60, reason: "Power structure identified as unitary" },
      { condition: lowerInfobox.includes("unitary"), points: 25, reason: "Infobox government type contains 'unitary'" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.CENTRALIZED_POWER,
    "power_distribution",
    [
      { condition: government.powerStructure === "centralized", points: 60, reason: "Power structure identified as centralized" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.CONFEDERATE_SYSTEM,
    "power_distribution",
    [
      { condition: government.powerStructure === "confederate", points: 60, reason: "Power structure identified as confederate" },
    ],
  ));

  // Decision Process
  entries.push(scoreComponent(
    ComponentType.DEMOCRATIC_PROCESS,
    "decision_process",
    [
      { condition: government.decisionProcess === "democratic", points: 60, reason: "Decision process identified as democratic" },
      { condition: government.legitimacySources.some((s) => s.type === "electoral"), points: 25, reason: "Legitimacy source includes electoral" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.AUTOCRATIC_PROCESS,
    "decision_process",
    [
      { condition: government.decisionProcess === "autocratic", points: 40, reason: "Decision process identified as autocratic" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.TECHNOCRATIC_PROCESS,
    "decision_process",
    [
      { condition: government.decisionProcess === "technocratic", points: 40, reason: "Decision process identified as technocratic" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.CONSENSUS_PROCESS,
    "decision_process",
    [
      { condition: government.decisionProcess === "consensus", points: 40, reason: "Decision process identified as consensus" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.OLIGARCHIC_PROCESS,
    "decision_process",
    [
      { condition: government.decisionProcess === "oligarchic", points: 40, reason: "Decision process identified as oligarchic" },
    ],
  ));

  // Legitimacy
  entries.push(scoreComponent(
    ComponentType.ELECTORAL_LEGITIMACY,
    "legitimacy",
    [
      { condition: government.legitimacySources.some((s) => s.type === "electoral"), points: 35, reason: "Legitimacy source includes electoral" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.TRADITIONAL_LEGITIMACY,
    "legitimacy",
    [
      { condition: government.legitimacySources.some((s) => s.type === "traditional"), points: 35, reason: "Legitimacy source includes traditional" },
      { condition: lowerInfobox.includes("monarchy"), points: 35, reason: "Infobox government type contains 'monarchy'" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.PERFORMANCE_LEGITIMACY,
    "legitimacy",
    [
      { condition: government.legitimacySources.some((s) => s.type === "performance"), points: 35, reason: "Legitimacy source includes performance" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.CHARISMATIC_LEGITIMACY,
    "legitimacy",
    [
      { condition: government.legitimacySources.some((s) => s.type === "charismatic"), points: 35, reason: "Legitimacy source includes charismatic" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.RELIGIOUS_LEGITIMACY,
    "legitimacy",
    [
      { condition: government.legitimacySources.some((s) => s.type === "religious"), points: 35, reason: "Legitimacy source includes religious" },
      { condition: lowerInfobox.includes("theocracy"), points: 35, reason: "Infobox government type contains 'theocracy'" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.INSTITUTIONAL_LEGITIMACY,
    "legitimacy",
    [
      { condition: government.legitimacySources.some((s) => s.type === "institutional"), points: 35, reason: "Legitimacy source includes institutional" },
    ],
  ));

  // Institutions
  entries.push(scoreComponent(
    ComponentType.INDEPENDENT_JUDICIARY,
    "institution",
    [
      { condition: government.institutions.some((i) => i.type === "independent_judiciary"), points: 35, reason: "Institution includes independent judiciary" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.PROFESSIONAL_BUREAUCRACY,
    "institution",
    [
      { condition: government.institutions.some((i) => i.type === "professional_bureaucracy"), points: 35, reason: "Institution includes professional bureaucracy" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.MILITARY_ADMINISTRATION,
    "institution",
    [
      { condition: government.institutions.some((i) => i.type === "military_administration"), points: 35, reason: "Institution includes military administration" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.PARTISAN_INSTITUTIONS,
    "institution",
    [
      { condition: government.institutions.some((i) => i.type === "partisan_institutions"), points: 35, reason: "Institution includes partisan institutions" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.TECHNOCRATIC_AGENCIES,
    "institution",
    [
      { condition: government.institutions.some((i) => i.type === "technocratic_agencies"), points: 35, reason: "Institution includes technocratic agencies" },
    ],
  ));

  // Control
  entries.push(scoreComponent(
    ComponentType.RULE_OF_LAW,
    "control",
    [
      { condition: government.controlMechanisms.some((c) => c.type === "rule_of_law"), points: 35, reason: "Control mechanism includes rule of law" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.SURVEILLANCE_SYSTEM,
    "control",
    [
      { condition: government.controlMechanisms.some((c) => c.type === "surveillance_system"), points: 35, reason: "Control mechanism includes surveillance system" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.ECONOMIC_INCENTIVES,
    "control",
    [
      { condition: government.controlMechanisms.some((c) => c.type === "economic_incentives"), points: 35, reason: "Control mechanism includes economic incentives" },
    ],
  ));

  // Economic governance
  entries.push(scoreComponent(
    ComponentType.FREE_MARKET_SYSTEM,
    "economic_governance",
    [
      { condition: government.economicGovernance.some((e) => e.type === "free_market"), points: 40, reason: "Economic governance includes free market" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.PLANNED_ECONOMY,
    "economic_governance",
    [
      { condition: government.economicGovernance.some((e) => e.type === "planned_economy"), points: 40, reason: "Economic governance includes planned economy" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.MIXED_ECONOMY,
    "economic_governance",
    [
      { condition: government.economicGovernance.some((e) => e.type === "mixed_economy"), points: 40, reason: "Economic governance includes mixed economy" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.CORPORATIST_SYSTEM,
    "economic_governance",
    [
      { condition: government.economicGovernance.some((e) => e.type === "corporatist"), points: 40, reason: "Economic governance includes corporatist" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.SOCIAL_MARKET_ECONOMY,
    "economic_governance",
    [
      { condition: government.economicGovernance.some((e) => e.type === "social_market"), points: 40, reason: "Economic governance includes social market" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.STATE_CAPITALISM,
    "economic_governance",
    [
      { condition: government.economicGovernance.some((e) => e.type === "state_capitalism"), points: 40, reason: "Economic governance includes state capitalism" },
    ],
  ));

  // Social policy
  entries.push(scoreComponent(
    ComponentType.WELFARE_STATE,
    "social_policy",
    [
      { condition: government.socialPolicies.some((s) => s.type === "welfare_state"), points: 35, reason: "Social policy includes welfare state" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.UNIVERSAL_HEALTHCARE,
    "social_policy",
    [
      { condition: government.socialPolicies.some((s) => s.type === "universal_healthcare"), points: 35, reason: "Social policy includes universal healthcare" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.PUBLIC_EDUCATION,
    "social_policy",
    [
      { condition: government.socialPolicies.some((s) => s.type === "public_education"), points: 35, reason: "Social policy includes public education" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.WORKER_PROTECTION,
    "social_policy",
    [
      { condition: government.socialPolicies.some((s) => s.type === "worker_protection"), points: 35, reason: "Social policy includes worker protection" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.ENVIRONMENTAL_PROTECTION,
    "social_policy",
    [
      { condition: government.socialPolicies.some((s) => s.type === "environmental_protection"), points: 35, reason: "Social policy includes environmental protection" },
    ],
  ));

  // Administrative
  entries.push(scoreComponent(
    ComponentType.DIGITAL_GOVERNMENT,
    "administrative",
    [
      { condition: government.administrativeFeatures.some((a) => a.type === "digital_government"), points: 35, reason: "Administrative feature includes digital government" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.ADMINISTRATIVE_DECENTRALIZATION,
    "administrative",
    [
      { condition: government.administrativeFeatures.some((a) => a.type === "administrative_decentralization"), points: 35, reason: "Administrative feature includes administrative decentralization" },
    ],
  ));

  entries.push(scoreComponent(
    ComponentType.MERIT_BASED_SYSTEM,
    "administrative",
    [
      { condition: government.administrativeFeatures.some((a) => a.type === "merit_based_system"), points: 35, reason: "Administrative feature includes merit-based system" },
    ],
  ));

  // International
  entries.push(scoreComponent(
    ComponentType.MULTILATERAL_DIPLOMACY,
    "international",
    [
      { condition: government.internationalPosture === "multilateral", points: 35, reason: "International posture identified as multilateral" },
    ],
  ));

  return entries;
}

function scoreComponent(
  component: ComponentType,
  category: string,
  rules: Array<{ condition: boolean; points: number; reason: string }>,
): ComponentScoringEntry {
  let score = 0;
  const reasons: string[] = [];

  for (const rule of rules) {
    if (rule.condition) {
      score += rule.points;
      reasons.push(rule.reason);
    }
  }

  return { component, score, reasons, category };
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
  const conflicts: Array<{ componentA: ComponentType; componentB: ComponentType; reason: string }> = [];

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
  const { government, economy, infoboxGovType } = attributes;

  let entries = scoreAllComponents(government, economy, infoboxGovType);
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
