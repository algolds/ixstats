/**
 * Builder Policy Integration Service
 *
 * Comprehensive service that bridges the policy creator with government/tax/economic builders.
 * Provides context extraction, validation, impact calculation, and AI-powered policy recommendations
 * based on the current state of all builder systems.
 */

import { EconomicComponentType, ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/atomic-economic-data";
import {
  ComponentType,
  ATOMIC_COMPONENTS,
} from "~/components/government/atoms/AtomicGovernmentComponents";
import { CrossBuilderSynergyService } from "~/app/builder/services/CrossBuilderSynergyService";
import { UnifiedEffectivenessCalculator } from "~/app/builder/services/UnifiedEffectivenessCalculator";
import { convertGovernmentStructureToSpending } from "~/lib/government-spending-bridge";
import {
  calculateAtomicTaxEffectiveness,
  getAtomicTaxRecommendations,
} from "~/lib/atomic-tax-integration";
import { getEconomicService } from "~/lib/enhanced-economic-service";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { GovernmentBuilderState, GovernmentStructure } from "~/types/government";
import type { TaxSystem, TaxCategory } from "~/types/tax-system";
import type { EconomyData, CoreEconomicIndicatorsData } from "~/types/economics";

// ===== TYPE DEFINITIONS =====

export interface BuilderPolicyContext {
  countryId: string;
  economy: {
    components: EconomicComponentType[];
    sectors: EconomicSectorData[];
    labor: LaborMarketData;
    gdp: number;
    gdpPerCapita: number;
    growthRate: number;
    inflationRate: number;
    effectiveness: number;
  };
  government: {
    components: ComponentType[];
    departments: DepartmentSummary[];
    totalBudget: number;
    budgetAllocations: BudgetAllocationSummary[];
    revenueSources: RevenueSourceSummary[];
    effectiveness: number;
  } | null;
  tax: {
    categories: TaxCategorySummary[];
    totalRevenue: number;
    collectionEfficiency: number;
    complianceRate: number;
    effectiveness: number;
    recommendations: TaxRecommendation[];
  } | null;
  crossBuilder: {
    synergies: CrossBuilderSynergy[];
    conflicts: CrossBuilderConflict[];
    overallScore: number;
    unifiedEffectiveness: number;
  };
  timestamp: number;
}

export interface EconomicSectorData {
  name: string;
  gdpContribution: number;
  employment: number;
  growthRate: number;
  productivity: number;
}

export interface LaborMarketData {
  totalWorkforce: number;
  employmentRate: number;
  unemploymentRate: number;
  averageIncome: number;
  minimumWage: number;
}

export interface DepartmentSummary {
  id: string;
  name: string;
  category: string;
  budget: number;
  employeeCount: number;
  priority: number;
}

export interface BudgetAllocationSummary {
  departmentId: string;
  departmentName: string;
  allocatedAmount: number;
  allocatedPercent: number;
  category: string;
}

export interface RevenueSourceSummary {
  name: string;
  category: string;
  amount: number;
  percent: number;
}

export interface TaxCategorySummary {
  id: string;
  name: string;
  type: string;
  rate: number;
  revenue: number;
  effectiveness: number;
}

export interface TaxRecommendation {
  category: string;
  currentRate: number;
  recommendedRate: number;
  rationale: string;
  expectedImpact: number;
}

export interface CrossBuilderSynergy {
  type: string;
  description: string;
  strength: number;
  impact: SynergyImpact;
}

export interface CrossBuilderConflict {
  type: string;
  description: string;
  severity: number;
  resolution: string;
}

export interface SynergyImpact {
  effectiveness: number;
  economicGrowth: number;
  taxEfficiency: number;
  governmentCapacity: number;
  stability: number;
}

export interface PolicyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  compatibilityScore: number;
  expectedEffectiveness: number;
}

export interface PolicyImpact {
  economic: EconomicImpact;
  government: GovernmentImpact;
  tax: TaxImpact;
  social: SocialImpact;
  overall: OverallImpact;
  timeline: ImpactTimeline;
}

export interface EconomicImpact {
  gdpChange: number; // percentage
  employmentChange: number; // jobs created/lost
  inflationChange: number; // percentage points
  sectorImpacts: Record<string, number>; // sector-specific growth changes
  investmentChange: number; // percentage
  productivityChange: number; // percentage
}

export interface GovernmentImpact {
  budgetChange: number; // absolute change
  efficiencyChange: number; // percentage
  capacityChange: number; // percentage
  departmentImpacts: Record<string, number>; // department-specific impacts
  serviceQualityChange: number; // percentage
}

export interface TaxImpact {
  revenueChange: number; // absolute change
  collectionEfficiencyChange: number; // percentage
  complianceChange: number; // percentage
  categoryImpacts: Record<string, number>; // tax category impacts
  administrativeCostChange: number; // absolute change
}

export interface SocialImpact {
  inequalityChange: number; // Gini coefficient change
  povertyChange: number; // percentage point change
  wellbeingChange: number; // index change 0-100
  educationImpact: number; // percentage
  healthcareImpact: number; // percentage
  publicSatisfaction: number; // percentage
}

export interface OverallImpact {
  effectivenessChange: number; // percentage points
  stabilityChange: number; // percentage points
  growthPotentialChange: number; // percentage points
  competitivenessChange: number; // percentage points
  riskLevel: "low" | "medium" | "high";
  confidence: number; // 0-100
}

export interface ImpactTimeline {
  immediate: PolicyImpactPhase; // 0-3 months
  shortTerm: PolicyImpactPhase; // 3-12 months
  mediumTerm: PolicyImpactPhase; // 1-3 years
  longTerm: PolicyImpactPhase; // 3+ years
}

export interface PolicyImpactPhase {
  economicImpact: number;
  governmentImpact: number;
  taxImpact: number;
  socialImpact: number;
  implementationCost: number;
}

export interface PolicyRecommendation {
  id: string;
  name: string;
  category: "economic" | "social" | "diplomatic" | "infrastructure" | "governance";
  priority: "critical" | "high" | "medium" | "low";
  description: string;
  rationale: string;
  expectedBenefits: string[];
  implementationSteps: string[];
  estimatedCost: number;
  timeframe: string;
  requiredComponents: string[];
  synergiesWith: string[];
  conflictsWith: string[];
  riskFactors: string[];
  successProbability: number; // 0-100
  aiConfidence: number; // 0-100
}

export interface PolicyApplicationResult {
  success: boolean;
  appliedChanges: PolicyChange[];
  builderUpdates: BuilderUpdateSummary;
  newEffectiveness: number;
  errors: string[];
  warnings: string[];
}

export interface PolicyChange {
  system: "economy" | "government" | "tax";
  changeType: string;
  oldValue: any;
  newValue: any;
  description: string;
}

export interface BuilderUpdateSummary {
  economyUpdates: number;
  governmentUpdates: number;
  taxUpdates: number;
  totalChanges: number;
}

// ===== MAIN SERVICE CLASS =====

export class BuilderPolicyIntegrationService {
  private crossBuilderService: CrossBuilderSynergyService;
  private effectivenessCalculator: UnifiedEffectivenessCalculator;
  private economicService: ReturnType<typeof getEconomicService>;

  constructor() {
    this.crossBuilderService = new CrossBuilderSynergyService();
    this.effectivenessCalculator = UnifiedEffectivenessCalculator.getInstance();
    this.economicService = getEconomicService();
  }

  /**
   * Get all relevant builder data for policy creation
   */
  async getPolicyContextFromBuilders(
    countryId: string,
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null,
    governmentStructure: GovernmentStructure | null,
    taxSystem: TaxSystem | null,
    economyData: EconomyData
  ): Promise<BuilderPolicyContext> {
    // Extract economic context
    const economyContext = this.extractEconomyContext(economyBuilder, economyData);

    // Extract government context
    const governmentContext =
      governmentBuilder || governmentStructure
        ? this.extractGovernmentContext(governmentBuilder, governmentStructure)
        : null;

    // Extract tax context
    const taxContext = taxSystem
      ? await this.extractTaxContext(taxSystem, economyBuilder, governmentBuilder)
      : null;

    // Calculate cross-builder synergies and conflicts
    const crossBuilderContext = await this.extractCrossBuilderContext(
      economyBuilder,
      governmentBuilder,
      taxSystem
    );

    return {
      countryId,
      economy: economyContext,
      government: governmentContext,
      tax: taxContext,
      crossBuilder: crossBuilderContext,
      timestamp: Date.now(),
    };
  }

  /**
   * Validate policy against current builder state
   */
  async validatePolicyAgainstBuilders(
    policyData: any,
    context: BuilderPolicyContext
  ): Promise<PolicyValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Validate policy type compatibility
    if (policyData.policyType === "economic" && !context.economy) {
      errors.push("Economic policy requires economy builder data");
    }

    if (policyData.policyType === "governance" && !context.government) {
      warnings.push("Governance policy is more effective with government builder configuration");
    }

    // Validate budget requirements
    if (policyData.implementationCost && context.government) {
      const availableBudget = context.government.totalBudget * 0.1; // Assume 10% available for new policies
      if (policyData.implementationCost > availableBudget) {
        errors.push(
          `Policy cost (${policyData.implementationCost}) exceeds available budget (${availableBudget})`
        );
      }
    }

    // Validate tax implications
    if (policyData.requiresTaxChange && !context.tax) {
      warnings.push("Tax system configuration recommended for tax-related policies");
    }

    // Check for component conflicts
    if (policyData.requiredComponents) {
      const missingComponents = this.checkRequiredComponents(
        policyData.requiredComponents,
        context
      );
      if (missingComponents.length > 0) {
        warnings.push(`Missing recommended components: ${missingComponents.join(", ")}`);
      }
    }

    // Calculate compatibility score
    const compatibilityScore = this.calculatePolicyCompatibility(policyData, context);

    // Estimate expected effectiveness
    const expectedEffectiveness = this.estimatePolicyEffectiveness(policyData, context);

    // Generate recommendations
    if (compatibilityScore < 70) {
      recommendations.push(
        "Consider adjusting policy parameters to better align with current builder configuration"
      );
    }

    if (context.crossBuilder.conflicts.length > 0) {
      recommendations.push(
        "Address existing cross-builder conflicts before implementing major policy changes"
      );
    }

    if (expectedEffectiveness < 50) {
      recommendations.push(
        "Current builder configuration may limit policy effectiveness - consider system improvements first"
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      recommendations,
      compatibilityScore,
      expectedEffectiveness,
    };
  }

  /**
   * Calculate economic/tax/government impact of policy
   */
  async calculatePolicyImpact(
    policyData: any,
    context: BuilderPolicyContext
  ): Promise<PolicyImpact> {
    // Calculate economic impact
    const economicImpact = this.calculateEconomicImpact(policyData, context);

    // Calculate government impact
    const governmentImpact = this.calculateGovernmentImpact(policyData, context);

    // Calculate tax impact
    const taxImpact = this.calculateTaxImpact(policyData, context);

    // Calculate social impact
    const socialImpact = this.calculateSocialImpact(policyData, context);

    // Calculate overall impact
    const overallImpact = this.calculateOverallImpact(
      economicImpact,
      governmentImpact,
      taxImpact,
      socialImpact,
      context
    );

    // Generate impact timeline
    const timeline = this.generateImpactTimeline(
      economicImpact,
      governmentImpact,
      taxImpact,
      socialImpact,
      policyData
    );

    return {
      economic: economicImpact,
      government: governmentImpact,
      tax: taxImpact,
      social: socialImpact,
      overall: overallImpact,
      timeline,
    };
  }

  /**
   * AI-powered policy recommendations based on builder state
   */
  async getSuggestedPolicies(context: BuilderPolicyContext): Promise<PolicyRecommendation[]> {
    const recommendations: PolicyRecommendation[] = [];

    // Economic policy recommendations
    recommendations.push(...this.generateEconomicPolicyRecommendations(context));

    // Government policy recommendations
    if (context.government) {
      recommendations.push(...this.generateGovernmentPolicyRecommendations(context));
    }

    // Tax policy recommendations
    if (context.tax) {
      recommendations.push(...this.generateTaxPolicyRecommendations(context));
    }

    // Cross-builder optimization policies
    recommendations.push(...this.generateCrossBuilderPolicyRecommendations(context));

    // Sort by priority and success probability
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.successProbability - a.successProbability;
    });
  }

  /**
   * Apply activated policy effects to builders
   */
  async applyPolicyToBuilders(
    policyId: string,
    policyData: any,
    context: BuilderPolicyContext
  ): Promise<PolicyApplicationResult> {
    const appliedChanges: PolicyChange[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Apply economic changes
      if (policyData.economicEffects) {
        const economicChanges = await this.applyEconomicEffects(
          policyData.economicEffects,
          context
        );
        appliedChanges.push(...economicChanges);
      }

      // Apply government changes
      if (policyData.governmentEffects && context.government) {
        const governmentChanges = await this.applyGovernmentEffects(
          policyData.governmentEffects,
          context
        );
        appliedChanges.push(...governmentChanges);
      }

      // Apply tax changes
      if (policyData.taxEffects && context.tax) {
        const taxChanges = await this.applyTaxEffects(policyData.taxEffects, context);
        appliedChanges.push(...taxChanges);
      }

      // Recalculate effectiveness after changes
      const newEffectiveness = await this.calculateNewEffectiveness(context, appliedChanges);

      const builderUpdates: BuilderUpdateSummary = {
        economyUpdates: appliedChanges.filter((c: { system: string }) => c.system === "economy")
          .length,
        governmentUpdates: appliedChanges.filter(
          (c: { system: string }) => c.system === "government"
        ).length,
        taxUpdates: appliedChanges.filter((c: { system: string }) => c.system === "tax").length,
        totalChanges: appliedChanges.length,
      };

      return {
        success: true,
        appliedChanges,
        builderUpdates,
        newEffectiveness,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(
        `Failed to apply policy: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return {
        success: false,
        appliedChanges,
        builderUpdates: { economyUpdates: 0, governmentUpdates: 0, taxUpdates: 0, totalChanges: 0 },
        newEffectiveness: context.crossBuilder.unifiedEffectiveness,
        errors,
        warnings,
      };
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private extractEconomyContext(economyBuilder: EconomyBuilderState, economyData: EconomyData) {
    const components = economyBuilder.selectedAtomicComponents;
    const effectiveness = this.calculateEconomyEffectiveness(components);

    return {
      components,
      sectors: this.extractSectorData(economyData),
      labor: this.extractLaborData(economyData),
      gdp: economyData.core.nominalGDP,
      gdpPerCapita: economyData.core.gdpPerCapita,
      growthRate: economyData.core.realGDPGrowthRate * 100,
      inflationRate: economyData.core.inflationRate * 100,
      effectiveness,
    };
  }

  private extractGovernmentContext(
    governmentBuilder: GovernmentBuilderState | null,
    governmentStructure: GovernmentStructure | null
  ) {
    if (!governmentBuilder && !governmentStructure) return null;

    const structure = governmentStructure || governmentBuilder?.structure;
    const components = governmentBuilder?.selectedComponents || [];
    const departments = (structure as any)?.departments || [];
    const budgetAllocations = (structure as any)?.budgetAllocations || [];
    const revenueSources = (structure as any)?.revenueSources || [];

    return {
      components: components as ComponentType[],
      departments: departments.map(
        (d: {
          id: string;
          name: string;
          category: string;
          employeeCount: number;
          priority: number;
        }) => ({
          id: d.id,
          name: d.name,
          category: d.category,
          budget:
            budgetAllocations.find(
              (ba: { departmentId: string; allocatedAmount: number }) => ba.departmentId === d.id
            )?.allocatedAmount || 0,
          employeeCount: d.employeeCount || 0,
          priority: d.priority,
        })
      ),
      totalBudget: structure?.totalBudget || 0,
      budgetAllocations: budgetAllocations.map(
        (ba: { departmentId: string; allocatedAmount: number; allocatedPercent: number }) => ({
          departmentId: ba.departmentId,
          departmentName:
            departments.find(
              (d: { id: string; name: string; category: string }) => d.id === ba.departmentId
            )?.name || "Unknown",
          allocatedAmount: ba.allocatedAmount,
          allocatedPercent: ba.allocatedPercent,
          category:
            departments.find(
              (d: { id: string; name: string; category: string }) => d.id === ba.departmentId
            )?.category || "Other",
        })
      ),
      revenueSources: revenueSources.map(
        (rs: { name: any; category: any; revenueAmount: any; revenuePercent: any }) => ({
          name: rs.name,
          category: rs.category,
          amount: rs.revenueAmount,
          percent: rs.revenuePercent,
        })
      ),
      effectiveness: this.calculateGovernmentEffectiveness(components as ComponentType[]),
    };
  }

  private async extractTaxContext(
    taxSystem: TaxSystem,
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null
  ) {
    const categories = taxSystem.taxCategories || [];
    const components = economyBuilder.selectedAtomicComponents;

    // Calculate tax effectiveness using atomic integration
    const atomicTaxEffectiveness = calculateAtomicTaxEffectiveness(
      (governmentBuilder?.selectedComponents as ComponentType[]) || [],
      {
        collectionEfficiency: taxSystem.collectionEfficiency || 70,
        complianceRate: taxSystem.complianceRate || 75,
      }
    );

    // Get tax recommendations
    const atomicRecommendations = getAtomicTaxRecommendations(
      (governmentBuilder?.selectedComponents as ComponentType[]) || []
    );

    const totalRevenue = categories.reduce((sum, cat) => {
      return sum + (cat.rate || 0) * 1000000; // Simplified revenue calculation
    }, 0);

    return {
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.categoryName,
        type: cat.categoryType,
        rate: cat.rate || cat.baseRate || 0,
        revenue: (cat.rate || 0) * 1000000, // Simplified
        effectiveness: atomicTaxEffectiveness.effectivenessScore,
      })),
      totalRevenue,
      collectionEfficiency: atomicTaxEffectiveness.collectionEfficiency,
      complianceRate: atomicTaxEffectiveness.complianceRate,
      effectiveness: atomicTaxEffectiveness.effectivenessScore,
      recommendations: atomicRecommendations.recommendedPolicies.map((policy, index) => ({
        category: "General",
        currentRate: 0,
        recommendedRate: 0,
        rationale: policy,
        expectedImpact: 5,
      })),
    };
  }

  private async extractCrossBuilderContext(
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null,
    taxSystem: TaxSystem | null
  ) {
    const crossBuilderAnalysis = this.crossBuilderService.analyzeCrossBuilderIntegration(
      economyBuilder,
      governmentBuilder,
      taxSystem
    );

    return {
      synergies: crossBuilderAnalysis.synergies.map((s) => ({
        type: s.type,
        description: s.description,
        strength: s.strength,
        impact: s.impact,
      })),
      conflicts: crossBuilderAnalysis.conflicts.map((c) => ({
        type: c.type,
        description: c.description,
        severity: c.strength,
        resolution: c.recommendations[0] || "No resolution available",
      })),
      overallScore: crossBuilderAnalysis.overallScore,
      unifiedEffectiveness: crossBuilderAnalysis.unifiedEffectiveness,
    };
  }

  private extractSectorData(economyData: EconomyData): EconomicSectorData[] {
    // Extract sector data from economy data
    return [
      {
        name: "Agriculture",
        gdpContribution: economyData.labor.employmentBySector.agriculture,
        employment: economyData.labor.employmentBySector.agriculture,
        growthRate: 2.5,
        productivity: 75,
      },
      {
        name: "Industry",
        gdpContribution: economyData.labor.employmentBySector.industry,
        employment: economyData.labor.employmentBySector.industry,
        growthRate: 3.5,
        productivity: 85,
      },
      {
        name: "Services",
        gdpContribution: economyData.labor.employmentBySector.services,
        employment: economyData.labor.employmentBySector.services,
        growthRate: 4.0,
        productivity: 80,
      },
    ];
  }

  private extractLaborData(economyData: EconomyData): LaborMarketData {
    return {
      totalWorkforce: economyData.labor.totalWorkforce,
      employmentRate: economyData.labor.employmentRate,
      unemploymentRate: economyData.labor.unemploymentRate,
      averageIncome: economyData.labor.averageAnnualIncome,
      minimumWage: economyData.labor.minimumWage,
    };
  }

  private calculateEconomyEffectiveness(components: EconomicComponentType[]): number {
    if (components.length === 0) return 0;

    const baseEffectiveness =
      components.reduce((sum, comp) => {
        return sum + (ATOMIC_ECONOMIC_COMPONENTS[comp]?.effectiveness || 0);
      }, 0) / components.length;

    return Math.round(baseEffectiveness);
  }

  private calculateGovernmentEffectiveness(components: ComponentType[]): number {
    if (components.length === 0) return 0;

    const baseEffectiveness =
      components.reduce((sum, comp) => {
        return sum + (ATOMIC_COMPONENTS[comp]?.effectiveness || 0);
      }, 0) / components.length;

    return Math.round(baseEffectiveness);
  }

  private checkRequiredComponents(
    requiredComponents: string[],
    context: BuilderPolicyContext
  ): string[] {
    const missing: string[] = [];

    requiredComponents.forEach((req) => {
      const hasEconomic = context.economy.components.some((c) =>
        ATOMIC_ECONOMIC_COMPONENTS[c]?.name.toLowerCase().includes(req.toLowerCase())
      );

      const hasGovernment = context.government?.components.some((c) =>
        ATOMIC_COMPONENTS[c]?.name.toLowerCase().includes(req.toLowerCase())
      );

      if (!hasEconomic && !hasGovernment) {
        missing.push(req);
      }
    });

    return missing;
  }

  private calculatePolicyCompatibility(policyData: any, context: BuilderPolicyContext): number {
    let score = 50; // Base compatibility

    // Check category alignment
    if (policyData.category === "economic" && context.economy.effectiveness > 70) {
      score += 20;
    }

    if (
      policyData.category === "governance" &&
      context.government &&
      context.government.effectiveness > 70
    ) {
      score += 20;
    }

    // Check for synergies
    if (context.crossBuilder.synergies.length > 3) {
      score += 15;
    }

    // Penalty for conflicts
    if (context.crossBuilder.conflicts.length > 2) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  private estimatePolicyEffectiveness(policyData: any, context: BuilderPolicyContext): number {
    let effectiveness = 50; // Base effectiveness

    // Factor in builder effectiveness
    effectiveness += (context.crossBuilder.unifiedEffectiveness - 50) * 0.5;

    // Factor in policy priority
    const priorityBonus = {
      critical: 20,
      high: 15,
      medium: 10,
      low: 5,
    };
    effectiveness += priorityBonus[policyData.priority as keyof typeof priorityBonus] || 0;

    // Factor in implementation cost (higher cost may be more effective but riskier)
    if (policyData.implementationCost) {
      const costRatio =
        policyData.implementationCost / (context.government?.totalBudget || 1000000);
      if (costRatio < 0.05) effectiveness += 10;
      else if (costRatio > 0.2) effectiveness -= 10;
    }

    return Math.max(0, Math.min(100, effectiveness));
  }

  private calculateEconomicImpact(policyData: any, context: BuilderPolicyContext): EconomicImpact {
    const baseImpact =
      policyData.priority === "critical" ? 5 : policyData.priority === "high" ? 3 : 1;

    return {
      gdpChange: baseImpact * (context.economy.effectiveness / 100),
      employmentChange: Math.round(baseImpact * context.economy.labor.totalWorkforce * 0.001),
      inflationChange: baseImpact * 0.2,
      sectorImpacts: {
        agriculture: baseImpact * 0.8,
        industry: baseImpact * 1.2,
        services: baseImpact * 1.0,
      },
      investmentChange: baseImpact * 1.5,
      productivityChange: baseImpact * 0.5,
    };
  }

  private calculateGovernmentImpact(
    policyData: any,
    context: BuilderPolicyContext
  ): GovernmentImpact {
    const baseImpact = policyData.implementationCost || 100000;

    return {
      budgetChange: -baseImpact,
      efficiencyChange: 2.5,
      capacityChange: 3.0,
      departmentImpacts: {},
      serviceQualityChange: 4.0,
    };
  }

  private calculateTaxImpact(policyData: any, context: BuilderPolicyContext): TaxImpact {
    const revenueImpact = (policyData.implementationCost || 0) * -0.1;

    return {
      revenueChange: revenueImpact,
      collectionEfficiencyChange: 1.0,
      complianceChange: 0.5,
      categoryImpacts: {},
      administrativeCostChange: (policyData.implementationCost || 0) * 0.05,
    };
  }

  private calculateSocialImpact(policyData: any, context: BuilderPolicyContext): SocialImpact {
    return {
      inequalityChange: -0.5,
      povertyChange: -1.0,
      wellbeingChange: 2.0,
      educationImpact: 1.5,
      healthcareImpact: 1.5,
      publicSatisfaction: 5.0,
    };
  }

  private calculateOverallImpact(
    economic: EconomicImpact,
    government: GovernmentImpact,
    tax: TaxImpact,
    social: SocialImpact,
    context: BuilderPolicyContext
  ): OverallImpact {
    const effectivenessChange =
      (economic.gdpChange + government.efficiencyChange + social.wellbeingChange) / 3;
    const stabilityChange =
      (government.capacityChange + tax.complianceChange - economic.inflationChange) / 3;
    const growthPotentialChange =
      (economic.gdpChange + economic.investmentChange + economic.productivityChange) / 3;
    const competitivenessChange =
      (economic.productivityChange + government.efficiencyChange + tax.collectionEfficiencyChange) /
      3;

    const riskLevel: "low" | "medium" | "high" =
      context.crossBuilder.conflicts.length > 2
        ? "high"
        : context.crossBuilder.conflicts.length > 0
          ? "medium"
          : "low";

    return {
      effectivenessChange,
      stabilityChange,
      growthPotentialChange,
      competitivenessChange,
      riskLevel,
      confidence: context.crossBuilder.overallScore,
    };
  }

  private generateImpactTimeline(
    economic: EconomicImpact,
    government: GovernmentImpact,
    tax: TaxImpact,
    social: SocialImpact,
    policyData: any
  ): ImpactTimeline {
    const baseCost = policyData.implementationCost || 100000;

    return {
      immediate: {
        economicImpact: economic.gdpChange * 0.1,
        governmentImpact: government.efficiencyChange * 0.2,
        taxImpact: tax.revenueChange * 0.1,
        socialImpact: social.publicSatisfaction * 0.3,
        implementationCost: baseCost * 0.4,
      },
      shortTerm: {
        economicImpact: economic.gdpChange * 0.4,
        governmentImpact: government.efficiencyChange * 0.6,
        taxImpact: tax.revenueChange * 0.5,
        socialImpact: social.wellbeingChange * 0.5,
        implementationCost: baseCost * 0.4,
      },
      mediumTerm: {
        economicImpact: economic.gdpChange * 0.8,
        governmentImpact: government.efficiencyChange * 0.9,
        taxImpact: tax.revenueChange * 0.8,
        socialImpact: social.wellbeingChange * 0.8,
        implementationCost: baseCost * 0.15,
      },
      longTerm: {
        economicImpact: economic.gdpChange,
        governmentImpact: government.efficiencyChange,
        taxImpact: tax.revenueChange,
        socialImpact: social.wellbeingChange,
        implementationCost: baseCost * 0.05,
      },
    };
  }

  private generateEconomicPolicyRecommendations(
    context: BuilderPolicyContext
  ): PolicyRecommendation[] {
    const recommendations: PolicyRecommendation[] = [];

    // Innovation policy
    if (context.economy.components.includes(EconomicComponentType.INNOVATION_ECONOMY)) {
      recommendations.push({
        id: "r-d-tax-credit",
        name: "Research & Development Tax Credit Program",
        category: "economic",
        priority: "high",
        description: "Implement tax credits for companies investing in R&D to boost innovation",
        rationale: "Innovation economy component benefits significantly from R&D incentives",
        expectedBenefits: [
          "Increase private sector R&D investment by 15-20%",
          "Attract high-tech companies and talent",
          "Boost productivity and economic growth",
        ],
        implementationSteps: [
          "Define eligible R&D activities",
          "Set tax credit rates and caps",
          "Establish verification mechanisms",
          "Launch awareness campaign",
        ],
        estimatedCost: 50000000,
        timeframe: "6-12 months",
        requiredComponents: ["Innovation Economy", "Professional Bureaucracy"],
        synergiesWith: ["Knowledge Economy", "Technocratic Process"],
        conflictsWith: [],
        riskFactors: ["Budget constraints", "Administrative complexity"],
        successProbability: 85,
        aiConfidence: 90,
      });
    }

    // Labor market policy
    if (context.economy.labor.unemploymentRate > 5) {
      recommendations.push({
        id: "job-training-program",
        name: "National Job Training & Reskilling Initiative",
        category: "economic",
        priority: "high",
        description:
          "Comprehensive training program to reduce unemployment and improve workforce skills",
        rationale: `Current unemployment rate of ${context.economy.labor.unemploymentRate.toFixed(1)}% indicates need for workforce development`,
        expectedBenefits: [
          "Reduce unemployment by 1-2 percentage points",
          "Improve workforce productivity",
          "Better match between skills and job market needs",
        ],
        implementationSteps: [
          "Identify high-demand skills and sectors",
          "Partner with educational institutions",
          "Provide training subsidies and stipends",
          "Track employment outcomes",
        ],
        estimatedCost: 30000000,
        timeframe: "12-24 months",
        requiredComponents: ["Flexible Labor", "Government Education Programs"],
        synergiesWith: ["Knowledge Economy", "Social Market Economy"],
        conflictsWith: [],
        riskFactors: ["Participant recruitment", "Training quality", "Job placement success"],
        successProbability: 75,
        aiConfidence: 85,
      });
    }

    return recommendations;
  }

  private generateGovernmentPolicyRecommendations(
    context: BuilderPolicyContext
  ): PolicyRecommendation[] {
    const recommendations: PolicyRecommendation[] = [];

    if (!context.government) return recommendations;

    // Budget optimization
    if (context.government.effectiveness < 70) {
      recommendations.push({
        id: "gov-efficiency-reform",
        name: "Government Efficiency Reform Initiative",
        category: "governance",
        priority: "high",
        description: "Streamline government operations and improve service delivery efficiency",
        rationale: `Government effectiveness score of ${context.government.effectiveness}% indicates room for improvement`,
        expectedBenefits: [
          "Reduce administrative costs by 10-15%",
          "Improve service delivery times",
          "Increase citizen satisfaction",
        ],
        implementationSteps: [
          "Conduct efficiency audit of all departments",
          "Identify redundant processes",
          "Implement digital transformation",
          "Train staff on new procedures",
        ],
        estimatedCost: 20000000,
        timeframe: "18-24 months",
        requiredComponents: ["Professional Bureaucracy", "Digital Government"],
        synergiesWith: ["Technocratic Process", "Performance Legitimacy"],
        conflictsWith: [],
        riskFactors: ["Resistance to change", "Implementation complexity"],
        successProbability: 70,
        aiConfidence: 80,
      });
    }

    return recommendations;
  }

  private generateTaxPolicyRecommendations(context: BuilderPolicyContext): PolicyRecommendation[] {
    const recommendations: PolicyRecommendation[] = [];

    if (!context.tax) return recommendations;

    // Tax compliance improvement
    if (context.tax.complianceRate < 80) {
      recommendations.push({
        id: "tax-compliance-enhancement",
        name: "Tax Compliance Enhancement Program",
        category: "economic",
        priority: "high",
        description: "Improve voluntary tax compliance through education and simplified filing",
        rationale: `Current compliance rate of ${context.tax.complianceRate.toFixed(1)}% below optimal levels`,
        expectedBenefits: [
          "Increase tax revenue by 5-10%",
          "Reduce enforcement costs",
          "Improve taxpayer satisfaction",
        ],
        implementationSteps: [
          "Simplify tax filing procedures",
          "Launch taxpayer education campaign",
          "Implement user-friendly digital filing",
          "Provide free filing assistance",
        ],
        estimatedCost: 15000000,
        timeframe: "12-18 months",
        requiredComponents: ["Professional Bureaucracy", "Digital Government"],
        synergiesWith: ["Rule of Law", "Institutional Legitimacy"],
        conflictsWith: [],
        riskFactors: ["System complexity", "Digital literacy gaps"],
        successProbability: 80,
        aiConfidence: 85,
      });
    }

    return recommendations;
  }

  private generateCrossBuilderPolicyRecommendations(
    context: BuilderPolicyContext
  ): PolicyRecommendation[] {
    const recommendations: PolicyRecommendation[] = [];

    // Address conflicts
    if (context.crossBuilder.conflicts.length > 0) {
      recommendations.push({
        id: "cross-system-alignment",
        name: "Cross-System Policy Alignment Initiative",
        category: "governance",
        priority: "critical",
        description: "Resolve conflicts between economic, government, and tax systems",
        rationale: `${context.crossBuilder.conflicts.length} cross-builder conflicts detected`,
        expectedBenefits: [
          "Improve overall system effectiveness by 10-15%",
          "Reduce policy implementation friction",
          "Create synergies between systems",
        ],
        implementationSteps: [
          "Analyze all system conflicts",
          "Prioritize critical conflicts",
          "Develop resolution strategies",
          "Implement coordinated changes",
        ],
        estimatedCost: 25000000,
        timeframe: "12-18 months",
        requiredComponents: ["Professional Bureaucracy", "Technocratic Process"],
        synergiesWith: context.crossBuilder.synergies.map((s) => s.type),
        conflictsWith: [],
        riskFactors: ["Coordination complexity", "Stakeholder resistance"],
        successProbability: 65,
        aiConfidence: 75,
      });
    }

    return recommendations;
  }

  private async applyEconomicEffects(
    effects: any,
    context: BuilderPolicyContext
  ): Promise<PolicyChange[]> {
    const changes: PolicyChange[] = [];

    // This would interface with the economy builder to apply changes
    // For now, return simulated changes
    changes.push({
      system: "economy",
      changeType: "growth_rate_adjustment",
      oldValue: context.economy.growthRate,
      newValue: context.economy.growthRate + (effects.growthImpact || 0),
      description: "Economic growth rate adjusted based on policy effects",
    });

    return changes;
  }

  private async applyGovernmentEffects(
    effects: any,
    context: BuilderPolicyContext
  ): Promise<PolicyChange[]> {
    const changes: PolicyChange[] = [];

    if (!context.government) return changes;

    changes.push({
      system: "government",
      changeType: "efficiency_adjustment",
      oldValue: context.government.effectiveness,
      newValue: context.government.effectiveness + (effects.efficiencyImpact || 0),
      description: "Government efficiency adjusted based on policy effects",
    });

    return changes;
  }

  private async applyTaxEffects(
    effects: any,
    context: BuilderPolicyContext
  ): Promise<PolicyChange[]> {
    const changes: PolicyChange[] = [];

    if (!context.tax) return changes;

    changes.push({
      system: "tax",
      changeType: "collection_efficiency_adjustment",
      oldValue: context.tax.collectionEfficiency,
      newValue: context.tax.collectionEfficiency + (effects.collectionImpact || 0),
      description: "Tax collection efficiency adjusted based on policy effects",
    });

    return changes;
  }

  private async calculateNewEffectiveness(
    context: BuilderPolicyContext,
    changes: PolicyChange[]
  ): Promise<number> {
    // Recalculate unified effectiveness after changes
    const improvementFactor = changes.length * 0.5; // Each change improves effectiveness slightly
    return Math.min(100, context.crossBuilder.unifiedEffectiveness + improvementFactor);
  }
}

// ===== EXPORT SINGLETON INSTANCE =====

export const builderPolicyIntegrationService = new BuilderPolicyIntegrationService();

// ===== UTILITY FUNCTIONS =====

export async function getPolicyContext(
  countryId: string,
  economyBuilder: EconomyBuilderState,
  governmentBuilder: GovernmentBuilderState | null,
  governmentStructure: GovernmentStructure | null,
  taxSystem: TaxSystem | null,
  economyData: EconomyData
): Promise<BuilderPolicyContext> {
  return builderPolicyIntegrationService.getPolicyContextFromBuilders(
    countryId,
    economyBuilder,
    governmentBuilder,
    governmentStructure,
    taxSystem,
    economyData
  );
}

export async function validatePolicy(
  policyData: any,
  context: BuilderPolicyContext
): Promise<PolicyValidationResult> {
  return builderPolicyIntegrationService.validatePolicyAgainstBuilders(policyData, context);
}

export async function calculateImpact(
  policyData: any,
  context: BuilderPolicyContext
): Promise<PolicyImpact> {
  return builderPolicyIntegrationService.calculatePolicyImpact(policyData, context);
}

export async function getSuggestedPolicies(
  context: BuilderPolicyContext
): Promise<PolicyRecommendation[]> {
  return builderPolicyIntegrationService.getSuggestedPolicies(context);
}

export async function applyPolicy(
  policyId: string,
  policyData: any,
  context: BuilderPolicyContext
): Promise<PolicyApplicationResult> {
  return builderPolicyIntegrationService.applyPolicyToBuilders(policyId, policyData, context);
}
