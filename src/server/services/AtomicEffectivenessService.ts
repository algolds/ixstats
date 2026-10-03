import { type PrismaClient, ComponentType, type AtomicEffectiveness } from "@prisma/client";
import { clamp } from "~/lib/utils/math";

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
  synergyType: "MULTIPLICATIVE" | "ADDITIVE" | "CONFLICTING";
  effectMultiplier: number;
  description: string;
}

class AtomicEffectivenessService {
  private cache = new Map<string, { data: AtomicEffectiveness; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private db: PrismaClient) {}

  // Component effectiveness mappings based on the atomic design document.
  // Columns: type, baseEffectiveness, taxImpact, economicImpact, stabilityImpact, legitimacyImpact.
  private componentEffectiveness: Partial<Record<ComponentType, ComponentEffectiveness>> =
    Object.fromEntries(
      (
        [
          // Power Distribution Components
          [ComponentType.CENTRALIZED_POWER, 75, 1.2, 1.05, 10, -5],
          [ComponentType.FEDERAL_SYSTEM, 70, 0.95, 1.08, 5, 10],
          [ComponentType.CONFEDERATE_SYSTEM, 60, 0.85, 1.02, -5, 15],
          [ComponentType.UNITARY_SYSTEM, 72, 1.15, 1.06, 8, 2],
          // Decision Process Components
          [ComponentType.DEMOCRATIC_PROCESS, 68, 1.0, 1.03, 5, 25],
          [ComponentType.AUTOCRATIC_PROCESS, 75, 1.25, 1.08, 15, -15],
          [ComponentType.TECHNOCRATIC_PROCESS, 85, 1.15, 1.25, 12, 5],
          [ComponentType.CONSENSUS_PROCESS, 60, 0.9, 0.95, 20, 20],
          [ComponentType.OLIGARCHIC_PROCESS, 70, 1.1, 1.1, 5, -10],
          // Legitimacy Sources
          [ComponentType.ELECTORAL_LEGITIMACY, 65, 1.05, 1.08, 10, 30],
          [ComponentType.TRADITIONAL_LEGITIMACY, 70, 1.1, 0.98, 25, 20],
          [ComponentType.PERFORMANCE_LEGITIMACY, 80, 1.2, 1.15, 15, 15],
          [ComponentType.CHARISMATIC_LEGITIMACY, 75, 1.15, 1.1, 10, 25],
          [ComponentType.RELIGIOUS_LEGITIMACY, 72, 1.12, 1.0, 20, 18],
          [ComponentType.INSTITUTIONAL_LEGITIMACY, 83, 1.18, 1.12, 15, 22],
          // Institution Types
          [ComponentType.PROFESSIONAL_BUREAUCRACY, 85, 1.3, 1.15, 15, 10],
          [ComponentType.MILITARY_ADMINISTRATION, 78, 1.25, 1.05, 20, -5],
          [ComponentType.INDEPENDENT_JUDICIARY, 80, 1.05, 1.12, 25, 20],
          [ComponentType.PARTISAN_INSTITUTIONS, 65, 1.08, 1.02, -5, 5],
          [ComponentType.TECHNOCRATIC_AGENCIES, 82, 1.18, 1.2, 12, 8],
          // Control Mechanisms
          [ComponentType.RULE_OF_LAW, 85, 1.15, 1.18, 30, 25],
          [ComponentType.SURVEILLANCE_SYSTEM, 78, 1.2, 1.05, 15, -15],
          [ComponentType.ECONOMIC_INCENTIVES, 73, 1.08, 1.15, 5, 8],
          [ComponentType.SOCIAL_PRESSURE, 68, 1.05, 1.02, 8, -5],
          [ComponentType.MILITARY_ENFORCEMENT, 80, 1.3, 1.02, 25, -20],
          // New Government Type Components
          [ComponentType.DIGITAL_GOVERNMENT, 85, 1.35, 1.22, 15, 12],
          [ComponentType.MINIMAL_GOVERNMENT, 60, 0.8, 1.15, 5, 10],
          [ComponentType.PRIVATE_SECTOR_LEADERSHIP, 75, 0.95, 1.2, 8, 5],
          [ComponentType.SOCIAL_DEMOCRACY, 78, 1.15, 1.1, 18, 22],
          [ComponentType.COMPREHENSIVE_WELFARE, 72, 1.1, 1.05, 15, 18],
          [ComponentType.PUBLIC_SECTOR_LEADERSHIP, 70, 1.2, 1.08, 12, 8],
          [ComponentType.ENVIRONMENTAL_FOCUS, 68, 0.95, 1.12, 10, 15],
          [ComponentType.ECONOMIC_PLANNING, 82, 1.25, 1.18, 15, 5],
          [ComponentType.DEVELOPMENTAL_STATE, 83, 1.22, 1.25, 18, 10],
          [ComponentType.WORKER_PROTECTION, 65, 0.9, 1.05, 8, 15],
          [ComponentType.MERITOCRATIC_SYSTEM, 88, 1.3, 1.2, 20, 18],
          [ComponentType.REGIONAL_DEVELOPMENT, 67, 0.92, 1.12, 10, 12],
        ] as const
      ).map(
        ([
          type,
          baseEffectiveness,
          taxImpact,
          economicImpact,
          stabilityImpact,
          legitimacyImpact,
        ]) => [
          type,
          { type, baseEffectiveness, taxImpact, economicImpact, stabilityImpact, legitimacyImpact },
        ]
      )
    ) as Partial<Record<ComponentType, ComponentEffectiveness>>;

  // Predefined synergies based on the atomic design document
  private synergyRules: SynergyRule[] = [
    {
      components: [
        ComponentType.TECHNOCRATIC_PROCESS,
        ComponentType.PROFESSIONAL_BUREAUCRACY,
        ComponentType.PERFORMANCE_LEGITIMACY,
      ],
      synergyType: "MULTIPLICATIVE",
      effectMultiplier: 1.5,
      description:
        "Technocratic Efficiency State: Expert-driven governance with professional implementation creates highly effective administration",
    },
    {
      components: [
        ComponentType.DEMOCRATIC_PROCESS,
        ComponentType.INDEPENDENT_JUDICIARY,
        ComponentType.RULE_OF_LAW,
      ],
      synergyType: "MULTIPLICATIVE",
      effectMultiplier: 1.4,
      description:
        "Democratic Institutional State: Democratic mandate + independent institutions creates strong rule of law",
    },
    {
      components: [
        ComponentType.CENTRALIZED_POWER,
        ComponentType.AUTOCRATIC_PROCESS,
        ComponentType.SURVEILLANCE_SYSTEM,
      ],
      synergyType: "MULTIPLICATIVE",
      effectMultiplier: 1.6,
      description:
        "Authoritarian Control State: Centralized autocracy with surveillance creates rapid response but may damage legitimacy",
    },
    {
      components: [ComponentType.PROFESSIONAL_BUREAUCRACY, ComponentType.TECHNOCRATIC_AGENCIES],
      synergyType: "ADDITIVE",
      effectMultiplier: 1.25,
      description:
        "Expert Administration: Professional bureaucracy enhanced by technocratic agencies",
    },
    {
      components: [ComponentType.RULE_OF_LAW, ComponentType.INDEPENDENT_JUDICIARY],
      synergyType: "MULTIPLICATIVE",
      effectMultiplier: 1.3,
      description:
        "Strong Legal Framework: Independent judiciary enforcing rule of law creates maximum institutional credibility",
    },
  ];

  // Conflict rules
  private conflictRules: SynergyRule[] = [
    {
      components: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.SURVEILLANCE_SYSTEM],
      synergyType: "CONFLICTING",
      effectMultiplier: 0.7,
      description:
        "Democratic-Surveillance Conflict: Democratic legitimacy undermined by extensive surveillance",
    },
    {
      components: [ComponentType.CONSENSUS_PROCESS, ComponentType.AUTOCRATIC_PROCESS],
      synergyType: "CONFLICTING",
      effectMultiplier: 0.5,
      description:
        "Process Conflict: Consensus and autocratic decision-making are fundamentally incompatible",
    },
  ];

  async getCountryEffectiveness(
    countryId: string,
    useCache: boolean = true
  ): Promise<AtomicEffectiveness> {
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
    const components = await this.db.governmentComponent.findMany({
      where: { countryId, isActive: true },
    });

    if (components.length === 0) {
      // Return default values if no atomic components
      return {
        id: "",
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
        updatedAt: new Date(),
      };
    }

    // Calculate base scores
    const componentTypes = components.map((c) => c.componentType);
    const baseScores = this.calculateBaseScores(componentTypes);

    // Detect and apply synergies/conflicts
    const { synergyBonus, conflictPenalty, detectedSynergies } =
      this.calculateSynergyEffects(componentTypes);

    // Apply modifiers to base scores
    const additive = (score: number) => clamp(score + synergyBonus - conflictPenalty, 0, 100);
    const relative = (score: number) =>
      clamp(score * (1 + synergyBonus / 100 - conflictPenalty / 100), 0, 100);
    const scoreData = {
      overallScore: additive(baseScores.overall),
      taxEffectiveness: relative(baseScores.tax),
      economicPolicyScore: relative(baseScores.economic),
      stabilityScore: additive(baseScores.stability),
      legitimacyScore: additive(baseScores.legitimacy),
      componentCount: components.length,
      synergyBonus,
      conflictPenalty,
      lastCalculated: new Date(),
    };

    const effectivenessData = await this.db.atomicEffectiveness.upsert({
      where: { countryId },
      update: { ...scoreData, updatedAt: new Date() },
      create: { countryId, ...scoreData },
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

    componentTypes.forEach((componentType) => {
      const effectiveness = this.componentEffectiveness[componentType];
      if (effectiveness) {
        totalEffectiveness += effectiveness.baseEffectiveness;
        totalTaxImpact *= effectiveness.taxImpact;
        totalEconomicImpact *= effectiveness.economicImpact;
        totalStabilityImpact += effectiveness.stabilityImpact;
        totalLegitimacyImpact += effectiveness.legitimacyImpact;
      }
    });

    const averageEffectiveness =
      componentTypes.length > 0 ? totalEffectiveness / componentTypes.length : 50;

    return {
      overall: averageEffectiveness,
      tax: Math.min(100, 50 * totalTaxImpact),
      economic: Math.min(100, 50 * totalEconomicImpact),
      stability: Math.max(0, Math.min(100, 50 + totalStabilityImpact)),
      legitimacy: Math.max(0, Math.min(100, 50 + totalLegitimacyImpact)),
    };
  }

  private calculateSynergyEffects(componentTypes: ComponentType[]) {
    let synergyBonus = 0;
    let conflictPenalty = 0;
    const detectedSynergies: SynergyRule[] = [];

    const matches = (rule: SynergyRule) =>
      rule.components.every((comp) => componentTypes.includes(comp));

    for (const rule of this.synergyRules.filter(matches)) {
      detectedSynergies.push(rule);
      synergyBonus += (rule.effectMultiplier - 1) * 10;
    }

    for (const rule of this.conflictRules.filter(matches)) {
      detectedSynergies.push(rule);
      conflictPenalty += (1 - rule.effectMultiplier) * 10;
    }

    return { synergyBonus, conflictPenalty, detectedSynergies };
  }

  private async createSynergyIfNotExists(countryId: string, synergy: SynergyRule) {
    // For simplicity, we'll create a synergy between the first two components
    if (synergy.components.length < 2) return;

    const [primaryType, secondaryType] = synergy.components;

    const primaryComponent = await this.db.governmentComponent.findFirst({
      where: { countryId, componentType: primaryType, isActive: true },
    });

    const secondaryComponent = await this.db.governmentComponent.findFirst({
      where: { countryId, componentType: secondaryType, isActive: true },
    });

    if (!primaryComponent || !secondaryComponent) return;

    const existingSynergy = await this.db.componentSynergy.findFirst({
      where: {
        countryId,
        primaryComponentId: primaryComponent.id,
        secondaryComponentId: secondaryComponent.id,
      },
    });

    if (!existingSynergy) {
      await this.db.componentSynergy.create({
        data: {
          countryId,
          primaryComponentId: primaryComponent.id,
          secondaryComponentId: secondaryComponent.id,
          synergyType: synergy.synergyType,
          effectMultiplier: synergy.effectMultiplier,
          description: synergy.description,
        },
      });
    }
  }

  // Helper method to get component effectiveness breakdown
  getComponentBreakdown(componentTypes: ComponentType[]): ComponentEffectiveness[] {
    return componentTypes
      .map((type) => this.componentEffectiveness[type])
      .filter((item): item is ComponentEffectiveness => item !== undefined);
  }

  // Helper method to detect potential synergies for a given set of components
  detectPotentialSynergies(componentTypes: ComponentType[]): SynergyRule[] {
    return this.synergyRules.filter((rule) =>
      rule.components.every((comp) => componentTypes.includes(comp))
    );
  }

  // Helper method to detect conflicts
  detectConflicts(componentTypes: ComponentType[]): SynergyRule[] {
    return this.conflictRules.filter((rule) =>
      rule.components.every((comp) => componentTypes.includes(comp))
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
