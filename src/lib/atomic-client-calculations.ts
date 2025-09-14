/**
 * Client-side atomic calculations
 * Pure functions without database dependencies for use in client components
 */

import { ComponentType } from '@prisma/client';

export interface ClientAtomicEconomicModifiers {
  taxCollectionMultiplier: number;
  gdpGrowthModifier: number;
  stabilityBonus: number;
  innovationMultiplier: number;
  internationalTradeBonus: number;
  governmentEfficiencyMultiplier: number;
  gdpImpact?: number;
  stabilityIndex?: number;
  internationalStanding?: number;
  taxEfficiency?: number;
}

export interface ComponentEffectivenessData {
  baseEffectiveness: number;
  economicImpact: number;
  taxImpact: number;
  stabilityImpact: number;
  legitimacyImpact: number;
}

// Component effectiveness lookup table
const COMPONENT_EFFECTIVENESS: Record<ComponentType, ComponentEffectivenessData> = {
  // Power Distribution
  [ComponentType.CENTRALIZED_POWER]: {
    baseEffectiveness: 75,
    economicImpact: 1.05,
    taxImpact: 1.15,
    stabilityImpact: 10,
    legitimacyImpact: 5
  },
  [ComponentType.FEDERAL_SYSTEM]: {
    baseEffectiveness: 70,
    economicImpact: 1.02,
    taxImpact: 0.95,
    stabilityImpact: 5,
    legitimacyImpact: 8
  },
  [ComponentType.CONFEDERATE_SYSTEM]: {
    baseEffectiveness: 60,
    economicImpact: 0.98,
    taxImpact: 0.85,
    stabilityImpact: -5,
    legitimacyImpact: 3
  },
  [ComponentType.UNITARY_SYSTEM]: {
    baseEffectiveness: 72,
    economicImpact: 1.08,
    taxImpact: 1.12,
    stabilityImpact: 8,
    legitimacyImpact: 6
  },

  // Decision Processes
  [ComponentType.DEMOCRATIC_PROCESS]: {
    baseEffectiveness: 68,
    economicImpact: 1.03,
    taxImpact: 1.05,
    stabilityImpact: 5,
    legitimacyImpact: 15
  },
  [ComponentType.AUTOCRATIC_PROCESS]: {
    baseEffectiveness: 75,
    economicImpact: 1.02,
    taxImpact: 1.20,
    stabilityImpact: -5,
    legitimacyImpact: -10
  },
  [ComponentType.TECHNOCRATIC_PROCESS]: {
    baseEffectiveness: 85,
    economicImpact: 1.15,
    taxImpact: 1.12,
    stabilityImpact: 8,
    legitimacyImpact: 5
  },
  [ComponentType.CONSENSUS_PROCESS]: {
    baseEffectiveness: 60,
    economicImpact: 0.95,
    taxImpact: 0.90,
    stabilityImpact: 12,
    legitimacyImpact: 10
  },
  [ComponentType.OLIGARCHIC_PROCESS]: {
    baseEffectiveness: 70,
    economicImpact: 1.08,
    taxImpact: 1.05,
    stabilityImpact: -8,
    legitimacyImpact: -15
  },

  // Legitimacy Sources
  [ComponentType.ELECTORAL_LEGITIMACY]: {
    baseEffectiveness: 65,
    economicImpact: 1.02,
    taxImpact: 1.05,
    stabilityImpact: 5,
    legitimacyImpact: 20
  },
  [ComponentType.TRADITIONAL_LEGITIMACY]: {
    baseEffectiveness: 70,
    economicImpact: 0.98,
    taxImpact: 1.10,
    stabilityImpact: 15,
    legitimacyImpact: 12
  },
  [ComponentType.PERFORMANCE_LEGITIMACY]: {
    baseEffectiveness: 80,
    economicImpact: 1.12,
    taxImpact: 1.08,
    stabilityImpact: 8,
    legitimacyImpact: 15
  },
  [ComponentType.CHARISMATIC_LEGITIMACY]: {
    baseEffectiveness: 75,
    economicImpact: 1.05,
    taxImpact: 1.02,
    stabilityImpact: -5,
    legitimacyImpact: 18
  },
  [ComponentType.RELIGIOUS_LEGITIMACY]: {
    baseEffectiveness: 72,
    economicImpact: 0.95,
    taxImpact: 1.15,
    stabilityImpact: 12,
    legitimacyImpact: 15
  },

  // Institutions
  [ComponentType.PROFESSIONAL_BUREAUCRACY]: {
    baseEffectiveness: 85,
    economicImpact: 1.20,
    taxImpact: 1.25,
    stabilityImpact: 15,
    legitimacyImpact: 8
  },
  [ComponentType.MILITARY_ADMINISTRATION]: {
    baseEffectiveness: 78,
    economicImpact: 1.05,
    taxImpact: 1.15,
    stabilityImpact: 8,
    legitimacyImpact: -8
  },
  [ComponentType.INDEPENDENT_JUDICIARY]: {
    baseEffectiveness: 80,
    economicImpact: 1.08,
    taxImpact: 1.12,
    stabilityImpact: 18,
    legitimacyImpact: 15
  },
  [ComponentType.PARTISAN_INSTITUTIONS]: {
    baseEffectiveness: 65,
    economicImpact: 0.92,
    taxImpact: 0.95,
    stabilityImpact: -12,
    legitimacyImpact: -10
  },
  [ComponentType.TECHNOCRATIC_AGENCIES]: {
    baseEffectiveness: 82,
    economicImpact: 1.18,
    taxImpact: 1.15,
    stabilityImpact: 10,
    legitimacyImpact: 5
  },

  // Control Mechanisms
  [ComponentType.RULE_OF_LAW]: {
    baseEffectiveness: 85,
    economicImpact: 1.15,
    taxImpact: 1.20,
    stabilityImpact: 20,
    legitimacyImpact: 18
  },
  [ComponentType.SURVEILLANCE_SYSTEM]: {
    baseEffectiveness: 78,
    economicImpact: 1.02,
    taxImpact: 1.18,
    stabilityImpact: 5,
    legitimacyImpact: -12
  },

  // Compliance Mechanisms
  [ComponentType.ECONOMIC_INCENTIVES]: {
    baseEffectiveness: 73,
    economicImpact: 1.10,
    taxImpact: 1.08,
    stabilityImpact: 5,
    legitimacyImpact: 8
  },
  [ComponentType.SOCIAL_PRESSURE]: {
    baseEffectiveness: 68,
    economicImpact: 1.02,
    taxImpact: 1.12,
    stabilityImpact: 8,
    legitimacyImpact: 5
  },
  [ComponentType.MILITARY_ENFORCEMENT]: {
    baseEffectiveness: 80,
    economicImpact: 0.95,
    taxImpact: 1.25,
    stabilityImpact: -8,
    legitimacyImpact: -15
  }
};

// Synergy definitions
const SYNERGY_COMBINATIONS: Array<{
  components: ComponentType[];
  economicBonus: number;
  taxBonus: number;
  stabilityBonus: number;
  description: string;
}> = [
  {
    components: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.PROFESSIONAL_BUREAUCRACY],
    economicBonus: 0.15,
    taxBonus: 0.20,
    stabilityBonus: 10,
    description: 'Optimal policy implementation synergy'
  },
  {
    components: [ComponentType.RULE_OF_LAW, ComponentType.INDEPENDENT_JUDICIARY],
    economicBonus: 0.12,
    taxBonus: 0.15,
    stabilityBonus: 15,
    description: 'Strong institutional framework synergy'
  },
  {
    components: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.ELECTORAL_LEGITIMACY],
    economicBonus: 0.08,
    taxBonus: 0.10,
    stabilityBonus: 12,
    description: 'Democratic legitimacy synergy'
  },
  {
    components: [ComponentType.PERFORMANCE_LEGITIMACY, ComponentType.TECHNOCRATIC_AGENCIES],
    economicBonus: 0.18,
    taxBonus: 0.12,
    stabilityBonus: 8,
    description: 'Results-driven governance synergy'
  }
];

// Conflict definitions
const CONFLICT_COMBINATIONS: Array<{
  components: ComponentType[];
  economicPenalty: number;
  taxPenalty: number;
  stabilityPenalty: number;
  description: string;
}> = [
  {
    components: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.SURVEILLANCE_SYSTEM],
    economicPenalty: 0.10,
    taxPenalty: 0.05,
    stabilityPenalty: 8,
    description: 'Democratic surveillance conflict'
  },
  {
    components: [ComponentType.MILITARY_ADMINISTRATION, ComponentType.ELECTORAL_LEGITIMACY],
    economicPenalty: 0.08,
    taxPenalty: 0.00,
    stabilityPenalty: 12,
    description: 'Military-electoral tension'
  },
  {
    components: [ComponentType.PARTISAN_INSTITUTIONS, ComponentType.RULE_OF_LAW],
    economicPenalty: 0.15,
    taxPenalty: 0.10,
    stabilityPenalty: 15,
    description: 'Partisan capture of institutions'
  }
];

/**
 * Calculate economic modifiers from atomic components (client-safe)
 */
export function calculateClientAtomicEconomicImpact(
  components: ComponentType[],
  baseGdpPerCapita: number = 15000,
  baseTaxRevenue: number = 0.2
): ClientAtomicEconomicModifiers {
  if (components.length === 0) {
    return {
      taxCollectionMultiplier: 1.0,
      gdpGrowthModifier: 1.0,
      stabilityBonus: 0,
      innovationMultiplier: 1.0,
      internationalTradeBonus: 0,
      governmentEfficiencyMultiplier: 1.0,
      gdpImpact: 0,
      stabilityIndex: 50,
      internationalStanding: 50,
      taxEfficiency: 1.0
    };
  }

  let modifiers: ClientAtomicEconomicModifiers = {
    taxCollectionMultiplier: 1.0,
    gdpGrowthModifier: 1.0,
    stabilityBonus: 0,
    innovationMultiplier: 1.0,
    internationalTradeBonus: 0,
    governmentEfficiencyMultiplier: 1.0,
    gdpImpact: 0,
    stabilityIndex: 50,
    internationalStanding: 50,
    taxEfficiency: 1.0
  };

  // Apply base component effects
  components.forEach(component => {
    const data = COMPONENT_EFFECTIVENESS[component];
    if (data) {
      modifiers.taxCollectionMultiplier *= data.taxImpact;
      modifiers.gdpGrowthModifier *= data.economicImpact;
      modifiers.stabilityBonus += data.stabilityImpact;
      modifiers.governmentEfficiencyMultiplier *= (data.baseEffectiveness / 70); // Normalize around 70

      // Innovation effects (primarily from technocratic components)
      if ([ComponentType.TECHNOCRATIC_PROCESS, ComponentType.TECHNOCRATIC_AGENCIES].includes(component as any)) {
        modifiers.innovationMultiplier *= 1.15;
      }

      // International trade bonuses (from rule of law, stability)
      if ([ComponentType.RULE_OF_LAW, ComponentType.INDEPENDENT_JUDICIARY].includes(component as any)) {
        modifiers.internationalTradeBonus += 5;
      }
    }
  });

  // Apply synergy bonuses
  SYNERGY_COMBINATIONS.forEach(synergy => {
    if (synergy.components.every(comp => components.includes(comp))) {
      modifiers.gdpGrowthModifier *= (1 + synergy.economicBonus);
      modifiers.taxCollectionMultiplier *= (1 + synergy.taxBonus);
      modifiers.stabilityBonus += synergy.stabilityBonus;
    }
  });

  // Apply conflict penalties
  CONFLICT_COMBINATIONS.forEach(conflict => {
    if (conflict.components.every(comp => components.includes(comp))) {
      modifiers.gdpGrowthModifier *= (1 - conflict.economicPenalty);
      modifiers.taxCollectionMultiplier *= (1 - conflict.taxPenalty);
      modifiers.stabilityBonus -= conflict.stabilityPenalty;
    }
  });

  return modifiers;
}

/**
 * Get component effectiveness breakdown (client-safe)
 */
export function getComponentBreakdown(components: ComponentType[]) {
  return components.map(component => ({
    type: component,
    ...COMPONENT_EFFECTIVENESS[component]
  }));
}

/**
 * Detect potential synergies (client-safe)
 */
export function detectPotentialSynergies(components: ComponentType[]) {
  return SYNERGY_COMBINATIONS.filter(synergy =>
    synergy.components.every(comp => components.includes(comp))
  );
}

/**
 * Detect conflicts (client-safe)
 */
export function detectConflicts(components: ComponentType[]) {
  return CONFLICT_COMBINATIONS.filter(conflict =>
    conflict.components.every(comp => components.includes(comp))
  );
}

/**
 * Calculate overall effectiveness score (client-safe)
 */
export function calculateOverallEffectiveness(components: ComponentType[]): number {
  if (components.length === 0) return 0;

  // Base effectiveness
  const baseScore = components.reduce((sum, comp) => {
    return sum + (COMPONENT_EFFECTIVENESS[comp]?.baseEffectiveness || 50);
  }, 0) / components.length;

  // Synergy bonuses
  const synergies = detectPotentialSynergies(components);
  const synergyBonus = synergies.length * 5; // 5 points per synergy

  // Conflict penalties
  const conflicts = detectConflicts(components);
  const conflictPenalty = conflicts.length * 8; // 8 points penalty per conflict

  return Math.max(0, Math.min(100, baseScore + synergyBonus - conflictPenalty));
}