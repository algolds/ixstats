/**
 * Unified Effectiveness Calculator
 * 
 * This service provides comprehensive cross-builder effectiveness scoring that combines
 * economy, government, and tax systems into a unified effectiveness metric. It analyzes
 * synergies, conflicts, and optimization opportunities across all builders.
 */

import { EconomicComponentType, ATOMIC_ECONOMIC_COMPONENTS } from '~/components/economy/atoms/AtomicEconomicComponents';
import { ComponentType, ATOMIC_COMPONENTS } from '~/components/government/atoms/AtomicGovernmentComponents';
import type { EconomyBuilderState } from '~/types/economy-builder';
import type { GovernmentBuilderState } from '~/types/government';
import type { TaxSystem } from '~/types/tax-system';
import { crossBuilderSynergyService } from './CrossBuilderSynergyService';
import { bidirectionalTaxSyncService } from './BidirectionalTaxSyncService';
import { bidirectionalGovernmentSyncService } from './BidirectionalGovernmentSyncService';

export interface UnifiedEffectivenessMetrics {
  overallScore: number; // 0-100
  economyScore: number; // 0-100
  governmentScore: number; // 0-100
  taxScore: number; // 0-100
  synergyBonus: number; // 0-100
  conflictPenalty: number; // 0-100
  optimizationPotential: number; // 0-100
  stabilityIndex: number; // 0-100
  growthPotential: number; // 0-100
  competitivenessIndex: number; // 0-100
}

export interface EffectivenessBreakdown {
  baseEffectiveness: number;
  componentSynergies: number;
  crossBuilderSynergies: number;
  conflictPenalties: number;
  optimizationBonuses: number;
  stabilityFactors: number;
  growthFactors: number;
  competitivenessFactors: number;
}

export interface OptimizationRecommendation {
  id: string;
  type: 'economy' | 'government' | 'tax' | 'cross_builder';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImprovement: number; // percentage points
  implementationCost: number;
  timeToImplement: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  affectedSystems: string[];
  requirements: string[];
}

export interface UnifiedEffectivenessAnalysis {
  metrics: UnifiedEffectivenessMetrics;
  breakdown: EffectivenessBreakdown;
  recommendations: OptimizationRecommendation[];
  riskFactors: string[];
  strengths: string[];
  weaknesses: string[];
  lastCalculated: number;
  confidence: number; // 0-100
  overallEffectivenessScore: number;
  economyEffectiveness: number;
  governmentEffectiveness: number;
  taxEffectiveness: number;
  crossBuilderSynergyScore: number;
  optimizationRecommendations: OptimizationRecommendation[];
}

export class UnifiedEffectivenessCalculator {
  private static instance: UnifiedEffectivenessCalculator;
  private lastAnalysis: UnifiedEffectivenessAnalysis | null = null;

  public static getInstance(): UnifiedEffectivenessCalculator {
    if (!UnifiedEffectivenessCalculator.instance) {
      UnifiedEffectivenessCalculator.instance = new UnifiedEffectivenessCalculator();
    }
    return UnifiedEffectivenessCalculator.instance;
  }

  /**
   * Calculate unified effectiveness across all builders
   */
  async calculateUnifiedEffectiveness(
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null,
    taxSystem: TaxSystem | null,
    governmentComponents: ComponentType[] = []
  ): Promise<UnifiedEffectivenessAnalysis> {
    try {
      // Calculate individual system scores
      const economyScore = this.calculateEconomyEffectiveness(economyBuilder);
      const governmentScore = this.calculateGovernmentEffectiveness(governmentBuilder, governmentComponents);
      const taxScore = this.calculateTaxEffectiveness(taxSystem);

      // Calculate cross-builder synergies and conflicts
      const crossBuilderAnalysis = await this.calculateCrossBuilderFactors(
        economyBuilder,
        governmentBuilder,
        taxSystem,
        governmentComponents
      );

      // Calculate unified metrics
      const metrics = this.calculateUnifiedMetrics(
        economyScore,
        governmentScore,
        taxScore,
        crossBuilderAnalysis
      );

      // Generate effectiveness breakdown
      const breakdown = this.calculateEffectivenessBreakdown(
        economyBuilder,
        governmentBuilder,
        taxSystem,
        crossBuilderAnalysis,
        governmentComponents
      );

      // Generate optimization recommendations
      const recommendations = await this.generateOptimizationRecommendations(
        economyBuilder,
        governmentBuilder,
        taxSystem,
        crossBuilderAnalysis,
        governmentComponents
      );

      // Identify risk factors and strengths/weaknesses
      const riskFactors = this.identifyRiskFactors(crossBuilderAnalysis);
      const strengths = this.identifyStrengths(economyBuilder, governmentBuilder, taxSystem, governmentComponents);
      const weaknesses = this.identifyWeaknesses(economyBuilder, governmentBuilder, taxSystem, governmentComponents);

      // Calculate confidence level
      const confidence = this.calculateConfidence(economyBuilder, governmentBuilder, taxSystem, governmentComponents);

      const analysis: UnifiedEffectivenessAnalysis = {
        metrics,
        breakdown,
        recommendations,
        riskFactors,
        strengths,
        weaknesses,
        lastCalculated: Date.now(),
        confidence,
        overallEffectivenessScore: metrics.overallScore,
        economyEffectiveness: economyScore,
        governmentEffectiveness: governmentScore,
        taxEffectiveness: taxScore,
        crossBuilderSynergyScore: crossBuilderAnalysis.synergyBonus,
        optimizationRecommendations: recommendations
      };

      this.lastAnalysis = analysis;
      return analysis;
    } catch (error) {
      console.error('Failed to calculate unified effectiveness:', error);
      throw error;
    }
  }

  /**
   * Get the last calculated analysis
   */
  getLastAnalysis(): UnifiedEffectivenessAnalysis | null {
    return this.lastAnalysis;
  }

  /**
   * Calculate economy system effectiveness
   */
  private calculateEconomyEffectiveness(economyBuilder: EconomyBuilderState): number {
    const components = economyBuilder.selectedAtomicComponents;
    if (components.length === 0) return 0;

    // Base effectiveness from components
    const baseEffectiveness = components.reduce((sum, comp) => {
      return sum + (ATOMIC_ECONOMIC_COMPONENTS[comp]?.effectiveness || 0);
    }, 0) / components.length;

    // Synergy bonuses
    let synergyBonus = 0;
    components.forEach(comp1 => {
      components.forEach(comp2 => {
        if (comp1 !== comp2) {
          const component1 = ATOMIC_ECONOMIC_COMPONENTS[comp1];
          if (component1?.synergies.includes(comp2)) {
            synergyBonus += 2;
          }
        }
      });
    });

    // Conflict penalties
    let conflictPenalty = 0;
    components.forEach(comp1 => {
      components.forEach(comp2 => {
        if (comp1 !== comp2) {
          const component1 = ATOMIC_ECONOMIC_COMPONENTS[comp1];
          if (component1?.conflicts.includes(comp2)) {
            conflictPenalty += 5;
          }
        }
      });
    });

    return Math.max(0, Math.min(100, baseEffectiveness + synergyBonus - conflictPenalty));
  }

  /**
   * Calculate government system effectiveness
   */
  private calculateGovernmentEffectiveness(governmentBuilder: GovernmentBuilderState | null, governmentComponents: ComponentType[] = []): number {
    if (governmentComponents.length === 0) return 0;

    const components = governmentComponents;
    if (components.length === 0) return 0;

    // Base effectiveness from components
    const baseEffectiveness = components.reduce((sum, comp) => {
      return sum + (ATOMIC_COMPONENTS[comp]?.effectiveness || 0);
    }, 0) / components.length;

    // Synergy bonuses
    let synergyBonus = 0;
    components.forEach(comp1 => {
      components.forEach(comp2 => {
        if (comp1 !== comp2) {
          const component1 = ATOMIC_COMPONENTS[comp1];
          if (component1?.synergies.includes(comp2)) {
            synergyBonus += 2;
          }
        }
      });
    });

    // Conflict penalties
    let conflictPenalty = 0;
    components.forEach(comp1 => {
      components.forEach(comp2 => {
        if (comp1 !== comp2) {
          const component1 = ATOMIC_COMPONENTS[comp1];
          if (component1?.conflicts.includes(comp2)) {
            conflictPenalty += 5;
          }
        }
      });
    });

    return Math.max(0, Math.min(100, baseEffectiveness + synergyBonus - conflictPenalty));
  }

  /**
   * Calculate tax system effectiveness
   */
  private calculateTaxEffectiveness(taxSystem: TaxSystem | null): number {
    if (!taxSystem) return 0;

    let effectiveness = 50; // Base tax system effectiveness

    // Adjust based on compliance and collection efficiency
    if (taxSystem.complianceRate) {
      effectiveness += (taxSystem.complianceRate - 50) * 0.5;
    }

    if (taxSystem.collectionEfficiency) {
      effectiveness += (taxSystem.collectionEfficiency - 50) * 0.5;
    }

    // Adjust based on tax structure
    if (taxSystem.progressiveTax) {
      effectiveness += 10; // Progressive tax generally more effective
    }

    if (taxSystem.alternativeMinTax) {
      effectiveness += 5; // Alternative minimum tax improves fairness
    }

    // Adjust based on number of tax categories
    if (taxSystem.taxCategories && taxSystem.taxCategories.length > 0) {
      const categoryCount = taxSystem.taxCategories.length;
      if (categoryCount >= 3 && categoryCount <= 7) {
        effectiveness += 5; // Optimal number of tax categories
      } else if (categoryCount > 7) {
        effectiveness -= 5; // Too many categories reduce efficiency
      }
    }

    return Math.max(0, Math.min(100, effectiveness));
  }

  /**
   * Calculate cross-builder factors (synergies, conflicts, etc.)
   */
  private async calculateCrossBuilderFactors(
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null,
    taxSystem: TaxSystem | null,
    governmentComponents: ComponentType[] = []
  ) {
    const factors = {
      synergyBonus: 0,
      conflictPenalty: 0,
      optimizationPotential: 0,
      crossBuilderScore: 50
    };

    // Economy-Government factors
    if (governmentBuilder) {
      const crossBuilderAnalysis = crossBuilderSynergyService.analyzeCrossBuilderIntegration(
        economyBuilder,
        governmentBuilder
      );

      factors.synergyBonus += crossBuilderAnalysis.synergies.reduce((sum, s) => sum + s.strength, 0) / 10;
      factors.conflictPenalty += crossBuilderAnalysis.conflicts.reduce((sum, c) => sum + c.strength, 0) / 10;
      factors.optimizationPotential = crossBuilderAnalysis.overallScore;
    }

    // Economy-Tax factors
    if (taxSystem) {
      const taxSyncState = bidirectionalTaxSyncService.getState();
      if (taxSyncState.taxRecommendations.length > 0) {
        const avgRecommendationStrength = taxSyncState.taxRecommendations.reduce(
          (sum, rec) => sum + Math.abs(rec.recommendedRate - rec.currentRate), 0
        ) / taxSyncState.taxRecommendations.length;
        
        factors.optimizationPotential += Math.min(20, avgRecommendationStrength);
      }
    }

    // Government-Tax factors
    if (governmentBuilder && taxSystem) {
      // This would be calculated based on government-tax synergies
      // For now, we'll use a simplified calculation
      factors.crossBuilderScore += 10;
    }

    return factors;
  }

  /**
   * Calculate unified metrics
   */
  private calculateUnifiedMetrics(
    economyScore: number,
    governmentScore: number,
    taxScore: number,
    crossBuilderFactors: any
  ): UnifiedEffectivenessMetrics {
    // Weighted average of individual scores
    const overallScore = (economyScore * 0.4 + governmentScore * 0.35 + taxScore * 0.25);

    // Apply cross-builder adjustments
    const synergyBonus = Math.min(20, crossBuilderFactors.synergyBonus);
    const conflictPenalty = Math.min(30, crossBuilderFactors.conflictPenalty);
    const optimizationPotential = Math.min(50, crossBuilderFactors.optimizationPotential);

    // Calculate derived metrics
    const stabilityIndex = this.calculateStabilityIndex(economyScore, governmentScore, taxScore);
    const growthPotential = this.calculateGrowthPotential(economyScore, governmentScore, taxScore);
    const competitivenessIndex = this.calculateCompetitivenessIndex(economyScore, governmentScore, taxScore);

    return {
      overallScore: Math.max(0, Math.min(100, overallScore + synergyBonus - conflictPenalty)),
      economyScore,
      governmentScore,
      taxScore,
      synergyBonus,
      conflictPenalty,
      optimizationPotential,
      stabilityIndex,
      growthPotential,
      competitivenessIndex
    };
  }

  /**
   * Calculate stability index
   */
  private calculateStabilityIndex(economyScore: number, governmentScore: number, taxScore: number): number {
    // Stability is heavily influenced by government effectiveness and tax system stability
    const baseStability = (governmentScore * 0.5 + taxScore * 0.3 + economyScore * 0.2);
    
    // Bonus for balanced systems
    const balanceBonus = 100 - Math.abs(economyScore - governmentScore) - Math.abs(governmentScore - taxScore);
    
    return Math.max(0, Math.min(100, (baseStability + balanceBonus * 0.1) / 2));
  }

  /**
   * Calculate growth potential
   */
  private calculateGrowthPotential(economyScore: number, governmentScore: number, taxScore: number): number {
    // Growth potential is primarily driven by economy and government effectiveness
    const baseGrowth = (economyScore * 0.6 + governmentScore * 0.3 + taxScore * 0.1);
    
    // Penalty for low tax effectiveness (reduces growth potential)
    const taxPenalty = taxScore < 30 ? (30 - taxScore) * 0.5 : 0;
    
    return Math.max(0, Math.min(100, baseGrowth - taxPenalty));
  }

  /**
   * Calculate competitiveness index
   */
  private calculateCompetitivenessIndex(economyScore: number, governmentScore: number, taxScore: number): number {
    // Competitiveness requires all systems to be effective
    const minScore = Math.min(economyScore, governmentScore, taxScore);
    const avgScore = (economyScore + governmentScore + taxScore) / 3;
    
    // Competitiveness is limited by the weakest system
    return Math.max(0, Math.min(100, (avgScore * 0.7 + minScore * 0.3)));
  }

  /**
   * Calculate effectiveness breakdown
   */
  private calculateEffectivenessBreakdown(
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null,
    taxSystem: TaxSystem | null,
    crossBuilderFactors: any,
    governmentComponents: ComponentType[] = []
  ): EffectivenessBreakdown {
    const economyScore = this.calculateEconomyEffectiveness(economyBuilder);
    const governmentScore = this.calculateGovernmentEffectiveness(governmentBuilder, governmentComponents);
    const taxScore = this.calculateTaxEffectiveness(taxSystem);

    const baseEffectiveness = (economyScore + governmentScore + taxScore) / 3;
    const componentSynergies = this.calculateComponentSynergies(economyBuilder, governmentBuilder, governmentComponents);
    const crossBuilderSynergies = crossBuilderFactors.synergyBonus;
    const conflictPenalties = crossBuilderFactors.conflictPenalty;
    const optimizationBonuses = crossBuilderFactors.optimizationPotential;
    const stabilityFactors = this.calculateStabilityFactors(economyBuilder, governmentBuilder, taxSystem, governmentComponents);
    const growthFactors = this.calculateGrowthFactors(economyBuilder, governmentBuilder, taxSystem, governmentComponents);
    const competitivenessFactors = this.calculateCompetitivenessFactors(economyBuilder, governmentBuilder, taxSystem, governmentComponents);

    return {
      baseEffectiveness,
      componentSynergies,
      crossBuilderSynergies,
      conflictPenalties,
      optimizationBonuses,
      stabilityFactors,
      growthFactors,
      competitivenessFactors
    };
  }

  /**
   * Calculate component synergies within systems
   */
  private calculateComponentSynergies(
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null,
    governmentComponents: ComponentType[] = []
  ): number {
    let synergies = 0;

    // Economy component synergies
    economyBuilder.selectedAtomicComponents.forEach(comp1 => {
      economyBuilder.selectedAtomicComponents.forEach(comp2 => {
        if (comp1 !== comp2) {
          const component1 = ATOMIC_ECONOMIC_COMPONENTS[comp1];
          if (component1?.synergies.includes(comp2)) {
            synergies += 2;
          }
        }
      });
    });

    // Government component synergies
    if (governmentComponents.length > 0) {
      governmentComponents.forEach(comp1 => {
        governmentComponents.forEach(comp2 => {
          if (comp1 !== comp2) {
            const component1 = ATOMIC_COMPONENTS[comp1];
            if (component1?.synergies.includes(comp2)) {
              synergies += 2;
            }
          }
        });
      });
    }

    return Math.min(30, synergies);
  }

  /**
   * Calculate stability factors
   */
  private calculateStabilityFactors(
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null,
    taxSystem: TaxSystem | null,
    governmentComponents: ComponentType[] = []
  ): number {
    let stability = 50;

    // Government stability
    if (governmentComponents.length > 0) {
      const hasRuleOfLaw = governmentComponents.includes(ComponentType.RULE_OF_LAW);
      const hasIndependentJudiciary = governmentComponents.includes(ComponentType.INDEPENDENT_JUDICIARY);
      const hasProfessionalBureaucracy = governmentComponents.includes(ComponentType.PROFESSIONAL_BUREAUCRACY);
      
      if (hasRuleOfLaw) stability += 15;
      if (hasIndependentJudiciary) stability += 10;
      if (hasProfessionalBureaucracy) stability += 10;
    }

    // Economic stability
    const hasMixedEconomy = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.MIXED_ECONOMY);
    const hasSocialMarket = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.SOCIAL_MARKET_ECONOMY);
    
    if (hasMixedEconomy) stability += 10;
    if (hasSocialMarket) stability += 15;

    // Tax stability
    if (taxSystem?.progressiveTax) stability += 10;
    if (taxSystem?.complianceRate && taxSystem.complianceRate > 80) stability += 5;

    return Math.min(100, stability);
  }

  /**
   * Calculate growth factors
   */
  private calculateGrowthFactors(
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null,
    taxSystem: TaxSystem | null,
    governmentComponents: ComponentType[] = []
  ): number {
    let growth = 50;

    // Economic growth factors
    const hasInnovation = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.INNOVATION_ECONOMY);
    const hasKnowledge = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.KNOWLEDGE_ECONOMY);
    const hasRnd = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.RD_INVESTMENT);
    
    if (hasInnovation) growth += 20;
    if (hasKnowledge) growth += 15;
    if (hasRnd) growth += 10;

    // Government growth factors
    if (governmentComponents.length > 0) {
      const hasTechnocratic = governmentComponents.includes(ComponentType.TECHNOCRATIC_PROCESS);
      const hasDigitalGov = governmentComponents.includes(ComponentType.DIGITAL_GOVERNMENT);
      
      if (hasTechnocratic) growth += 15;
      if (hasDigitalGov) growth += 10;
    }

    // Tax growth factors
    if (taxSystem?.collectionEfficiency && taxSystem.collectionEfficiency > 80) growth += 10;

    return Math.min(100, growth);
  }

  /**
   * Calculate competitiveness factors
   */
  private calculateCompetitivenessFactors(
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null,
    taxSystem: TaxSystem | null,
    governmentComponents: ComponentType[] = []
  ): number {
    let competitiveness = 50;

    // Economic competitiveness
    const hasFreeMarket = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.FREE_MARKET_SYSTEM);
    const hasExportOriented = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.EXPORT_ORIENTED);
    const hasFlexibleLabor = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.FLEXIBLE_LABOR);
    
    if (hasFreeMarket) competitiveness += 15;
    if (hasExportOriented) competitiveness += 20;
    if (hasFlexibleLabor) competitiveness += 10;

    // Government competitiveness
    if (governmentComponents.length > 0) {
      const hasProfessionalBureaucracy = governmentComponents.includes(ComponentType.PROFESSIONAL_BUREAUCRACY);
      const hasRuleOfLaw = governmentComponents.includes(ComponentType.RULE_OF_LAW);
      
      if (hasProfessionalBureaucracy) competitiveness += 15;
      if (hasRuleOfLaw) competitiveness += 20;
    }

    // Tax competitiveness
    if (taxSystem?.taxCategories) {
      const corporateTax = taxSystem.taxCategories.find(cat => cat.categoryName === 'Corporate Income Tax');
      if (corporateTax && corporateTax.baseRate && corporateTax.baseRate < 25) {
        competitiveness += 10;
      }
    }

    return Math.min(100, competitiveness);
  }

  /**
   * Generate optimization recommendations
   */
  private async generateOptimizationRecommendations(
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null,
    taxSystem: TaxSystem | null,
    crossBuilderFactors: any,
    governmentComponents: ComponentType[] = []
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Economy optimization recommendations
    if (crossBuilderFactors.optimizationPotential > 30) {
      recommendations.push({
        id: 'economy-optimization',
        type: 'economy',
        priority: 'high',
        title: 'Optimize Economic Component Synergies',
        description: 'Add synergistic economic components to improve overall effectiveness',
        expectedImprovement: 15,
        implementationCost: 100000,
        timeToImplement: 'medium_term',
        affectedSystems: ['economy'],
        requirements: ['Economic component analysis', 'Synergy mapping']
      });
    }

    // Government optimization recommendations
    if (governmentBuilder && this.calculateGovernmentEffectiveness(governmentBuilder, governmentComponents) < 70) {
      recommendations.push({
        id: 'government-optimization',
        type: 'government',
        priority: 'high',
        title: 'Improve Government System Effectiveness',
        description: 'Add or modify government components to enhance governance effectiveness',
        expectedImprovement: 20,
        implementationCost: 200000,
        timeToImplement: 'long_term',
        affectedSystems: ['government'],
        requirements: ['Government component analysis', 'Capacity assessment']
      });
    }

    // Tax optimization recommendations
    if (taxSystem && this.calculateTaxEffectiveness(taxSystem) < 60) {
      recommendations.push({
        id: 'tax-optimization',
        type: 'tax',
        priority: 'medium',
        title: 'Optimize Tax System Structure',
        description: 'Improve tax system efficiency and compliance',
        expectedImprovement: 12,
        implementationCost: 50000,
        timeToImplement: 'short_term',
        affectedSystems: ['tax'],
        requirements: ['Tax system analysis', 'Compliance assessment']
      });
    }

    // Cross-builder optimization recommendations
    if (crossBuilderFactors.conflictPenalty > 10) {
      recommendations.push({
        id: 'cross-builder-conflict-resolution',
        type: 'cross_builder',
        priority: 'critical',
        title: 'Resolve Cross-Builder Conflicts',
        description: 'Address conflicts between economy, government, and tax systems',
        expectedImprovement: 25,
        implementationCost: 150000,
        timeToImplement: 'medium_term',
        affectedSystems: ['economy', 'government', 'tax'],
        requirements: ['Cross-builder analysis', 'Conflict resolution planning']
      });
    }

    return recommendations;
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(crossBuilderFactors: any): string[] {
    const risks: string[] = [];

    if (crossBuilderFactors.conflictPenalty > 15) {
      risks.push('High cross-builder conflicts may reduce overall system stability');
    }

    if (crossBuilderFactors.optimizationPotential < 20) {
      risks.push('Limited optimization potential may constrain future growth');
    }

    if (crossBuilderFactors.synergyBonus < 5) {
      risks.push('Low synergy levels may indicate suboptimal system integration');
    }

    return risks;
  }

  /**
   * Identify strengths
   */
  private identifyStrengths(
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null,
    taxSystem: TaxSystem | null,
    governmentComponents: ComponentType[] = []
  ): string[] {
    const strengths: string[] = [];

    const economyScore = this.calculateEconomyEffectiveness(economyBuilder);
    if (economyScore > 80) {
      strengths.push('Strong economic system with high effectiveness');
    }

    if (governmentBuilder) {
      const governmentScore = this.calculateGovernmentEffectiveness(governmentBuilder, governmentComponents);
      if (governmentScore > 80) {
        strengths.push('Robust government system with excellent governance');
      }
    }

    if (taxSystem) {
      const taxScore = this.calculateTaxEffectiveness(taxSystem);
      if (taxScore > 75) {
        strengths.push('Efficient tax system with good collection and compliance');
      }
    }

    // Check for specific strong components
    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.INNOVATION_ECONOMY)) {
      strengths.push('Innovation-focused economy with high growth potential');
    }

    if (governmentComponents.includes(ComponentType.RULE_OF_LAW)) {
      strengths.push('Strong rule of law providing stability and predictability');
    }

    return strengths;
  }

  /**
   * Identify weaknesses
   */
  private identifyWeaknesses(
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null,
    taxSystem: TaxSystem | null,
    governmentComponents: ComponentType[] = []
  ): string[] {
    const weaknesses: string[] = [];

    const economyScore = this.calculateEconomyEffectiveness(economyBuilder);
    if (economyScore < 60) {
      weaknesses.push('Economic system effectiveness below optimal levels');
    }

    if (governmentBuilder) {
      const governmentScore = this.calculateGovernmentEffectiveness(governmentBuilder);
      if (governmentScore < 60) {
        weaknesses.push('Government system requires improvement for better governance');
      }
    }

    if (taxSystem) {
      const taxScore = this.calculateTaxEffectiveness(taxSystem);
      if (taxScore < 50) {
        weaknesses.push('Tax system efficiency needs significant improvement');
      }
    }

    // Check for missing critical components
    if (!economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.MIXED_ECONOMY) &&
        !economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.SOCIAL_MARKET_ECONOMY)) {
      weaknesses.push('Lack of balanced economic model may reduce stability');
    }

    if (governmentBuilder && !governmentComponents.includes(ComponentType.RULE_OF_LAW)) {
      weaknesses.push('Absence of rule of law may undermine system stability');
    }

    return weaknesses;
  }

  /**
   * Calculate confidence in analysis
   */
  private calculateConfidence(
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null,
    taxSystem: TaxSystem | null,
    governmentComponents: ComponentType[] = []
  ): number {
    let confidence = 70; // Base confidence

    // Increase confidence based on data availability
    if (economyBuilder.selectedAtomicComponents.length >= 3) confidence += 10;
    if (governmentComponents.length >= 3) confidence += 10;
    if (taxSystem?.taxCategories && taxSystem.taxCategories.length >= 2) confidence += 10;

    // Decrease confidence for incomplete systems
    if (!governmentBuilder) confidence -= 15;
    if (!taxSystem) confidence -= 15;

    return Math.max(50, Math.min(95, confidence));
  }
}

// Export singleton instance
export const unifiedEffectivenessCalculator = UnifiedEffectivenessCalculator.getInstance();
