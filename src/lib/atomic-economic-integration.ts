// src/lib/atomic-economic-integration.ts
import { ComponentType, type Country, type GovernmentComponent, type AtomicEffectiveness } from '@prisma/client';
import { getAtomicEffectivenessService } from '~/services/AtomicEffectivenessService';
import { db } from '~/server/db';

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

export async function calculateAtomicEconomicImpact(
  components: ComponentType[],
  baseGdpPerCapita: number,
  baseTaxRevenue: number = 0
): Promise<AtomicEconomicModifiers> {
  const atomicService = getAtomicEffectivenessService(db);
  const componentBreakdown = atomicService.getComponentBreakdown(components);
  
  let modifiers: AtomicEconomicModifiers = {
    taxCollectionMultiplier: 1.0,
    gdpGrowthModifier: 1.0,
    stabilityBonus: 0,
    innovationMultiplier: 1.0,
    internationalTradeBonus: 0,
    governmentEfficiencyMultiplier: 1.0
  };

  // Apply component-specific modifiers
  componentBreakdown.forEach(component => {
    // Tax collection improvements
    modifiers.taxCollectionMultiplier *= component.taxImpact;
    
    // Economic growth modifiers
    modifiers.gdpGrowthModifier *= component.economicImpact;
    
    // Stability improvements (additive)
    modifiers.stabilityBonus += component.stabilityImpact;
    
    // Innovation effects (primarily from technocratic components)
    if ([ComponentType.TECHNOCRATIC_PROCESS, ComponentType.TECHNOCRATIC_AGENCIES].includes(component.type)) {
      modifiers.innovationMultiplier *= 1.15;
    }
    
    // International trade bonuses (from rule of law, stability)
    if ([ComponentType.RULE_OF_LAW, ComponentType.INDEPENDENT_JUDICIARY].includes(component.type)) {
      modifiers.internationalTradeBonus += 5;
    }
    
    // Government efficiency
    modifiers.governmentEfficiencyMultiplier *= (component.baseEffectiveness / 70); // Normalize around 70 as neutral
  });

  // Apply synergy bonuses
  const synergies = atomicService.detectPotentialSynergies(components);
  synergies.forEach(synergy => {
    // Major synergy effects based on the integration guide
    if (synergy.components.includes(ComponentType.TECHNOCRATIC_PROCESS) && 
        synergy.components.includes(ComponentType.PROFESSIONAL_BUREAUCRACY)) {
      modifiers.gdpGrowthModifier *= 1.15; // Additional 15% bonus
      modifiers.innovationMultiplier *= 1.20;
      modifiers.governmentEfficiencyMultiplier *= 1.25;
    }
    
    if (synergy.components.includes(ComponentType.RULE_OF_LAW) && 
        synergy.components.includes(ComponentType.INDEPENDENT_JUDICIARY)) {
      modifiers.internationalTradeBonus += 15;
      modifiers.stabilityBonus += 10;
    }
  });

  // Apply conflict penalties
  const conflicts = atomicService.detectConflicts(components);
  conflicts.forEach(conflict => {
    // Democratic-Surveillance conflict reduces legitimacy and economic confidence
    if (conflict.components.includes(ComponentType.DEMOCRATIC_PROCESS) && 
        conflict.components.includes(ComponentType.SURVEILLANCE_SYSTEM)) {
      modifiers.gdpGrowthModifier *= 0.95; // 5% penalty
      modifiers.internationalTradeBonus -= 10;
    }
  });

  return modifiers;
}

export async function calculateCountryDataWithAtomicEnhancement(
  country: CountryWithAtomicComponents
): Promise<AtomicEnhancedCountryData> {
  // Get atomic effectiveness
  const atomicService = getAtomicEffectivenessService(db);
  
  let atomicEffectiveness: AtomicEffectiveness;
  if (country.usesAtomicGovernment && country.governmentComponents.length > 0) {
    atomicEffectiveness = await atomicService.getCountryEffectiveness(country.id);
  } else {
    // Default effectiveness for non-atomic countries
    atomicEffectiveness = {
      id: '',
      countryId: country.id,
      overallScore: 50,
      taxEffectiveness: 50,
      economicPolicyScore: 50,
      stabilityScore: 50,
      legitimacyScore: 50,
      componentCount: 0,
      synergyBonus: 0,
      conflictPenalty: 0,
      lastCalculated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  // Calculate atomic modifiers
  const activeComponents = country.governmentComponents
    .filter(c => c.isActive)
    .map(c => c.componentType);
    
  const atomicModifiers = await calculateAtomicEconomicImpact(
    activeComponents,
    country.currentGdpPerCapita,
    country.taxRevenueGDPPercent || 0
  );
  
  // Apply atomic enhancements to base metrics
  const baseGdpGrowth = country.adjustedGdpGrowth;
  const baseTaxRevenue = country.taxRevenueGDPPercent || 0;
  
  const enhancedGdpGrowth = baseGdpGrowth * atomicModifiers.gdpGrowthModifier;
  const enhancedTaxRevenue = baseTaxRevenue * atomicModifiers.taxCollectionMultiplier;
  
  // Calculate stability index (0-100 scale)
  const baseStability = 50; // Default stability
  const stabilityIndex = Math.max(0, Math.min(100, 
    baseStability + atomicModifiers.stabilityBonus
  ));
  
  // Government capacity index based on atomic effectiveness
  const governmentCapacityIndex = atomicEffectiveness.overallScore;
  
  // Calculate impact analysis
  const gdpImpactPercent = baseGdpGrowth > 0 ? 
    ((enhancedGdpGrowth - baseGdpGrowth) / baseGdpGrowth) * 100 : 0;
  const taxImpactPercent = baseTaxRevenue > 0 ? 
    ((enhancedTaxRevenue - baseTaxRevenue) / baseTaxRevenue) * 100 : 0;
  const stabilityImpactPoints = atomicModifiers.stabilityBonus;
  
  // Grade overall effectiveness
  let effectivenessGrade = 'F';
  if (atomicEffectiveness.overallScore >= 90) effectivenessGrade = 'A+';
  else if (atomicEffectiveness.overallScore >= 85) effectivenessGrade = 'A';
  else if (atomicEffectiveness.overallScore >= 80) effectivenessGrade = 'A-';
  else if (atomicEffectiveness.overallScore >= 75) effectivenessGrade = 'B+';
  else if (atomicEffectiveness.overallScore >= 70) effectivenessGrade = 'B';
  else if (atomicEffectiveness.overallScore >= 65) effectivenessGrade = 'B-';
  else if (atomicEffectiveness.overallScore >= 60) effectivenessGrade = 'C+';
  else if (atomicEffectiveness.overallScore >= 55) effectivenessGrade = 'C';
  else if (atomicEffectiveness.overallScore >= 50) effectivenessGrade = 'C-';
  else if (atomicEffectiveness.overallScore >= 40) effectivenessGrade = 'D';
  
  return {
    // Base country data
    id: country.id,
    name: country.name,
    currentPopulation: country.currentPopulation,
    currentGdpPerCapita: country.currentGdpPerCapita,
    currentTotalGdp: country.currentTotalGdp,
    adjustedGdpGrowth: country.adjustedGdpGrowth,
    taxRevenueGDPPercent: country.taxRevenueGDPPercent,
    
    // Atomic enhancements
    atomicModifiers,
    atomicEffectiveness,
    enhancedGdpGrowth,
    enhancedTaxRevenue,
    stabilityIndex,
    governmentCapacityIndex,
    
    // Impact analysis
    economicImpactFromAtomic: {
      gdpImpactPercent,
      taxImpactPercent,
      stabilityImpactPoints,
      overallEffectivenessGrade: effectivenessGrade
    }
  };
}

// Helper function to get atomic intelligence recommendations
export async function getAtomicIntelligenceRecommendations(
  countryId: string
): Promise<Array<{
  type: 'component_add' | 'component_improve' | 'synergy_opportunity' | 'conflict_resolution';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImpact: {
    economic: number;
    stability: number;
    legitimacy: number;
  };
}>> {
  const atomicService = getAtomicEffectivenessService(db);
  
  // Get current country data
  const country = await db.country.findUnique({
    where: { id: countryId },
    include: {
      governmentComponents: { where: { isActive: true } },
      atomicEffectiveness: true
    }
  });
  
  if (!country) return [];
  
  const recommendations = [];
  const currentComponents = country.governmentComponents.map(c => c.componentType);
  
  // Check for missing high-impact components
  const highImpactComponents = [
    ComponentType.PROFESSIONAL_BUREAUCRACY,
    ComponentType.RULE_OF_LAW,
    ComponentType.INDEPENDENT_JUDICIARY,
    ComponentType.TECHNOCRATIC_PROCESS
  ];
  
  for (const component of highImpactComponents) {
    if (!currentComponents.includes(component)) {
      const componentData = atomicService.getComponentBreakdown([component])[0];
      if (componentData) {
        recommendations.push({
          type: 'component_add' as const,
          priority: 'high' as const,
          title: `Add ${component.replace(/_/g, ' ')}`,
          description: `Adding this component could significantly improve government effectiveness`,
          expectedImpact: {
            economic: (componentData.economicImpact - 1) * 100,
            stability: componentData.stabilityImpact,
            legitimacy: componentData.legitimacyImpact
          }
        });
      }
    }
  }
  
  return recommendations.slice(0, 10); // Limit to top 10 recommendations
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

export type { AtomicEnhancedCountryData, CountryWithAtomicComponents };