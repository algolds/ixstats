// src/lib/atomic-economic-integration.ts
import type { Country, GovernmentComponent, AtomicEffectiveness } from "@prisma/client";

export interface AtomicEconomicModifiers {
  taxCollectionMultiplier: number;
  gdpGrowthModifier: number;
  stabilityBonus: number;
  innovationMultiplier: number;
  internationalTradeBonus: number;
  governmentEfficiencyMultiplier: number;
}

export interface AtomicEnhancedCountryData {
  // Base country data
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  adjustedGdpGrowth: number;
  taxRevenueGDPPercent: number | null;

  // Atomic enhancements
  atomicModifiers: AtomicEconomicModifiers;
  atomicEffectiveness: AtomicEffectiveness;
  enhancedGdpGrowth: number;
  enhancedTaxRevenue: number;
  stabilityIndex: number;
  governmentCapacityIndex: number;

  // Impact analysis
  economicImpactFromAtomic: {
    gdpImpactPercent: number;
    taxImpactPercent: number;
    stabilityImpactPoints: number;
    overallEffectivenessGrade: string;
  };
}

export interface CountryWithAtomicComponents extends Country {
  governmentComponents: GovernmentComponent[];
  atomicEffectiveness?: AtomicEffectiveness | null;
}

// Client-side version of calculateAtomicEconomicImpact
// Synchronous functions for client-side calculations
