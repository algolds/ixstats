// src/lib/atomic-economic-integration.ts
import { ComponentType, type Country, type GovernmentComponent, type AtomicEffectiveness } from '@prisma/client';

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
export function calculateAtomicEconomicImpact(
  components: ComponentType[],
  baseGdpPerCapita: number,
  baseTaxRevenue: number = 0
): AtomicEconomicModifiers {
  let modifiers: AtomicEconomicModifiers = {
    taxCollectionMultiplier: 1.0,
    gdpGrowthModifier: 1.0,
    stabilityBonus: 0,
    innovationMultiplier: 1.0,
    internationalTradeBonus: 0,
    governmentEfficiencyMultiplier: 1.0
  };

  // Apply component-specific modifiers (client-side calculations)
  components.forEach(component => {
    switch (component) {
      case ComponentType.PROFESSIONAL_BUREAUCRACY:
        modifiers.taxCollectionMultiplier *= 1.15;
        modifiers.gdpGrowthModifier *= 1.05;
        modifiers.stabilityBonus += 5;
        modifiers.governmentEfficiencyMultiplier *= 1.10;
        break;
      case ComponentType.RULE_OF_LAW:
        modifiers.gdpGrowthModifier *= 1.10;
        modifiers.stabilityBonus += 15;
        modifiers.internationalTradeBonus += 5;
        break;
      case ComponentType.INDEPENDENT_JUDICIARY:
        modifiers.stabilityBonus += 10;
        modifiers.internationalTradeBonus += 5;
        break;
      case ComponentType.TECHNOCRATIC_AGENCIES:
        modifiers.innovationMultiplier *= 1.15;
        modifiers.governmentEfficiencyMultiplier *= 1.08;
        break;
      case ComponentType.TECHNOCRATIC_PROCESS:
        modifiers.innovationMultiplier *= 1.15;
        modifiers.gdpGrowthModifier *= 1.05;
        break;
      case ComponentType.DEMOCRATIC_PROCESS:
        modifiers.stabilityBonus += 8;
        break;
    }
  });

  // Apply synergy bonuses
  if (components.includes(ComponentType.TECHNOCRATIC_PROCESS) &&
      components.includes(ComponentType.PROFESSIONAL_BUREAUCRACY)) {
    modifiers.gdpGrowthModifier *= 1.15; // Additional 15% bonus
    modifiers.innovationMultiplier *= 1.20;
    modifiers.governmentEfficiencyMultiplier *= 1.25;
  }

  if (components.includes(ComponentType.RULE_OF_LAW) &&
      components.includes(ComponentType.INDEPENDENT_JUDICIARY)) {
    modifiers.internationalTradeBonus += 15;
    modifiers.stabilityBonus += 10;
  }

  // Apply conflict penalties
  if (components.includes(ComponentType.DEMOCRATIC_PROCESS) &&
      components.includes(ComponentType.SURVEILLANCE_SYSTEM)) {
    modifiers.gdpGrowthModifier *= 0.95; // 5% penalty
    modifiers.internationalTradeBonus -= 10;
  }

  return modifiers;
}

// Synchronous functions for client-side calculations
export function calculateAtomicEconomicEffectiveness(
  components: ComponentType[],
  baseEconomicData: {
    gdpPerCapita: number;
    gdpGrowthRate: number;
    inflationRate: number;
    taxRevenueGDPPercent?: number;
  }
): {
  overallScore: number;
  gdpGrowthRate: number;
  inflationRate: number;
  economicStability: number;
  policyEffectiveness: number;
  taxCollectionMultiplier: number;
  stabilityIndex: number;
  governmentCapacityIndex: number;
  recommendedImprovements: string[];
  synergies: ComponentType[];
  conflicts: ComponentType[];
  modifierBreakdown: Array<{
    component: ComponentType;
    effect: string;
    value: number;
  }>;
} {
  // Basic effectiveness calculation based on component synergies
  let overallScore = 50; // Base score
  let gdpGrowthRate = baseEconomicData.gdpGrowthRate || 2.0;
  let inflationRate = baseEconomicData.inflationRate || 2.0;
  let economicStability = 50;
  let policyEffectiveness = 50;
  let taxCollectionMultiplier = 1.0;
  let stabilityIndex = 50;
  let governmentCapacityIndex = 50;

  // Apply basic component bonuses
  for (const component of components) {
    switch (component) {
      case 'PROFESSIONAL_BUREAUCRACY':
        overallScore += 15;
        taxCollectionMultiplier += 0.15;
        governmentCapacityIndex += 20;
        policyEffectiveness += 15;
        break;
      case 'RULE_OF_LAW':
        overallScore += 20;
        gdpGrowthRate += 0.5;
        stabilityIndex += 25;
        economicStability += 20;
        break;
      case 'INDEPENDENT_JUDICIARY':
        overallScore += 10;
        stabilityIndex += 15;
        economicStability += 10;
        break;
      case 'TECHNOCRATIC_AGENCIES':
        overallScore += 12;
        governmentCapacityIndex += 15;
        policyEffectiveness += 12;
        break;
      case 'DEMOCRATIC_PROCESS':
        overallScore += 8;
        stabilityIndex += 10;
        economicStability += 8;
        break;
    }
  }

  const recommendedImprovements = [];
  if (!components.includes(ComponentType.PROFESSIONAL_BUREAUCRACY)) {
    recommendedImprovements.push('Add Professional Bureaucracy for better tax collection');
  }
  if (!components.includes(ComponentType.RULE_OF_LAW)) {
    recommendedImprovements.push('Implement Rule of Law for economic stability');
  }

  // Calculate synergies and conflicts
  const synergies: ComponentType[] = [];
  const conflicts: ComponentType[] = [];
  const modifierBreakdown: Array<{component: ComponentType; effect: string; value: number;}> = [];

  for (const component of components) {
    switch (component) {
      case ComponentType.PROFESSIONAL_BUREAUCRACY:
        synergies.push(ComponentType.RULE_OF_LAW);
        modifierBreakdown.push({ component, effect: 'Tax Collection', value: 15 });
        break;
      case ComponentType.RULE_OF_LAW:
        synergies.push(ComponentType.INDEPENDENT_JUDICIARY);
        modifierBreakdown.push({ component, effect: 'Economic Stability', value: 20 });
        break;
      case ComponentType.AUTOCRATIC_PROCESS:
        conflicts.push(ComponentType.DEMOCRATIC_PROCESS);
        break;
    }
  }

  return {
    overallScore: Math.min(100, overallScore),
    gdpGrowthRate: Math.max(0, gdpGrowthRate),
    inflationRate: Math.max(0, inflationRate),
    economicStability: Math.min(100, economicStability),
    policyEffectiveness: Math.min(100, policyEffectiveness),
    taxCollectionMultiplier,
    stabilityIndex: Math.min(100, stabilityIndex),
    governmentCapacityIndex: Math.min(100, governmentCapacityIndex),
    recommendedImprovements,
    synergies,
    conflicts,
    modifierBreakdown
  };
}

export function getAtomicEconomicRecommendations(
  components: ComponentType[],
  baseEconomicData: {
    gdpPerCapita: number;
    gdpGrowthRate: number;
    inflationRate: number;
    taxRevenueGDPPercent?: number;
  }
): {
  recommendedPolicies: Array<{
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
  }>;
  warnings: Array<{
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
  }>;
  opportunities: Array<{
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
  }>;
} {
  const recommendedPolicies = [];
  const warnings = [];
  const opportunities = [];
  
  if (!components.includes(ComponentType.PROFESSIONAL_BUREAUCRACY)) {
    recommendedPolicies.push({
      priority: 'high' as const,
      title: 'Establish Professional Bureaucracy',
      description: 'Create a merit-based civil service system',
      impact: '+15% tax collection efficiency'
    });
  }
  
  if (!components.includes(ComponentType.RULE_OF_LAW)) {
    recommendedPolicies.push({
      priority: 'high' as const,
      title: 'Strengthen Rule of Law',
      description: 'Ensure consistent and fair application of laws',
      impact: '+10% GDP growth, +25 stability points'
    });
  }
  
  if (!components.includes(ComponentType.INDEPENDENT_JUDICIARY)) {
    opportunities.push({
      priority: 'medium' as const,
      title: 'Establish Independent Judiciary',
      description: 'Create separation between judicial and executive branches',
      impact: '+15 stability points'
    });
  }

  // Add warnings for conflicting components
  if (components.includes(ComponentType.AUTOCRATIC_PROCESS) && components.includes(ComponentType.DEMOCRATIC_PROCESS)) {
    warnings.push({
      priority: 'high' as const,
      title: 'Conflicting Governance Systems',
      description: 'Autocratic and democratic processes may conflict',
      impact: '-10% policy effectiveness'
    });
  }

  return {
    recommendedPolicies: recommendedPolicies.slice(0, 5),
    warnings: warnings.slice(0, 5),
    opportunities: opportunities.slice(0, 5)
  };
}

