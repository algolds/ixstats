/**
 * Cross-Builder Synergy Service
 *
 * This service provides comprehensive cross-builder synergy detection and analysis
 * between economy, government, and tax systems. It analyzes component combinations
 * to identify synergies, conflicts, and optimization opportunities.
 */

import { EconomicComponentType, ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/atomic-economic-data";
import {
  ComponentType,
  ATOMIC_COMPONENTS,
} from "~/components/government/atoms/AtomicGovernmentComponents";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { GovernmentBuilderState } from "~/types/government";

export interface CrossBuilderSynergy {
  id: string;
  type:
    | "economy-government"
    | "government-economy"
    | "economy-tax"
    | "tax-economy"
    | "government-tax"
    | "tax-government";
  components: {
    economic?: EconomicComponentType;
    government?: ComponentType;
    tax?: string;
  };
  strength: number; // 0-100
  description: string;
  impact: {
    effectiveness: number;
    economicGrowth: number;
    taxEfficiency: number;
    governmentCapacity: number;
    stability: number;
  };
  category: "synergy" | "conflict" | "neutral";
  recommendations: string[];
}

export interface CrossBuilderAnalysis {
  synergies: CrossBuilderSynergy[];
  conflicts: CrossBuilderSynergy[];
  overallScore: number; // 0-100
  optimizationOpportunities: string[];
  riskFactors: string[];
  unifiedEffectiveness: number;
  overallCrossBuilderScore: number;
  recommendations: string[];
}

export interface SynergyPattern {
  id: string;
  name: string;
  description: string;
  components: {
    economic?: EconomicComponentType[];
    government?: ComponentType[];
    tax?: string[];
  };
  strength: number;
  impact: {
    effectiveness: number;
    economicGrowth: number;
    taxEfficiency: number;
    governmentCapacity: number;
    stability: number;
  };
  category: "synergy" | "conflict";
}

export class CrossBuilderSynergyService {
  private synergyPatterns: SynergyPattern[] = [];
  private conflictPatterns: SynergyPattern[] = [];

  constructor() {
    this.initializeSynergyPatterns();
    this.initializeConflictPatterns();
  }

  /**
   * Analyze cross-builder synergies and conflicts
   */
  analyzeCrossBuilderIntegration(
    economyBuilder: EconomyBuilderState,
    governmentBuilder: GovernmentBuilderState | null,
    taxSystem: any = null
  ): CrossBuilderAnalysis {
    const economicComponents = economyBuilder.selectedAtomicComponents;
    const governmentComponents = (governmentBuilder?.selectedComponents || []).map(
      (ct) => ct as ComponentType
    );
    const taxComponents = this.extractTaxComponents(taxSystem);

    const synergies = this.detectSynergies(economicComponents, governmentComponents, taxComponents);
    const conflicts = this.detectConflicts(economicComponents, governmentComponents, taxComponents);

    const overallScore = this.calculateOverallScore(synergies, conflicts);
    const optimizationOpportunities = this.identifyOptimizationOpportunities(synergies, conflicts);
    const riskFactors = this.identifyRiskFactors(conflicts);
    const unifiedEffectiveness = this.calculateUnifiedEffectiveness(
      economicComponents,
      governmentComponents,
      synergies,
      conflicts
    );

    return {
      synergies,
      conflicts,
      overallScore,
      optimizationOpportunities,
      riskFactors,
      unifiedEffectiveness,
      overallCrossBuilderScore: overallScore,
      recommendations: [
        ...optimizationOpportunities,
        ...this.generateGeneralRecommendations(synergies, conflicts),
      ],
    };
  }

  /**
   * Detect specific synergy patterns
   */
  private detectSynergies(
    economicComponents: EconomicComponentType[],
    governmentComponents: ComponentType[],
    taxComponents: string[]
  ): CrossBuilderSynergy[] {
    const synergies: CrossBuilderSynergy[] = [];

    // Economy-Government synergies
    economicComponents.forEach((economicComp) => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[economicComp];
      if (component?.governmentSynergies) {
        component.governmentSynergies.forEach((govSynergy) => {
          const govComponent = governmentComponents.find((gc) =>
            ATOMIC_COMPONENTS[gc]?.name.toLowerCase().includes(govSynergy.toLowerCase())
          );

          if (govComponent) {
            const synergyStrength = this.calculateSynergyStrength(economicComp, govComponent);
            synergies.push({
              id: `economy-gov-${economicComp}-${govComponent}`,
              type: "economy-government",
              components: { economic: economicComp, government: govComponent },
              strength: synergyStrength,
              description: `${component.name} synergizes with ${ATOMIC_COMPONENTS[govComponent]?.name}`,
              impact: this.calculateSynergyImpact(economicComp, govComponent, "synergy"),
              category: "synergy",
              recommendations: this.generateSynergyRecommendations(economicComp, govComponent),
            });
          }
        });
      }
    });

    // Government-Economy synergies (reverse direction)
    governmentComponents.forEach((govComp) => {
      const component = ATOMIC_COMPONENTS[govComp];
      if (component?.synergies) {
        component.synergies.forEach((econSynergy) => {
          const econComponent = economicComponents.find((ec) =>
            ATOMIC_ECONOMIC_COMPONENTS[ec]?.name.toLowerCase().includes(econSynergy.toLowerCase())
          );

          if (econComponent) {
            const synergyStrength = this.calculateSynergyStrength(econComponent, govComp);
            synergies.push({
              id: `gov-economy-${govComp}-${econComponent}`,
              type: "government-economy",
              components: { economic: econComponent, government: govComp },
              strength: synergyStrength,
              description: `${component.name} supports ${ATOMIC_ECONOMIC_COMPONENTS[econComponent]?.name}`,
              impact: this.calculateSynergyImpact(econComponent, govComp, "synergy"),
              category: "synergy",
              recommendations: this.generateSynergyRecommendations(econComponent, govComp),
            });
          }
        });
      }
    });

    // Economy-Tax synergies
    economicComponents.forEach((economicComp) => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[economicComp];
      if (component) {
        const taxRecommendations = this.generateTaxRecommendations(economicComp);

        taxRecommendations.forEach((taxRec) => {
          synergies.push({
            id: `economy-tax-${economicComp}-${taxRec.type}`,
            type: "economy-tax",
            components: { economic: economicComp, tax: taxRec.type },
            strength: taxRec.strength,
            description: `${component.name} benefits from ${taxRec.type} tax policy`,
            impact: this.calculateTaxSynergyImpact(economicComp, taxRec),
            category: "synergy",
            recommendations: [taxRec.recommendation],
          });
        });
      }
    });

    return synergies;
  }

  /**
   * Detect conflict patterns
   */
  private detectConflicts(
    economicComponents: EconomicComponentType[],
    governmentComponents: ComponentType[],
    taxComponents: string[]
  ): CrossBuilderSynergy[] {
    const conflicts: CrossBuilderSynergy[] = [];

    // Economy-Government conflicts
    economicComponents.forEach((economicComp) => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[economicComp];
      if (component?.governmentConflicts) {
        component.governmentConflicts.forEach((govConflict) => {
          const govComponent = governmentComponents.find((gc) =>
            ATOMIC_COMPONENTS[gc]?.name.toLowerCase().includes(govConflict.toLowerCase())
          );

          if (govComponent) {
            const conflictStrength = this.calculateConflictStrength(economicComp, govComponent);
            conflicts.push({
              id: `economy-gov-conflict-${economicComp}-${govComponent}`,
              type: "economy-government",
              components: { economic: economicComp, government: govComponent },
              strength: conflictStrength,
              description: `${component.name} conflicts with ${ATOMIC_COMPONENTS[govComponent]?.name}`,
              impact: this.calculateSynergyImpact(economicComp, govComponent, "conflict"),
              category: "conflict",
              recommendations: this.generateConflictResolutionRecommendations(
                economicComp,
                govComponent
              ),
            });
          }
        });
      }
    });

    // Government-Economy conflicts (reverse direction)
    governmentComponents.forEach((govComp) => {
      const component = ATOMIC_COMPONENTS[govComp];
      if (component?.conflicts) {
        component.conflicts.forEach((econConflict) => {
          const econComponent = economicComponents.find((ec) =>
            ATOMIC_ECONOMIC_COMPONENTS[ec]?.name.toLowerCase().includes(econConflict.toLowerCase())
          );

          if (econComponent) {
            const conflictStrength = this.calculateConflictStrength(econComponent, govComp);
            conflicts.push({
              id: `gov-economy-conflict-${govComp}-${econComponent}`,
              type: "government-economy",
              components: { economic: econComponent, government: govComp },
              strength: conflictStrength,
              description: `${component.name} conflicts with ${ATOMIC_ECONOMIC_COMPONENTS[econComponent]?.name}`,
              impact: this.calculateSynergyImpact(econComponent, govComp, "conflict"),
              category: "conflict",
              recommendations: this.generateConflictResolutionRecommendations(
                econComponent,
                govComp
              ),
            });
          }
        });
      }
    });

    return conflicts;
  }

  /**
   * Initialize predefined synergy patterns
   */
  private initializeSynergyPatterns(): void {
    this.synergyPatterns = [
      // High-impact synergy patterns
      {
        id: "free-market-democracy",
        name: "Free Market Democracy",
        description:
          "Free market economy with democratic governance creates optimal conditions for growth",
        components: {
          economic: [
            EconomicComponentType.FREE_MARKET_SYSTEM,
            EconomicComponentType.FLEXIBLE_LABOR,
          ],
          government: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.RULE_OF_LAW],
        },
        strength: 95,
        impact: {
          effectiveness: 20,
          economicGrowth: 25,
          taxEfficiency: 15,
          governmentCapacity: 10,
          stability: 15,
        },
        category: "synergy",
      },
      {
        id: "innovation-ecosystem",
        name: "Innovation Ecosystem",
        description:
          "Innovation economy with research-focused government creates technological advancement",
        components: {
          economic: [
            EconomicComponentType.INNOVATION_ECONOMY,
            EconomicComponentType.KNOWLEDGE_ECONOMY,
          ],
          government: [ComponentType.PROFESSIONAL_BUREAUCRACY, ComponentType.TECHNOCRATIC_PROCESS],
        },
        strength: 90,
        impact: {
          effectiveness: 25,
          economicGrowth: 30,
          taxEfficiency: 20,
          governmentCapacity: 15,
          stability: 10,
        },
        category: "synergy",
      },
      {
        id: "social-market-welfare",
        name: "Social Market Welfare",
        description:
          "Social market economy with comprehensive welfare state ensures equity and stability",
        components: {
          economic: [
            EconomicComponentType.SOCIAL_MARKET_ECONOMY,
            EconomicComponentType.PROTECTED_WORKERS,
          ],
          government: [ComponentType.WELFARE_STATE, ComponentType.UNIVERSAL_HEALTHCARE],
        },
        strength: 85,
        impact: {
          effectiveness: 15,
          economicGrowth: 10,
          taxEfficiency: 12,
          governmentCapacity: 20,
          stability: 25,
        },
        category: "synergy",
      },
      {
        id: "export-oriented-bureaucracy",
        name: "Export-Oriented Bureaucracy",
        description:
          "Export-focused economy with professional bureaucracy maximizes trade efficiency",
        components: {
          economic: [
            EconomicComponentType.EXPORT_ORIENTED,
            EconomicComponentType.MANUFACTURING_LED,
          ],
          government: [ComponentType.PROFESSIONAL_BUREAUCRACY, ComponentType.TRADE_AGREEMENTS],
        },
        strength: 80,
        impact: {
          effectiveness: 18,
          economicGrowth: 20,
          taxEfficiency: 10,
          governmentCapacity: 12,
          stability: 8,
        },
        category: "synergy",
      },
    ];
  }

  /**
   * Initialize predefined conflict patterns
   */
  private initializeConflictPatterns(): void {
    this.conflictPatterns = [
      {
        id: "free-market-authoritarian",
        name: "Free Market Authoritarian Conflict",
        description: "Free market economy conflicts with authoritarian governance",
        components: {
          economic: [EconomicComponentType.FREE_MARKET_SYSTEM],
          government: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.CENTRALIZED_POWER],
        },
        strength: 85,
        impact: {
          effectiveness: -20,
          economicGrowth: -15,
          taxEfficiency: -10,
          governmentCapacity: -5,
          stability: -25,
        },
        category: "conflict",
      },
      {
        id: "planned-economy-democracy",
        name: "Planned Economy Democratic Conflict",
        description: "Planned economy conflicts with democratic processes",
        components: {
          economic: [EconomicComponentType.PLANNED_ECONOMY],
          government: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.FEDERAL_SYSTEM],
        },
        strength: 75,
        impact: {
          effectiveness: -15,
          economicGrowth: -20,
          taxEfficiency: -8,
          governmentCapacity: -10,
          stability: -15,
        },
        category: "conflict",
      },
    ];
  }

  /**
   * Calculate synergy strength between components
   */
  private calculateSynergyStrength(
    economicComp: EconomicComponentType,
    govComp: ComponentType
  ): number {
    const economicComponent = ATOMIC_ECONOMIC_COMPONENTS[economicComp];
    const govComponent = ATOMIC_COMPONENTS[govComp];

    if (!economicComponent || !govComponent) return 0;

    // Base strength from component effectiveness
    const baseStrength = (economicComponent.effectiveness + govComponent.effectiveness) / 2;

    // Check for predefined patterns
    const pattern = this.synergyPatterns.find(
      (p) =>
        p.components.economic?.includes(economicComp) && p.components.government?.includes(govComp)
    );

    if (pattern) {
      return Math.min(100, baseStrength + pattern.strength - 75);
    }

    // Default synergy calculation
    return Math.min(100, baseStrength + 10);
  }

  /**
   * Calculate conflict strength between components
   */
  private calculateConflictStrength(
    economicComp: EconomicComponentType,
    govComp: ComponentType
  ): number {
    const economicComponent = ATOMIC_ECONOMIC_COMPONENTS[economicComp];
    const govComponent = ATOMIC_COMPONENTS[govComp];

    if (!economicComponent || !govComponent) return 0;

    // Check for predefined conflict patterns
    const pattern = this.conflictPatterns.find(
      (p) =>
        p.components.economic?.includes(economicComp) && p.components.government?.includes(govComp)
    );

    if (pattern) {
      return pattern.strength;
    }

    // Default conflict calculation
    return 60;
  }

  /**
   * Calculate impact of synergy or conflict
   */
  private calculateSynergyImpact(
    economicComp: EconomicComponentType,
    govComp: ComponentType,
    type: "synergy" | "conflict"
  ) {
    const economicComponent = ATOMIC_ECONOMIC_COMPONENTS[economicComp];
    const govComponent = ATOMIC_COMPONENTS[govComp];

    const multiplier = type === "synergy" ? 1 : -1;
    const baseImpact = type === "synergy" ? 10 : -8;

    return {
      effectiveness: baseImpact * multiplier,
      economicGrowth: (baseImpact + 2) * multiplier,
      taxEfficiency: (baseImpact - 2) * multiplier,
      governmentCapacity: (baseImpact + 1) * multiplier,
      stability: (baseImpact + 3) * multiplier,
    };
  }

  /**
   * Calculate tax synergy impact
   */
  private calculateTaxSynergyImpact(economicComp: EconomicComponentType, taxRecommendation: any) {
    return {
      effectiveness: taxRecommendation.strength * 0.2,
      economicGrowth: taxRecommendation.strength * 0.3,
      taxEfficiency: taxRecommendation.strength * 0.4,
      governmentCapacity: taxRecommendation.strength * 0.1,
      stability: taxRecommendation.strength * 0.1,
    };
  }

  /**
   * Generate tax recommendations for economic component
   */
  private generateTaxRecommendations(economicComp: EconomicComponentType) {
    const component = ATOMIC_ECONOMIC_COMPONENTS[economicComp];
    if (!component) return [];

    const recommendations = [];

    // Corporate tax recommendations
    if (component.taxImpact.optimalCorporateRate < 25) {
      recommendations.push({
        type: "Corporate Tax",
        strength: 80,
        recommendation: `Lower corporate tax rate to ${component.taxImpact.optimalCorporateRate}% to support ${component.name}`,
      });
    }

    // Income tax recommendations
    if (component.taxImpact.optimalIncomeRate < 30) {
      recommendations.push({
        type: "Income Tax",
        strength: 75,
        recommendation: `Optimize income tax rate to ${component.taxImpact.optimalIncomeRate}% for ${component.name}`,
      });
    }

    // Special tax incentives
    if (economicComp === EconomicComponentType.INNOVATION_ECONOMY) {
      recommendations.push({
        type: "R&D Tax Credit",
        strength: 90,
        recommendation: "Implement R&D tax credits to support innovation economy",
      });
    }

    if (economicComp === EconomicComponentType.EXPORT_ORIENTED) {
      recommendations.push({
        type: "Export Tax Incentive",
        strength: 85,
        recommendation: "Provide export tax incentives for export-oriented economy",
      });
    }

    return recommendations;
  }

  /**
   * Generate synergy recommendations
   */
  private generateSynergyRecommendations(
    economicComp: EconomicComponentType,
    govComp: ComponentType
  ): string[] {
    const recommendations = [];

    // Specific recommendations based on component combinations
    if (
      economicComp === EconomicComponentType.INNOVATION_ECONOMY &&
      govComp === ComponentType.PROFESSIONAL_BUREAUCRACY
    ) {
      recommendations.push("Establish innovation agencies within professional bureaucracy");
      recommendations.push("Create streamlined R&D approval processes");
      recommendations.push("Implement innovation metrics in government performance evaluation");
    }

    if (
      economicComp === EconomicComponentType.SOCIAL_MARKET_ECONOMY &&
      govComp === ComponentType.WELFARE_STATE
    ) {
      recommendations.push("Align social safety nets with market economy principles");
      recommendations.push("Implement progressive taxation for social equity");
      recommendations.push("Create public-private partnerships for social services");
    }

    if (
      economicComp === EconomicComponentType.EXPORT_ORIENTED &&
      govComp === ComponentType.TRADE_AGREEMENTS
    ) {
      recommendations.push("Streamline export documentation processes");
      recommendations.push("Establish trade promotion agencies");
      recommendations.push("Implement export financing programs");
    }

    return recommendations;
  }

  /**
   * Generate conflict resolution recommendations
   */
  private generateConflictResolutionRecommendations(
    economicComp: EconomicComponentType,
    govComp: ComponentType
  ): string[] {
    const recommendations = [];

    if (
      economicComp === EconomicComponentType.FREE_MARKET_SYSTEM &&
      govComp === ComponentType.AUTOCRATIC_PROCESS
    ) {
      recommendations.push("Consider transitioning to democratic processes for market confidence");
      recommendations.push("Implement independent regulatory bodies");
      recommendations.push("Establish property rights protection mechanisms");
    }

    if (
      economicComp === EconomicComponentType.PLANNED_ECONOMY &&
      govComp === ComponentType.DEMOCRATIC_PROCESS
    ) {
      recommendations.push("Introduce market mechanisms within planned economy");
      recommendations.push("Create participatory planning processes");
      recommendations.push("Establish market feedback mechanisms");
    }

    return recommendations;
  }

  /**
   * Calculate overall cross-builder score
   */
  private calculateOverallScore(
    synergies: CrossBuilderSynergy[],
    conflicts: CrossBuilderSynergy[]
  ): number {
    let score = 50; // Base score

    // Add synergy bonuses
    synergies.forEach((synergy) => {
      score += (synergy.strength / 100) * 10;
    });

    // Subtract conflict penalties
    conflicts.forEach((conflict) => {
      score -= (conflict.strength / 100) * 15;
    });

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Identify optimization opportunities
   */
  private identifyOptimizationOpportunities(
    synergies: CrossBuilderSynergy[],
    conflicts: CrossBuilderSynergy[]
  ): string[] {
    const opportunities = [];

    // High-strength synergies suggest optimization opportunities
    const strongSynergies = synergies.filter((s) => s.strength > 80);
    strongSynergies.forEach((synergy) => {
      opportunities.push(
        `Leverage strong synergy between ${synergy.description} for maximum benefit`
      );
    });

    // Conflicts suggest resolution opportunities
    conflicts.forEach((conflict) => {
      opportunities.push(
        `Resolve conflict between ${conflict.description} to improve overall effectiveness`
      );
    });

    // Missing synergies suggest addition opportunities
    if (synergies.length < 3) {
      opportunities.push("Consider adding more synergistic component combinations");
    }

    return opportunities;
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(conflicts: CrossBuilderSynergy[]): string[] {
    const risks = [];

    conflicts.forEach((conflict) => {
      if (conflict.strength > 70) {
        risks.push(`High-strength conflict: ${conflict.description}`);
      }
    });

    if (conflicts.length > 3) {
      risks.push("Multiple component conflicts may reduce overall system stability");
    }

    return risks;
  }

  /**
   * Calculate unified effectiveness across all builders
   */
  private calculateUnifiedEffectiveness(
    economicComponents: EconomicComponentType[],
    governmentComponents: ComponentType[],
    synergies: CrossBuilderSynergy[],
    conflicts: CrossBuilderSynergy[]
  ): number {
    // Base effectiveness from components
    const economicEffectiveness =
      economicComponents.reduce((sum, comp) => {
        return sum + (ATOMIC_ECONOMIC_COMPONENTS[comp]?.effectiveness || 0);
      }, 0) / economicComponents.length || 0;

    const governmentEffectiveness =
      governmentComponents.reduce((sum, comp) => {
        return sum + (ATOMIC_COMPONENTS[comp]?.effectiveness || 0);
      }, 0) / governmentComponents.length || 0;

    const baseEffectiveness = (economicEffectiveness + governmentEffectiveness) / 2;

    // Apply synergy bonuses
    const synergyBonus = synergies.reduce((sum, synergy) => {
      return sum + synergy.impact.effectiveness * (synergy.strength / 100);
    }, 0);

    // Apply conflict penalties
    const conflictPenalty = conflicts.reduce((sum, conflict) => {
      return sum + Math.abs(conflict.impact.effectiveness) * (conflict.strength / 100);
    }, 0);

    return Math.max(0, Math.min(100, baseEffectiveness + synergyBonus - conflictPenalty));
  }

  /**
   * Extract tax components from tax system
   */
  private extractTaxComponents(taxSystem: any): string[] {
    if (!taxSystem) return [];

    // This would be implemented based on the actual tax system structure
    return [];
  }

  /**
   * Generate general recommendations based on synergies and conflicts
   */
  private generateGeneralRecommendations(
    synergies: CrossBuilderSynergy[],
    conflicts: CrossBuilderSynergy[]
  ): string[] {
    const recommendations: string[] = [];

    if (synergies.length > 0) {
      recommendations.push("Continue leveraging identified synergies between systems");
    }

    if (conflicts.length > 0) {
      recommendations.push(
        "Prioritize resolving conflicts to improve overall system effectiveness"
      );
    }

    if (synergies.length < 2) {
      recommendations.push("Consider adding more components with synergistic relationships");
    }

    return recommendations;
  }
}

// Export singleton instance
export const crossBuilderSynergyService = new CrossBuilderSynergyService();
