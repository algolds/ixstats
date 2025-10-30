/**
 * Real-time Atomic Effects Integration
 *
 * This module integrates all atomic components (Government, Economic, Tax) into
 * real-time economic calculations, applying modifiers to GDP, tax revenue,
 * employment, inflation, and other key economic indicators.
 */

import { ComponentType, EconomicComponentType, TaxComponentType } from "@prisma/client";
import {
  calculateOverallEffectiveness,
  calculateClientAtomicEconomicImpact,
  detectPotentialSynergies,
  detectConflicts,
} from "./atomic-client-calculations";

export interface RealTimeEffects {
  gdpModifiers: {
    growthRateMultiplier: number;
    baseValueMultiplier: number;
    perCapitaMultiplier: number;
  };
  taxModifiers: {
    revenueMultiplier: number;
    collectionEfficiencyMultiplier: number;
    complianceRateMultiplier: number;
  };
  employmentModifiers: {
    participationRateMultiplier: number;
    unemploymentRateMultiplier: number;
    productivityMultiplier: number;
  };
  inflationModifiers: {
    inflationRateMultiplier: number;
    priceStabilityMultiplier: number;
  };
  stabilityModifiers: {
    overallStabilityMultiplier: number;
    institutionalCapacityMultiplier: number;
    legitimacyMultiplier: number;
  };
  synergies: {
    activeSynergies: Array<{
      name: string;
      description: string;
      effectivenessBonus: number;
      affectedMetrics: string[];
    }>;
    crossBuilderSynergies: Array<{
      id: string;
      description: string;
      effectivenessBonus: number;
      affectedMetrics: string[];
    }>;
  };
  conflicts: Array<{
    name: string;
    description: string;
    effectivenessPenalty: number;
    affectedMetrics: string[];
  }>;
}

export interface AtomicComponentData {
  government: ComponentType[];
  economic: EconomicComponentType[];
  tax: TaxComponentType[];
}

/**
 * Calculate comprehensive real-time effects from all atomic components
 */
export function calculateRealTimeAtomicEffects(
  components: AtomicComponentData,
  baseEconomicData: {
    gdpGrowthRate: number;
    nominalGDP: number;
    gdpPerCapita: number;
    taxRevenueGDPPercent: number;
    unemploymentRate: number;
    inflationRate: number;
    population: number;
  }
): RealTimeEffects {
  const { government, economic, tax } = components;

  // Calculate individual component effectiveness
  const governmentEffectiveness = calculateOverallEffectiveness(government);
  const economicEffectiveness = calculateOverallEffectiveness(economic as any);
  const taxEffectiveness = calculateOverallEffectiveness(tax as any);

  // Calculate economic modifiers from government components
  const governmentEconomicModifiers = calculateClientAtomicEconomicImpact(government);
  const governmentTaxModifiers = governmentEconomicModifiers.taxCollectionMultiplier;
  const governmentStabilityModifiers = governmentEconomicModifiers.stabilityBonus;

  // Calculate synergies and conflicts
  const synergies = detectPotentialSynergies(government);
  const conflicts = detectConflicts(government);

  // Calculate cross-builder synergies (simplified for now)
  const crossBuilderSynergies = calculateCrossBuilderSynergies(government, economic, tax);

  // Apply economic component modifiers
  const economicModifiers = calculateEconomicComponentModifiers(economic);
  const taxComponentModifiers = calculateTaxComponentModifiers(tax);

  // Combine all modifiers
  const combinedModifiers = combineAllModifiers({
    government: {
      gdpGrowthModifier: governmentEconomicModifiers.gdpGrowthModifier,
      gdpBaseModifier: 1.0,
      gdpPerCapitaModifier: 1.0,
      taxRevenueModifier: governmentEconomicModifiers.taxCollectionMultiplier,
      taxCollectionModifier: governmentEconomicModifiers.taxCollectionMultiplier,
      taxComplianceModifier: 1.0,
      employmentParticipationModifier: 1.0,
      unemploymentModifier: 1.0,
      productivityModifier: 1.0,
      inflationModifier: 1.0,
      priceStabilityModifier: 1.0,
    },
    economic: economicModifiers,
    tax: taxComponentModifiers,
    stability: {
      stabilityModifier: 1.0 + governmentStabilityModifiers / 100,
      institutionalModifier: 1.0,
      legitimacyModifier: 1.0,
    },
  });

  return {
    gdpModifiers: {
      growthRateMultiplier: combinedModifiers.gdpGrowthModifier,
      baseValueMultiplier: combinedModifiers.gdpBaseModifier,
      perCapitaMultiplier: combinedModifiers.gdpPerCapitaModifier,
    },
    taxModifiers: {
      revenueMultiplier: combinedModifiers.taxRevenueModifier,
      collectionEfficiencyMultiplier: combinedModifiers.taxCollectionModifier,
      complianceRateMultiplier: combinedModifiers.taxComplianceModifier,
    },
    employmentModifiers: {
      participationRateMultiplier: combinedModifiers.employmentParticipationModifier,
      unemploymentRateMultiplier: combinedModifiers.unemploymentModifier,
      productivityMultiplier: combinedModifiers.productivityModifier,
    },
    inflationModifiers: {
      inflationRateMultiplier: combinedModifiers.inflationModifier,
      priceStabilityMultiplier: combinedModifiers.priceStabilityModifier,
    },
    stabilityModifiers: {
      overallStabilityMultiplier: combinedModifiers.stabilityModifier,
      institutionalCapacityMultiplier: combinedModifiers.institutionalModifier,
      legitimacyMultiplier: combinedModifiers.legitimacyModifier,
    },
    synergies: {
      activeSynergies: synergies.map((synergy) => ({
        name: synergy.description,
        description: synergy.description,
        effectivenessBonus: (synergy.economicBonus + synergy.taxBonus) * 50, // Convert to percentage
        affectedMetrics: ["gdpGrowth", "taxRevenue", "stability"],
      })),
      crossBuilderSynergies: crossBuilderSynergies.map((synergy) => ({
        id: synergy.id,
        description: synergy.description,
        effectivenessBonus: synergy.effectivenessBonus,
        affectedMetrics: synergy.affectedMetrics || [],
      })),
    },
    conflicts: conflicts.map((conflict) => ({
      name: conflict.description,
      description: conflict.description,
      effectivenessPenalty: (conflict.economicPenalty + conflict.taxPenalty) * 50, // Convert to percentage
      affectedMetrics: ["gdpGrowth", "taxRevenue", "stability"],
    })),
  };
}

/**
 * Apply real-time effects to economic data
 */
export function applyRealTimeEffects(
  baseData: {
    gdpGrowthRate: number;
    nominalGDP: number;
    gdpPerCapita: number;
    taxRevenueGDPPercent: number;
    unemploymentRate: number;
    inflationRate: number;
    population: number;
  },
  effects: RealTimeEffects
): {
  enhancedGdpGrowthRate: number;
  enhancedNominalGDP: number;
  enhancedGdpPerCapita: number;
  enhancedTaxRevenueGDPPercent: number;
  enhancedUnemploymentRate: number;
  enhancedInflationRate: number;
  enhancedPopulation: number;
  totalSynergyBonus: number;
  totalConflictPenalty: number;
} {
  // Calculate synergy and conflict bonuses
  const totalSynergyBonus =
    effects.synergies.activeSynergies.reduce(
      (sum, synergy) => sum + synergy.effectivenessBonus,
      0
    ) +
    effects.synergies.crossBuilderSynergies.reduce(
      (sum, synergy) => sum + synergy.effectivenessBonus,
      0
    );

  const totalConflictPenalty = effects.conflicts.reduce(
    (sum, conflict) => sum + conflict.effectivenessPenalty,
    0
  );

  // Apply modifiers with synergy/conflict adjustments
  const synergyMultiplier = 1 + (totalSynergyBonus - totalConflictPenalty) / 100;

  return {
    enhancedGdpGrowthRate:
      baseData.gdpGrowthRate * effects.gdpModifiers.growthRateMultiplier * synergyMultiplier,
    enhancedNominalGDP:
      baseData.nominalGDP * effects.gdpModifiers.baseValueMultiplier * synergyMultiplier,
    enhancedGdpPerCapita:
      baseData.gdpPerCapita * effects.gdpModifiers.perCapitaMultiplier * synergyMultiplier,
    enhancedTaxRevenueGDPPercent:
      baseData.taxRevenueGDPPercent * effects.taxModifiers.revenueMultiplier * synergyMultiplier,
    enhancedUnemploymentRate: Math.max(
      0,
      (baseData.unemploymentRate * effects.employmentModifiers.unemploymentRateMultiplier) /
        synergyMultiplier
    ),
    enhancedInflationRate:
      baseData.inflationRate *
      effects.inflationModifiers.inflationRateMultiplier *
      synergyMultiplier,
    enhancedPopulation: baseData.population, // Population typically not affected by atomic components
    totalSynergyBonus,
    totalConflictPenalty,
  };
}

/**
 * Calculate economic component modifiers
 */
function calculateEconomicComponentModifiers(economicComponents: EconomicComponentType[]): any {
  // This would be implemented based on the economic component effectiveness data
  // For now, return base modifiers
  return {
    gdpGrowthModifier: 1.0,
    gdpBaseModifier: 1.0,
    gdpPerCapitaModifier: 1.0,
    employmentParticipationModifier: 1.0,
    unemploymentModifier: 1.0,
    productivityModifier: 1.0,
    inflationModifier: 1.0,
    priceStabilityModifier: 1.0,
  };
}

/**
 * Calculate tax component modifiers
 */
function calculateTaxComponentModifiers(taxComponents: TaxComponentType[]): any {
  // This would be implemented based on the tax component effectiveness data
  // For now, return base modifiers
  return {
    taxRevenueModifier: 1.0,
    taxCollectionModifier: 1.0,
    taxComplianceModifier: 1.0,
  };
}

/**
 * Calculate cross-builder synergies between different component types
 */
function calculateCrossBuilderSynergies(
  government: ComponentType[],
  economic: EconomicComponentType[],
  tax: TaxComponentType[]
): Array<{
  id: string;
  description: string;
  effectivenessBonus: number;
  affectedMetrics: string[];
}> {
  const synergies = [];

  // Example cross-builder synergies (simplified)
  if (
    government.includes(ComponentType.DEMOCRATIC_PROCESS) &&
    economic.includes(EconomicComponentType.FREE_MARKET_SYSTEM)
  ) {
    synergies.push({
      id: "democracy-free-market",
      description: "Democratic institutions enhance free market efficiency",
      effectivenessBonus: 5,
      affectedMetrics: ["gdpGrowth", "taxRevenue", "stability"],
    });
  }

  if (
    government.includes(ComponentType.PROFESSIONAL_BUREAUCRACY) &&
    tax.includes(TaxComponentType.PROGRESSIVE_TAX)
  ) {
    synergies.push({
      id: "bureaucracy-progressive-tax",
      description:
        "Professional bureaucracy coordination with progressive taxation improves economic stability",
      effectivenessBonus: 3,
      affectedMetrics: ["inflation", "stability", "taxRevenue"],
    });
  }

  return synergies;
}

/**
 * Combine all modifiers from different component types
 */
function combineAllModifiers(modifiers: {
  government: any;
  economic: any;
  tax: any;
  stability: any;
}): any {
  return {
    gdpGrowthModifier:
      (modifiers.government.gdpGrowthModifier || 1.0) *
      (modifiers.economic.gdpGrowthModifier || 1.0),
    gdpBaseModifier:
      (modifiers.government.gdpBaseModifier || 1.0) * (modifiers.economic.gdpBaseModifier || 1.0),
    gdpPerCapitaModifier:
      (modifiers.government.gdpPerCapitaModifier || 1.0) *
      (modifiers.economic.gdpPerCapitaModifier || 1.0),
    taxRevenueModifier:
      (modifiers.government.taxRevenueModifier || 1.0) * (modifiers.tax.taxRevenueModifier || 1.0),
    taxCollectionModifier:
      (modifiers.government.taxCollectionModifier || 1.0) *
      (modifiers.tax.taxCollectionModifier || 1.0),
    taxComplianceModifier:
      (modifiers.government.taxComplianceModifier || 1.0) *
      (modifiers.tax.taxComplianceModifier || 1.0),
    employmentParticipationModifier:
      (modifiers.government.employmentParticipationModifier || 1.0) *
      (modifiers.economic.employmentParticipationModifier || 1.0),
    unemploymentModifier:
      (modifiers.government.unemploymentModifier || 1.0) *
      (modifiers.economic.unemploymentModifier || 1.0),
    productivityModifier:
      (modifiers.government.productivityModifier || 1.0) *
      (modifiers.economic.productivityModifier || 1.0),
    inflationModifier:
      (modifiers.government.inflationModifier || 1.0) *
      (modifiers.economic.inflationModifier || 1.0),
    priceStabilityModifier:
      (modifiers.government.priceStabilityModifier || 1.0) *
      (modifiers.economic.priceStabilityModifier || 1.0),
    stabilityModifier: modifiers.stability.stabilityModifier || 1.0,
    institutionalModifier: modifiers.stability.institutionalModifier || 1.0,
    legitimacyModifier: modifiers.stability.legitimacyModifier || 1.0,
  };
}
