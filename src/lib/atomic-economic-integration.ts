/**
 * Atomic Economic Integration
 * Connects economic indicators and calculations to atomic government components
 */

import type { ComponentType } from '~/types/government';

// Economic effectiveness multipliers based on atomic components
export const ECONOMIC_EFFECTIVENESS_MODIFIERS = {
  // Power Distribution Components
  CENTRALIZED_POWER: {
    gdpGrowthRate: 1.05,
    inflationControl: 1.15,
    economicStability: 1.10,
    policyImplementation: 1.20,
    description: "Centralized power enables rapid economic policy implementation"
  },
  FEDERAL_SYSTEM: {
    gdpGrowthRate: 1.02,
    inflationControl: 0.95,
    economicStability: 1.05,
    policyImplementation: 0.90,
    description: "Federal systems provide regional economic flexibility"
  },
  CONFEDERATE_SYSTEM: {
    gdpGrowthRate: 0.90,
    inflationControl: 0.85,
    economicStability: 0.80,
    policyImplementation: 0.70,
    description: "Confederate systems struggle with coordinated economic policy"
  },
  UNITARY_SYSTEM: {
    gdpGrowthRate: 1.08,
    inflationControl: 1.12,
    economicStability: 1.15,
    policyImplementation: 1.15,
    description: "Unitary systems enable consistent economic policy"
  },

  // Decision Process Components
  DEMOCRATIC_PROCESS: {
    gdpGrowthRate: 1.00,
    inflationControl: 0.95,
    economicStability: 1.05,
    policyImplementation: 0.85,
    description: "Democratic processes ensure sustainable but slower economic decisions"
  },
  AUTOCRATIC_PROCESS: {
    gdpGrowthRate: 1.15,
    inflationControl: 1.10,
    economicStability: 0.90,
    policyImplementation: 1.25,
    description: "Autocratic processes enable rapid economic responses"
  },
  TECHNOCRATIC_PROCESS: {
    gdpGrowthRate: 1.20,
    inflationControl: 1.25,
    economicStability: 1.15,
    policyImplementation: 1.15,
    description: "Technocratic governance optimizes economic policy effectiveness"
  },
  CONSENSUS_PROCESS: {
    gdpGrowthRate: 0.95,
    inflationControl: 1.05,
    economicStability: 1.20,
    policyImplementation: 0.80,
    description: "Consensus building creates stable but slow economic policy"
  },
  OLIGARCHIC_PROCESS: {
    gdpGrowthRate: 0.85,
    inflationControl: 0.90,
    economicStability: 0.85,
    policyImplementation: 1.00,
    description: "Oligarchic systems distort economic priorities"
  },

  // Legitimacy Source Components
  ELECTORAL_LEGITIMACY: {
    gdpGrowthRate: 1.05,
    inflationControl: 1.00,
    economicStability: 1.10,
    policyImplementation: 0.90,
    description: "Electoral legitimacy provides stable economic expectations"
  },
  TRADITIONAL_LEGITIMACY: {
    gdpGrowthRate: 0.95,
    inflationControl: 1.05,
    economicStability: 1.15,
    policyImplementation: 1.00,
    description: "Traditional authority maintains steady economic conditions"
  },
  PERFORMANCE_LEGITIMACY: {
    gdpGrowthRate: 1.15,
    inflationControl: 1.10,
    economicStability: 1.05,
    policyImplementation: 1.20,
    description: "Performance-based legitimacy drives economic results"
  },
  CHARISMATIC_LEGITIMACY: {
    gdpGrowthRate: 1.10,
    inflationControl: 0.95,
    economicStability: 0.90,
    policyImplementation: 1.15,
    description: "Charismatic leadership can drive ambitious economic programs"
  },
  RELIGIOUS_LEGITIMACY: {
    gdpGrowthRate: 0.90,
    inflationControl: 1.10,
    economicStability: 1.20,
    policyImplementation: 1.05,
    description: "Religious legitimacy prioritizes stability over growth"
  },

  // Institution Components
  PROFESSIONAL_BUREAUCRACY: {
    gdpGrowthRate: 1.15,
    inflationControl: 1.20,
    economicStability: 1.15,
    policyImplementation: 1.30,
    description: "Professional bureaucracy maximizes economic policy effectiveness"
  },
  MILITARY_ADMINISTRATION: {
    gdpGrowthRate: 1.05,
    inflationControl: 1.15,
    economicStability: 0.95,
    policyImplementation: 1.20,
    description: "Military administration prioritizes strategic sectors"
  },
  INDEPENDENT_JUDICIARY: {
    gdpGrowthRate: 1.08,
    inflationControl: 1.05,
    economicStability: 1.25,
    policyImplementation: 1.10,
    description: "Independent judiciary provides economic predictability"
  },
  PARTISAN_INSTITUTIONS: {
    gdpGrowthRate: 0.90,
    inflationControl: 0.85,
    economicStability: 0.80,
    policyImplementation: 0.95,
    description: "Partisan institutions create economic policy inconsistency"
  },
  TECHNOCRATIC_AGENCIES: {
    gdpGrowthRate: 1.25,
    inflationControl: 1.30,
    economicStability: 1.20,
    policyImplementation: 1.35,
    description: "Technocratic agencies optimize economic management"
  },

  // Control Mechanism Components
  RULE_OF_LAW: {
    gdpGrowthRate: 1.12,
    inflationControl: 1.10,
    economicStability: 1.30,
    policyImplementation: 1.15,
    description: "Rule of law provides essential economic stability"
  },
  SURVEILLANCE_SYSTEM: {
    gdpGrowthRate: 0.95,
    inflationControl: 1.05,
    economicStability: 0.90,
    policyImplementation: 1.10,
    description: "Surveillance systems may inhibit economic dynamism"
  }
} as const;

// Component synergies for economic effectiveness
export const ECONOMIC_COMPONENT_SYNERGIES = {
  // Technocratic process + Professional bureaucracy = Optimal economic management
  'TECHNOCRATIC_PROCESS+PROFESSIONAL_BUREAUCRACY': {
    gdpGrowthRate: 1.20,
    policyImplementation: 1.25,
    description: "Technocratic governance with professional bureaucracy maximizes economic efficiency"
  },
  
  // Rule of law + Independent judiciary = Investor confidence
  'RULE_OF_LAW+INDEPENDENT_JUDICIARY': {
    gdpGrowthRate: 1.15,
    economicStability: 1.20,
    description: "Rule of law with independent judiciary maximizes investor confidence"
  },
  
  // Performance legitimacy + Technocratic agencies = Results-driven economic policy
  'PERFORMANCE_LEGITIMACY+TECHNOCRATIC_AGENCIES': {
    gdpGrowthRate: 1.25,
    policyImplementation: 1.20,
    description: "Performance legitimacy with technocratic agencies drives economic results"
  },
  
  // Centralized power + Autocratic process = Rapid economic transformation
  'CENTRALIZED_POWER+AUTOCRATIC_PROCESS': {
    gdpGrowthRate: 1.30,
    policyImplementation: 1.35,
    economicStability: 0.85,
    description: "Centralized autocracy enables rapid economic transformation"
  },
  
  // Democratic process + Electoral legitimacy = Sustainable economic policy
  'DEMOCRATIC_PROCESS+ELECTORAL_LEGITIMACY': {
    economicStability: 1.25,
    inflationControl: 1.10,
    description: "Democratic legitimacy creates sustainable economic policy"
  }
} as const;

// Component conflicts that reduce economic effectiveness
export const ECONOMIC_COMPONENT_CONFLICTS = {
  // Surveillance + Rule of law = Reduced business confidence
  'SURVEILLANCE_SYSTEM+RULE_OF_LAW': {
    gdpGrowthRate: 0.90,
    description: "Surveillance undermines rule of law credibility"
  },
  
  // Military administration + Democratic process = Policy inconsistency
  'MILITARY_ADMINISTRATION+DEMOCRATIC_PROCESS': {
    policyImplementation: 0.80,
    description: "Military administration conflicts with democratic processes"
  },
  
  // Federal system + Centralized power = Coordination inefficiency
  'FEDERAL_SYSTEM+CENTRALIZED_POWER': {
    policyImplementation: 0.85,
    description: "Federal structure conflicts with centralized economic control"
  },
  
  // Partisan institutions + Technocratic agencies = Politicization of economic policy
  'PARTISAN_INSTITUTIONS+TECHNOCRATIC_AGENCIES': {
    gdpGrowthRate: 0.85,
    policyImplementation: 0.90,
    description: "Partisan institutions undermine technocratic economic management"
  }
} as const;

/**
 * Calculate economic effectiveness based on atomic government components
 */
export function calculateAtomicEconomicEffectiveness(
  components: ComponentType[],
  baseEconomicData: {
    gdpGrowthRate: number;
    inflationRate: number;
    gdpPerCapita: number;
    economicStability?: number;
    policyEffectiveness?: number;
  }
): {
  gdpGrowthRate: number;
  inflationRate: number;
  economicStability: number;
  policyEffectiveness: number;
  overallScore: number;
  modifierBreakdown: {
    component: ComponentType;
    modifiers: any;
    description: string;
  }[];
  synergies: string[];
  conflicts: string[];
} {
  let gdpMultiplier = 1.0;
  let inflationMultiplier = 1.0;
  let stabilityMultiplier = 1.0;
  let policyMultiplier = 1.0;
  
  const modifierBreakdown: any[] = [];
  const synergies: string[] = [];
  const conflicts: string[] = [];

  // Apply individual component modifiers
  for (const component of components) {
    const modifier = ECONOMIC_EFFECTIVENESS_MODIFIERS[component];
    if (modifier) {
      gdpMultiplier *= modifier.gdpGrowthRate;
      inflationMultiplier *= modifier.inflationControl;
      stabilityMultiplier *= modifier.economicStability;
      policyMultiplier *= modifier.policyImplementation;
      
      modifierBreakdown.push({
        component,
        modifiers: modifier,
        description: modifier.description
      });
    }
  }

  // Check for synergies
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const synergyKey = `${components[i]}+${components[j]}` as keyof typeof ECONOMIC_COMPONENT_SYNERGIES;
      const synergy = ECONOMIC_COMPONENT_SYNERGIES[synergyKey];
      
      if (synergy) {
        if (synergy.gdpGrowthRate) gdpMultiplier *= synergy.gdpGrowthRate;
        if (synergy.inflationControl) inflationMultiplier *= synergy.inflationControl;
        if (synergy.economicStability) stabilityMultiplier *= synergy.economicStability;
        if (synergy.policyImplementation) policyMultiplier *= synergy.policyImplementation;
        synergies.push(synergy.description);
      }

      // Check for conflicts
      const conflictKey = `${components[i]}+${components[j]}` as keyof typeof ECONOMIC_COMPONENT_CONFLICTS;
      const conflict = ECONOMIC_COMPONENT_CONFLICTS[conflictKey];
      
      if (conflict) {
        if (conflict.gdpGrowthRate) gdpMultiplier *= conflict.gdpGrowthRate;
        if (conflict.inflationControl) inflationMultiplier *= conflict.inflationControl;
        if (conflict.policyImplementation) policyMultiplier *= conflict.policyImplementation;
        conflicts.push(conflict.description);
      }
    }
  }

  // Calculate final values
  const finalGdpGrowthRate = baseEconomicData.gdpGrowthRate * gdpMultiplier;
  const finalInflationRate = baseEconomicData.inflationRate / inflationMultiplier; // Lower is better for inflation
  const finalEconomicStability = (baseEconomicData.economicStability || 70) * stabilityMultiplier;
  const finalPolicyEffectiveness = (baseEconomicData.policyEffectiveness || 60) * policyMultiplier;

  // Calculate overall economic performance score
  const overallScore = Math.round(
    (Math.min(100, finalGdpGrowthRate * 10) * 0.3 + // GDP growth (capped at 10%)
     Math.min(100, 100 - Math.abs(finalInflationRate - 2) * 10) * 0.25 + // Inflation target ~2%
     Math.min(100, finalEconomicStability) * 0.25 + // Stability
     Math.min(100, finalPolicyEffectiveness) * 0.2) // Policy effectiveness
  );

  return {
    gdpGrowthRate: Math.round(finalGdpGrowthRate * 100) / 100,
    inflationRate: Math.round(finalInflationRate * 100) / 100,
    economicStability: Math.round(finalEconomicStability * 100) / 100,
    policyEffectiveness: Math.round(finalPolicyEffectiveness * 100) / 100,
    overallScore,
    modifierBreakdown,
    synergies,
    conflicts
  };
}

/**
 * Get economic policy recommendations based on atomic components
 */
export function getAtomicEconomicRecommendations(
  components: ComponentType[],
  currentEconomicData: {
    gdpGrowthRate: number;
    inflationRate: number;
    unemploymentRate?: number;
  }
): {
  recommendedPolicies: string[];
  warnings: string[];
  opportunities: string[];
} {
  const recommendedPolicies: string[] = [];
  const warnings: string[] = [];
  const opportunities: string[] = [];

  // Professional bureaucracy recommendations
  if (components.includes('PROFESSIONAL_BUREAUCRACY')) {
    recommendedPolicies.push("Implement complex industrial policies");
    recommendedPolicies.push("Deploy sophisticated financial regulations");
    opportunities.push("Leverage bureaucratic capacity for economic planning");
  }

  // Technocratic governance recommendations
  if (components.includes('TECHNOCRATIC_PROCESS') || components.includes('TECHNOCRATIC_AGENCIES')) {
    recommendedPolicies.push("Focus on evidence-based economic policy");
    recommendedPolicies.push("Invest in data-driven economic monitoring");
    opportunities.push("Optimize economic policies using technical expertise");
  }

  // Democratic legitimacy considerations
  if (components.includes('ELECTORAL_LEGITIMACY') || components.includes('DEMOCRATIC_PROCESS')) {
    recommendedPolicies.push("Ensure inclusive economic growth");
    recommendedPolicies.push("Build public support for economic reforms");
    warnings.push("Economic reforms may face democratic constraints");
  }

  // Rule of law advantages
  if (components.includes('RULE_OF_LAW')) {
    opportunities.push("Attract foreign investment through legal certainty");
    recommendedPolicies.push("Strengthen intellectual property protection");
  }

  // Centralized power considerations
  if (components.includes('CENTRALIZED_POWER')) {
    opportunities.push("Implement rapid economic transformation programs");
    warnings.push("Ensure economic policies don't create regional imbalances");
  }

  // Surveillance system warnings
  if (components.includes('SURVEILLANCE_SYSTEM')) {
    warnings.push("Surveillance may discourage entrepreneurship");
    recommendedPolicies.push("Balance security with economic freedom");
  }

  // Economic performance based recommendations
  if (currentEconomicData.gdpGrowthRate < 2) {
    recommendedPolicies.push("Focus on productivity-enhancing investments");
    if (components.includes('TECHNOCRATIC_PROCESS')) {
      opportunities.push("Use technocratic capacity for growth acceleration");
    }
  }

  if (currentEconomicData.inflationRate > 4) {
    recommendedPolicies.push("Implement anti-inflationary measures");
    if (components.includes('CENTRALIZED_POWER')) {
      opportunities.push("Use centralized authority for inflation control");
    }
  }

  return {
    recommendedPolicies,
    warnings,
    opportunities
  };
}