/**
 * Government Component Synergy Calculator
 *
 * This module handles the detection and calculation of synergies and conflicts
 * between atomic government components.
 */

import { ComponentType } from "@prisma/client";

export interface SynergyData {
  type: "ADDITIVE" | "MULTIPLICATIVE" | "CONFLICTING";
  multiplier: number;
  description: string;
}

/**
 * Comprehensive synergy and conflict mappings extracted from AtomicGovernmentComponents.tsx
 *
 * ADDITIVE synergies provide a +10 effectiveness bonus
 * CONFLICTING combinations impose a -15 effectiveness penalty
 * MULTIPLICATIVE synergies scale with the multiplier value
 */
const SYNERGY_MAP: Record<string, SynergyData> = {
  // Power Distribution Synergies
  "CENTRALIZED_POWER+AUTOCRATIC_PROCESS": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Centralized power reinforces autocratic decision making",
  },
  "CENTRALIZED_POWER+PROFESSIONAL_BUREAUCRACY": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Central authority enables coordinated bureaucracy",
  },
  "FEDERAL_SYSTEM+DEMOCRATIC_PROCESS": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Federal structure supports democratic participation",
  },
  "FEDERAL_SYSTEM+RULE_OF_LAW": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Federal system strengthens legal frameworks",
  },
  "CONFEDERATE_SYSTEM+CONSENSUS_PROCESS": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Confederate structure requires consensus building",
  },
  "CONFEDERATE_SYSTEM+TRADITIONAL_LEGITIMACY": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Confederation respects traditional authority",
  },
  "UNITARY_SYSTEM+CENTRALIZED_POWER": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Unitary system maximizes central control",
  },
  "UNITARY_SYSTEM+PROFESSIONAL_BUREAUCRACY": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Unified administration enhances bureaucratic efficiency",
  },

  // Decision Process Synergies
  "DEMOCRATIC_PROCESS+ELECTORAL_LEGITIMACY": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Democracy derives strength from electoral mandate",
  },
  "DEMOCRATIC_PROCESS+RULE_OF_LAW": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Democratic institutions require legal framework",
  },
  "AUTOCRATIC_PROCESS+CHARISMATIC_LEGITIMACY": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Autocracy benefits from strong leadership",
  },
  "TECHNOCRATIC_PROCESS+PERFORMANCE_LEGITIMACY": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Expert governance validated by results",
  },
  "TECHNOCRATIC_PROCESS+TECHNOCRATIC_AGENCIES": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Technical decision making empowers expert agencies",
  },
  "CONSENSUS_PROCESS+TRADITIONAL_LEGITIMACY": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Consensus building respects traditional norms",
  },
  "OLIGARCHIC_PROCESS+ECONOMIC_INCENTIVES": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Elite control leverages economic rewards",
  },
  "OLIGARCHIC_PROCESS+SURVEILLANCE_SYSTEM": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Oligarchy maintains control through monitoring",
  },

  // Legitimacy Synergies
  "ELECTORAL_LEGITIMACY+INDEPENDENT_JUDICIARY": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Electoral authority protected by independent courts",
  },
  "TRADITIONAL_LEGITIMACY+RELIGIOUS_LEGITIMACY": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Traditional and religious authority reinforce each other",
  },
  "PERFORMANCE_LEGITIMACY+PROFESSIONAL_BUREAUCRACY": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Performance governance requires professional administration",
  },
  "CHARISMATIC_LEGITIMACY+SOCIAL_PRESSURE": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Charismatic leadership mobilizes social support",
  },
  "RELIGIOUS_LEGITIMACY+SOCIAL_PRESSURE": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Religious authority enforced through community norms",
  },

  // Institution Synergies
  "PROFESSIONAL_BUREAUCRACY+RULE_OF_LAW": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Professional administration upholds legal standards",
  },
  "MILITARY_ADMINISTRATION+AUTOCRATIC_PROCESS": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Military hierarchy supports centralized command",
  },
  "MILITARY_ADMINISTRATION+MILITARY_ENFORCEMENT": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Military administration and enforcement work together",
  },
  "INDEPENDENT_JUDICIARY+RULE_OF_LAW": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Independent courts essential for rule of law",
  },
  "PARTISAN_INSTITUTIONS+OLIGARCHIC_PROCESS": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Partisan loyalty supports elite control",
  },
  "PARTISAN_INSTITUTIONS+ECONOMIC_INCENTIVES": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Partisan institutions distribute economic rewards",
  },

  // Control Mechanism Synergies
  "SURVEILLANCE_SYSTEM+AUTOCRATIC_PROCESS": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Surveillance supports centralized control",
  },
  "ECONOMIC_INCENTIVES+PERFORMANCE_LEGITIMACY": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Economic rewards validate performance-based governance",
  },
  "SOCIAL_PRESSURE+TRADITIONAL_LEGITIMACY": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Social norms reinforce traditional values",
  },
  "SOCIAL_PRESSURE+CONSENSUS_PROCESS": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Social pressure facilitates consensus building",
  },

  // Economic System Synergies
  "FREE_MARKET_SYSTEM+DEMOCRATIC_PROCESS": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Free markets thrive in democratic systems",
  },
  "FREE_MARKET_SYSTEM+ECONOMIC_INCENTIVES": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Market economy relies on economic incentives",
  },
  "PLANNED_ECONOMY+CENTRALIZED_POWER": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Economic planning requires centralized authority",
  },
  "PLANNED_ECONOMY+TECHNOCRATIC_PROCESS": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Economic planning benefits from technical expertise",
  },
  "MIXED_ECONOMY+SOCIAL_MARKET_ECONOMY": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Mixed economy compatible with social market principles",
  },
  "MIXED_ECONOMY+DEMOCRATIC_PROCESS": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Mixed economy balances interests democratically",
  },
  "CORPORATIST_SYSTEM+OLIGARCHIC_PROCESS": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Corporatism enables organized elite coordination",
  },
  "CORPORATIST_SYSTEM+TECHNOCRATIC_AGENCIES": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Corporatism benefits from expert management",
  },
  "SOCIAL_MARKET_ECONOMY+DEMOCRATIC_PROCESS": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Social market economy requires democratic oversight",
  },
  "SOCIAL_MARKET_ECONOMY+WELFARE_STATE": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Social market principles align with welfare policies",
  },
  "STATE_CAPITALISM+CENTRALIZED_POWER": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "State capitalism requires strong central authority",
  },
  "STATE_CAPITALISM+TECHNOCRATIC_AGENCIES": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "State economic control benefits from expert management",
  },
  "RESOURCE_BASED_ECONOMY+STATE_CAPITALISM": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Resource economy often controlled by state",
  },
  "RESOURCE_BASED_ECONOMY+TECHNOCRATIC_AGENCIES": {
    type: "ADDITIVE",
    multiplier: 1.0,
    description: "Resource extraction requires technical expertise",
  },

  // Major Conflicts
  "CENTRALIZED_POWER+FEDERAL_SYSTEM": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Centralized control conflicts with federal autonomy",
  },
  "CENTRALIZED_POWER+CONSENSUS_PROCESS": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Central authority undermines consensus building",
  },
  "FEDERAL_SYSTEM+AUTOCRATIC_PROCESS": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Federal autonomy conflicts with autocratic control",
  },
  "CONFEDERATE_SYSTEM+CENTRALIZED_POWER": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Confederate independence conflicts with centralization",
  },
  "CONFEDERATE_SYSTEM+PROFESSIONAL_BUREAUCRACY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Loose confederation hinders unified bureaucracy",
  },
  "UNITARY_SYSTEM+FEDERAL_SYSTEM": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Unitary and federal systems are incompatible",
  },
  "UNITARY_SYSTEM+CONFEDERATE_SYSTEM": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Unitary control conflicts with confederate autonomy",
  },
  "DEMOCRATIC_PROCESS+AUTOCRATIC_PROCESS": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Democracy and autocracy are fundamentally opposed",
  },
  "DEMOCRATIC_PROCESS+MILITARY_ADMINISTRATION": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Democratic governance conflicts with military rule",
  },
  "AUTOCRATIC_PROCESS+CONSENSUS_PROCESS": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Autocratic control prevents consensus building",
  },
  "AUTOCRATIC_PROCESS+ELECTORAL_LEGITIMACY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Autocracy undermines electoral processes",
  },
  "TECHNOCRATIC_PROCESS+CHARISMATIC_LEGITIMACY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Technical expertise conflicts with charismatic authority",
  },
  "TECHNOCRATIC_PROCESS+TRADITIONAL_LEGITIMACY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Technical rationality conflicts with traditional norms",
  },
  "OLIGARCHIC_PROCESS+DEMOCRATIC_PROCESS": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Elite control conflicts with democratic participation",
  },
  "OLIGARCHIC_PROCESS+ELECTORAL_LEGITIMACY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Oligarchic power undermines electoral processes",
  },
  "TRADITIONAL_LEGITIMACY+PERFORMANCE_LEGITIMACY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Traditional authority conflicts with performance standards",
  },
  "CHARISMATIC_LEGITIMACY+PERFORMANCE_LEGITIMACY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Charismatic authority conflicts with performance metrics",
  },
  "RELIGIOUS_LEGITIMACY+TECHNOCRATIC_PROCESS": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Religious authority conflicts with technical rationality",
  },
  "RELIGIOUS_LEGITIMACY+RULE_OF_LAW": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Religious law may conflict with secular legal framework",
  },
  "PROFESSIONAL_BUREAUCRACY+PARTISAN_INSTITUTIONS": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Merit-based system conflicts with partisan appointments",
  },
  "PROFESSIONAL_BUREAUCRACY+MILITARY_ADMINISTRATION": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Professional bureaucracy conflicts with military hierarchy",
  },
  "MILITARY_ADMINISTRATION+INDEPENDENT_JUDICIARY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Military rule undermines judicial independence",
  },
  "PARTISAN_INSTITUTIONS+INDEPENDENT_JUDICIARY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Partisan control conflicts with judicial independence",
  },
  "TECHNOCRATIC_AGENCIES+TRADITIONAL_LEGITIMACY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Technical expertise conflicts with traditional authority",
  },
  "TECHNOCRATIC_AGENCIES+PARTISAN_INSTITUTIONS": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Expert agencies conflict with partisan control",
  },
  "RULE_OF_LAW+AUTOCRATIC_PROCESS": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Rule of law constrained by autocratic power",
  },
  "RULE_OF_LAW+MILITARY_ENFORCEMENT": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Legal framework conflicts with military force",
  },
  "SURVEILLANCE_SYSTEM+DEMOCRATIC_PROCESS": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Mass surveillance undermines democratic freedoms",
  },
  "SURVEILLANCE_SYSTEM+RULE_OF_LAW": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Surveillance may violate legal protections",
  },
  "ECONOMIC_INCENTIVES+TRADITIONAL_LEGITIMACY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Economic rewards conflict with traditional values",
  },
  "ECONOMIC_INCENTIVES+RELIGIOUS_LEGITIMACY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Material incentives conflict with religious principles",
  },
  "SOCIAL_PRESSURE+TECHNOCRATIC_PROCESS": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Social conformity conflicts with technical rationality",
  },
  "SOCIAL_PRESSURE+SURVEILLANCE_SYSTEM": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Community norms differ from state surveillance",
  },
  "MILITARY_ENFORCEMENT+DEMOCRATIC_PROCESS": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Military force undermines democratic governance",
  },
  "FREE_MARKET_SYSTEM+PLANNED_ECONOMY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Free markets and central planning are incompatible",
  },
  "FREE_MARKET_SYSTEM+WELFARE_STATE": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Unrestricted markets conflict with extensive welfare",
  },
  "PLANNED_ECONOMY+ECONOMIC_INCENTIVES": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Central planning reduces market incentives",
  },
  "MIXED_ECONOMY+PLANNED_ECONOMY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Mixed economy balances differ from pure planning",
  },
  "MIXED_ECONOMY+FREE_MARKET_SYSTEM": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Mixed economy includes more intervention than free market",
  },
  "CORPORATIST_SYSTEM+DEMOCRATIC_PROCESS": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Corporatist structures limit democratic participation",
  },
  "CORPORATIST_SYSTEM+FREE_MARKET_SYSTEM": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Corporatism constrains free market competition",
  },
  "SOCIAL_MARKET_ECONOMY+FREE_MARKET_SYSTEM": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Social market includes more regulation than free market",
  },
  "SOCIAL_MARKET_ECONOMY+PLANNED_ECONOMY": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "Social market preserves more market mechanisms than planning",
  },
  "STATE_CAPITALISM+FREE_MARKET_SYSTEM": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "State ownership conflicts with free market principles",
  },
  "STATE_CAPITALISM+DEMOCRATIC_PROCESS": {
    type: "CONFLICTING",
    multiplier: 1.0,
    description: "State economic control may undermine democratic accountability",
  },
};

/**
 * Check if two government components have synergy or conflict
 *
 * @param type1 - First component type
 * @param type2 - Second component type
 * @returns SynergyData if synergy/conflict exists, null otherwise
 */
export function checkComponentSynergy(
  type1: ComponentType,
  type2: ComponentType
): SynergyData | null {
  // Check both orderings of component pairs
  const key1 = `${type1}+${type2}`;
  const key2 = `${type2}+${type1}`;

  return SYNERGY_MAP[key1] ?? SYNERGY_MAP[key2] ?? null;
}

/**
 * Calculate total government effectiveness from components and synergies
 *
 * @param components - Array of government components with effectiveness scores
 * @param synergies - Array of component synergies
 * @returns Total government effectiveness (0-100)
 */
export function calculateGovernmentEffectiveness(
  components: Array<{ effectivenessScore: number }>,
  synergies: Array<{ synergyType: string; effectMultiplier: number }>
): number {
  if (components.length === 0) return 50; // Default neutral effectiveness

  // Calculate base effectiveness from components
  const baseEffectiveness =
    components.reduce((sum, comp) => sum + comp.effectivenessScore, 0) / components.length;

  // Calculate synergy bonuses and conflict penalties
  let totalSynergyBonus = 0;
  let conflictPenalty = 0;

  for (const synergy of synergies) {
    if (synergy.synergyType === "CONFLICTING") {
      conflictPenalty += 15; // Standard conflict penalty
    } else if (synergy.synergyType === "ADDITIVE") {
      totalSynergyBonus += 10; // Standard synergy bonus
    } else if (synergy.synergyType === "MULTIPLICATIVE") {
      totalSynergyBonus += synergy.effectMultiplier * 10;
    }
  }

  // Calculate final effectiveness (clamped to 0-100 range)
  return Math.max(0, Math.min(100, baseEffectiveness + totalSynergyBonus - conflictPenalty));
}

/**
 * Get a summary of all synergies in the system
 *
 * @returns Object with synergy counts by type
 */
export function getSynergySummary() {
  const summary = {
    totalSynergies: 0,
    additive: 0,
    multiplicative: 0,
    conflicting: 0,
  };

  for (const synergy of Object.values(SYNERGY_MAP)) {
    summary.totalSynergies++;
    if (synergy.type === "ADDITIVE") summary.additive++;
    else if (synergy.type === "MULTIPLICATIVE") summary.multiplicative++;
    else if (synergy.type === "CONFLICTING") summary.conflicting++;
  }

  return summary;
}
