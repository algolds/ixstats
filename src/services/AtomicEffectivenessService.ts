// src/services/AtomicEffectivenessService.ts
import { type PrismaClient } from '@prisma/client';
import { ComponentType, type GovernmentComponent, type ComponentSynergy, type AtomicEffectiveness } from '@prisma/client';

interface ComponentEffectiveness {
  type: ComponentType;
  baseEffectiveness: number;
  taxImpact: number;
  economicImpact: number;
  stabilityImpact: number;
  legitimacyImpact: number;
}

interface SynergyRule {
  components: ComponentType[];
  synergyType: 'MULTIPLICATIVE' | 'ADDITIVE' | 'CONFLICTING';
  effectMultiplier: number;
  description: string;
}

export class AtomicEffectivenessService {
  private cache = new Map<string, { data: AtomicEffectiveness; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  constructor(private db: PrismaClient) {}

  // Component effectiveness mappings based on the atomic design document
  private componentEffectiveness: Record<ComponentType, ComponentEffectiveness> = {
    // Power Distribution Components
    [ComponentType.CENTRALIZED_POWER]: {
      type: ComponentType.CENTRALIZED_POWER,
      baseEffectiveness: 75,
      taxImpact: 1.2, // 20% better tax collection
      economicImpact: 1.05,
      stabilityImpact: 10,
      legitimacyImpact: -5 // Centralization can reduce legitimacy
    },
    [ComponentType.FEDERAL_SYSTEM]: {
      type: ComponentType.FEDERAL_SYSTEM,
      baseEffectiveness: 70,
      taxImpact: 0.95,
      economicImpact: 1.08,
      stabilityImpact: 5,
      legitimacyImpact: 10
    },
    [ComponentType.CONFEDERATE_SYSTEM]: {
      type: ComponentType.CONFEDERATE_SYSTEM,
      baseEffectiveness: 60,
      taxImpact: 0.85,
      economicImpact: 1.02,
      stabilityImpact: -5,
      legitimacyImpact: 15
    },
    [ComponentType.UNITARY_SYSTEM]: {
      type: ComponentType.UNITARY_SYSTEM,
      baseEffectiveness: 72,
      taxImpact: 1.15,
      economicImpact: 1.06,
      stabilityImpact: 8,
      legitimacyImpact: 2
    },

    // Decision Process Components
    [ComponentType.DEMOCRATIC_PROCESS]: {
      type: ComponentType.DEMOCRATIC_PROCESS,
      baseEffectiveness: 68,
      taxImpact: 1.0,
      economicImpact: 1.03,
      stabilityImpact: 5,
      legitimacyImpact: 25
    },
    [ComponentType.AUTOCRATIC_PROCESS]: {
      type: ComponentType.AUTOCRATIC_PROCESS,
      baseEffectiveness: 75,
      taxImpact: 1.25,
      economicImpact: 1.08,
      stabilityImpact: 15,
      legitimacyImpact: -15
    },
    [ComponentType.TECHNOCRATIC_PROCESS]: {
      type: ComponentType.TECHNOCRATIC_PROCESS,
      baseEffectiveness: 85,
      taxImpact: 1.15,
      economicImpact: 1.25, // 25% economic boost from expert decisions
      stabilityImpact: 12,
      legitimacyImpact: 5
    },
    [ComponentType.CONSENSUS_PROCESS]: {
      type: ComponentType.CONSENSUS_PROCESS,
      baseEffectiveness: 60,
      taxImpact: 0.9,
      economicImpact: 0.95,
      stabilityImpact: 20,
      legitimacyImpact: 20
    },
    [ComponentType.OLIGARCHIC_PROCESS]: {
      type: ComponentType.OLIGARCHIC_PROCESS,
      baseEffectiveness: 70,
      taxImpact: 1.1,
      economicImpact: 1.1,
      stabilityImpact: 5,
      legitimacyImpact: -10
    },

    // Legitimacy Sources
    [ComponentType.ELECTORAL_LEGITIMACY]: {
      type: ComponentType.ELECTORAL_LEGITIMACY,
      baseEffectiveness: 65,
      taxImpact: 1.05,
      economicImpact: 1.08,
      stabilityImpact: 10,
      legitimacyImpact: 30
    },
    [ComponentType.TRADITIONAL_LEGITIMACY]: {
      type: ComponentType.TRADITIONAL_LEGITIMACY,
      baseEffectiveness: 70,
      taxImpact: 1.1,
      economicImpact: 0.98,
      stabilityImpact: 25,
      legitimacyImpact: 20
    },
    [ComponentType.PERFORMANCE_LEGITIMACY]: {
      type: ComponentType.PERFORMANCE_LEGITIMACY,
      baseEffectiveness: 80,
      taxImpact: 1.2,
      economicImpact: 1.15,
      stabilityImpact: 15,
      legitimacyImpact: 15
    },
    [ComponentType.CHARISMATIC_LEGITIMACY]: {
      type: ComponentType.CHARISMATIC_LEGITIMACY,
      baseEffectiveness: 75,
      taxImpact: 1.15,
      economicImpact: 1.1,
      stabilityImpact: 10,
      legitimacyImpact: 25
    },
    [ComponentType.RELIGIOUS_LEGITIMACY]: {
      type: ComponentType.RELIGIOUS_LEGITIMACY,
      baseEffectiveness: 72,
      taxImpact: 1.12,
      economicImpact: 1.0,
      stabilityImpact: 20,
      legitimacyImpact: 18
    },

    // Institution Types
    [ComponentType.PROFESSIONAL_BUREAUCRACY]: {
      type: ComponentType.PROFESSIONAL_BUREAUCRACY,
      baseEffectiveness: 85,
      taxImpact: 1.30, // 30% improvement as per design doc
      economicImpact: 1.15,
      stabilityImpact: 15,
      legitimacyImpact: 10
    },
    [ComponentType.MILITARY_ADMINISTRATION]: {
      type: ComponentType.MILITARY_ADMINISTRATION,
      baseEffectiveness: 78,
      taxImpact: 1.25,
      economicImpact: 1.05,
      stabilityImpact: 20,
      legitimacyImpact: -5
    },
    [ComponentType.INDEPENDENT_JUDICIARY]: {
      type: ComponentType.INDEPENDENT_JUDICIARY,
      baseEffectiveness: 80,
      taxImpact: 1.05,
      economicImpact: 1.12,
      stabilityImpact: 25,
      legitimacyImpact: 20
    },
    [ComponentType.PARTISAN_INSTITUTIONS]: {
      type: ComponentType.PARTISAN_INSTITUTIONS,
      baseEffectiveness: 65,
      taxImpact: 1.08,
      economicImpact: 1.02,
      stabilityImpact: -5,
      legitimacyImpact: 5
    },
    [ComponentType.TECHNOCRATIC_AGENCIES]: {
      type: ComponentType.TECHNOCRATIC_AGENCIES,
      baseEffectiveness: 82,
      taxImpact: 1.18,
      economicImpact: 1.20,
      stabilityImpact: 12,
      legitimacyImpact: 8
    },

    // Control Mechanisms
    [ComponentType.RULE_OF_LAW]: {
      type: ComponentType.RULE_OF_LAW,
      baseEffectiveness: 85,
      taxImpact: 1.15,
      economicImpact: 1.18,
      stabilityImpact: 30,
      legitimacyImpact: 25
    },
    [ComponentType.SURVEILLANCE_SYSTEM]: {
      type: ComponentType.SURVEILLANCE_SYSTEM,
      baseEffectiveness: 78,
      taxImpact: 1.20,
      economicImpact: 1.05,
      stabilityImpact: 15,
      legitimacyImpact: -15
    },
    [ComponentType.ECONOMIC_INCENTIVES]: {
      type: ComponentType.ECONOMIC_INCENTIVES,
      baseEffectiveness: 73,
      taxImpact: 1.08,
      economicImpact: 1.15,
      stabilityImpact: 5,
      legitimacyImpact: 8
    },
    [ComponentType.SOCIAL_PRESSURE]: {
      type: ComponentType.SOCIAL_PRESSURE,
      baseEffectiveness: 68,
      taxImpact: 1.05,
      economicImpact: 1.02,
      stabilityImpact: 8,
      legitimacyImpact: -5
    },
    [ComponentType.MILITARY_ENFORCEMENT]: {
      type: ComponentType.MILITARY_ENFORCEMENT,
      baseEffectiveness: 80,
      taxImpact: 1.30,
      economicImpact: 1.02,
      stabilityImpact: 25,
      legitimacyImpact: -20
    }
  };

  // Predefined synergies based on the atomic design document
  private synergyRules: SynergyRule[] = [
    {
      components: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.PROFESSIONAL_BUREAUCRACY, ComponentType.PERFORMANCE_LEGITIMACY],
      synergyType: 'MULTIPLICATIVE',
      effectMultiplier: 1.5,
      description: 'Technocratic Efficiency State: Expert-driven governance with professional implementation creates highly effective administration'
    },
    {
      components: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.INDEPENDENT_JUDICIARY, ComponentType.RULE_OF_LAW],
      synergyType: 'MULTIPLICATIVE',
      effectMultiplier: 1.4,
      description: 'Democratic Institutional State: Democratic mandate + independent institutions creates strong rule of law'
    },
    {
      components: [ComponentType.CENTRALIZED_POWER, ComponentType.AUTOCRATIC_PROCESS, ComponentType.SURVEILLANCE_SYSTEM],
      synergyType: 'MULTIPLICATIVE',
      effectMultiplier: 1.6,
      description: 'Authoritarian Control State: Centralized autocracy with surveillance creates rapid response but may damage legitimacy'
    },
    {
      components: [ComponentType.PROFESSIONAL_BUREAUCRACY, ComponentType.TECHNOCRATIC_AGENCIES],
      synergyType: 'ADDITIVE',
      effectMultiplier: 1.25,
      description: 'Expert Administration: Professional bureaucracy enhanced by technocratic agencies'
    },
    {
      components: [ComponentType.RULE_OF_LAW, ComponentType.INDEPENDENT_JUDICIARY],
      synergyType: 'MULTIPLICATIVE',
      effectMultiplier: 1.3,
      description: 'Strong Legal Framework: Independent judiciary enforcing rule of law creates maximum institutional credibility'
    }
  ];

  // Conflict rules
  private conflictRules: SynergyRule[] = [
    {
      components: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.SURVEILLANCE_SYSTEM],
      synergyType: 'CONFLICTING',
      effectMultiplier: 0.7,
      description: 'Democratic-Surveillance Conflict: Democratic legitimacy undermined by extensive surveillance'
    },
    {
      components: [ComponentType.CONSENSUS_PROCESS, ComponentType.AUTOCRATIC_PROCESS],
      synergyType: 'CONFLICTING',
      effectMultiplier: 0.5,
      description: 'Process Conflict: Consensus and autocratic decision-making are fundamentally incompatible'
    }
  ];

  async getCountryEffectiveness(countryId: string, useCache: boolean = true): Promise<AtomicEffectiveness> {
    if (useCache) {
      const cached = this.cache.get(countryId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }
    
    const effectiveness = await this.calculateEffectiveness(countryId);
    this.cache.set(countryId, { data: effectiveness, timestamp: Date.now() });
    
    return effectiveness;
  }

  async calculateEffectiveness(countryId: string): Promise<AtomicEffectiveness> {
    // Get components and synergies from database
    const components = await this.db.governmentComponent.findMany({
      where: { countryId, isActive: true }
    });
    
    const existingSynergies = await this.db.componentSynergy.findMany({
      where: { countryId }
    });
    
    if (components.length === 0) {
      // Return default values if no atomic components
      return {
        id: '',
        countryId,
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
    
    // Calculate base scores
    const componentTypes = components.map(c => c.componentType);
    const baseScores = this.calculateBaseScores(componentTypes);
    
    // Detect and apply synergies/conflicts
    const { synergyBonus, conflictPenalty, detectedSynergies } = this.calculateSynergyEffects(componentTypes);
    
    // Apply modifiers to base scores
    const finalScores = {
      overallScore: Math.max(0, Math.min(100, baseScores.overall + synergyBonus - conflictPenalty)),
      taxEffectiveness: Math.max(0, Math.min(100, baseScores.tax * (1 + synergyBonus / 100 - conflictPenalty / 100))),
      economicPolicyScore: Math.max(0, Math.min(100, baseScores.economic * (1 + synergyBonus / 100 - conflictPenalty / 100))),
      stabilityScore: Math.max(0, Math.min(100, baseScores.stability + synergyBonus - conflictPenalty)),
      legitimacyScore: Math.max(0, Math.min(100, baseScores.legitimacy + synergyBonus - conflictPenalty))
    };
    
    // Store or update in database
    const effectivenessData = await this.db.atomicEffectiveness.upsert({
      where: { countryId },
      update: {
        overallScore: finalScores.overallScore,
        taxEffectiveness: finalScores.taxEffectiveness,
        economicPolicyScore: finalScores.economicPolicyScore,
        stabilityScore: finalScores.stabilityScore,
        legitimacyScore: finalScores.legitimacyScore,
        componentCount: components.length,
        synergyBonus,
        conflictPenalty,
        lastCalculated: new Date(),
        updatedAt: new Date()
      },
      create: {
        countryId,
        overallScore: finalScores.overallScore,
        taxEffectiveness: finalScores.taxEffectiveness,
        economicPolicyScore: finalScores.economicPolicyScore,
        stabilityScore: finalScores.stabilityScore,
        legitimacyScore: finalScores.legitimacyScore,
        componentCount: components.length,
        synergyBonus,
        conflictPenalty,
        lastCalculated: new Date()
      }
    });
    
    // Create synergies in database if they don't exist
    for (const synergy of detectedSynergies) {
      await this.createSynergyIfNotExists(countryId, synergy);
    }
    
    return effectivenessData;
  }

  private calculateBaseScores(componentTypes: ComponentType[]) {
    let totalEffectiveness = 0;
    let totalTaxImpact = 1;
    let totalEconomicImpact = 1;
    let totalStabilityImpact = 0;
    let totalLegitimacyImpact = 0;
    
    componentTypes.forEach(componentType => {
      const effectiveness = this.componentEffectiveness[componentType];
      if (effectiveness) {
        totalEffectiveness += effectiveness.baseEffectiveness;
        totalTaxImpact *= effectiveness.taxImpact;
        totalEconomicImpact *= effectiveness.economicImpact;
        totalStabilityImpact += effectiveness.stabilityImpact;
        totalLegitimacyImpact += effectiveness.legitimacyImpact;
      }
    });
    
    const averageEffectiveness = componentTypes.length > 0 ? totalEffectiveness / componentTypes.length : 50;
    
    return {
      overall: averageEffectiveness,
      tax: Math.min(100, 50 * totalTaxImpact),
      economic: Math.min(100, 50 * totalEconomicImpact),
      stability: Math.max(0, Math.min(100, 50 + totalStabilityImpact)),
      legitimacy: Math.max(0, Math.min(100, 50 + totalLegitimacyImpact))
    };
  }

  private calculateSynergyEffects(componentTypes: ComponentType[]) {
    let synergyBonus = 0;
    let conflictPenalty = 0;
    const detectedSynergies: SynergyRule[] = [];
    
    // Check for synergies
    for (const rule of this.synergyRules) {
      const hasAllComponents = rule.components.every(comp => componentTypes.includes(comp));
      if (hasAllComponents) {
        detectedSynergies.push(rule);
        const bonus = (rule.effectMultiplier - 1) * 10;
        synergyBonus += bonus;
      }
    }
    
    // Check for conflicts
    for (const rule of this.conflictRules) {
      const hasAllComponents = rule.components.every(comp => componentTypes.includes(comp));
      if (hasAllComponents) {
        detectedSynergies.push(rule);
        const penalty = (1 - rule.effectMultiplier) * 10;
        conflictPenalty += penalty;
      }
    }
    
    return { synergyBonus, conflictPenalty, detectedSynergies };
  }

  private async createSynergyIfNotExists(countryId: string, synergy: SynergyRule) {
    // For simplicity, we'll create a synergy between the first two components
    if (synergy.components.length < 2) return;
    
    const [primaryType, secondaryType] = synergy.components;
    
    const primaryComponent = await this.db.governmentComponent.findFirst({
      where: { countryId, componentType: primaryType, isActive: true }
    });
    
    const secondaryComponent = await this.db.governmentComponent.findFirst({
      where: { countryId, componentType: secondaryType, isActive: true }
    });
    
    if (!primaryComponent || !secondaryComponent) return;
    
    const existingSynergy = await this.db.componentSynergy.findFirst({
      where: {
        countryId,
        primaryComponentId: primaryComponent.id,
        secondaryComponentId: secondaryComponent.id
      }
    });
    
    if (!existingSynergy) {
      await this.db.componentSynergy.create({
        data: {
          countryId,
          primaryComponentId: primaryComponent.id,
          secondaryComponentId: secondaryComponent.id,
          synergyType: synergy.synergyType,
          effectMultiplier: synergy.effectMultiplier,
          description: synergy.description
        }
      });
    }
  }

  invalidateCache(countryId: string): void {
    this.cache.delete(countryId);
  }

  clearCache(): void {
    this.cache.clear();
  }

  // Helper method to get component effectiveness breakdown
  getComponentBreakdown(componentTypes: ComponentType[]): ComponentEffectiveness[] {
    return componentTypes.map(type => this.componentEffectiveness[type]).filter(Boolean);
  }

  // Helper method to detect potential synergies for a given set of components
  detectPotentialSynergies(componentTypes: ComponentType[]): SynergyRule[] {
    return this.synergyRules.filter(rule => 
      rule.components.every(comp => componentTypes.includes(comp))
    );
  }

  // Helper method to detect conflicts
  detectConflicts(componentTypes: ComponentType[]): SynergyRule[] {
    return this.conflictRules.filter(rule => 
      rule.components.every(comp => componentTypes.includes(comp))
    );
  }
}

// Export a singleton instance for use throughout the application
let atomicEffectivenessService: AtomicEffectivenessService | null = null;

export function getAtomicEffectivenessService(db: PrismaClient): AtomicEffectivenessService {
  if (!atomicEffectivenessService) {
    atomicEffectivenessService = new AtomicEffectivenessService(db);
  }
  return atomicEffectivenessService;
}

export type { ComponentEffectiveness, SynergyRule };