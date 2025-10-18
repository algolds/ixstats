/**
 * UnifiedValidationService
 * 
 * Comprehensive validation system for cross-builder consistency
 * across economy, government, and tax systems.
 */

import { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import type { TaxSystem } from '~/types/tax-system';
import type { EconomyBuilderState } from '~/types/economy-builder';
import type { GovernmentBuilderState } from '~/types/government';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: 'consistency' | 'feasibility' | 'compatibility' | 'performance' | 'policy';
  severity: 'low' | 'medium' | 'high' | 'critical';
  systems: ('economy' | 'government' | 'tax')[];
  validate: (context: ValidationContext) => ValidationResult;
}

export interface ValidationContext {
  economyBuilder: EconomyBuilderState | null;
  governmentBuilder: GovernmentBuilderState | null;
  governmentComponents: ComponentType[];
  taxSystem: TaxSystem | null;
  userPreferences?: {
    growthFocus?: boolean;
    stabilityFocus?: boolean;
    innovationFocus?: boolean;
    equityFocus?: boolean;
    complexity?: 'low' | 'medium' | 'high';
  };
}

export interface ValidationResult {
  ruleId: string;
  passed: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: string[];
  suggestions: string[];
  impact: {
    economic?: number;
    government?: number;
    tax?: number;
    overall?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface ValidationReport {
  timestamp: number;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  passRate: number;
  results: ValidationResult[];
  summary: {
    critical: ValidationResult[];
    high: ValidationResult[];
    medium: ValidationResult[];
    low: ValidationResult[];
  };
  recommendations: string[];
  warnings: string[];
  systemHealth: {
    economy: number;
    government: number;
    tax: number;
    overall: number;
  };
  consistencyScore: number;
  feasibilityScore: number;
  compatibilityScore: number;
  criticalIssues: ValidationResult[];
}

export class UnifiedValidationService {
  private rules: Map<string, ValidationRule> = new Map();

  constructor() {
    this.initializeRules();
  }

  /**
   * Run comprehensive validation across all systems
   */
  public async validateAll(context: ValidationContext): Promise<ValidationReport> {
    const results: ValidationResult[] = [];
    
    for (const rule of this.rules.values()) {
      try {
        const result = rule.validate(context);
        results.push(result);
      } catch (error) {
        results.push({
          ruleId: rule.id,
          passed: false,
          severity: 'critical',
          message: `Validation error: ${error}`,
          details: [`Rule ${rule.id} failed to execute`],
          suggestions: ['Check system configuration and try again'],
          impact: { overall: -10 }
        });
      }
    }

    return this.generateReport(results);
  }

  /**
   * Validate specific category of rules
   */
  public async validateCategory(
    category: ValidationRule['category'], 
    context: ValidationContext
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const rule of this.rules.values()) {
      if (rule.category === category) {
        try {
          const result = rule.validate(context);
          results.push(result);
        } catch (error) {
          results.push({
            ruleId: rule.id,
            passed: false,
            severity: 'critical',
            message: `Validation error: ${error}`,
            details: [`Rule ${rule.id} failed to execute`],
            suggestions: ['Check system configuration and try again'],
            impact: { overall: -10 }
          });
        }
      }
    }

    return results;
  }

  /**
   * Get validation rules by system
   */
  public getRulesBySystem(system: 'economy' | 'government' | 'tax'): ValidationRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.systems.includes(system));
  }

  /**
   * Get validation rules by category
   */
  public getRulesByCategory(category: ValidationRule['category']): ValidationRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.category === category);
  }

  /**
   * Initialize all validation rules
   */
  private initializeRules(): void {
    // Economic System Rules
    this.addRule({
      id: 'economy-component-compatibility',
      name: 'Economic Component Compatibility',
      description: 'Ensures selected economic components are compatible with each other',
      category: 'compatibility',
      severity: 'high',
      systems: ['economy'],
      validate: (context) => this.validateEconomicComponentCompatibility(context)
    });

    this.addRule({
      id: 'economy-government-alignment',
      name: 'Economy-Government Alignment',
      description: 'Validates alignment between economic model and government structure',
      category: 'consistency',
      severity: 'high',
      systems: ['economy', 'government'],
      validate: (context) => this.validateEconomyGovernmentAlignment(context)
    });

    this.addRule({
      id: 'economy-tax-consistency',
      name: 'Economy-Tax Consistency',
      description: 'Ensures tax system supports the economic model',
      category: 'consistency',
      severity: 'medium',
      systems: ['economy', 'tax'],
      validate: (context) => this.validateEconomyTaxConsistency(context)
    });

    // Government System Rules
    this.addRule({
      id: 'government-component-feasibility',
      name: 'Government Component Feasibility',
      description: 'Validates that government components can be realistically implemented',
      category: 'feasibility',
      severity: 'medium',
      systems: ['government'],
      validate: (context) => this.validateGovernmentComponentFeasibility(context)
    });

    this.addRule({
      id: 'government-capacity-requirements',
      name: 'Government Capacity Requirements',
      description: 'Ensures government has sufficient capacity for selected components',
      category: 'feasibility',
      severity: 'high',
      systems: ['government'],
      validate: (context) => this.validateGovernmentCapacityRequirements(context)
    });

    // Tax System Rules
    this.addRule({
      id: 'tax-revenue-sustainability',
      name: 'Tax Revenue Sustainability',
      description: 'Validates that tax system can generate sustainable revenue',
      category: 'feasibility',
      severity: 'high',
      systems: ['tax'],
      validate: (context) => this.validateTaxRevenueSustainability(context)
    });

    this.addRule({
      id: 'tax-economic-impact',
      name: 'Tax Economic Impact',
      description: 'Ensures tax rates support economic growth objectives',
      category: 'performance',
      severity: 'medium',
      systems: ['tax', 'economy'],
      validate: (context) => this.validateTaxEconomicImpact(context)
    });

    // Cross-System Rules
    this.addRule({
      id: 'cross-system-synergy',
      name: 'Cross-System Synergy',
      description: 'Validates positive synergies between all systems',
      category: 'performance',
      severity: 'medium',
      systems: ['economy', 'government', 'tax'],
      validate: (context) => this.validateCrossSystemSynergy(context)
    });

    this.addRule({
      id: 'policy-coherence',
      name: 'Policy Coherence',
      description: 'Ensures policy coherence across all systems',
      category: 'policy',
      severity: 'high',
      systems: ['economy', 'government', 'tax'],
      validate: (context) => this.validatePolicyCoherence(context)
    });

    this.addRule({
      id: 'implementation-complexity',
      name: 'Implementation Complexity',
      description: 'Validates that overall system complexity is manageable',
      category: 'feasibility',
      severity: 'medium',
      systems: ['economy', 'government', 'tax'],
      validate: (context) => this.validateImplementationComplexity(context)
    });

    // Performance Rules
    this.addRule({
      id: 'economic-growth-potential',
      name: 'Economic Growth Potential',
      description: 'Validates potential for sustainable economic growth',
      category: 'performance',
      severity: 'medium',
      systems: ['economy', 'government', 'tax'],
      validate: (context) => this.validateEconomicGrowthPotential(context)
    });

    this.addRule({
      id: 'social-equity-balance',
      name: 'Social Equity Balance',
      description: 'Ensures balance between growth and social equity',
      category: 'policy',
      severity: 'medium',
      systems: ['economy', 'government', 'tax'],
      validate: (context) => this.validateSocialEquityBalance(context)
    });

    this.addRule({
      id: 'environmental-sustainability',
      name: 'Environmental Sustainability',
      description: 'Validates environmental sustainability considerations',
      category: 'policy',
      severity: 'low',
      systems: ['economy', 'government'],
      validate: (context) => this.validateEnvironmentalSustainability(context)
    });
  }

  /**
   * Add a validation rule
   */
  private addRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Validate economic component compatibility
   */
  private validateEconomicComponentCompatibility(context: ValidationContext): ValidationResult {
    const { economyBuilder } = context;
    
    if (!economyBuilder || economyBuilder.selectedAtomicComponents.length === 0) {
      return {
        ruleId: 'economy-component-compatibility',
        passed: true,
        severity: 'low',
        message: 'No economic components selected',
        details: ['Economic system is empty'],
        suggestions: ['Select economic components to validate compatibility'],
        impact: { economic: 0 }
      };
    }

    const components = economyBuilder.selectedAtomicComponents;
    const conflicts: string[] = [];
    const synergies: string[] = [];

    // Check for conflicts
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        const componentA = components[i];
        const componentB = components[j];
        
        // Get component definitions and check for conflicts
        const componentADef = this.getEconomicComponentDefinition(componentA);
        const componentBDef = this.getEconomicComponentDefinition(componentB);
        
        if (componentADef?.conflicts.includes(componentB)) {
          conflicts.push(`${componentADef.name} conflicts with ${componentBDef?.name || componentB}`);
        }
        
        if (componentADef?.synergies.includes(componentB)) {
          synergies.push(`${componentADef.name} synergizes with ${componentBDef?.name || componentB}`);
        }
      }
    }

    const passed = conflicts.length === 0;
    const severity = conflicts.length > 2 ? 'high' : conflicts.length > 0 ? 'medium' : 'low';

    return {
      ruleId: 'economy-component-compatibility',
      passed,
      severity,
      message: passed ? 
        `All economic components are compatible (${synergies.length} synergies found)` :
        `${conflicts.length} conflicts found between economic components`,
      details: [...conflicts, ...synergies],
      suggestions: conflicts.length > 0 ? [
        'Remove conflicting components',
        'Replace with compatible alternatives',
        'Consider phased implementation'
      ] : [
        'Optimize component synergies',
        'Consider adding more synergistic components'
      ],
      impact: { 
        economic: passed ? 10 : -conflicts.length * 5,
        overall: passed ? 5 : -conflicts.length * 3
      }
    };
  }

  /**
   * Validate economy-government alignment
   */
  private validateEconomyGovernmentAlignment(context: ValidationContext): ValidationResult {
    const { economyBuilder, governmentComponents } = context;
    
    if (!economyBuilder || governmentComponents.length === 0) {
      return {
        ruleId: 'economy-government-alignment',
        passed: true,
        severity: 'low',
        message: 'Insufficient data for alignment validation',
        details: ['Either economy or government system is empty'],
        suggestions: ['Configure both systems for alignment validation'],
        impact: { overall: 0 }
      };
    }

    const economicComponents = economyBuilder.selectedAtomicComponents;
    const alignmentIssues: string[] = [];
    const alignments: string[] = [];

    // Check alignment between economic and government components
    for (const econComponent of economicComponents) {
      const econDef = this.getEconomicComponentDefinition(econComponent);
      if (!econDef) continue;

      for (const govComponent of governmentComponents) {
        if (econDef.governmentSynergies.includes(govComponent)) {
          alignments.push(`${econDef.name} aligns with ${govComponent}`);
        }
        
        if (econDef.governmentConflicts.includes(govComponent)) {
          alignmentIssues.push(`${econDef.name} conflicts with ${govComponent}`);
        }
      }
    }

    const passed = alignmentIssues.length === 0;
    const severity = alignmentIssues.length > 1 ? 'high' : alignmentIssues.length > 0 ? 'medium' : 'low';

    return {
      ruleId: 'economy-government-alignment',
      passed,
      severity,
      message: passed ? 
        `Economy and government systems are well-aligned (${alignments.length} alignments)` :
        `${alignmentIssues.length} alignment issues found`,
      details: [...alignmentIssues, ...alignments],
      suggestions: alignmentIssues.length > 0 ? [
        'Adjust economic or government components',
        'Implement transitional policies',
        'Consider alternative component combinations'
      ] : [
        'Strengthen existing alignments',
        'Add more aligned components'
      ],
      impact: { 
        economic: passed ? 8 : -alignmentIssues.length * 4,
        government: passed ? 8 : -alignmentIssues.length * 4,
        overall: passed ? 10 : -alignmentIssues.length * 5
      }
    };
  }

  /**
   * Validate economy-tax consistency
   */
  private validateEconomyTaxConsistency(context: ValidationContext): ValidationResult {
    const { economyBuilder, taxSystem } = context;
    
    if (!economyBuilder || !taxSystem) {
      return {
        ruleId: 'economy-tax-consistency',
        passed: true,
        severity: 'low',
        message: 'Insufficient data for tax consistency validation',
        details: ['Either economy or tax system is not configured'],
        suggestions: ['Configure both systems for consistency validation'],
        impact: { overall: 0 }
      };
    }

    const economicComponents = economyBuilder.selectedAtomicComponents;
    const consistencyIssues: string[] = [];
    const consistencies: string[] = [];

    // Check if tax rates align with economic model
    for (const econComponent of economicComponents) {
      const econDef = this.getEconomicComponentDefinition(econComponent);
      if (!econDef) continue;

      const optimalCorporateRate = econDef.taxImpact.optimalCorporateRate;
      const optimalIncomeRate = econDef.taxImpact.optimalIncomeRate;

      // Find relevant tax categories
      const corporateTax = taxSystem.taxCategories?.find(cat => cat.categoryName.includes('Corporate'));
      const incomeTax = taxSystem.taxCategories?.find(cat => cat.categoryName.includes('Income'));

      if (corporateTax && corporateTax.baseRate && Math.abs(corporateTax.baseRate - optimalCorporateRate) > 10) {
        consistencyIssues.push(
          `Corporate tax rate (${corporateTax.baseRate}%) differs significantly from optimal rate for ${econDef.name} (${optimalCorporateRate}%)`
        );
      } else if (corporateTax) {
        consistencies.push(
          `Corporate tax rate aligns well with ${econDef.name} requirements`
        );
      }

      if (incomeTax && incomeTax.baseRate && Math.abs(incomeTax.baseRate - optimalIncomeRate) > 15) {
        consistencyIssues.push(
          `Income tax rate (${incomeTax.baseRate}%) differs significantly from optimal rate for ${econDef.name} (${optimalIncomeRate}%)`
        );
      } else if (incomeTax) {
        consistencies.push(
          `Income tax rate aligns well with ${econDef.name} requirements`
        );
      }
    }

    const passed = consistencyIssues.length === 0;
    const severity = consistencyIssues.length > 2 ? 'high' : consistencyIssues.length > 0 ? 'medium' : 'low';

    return {
      ruleId: 'economy-tax-consistency',
      passed,
      severity,
      message: passed ? 
        `Economy and tax systems are consistent (${consistencies.length} alignments)` :
        `${consistencyIssues.length} consistency issues found`,
      details: [...consistencyIssues, ...consistencies],
      suggestions: consistencyIssues.length > 0 ? [
        'Adjust tax rates to match economic model requirements',
        'Consider economic model alternatives',
        'Implement gradual tax rate adjustments'
      ] : [
        'Maintain current tax-economic alignment',
        'Monitor tax efficiency metrics'
      ],
      impact: { 
        economic: passed ? 6 : -consistencyIssues.length * 3,
        tax: passed ? 6 : -consistencyIssues.length * 3,
        overall: passed ? 8 : -consistencyIssues.length * 4
      }
    };
  }

  /**
   * Validate government component feasibility
   */
  private validateGovernmentComponentFeasibility(context: ValidationContext): ValidationResult {
    const { governmentComponents } = context;
    
    if (governmentComponents.length === 0) {
      return {
        ruleId: 'government-component-feasibility',
        passed: true,
        severity: 'low',
        message: 'No government components selected',
        details: ['Government system is empty'],
        suggestions: ['Select government components for feasibility validation'],
        impact: { government: 0 }
      };
    }

    const feasibilityIssues: string[] = [];
    const feasibleComponents: string[] = [];

    // Check feasibility of each government component
    for (const component of governmentComponents) {
      const feasibility = this.assessGovernmentComponentFeasibility(component);
      
      if (feasibility.isFeasible) {
        feasibleComponents.push(`${component} is feasible to implement`);
      } else {
        feasibilityIssues.push(`${component}: ${feasibility.reason}`);
      }
    }

    const passed = feasibilityIssues.length === 0;
    const severity = feasibilityIssues.length > 2 ? 'high' : feasibilityIssues.length > 0 ? 'medium' : 'low';

    return {
      ruleId: 'government-component-feasibility',
      passed,
      severity,
      message: passed ? 
        `All government components are feasible (${feasibleComponents.length} components)` :
        `${feasibilityIssues.length} feasibility issues found`,
      details: [...feasibilityIssues, ...feasibleComponents],
      suggestions: feasibilityIssues.length > 0 ? [
        'Consider alternative government structures',
        'Implement phased approach for complex components',
        'Assess resource requirements and capacity'
      ] : [
        'Proceed with implementation planning',
        'Develop detailed implementation roadmap'
      ],
      impact: { 
        government: passed ? 8 : -feasibilityIssues.length * 4,
        overall: passed ? 5 : -feasibilityIssues.length * 2
      }
    };
  }

  /**
   * Validate government capacity requirements
   */
  private validateGovernmentCapacityRequirements(context: ValidationContext): ValidationResult {
    const { governmentComponents, governmentBuilder } = context;
    
    if (governmentComponents.length === 0) {
      return {
        ruleId: 'government-capacity-requirements',
        passed: true,
        severity: 'low',
        message: 'No government components selected',
        details: ['Government system is empty'],
        suggestions: ['Select government components for capacity validation'],
        impact: { government: 0 }
      };
    }

    // Estimate capacity requirements
    const capacityRequirements = governmentComponents.reduce((total, component) => {
      return total + this.getGovernmentComponentCapacityRequirement(component);
    }, 0);

    const availableCapacity = governmentBuilder?.structure?.totalBudget ?
      Math.min(governmentBuilder.structure.totalBudget / 1000000, 100) : 50; // Simplified capacity calculation

    const capacityShortage = capacityRequirements - availableCapacity;
    const passed = capacityShortage <= 0;
    const severity = capacityShortage > 30 ? 'high' : capacityShortage > 10 ? 'medium' : 'low';

    return {
      ruleId: 'government-capacity-requirements',
      passed,
      severity,
      message: passed ? 
        `Government has sufficient capacity (${availableCapacity.toFixed(1)}/100, requiring ${capacityRequirements.toFixed(1)})` :
        `Government capacity shortage: ${capacityShortage.toFixed(1)} points`,
      details: [
        `Required capacity: ${capacityRequirements.toFixed(1)}`,
        `Available capacity: ${availableCapacity.toFixed(1)}`,
        `Shortage: ${capacityShortage.toFixed(1)}`
      ],
      suggestions: passed ? [
        'Capacity is adequate for implementation',
        'Consider adding more components'
      ] : [
        'Increase government budget allocation',
        'Remove high-capacity components',
        'Implement components in phases',
        'Seek external capacity support'
      ],
      impact: { 
        government: passed ? 10 : -capacityShortage * 2,
        overall: passed ? 8 : -capacityShortage * 1.5
      }
    };
  }

  /**
   * Validate tax revenue sustainability
   */
  private validateTaxRevenueSustainability(context: ValidationContext): ValidationResult {
    const { taxSystem, economyBuilder } = context;
    
    if (!taxSystem || !economyBuilder) {
      return {
        ruleId: 'tax-revenue-sustainability',
        passed: true,
        severity: 'low',
        message: 'Insufficient data for revenue sustainability validation',
        details: ['Either tax or economy system is not configured'],
        suggestions: ['Configure both systems for revenue validation'],
        impact: { tax: 0 }
      };
    }

    // Calculate estimated revenue
    const totalGDP = economyBuilder.structure.totalGDP;
    const estimatedRevenue = this.calculateEstimatedTaxRevenue(taxSystem, totalGDP);
    
    // Estimate required government spending
    const requiredSpending = this.estimateRequiredGovernmentSpending(economyBuilder, context.governmentComponents);
    
    const revenueRatio = estimatedRevenue / requiredSpending;
    const passed = revenueRatio >= 0.8; // At least 80% of required spending
    const severity = revenueRatio < 0.5 ? 'high' : revenueRatio < 0.8 ? 'medium' : 'low';

    return {
      ruleId: 'tax-revenue-sustainability',
      passed,
      severity,
      message: passed ? 
        `Tax revenue is sustainable (${(revenueRatio * 100).toFixed(1)}% of required spending)` :
        `Tax revenue insufficient (${(revenueRatio * 100).toFixed(1)}% of required spending)`,
      details: [
        `Estimated revenue: $${estimatedRevenue.toFixed(0)}M`,
        `Required spending: $${requiredSpending.toFixed(0)}M`,
        `Revenue ratio: ${(revenueRatio * 100).toFixed(1)}%`
      ],
      suggestions: passed ? [
        'Revenue appears sustainable',
        'Monitor revenue collection efficiency'
      ] : [
        'Increase tax rates',
        'Improve tax collection efficiency',
        'Reduce government spending requirements',
        'Explore alternative revenue sources'
      ],
      impact: { 
        tax: passed ? 8 : -Math.abs(1 - revenueRatio) * 20,
        government: passed ? 5 : -Math.abs(1 - revenueRatio) * 15,
        overall: passed ? 6 : -Math.abs(1 - revenueRatio) * 12
      }
    };
  }

  // Additional validation methods would continue here...
  // For brevity, I'll include placeholder implementations for the remaining methods

  private validateTaxEconomicImpact(context: ValidationContext): ValidationResult {
    const { taxSystem, economyBuilder } = context;

    if (!taxSystem || !economyBuilder) {
      return {
        ruleId: 'tax-economic-impact',
        passed: true,
        severity: 'low',
        message: 'Insufficient data for tax impact validation',
        details: ['Either tax or economy system is not configured'],
        suggestions: ['Configure both systems for impact validation'],
        impact: { tax: 0, economic: 0 }
      };
    }

    const issues: string[] = [];
    const positives: string[] = [];

    // Calculate total tax burden
    const totalTaxRate = taxSystem.taxCategories?.reduce((sum, cat) => sum + (cat.baseRate || 0), 0) || 0;
    const avgTaxRate = totalTaxRate / (taxSystem.taxCategories?.length || 1);

    // Check if tax rates support economic growth
    if (avgTaxRate > 40) {
      issues.push(`Average tax rate (${avgTaxRate.toFixed(1)}%) is high and may hinder growth`);
    } else if (avgTaxRate >= 25 && avgTaxRate <= 35) {
      positives.push(`Average tax rate (${avgTaxRate.toFixed(1)}%) is in optimal range for balanced growth`);
    }

    // Check progressive tax alignment with economy
    const hasProgressiveTax = taxSystem.progressiveTax;
    const hasSocialMarket = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.SOCIAL_MARKET_ECONOMY);

    if (hasSocialMarket && !hasProgressiveTax) {
      issues.push('Social market economy would benefit from progressive taxation');
    } else if (hasSocialMarket && hasProgressiveTax) {
      positives.push('Progressive tax system aligns well with social market economy');
    }

    const passed = issues.length === 0;
    const severity: 'low' | 'medium' | 'high' = issues.length > 2 ? 'high' : issues.length > 0 ? 'medium' : 'low';

    return {
      ruleId: 'tax-economic-impact',
      passed,
      severity,
      message: passed ?
        `Tax system supports economic objectives (${positives.length} alignments)` :
        `${issues.length} tax-economic alignment issues found`,
      details: [...issues, ...positives],
      suggestions: issues.length > 0 ? [
        'Adjust tax rates to support economic growth',
        'Align tax structure with economic model',
        'Consider phased tax policy changes'
      ] : [
        'Maintain current tax-economic alignment',
        'Monitor tax efficiency and compliance'
      ],
      impact: {
        tax: passed ? 5 : -issues.length * 3,
        economic: passed ? 8 : -issues.length * 4,
        overall: passed ? 6 : -issues.length * 3
      }
    };
  }

  private validateCrossSystemSynergy(context: ValidationContext): ValidationResult {
    const { economyBuilder, governmentComponents, taxSystem } = context;

    if (!economyBuilder || governmentComponents.length === 0 || !taxSystem) {
      return {
        ruleId: 'cross-system-synergy',
        passed: true,
        severity: 'low',
        message: 'Insufficient data for synergy validation',
        details: ['All systems must be configured for synergy analysis'],
        suggestions: ['Complete all system configurations'],
        impact: { overall: 0 }
      };
    }

    const synergies: string[] = [];
    const missed: string[] = [];

    // Check economy-government synergies
    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.INNOVATION_ECONOMY) &&
        governmentComponents.includes(ComponentType.TECHNOCRATIC_PROCESS)) {
      synergies.push('Innovation economy + technocratic government creates strong R&D synergy');
    }

    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.FREE_MARKET_SYSTEM) &&
        governmentComponents.includes(ComponentType.DEMOCRATIC_PROCESS)) {
      synergies.push('Free market + democratic process creates optimal stability synergy');
    }

    // Check economy-tax synergies
    const corporateTax = taxSystem.taxCategories?.find(cat => cat.categoryName.includes('Corporate'));
    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.INNOVATION_ECONOMY) &&
        corporateTax && corporateTax.baseRate && corporateTax.baseRate <= 20) {
      synergies.push('Innovation economy + low corporate tax creates investment synergy');
    }

    // Check for missed synergies
    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.SOCIAL_MARKET_ECONOMY) &&
        !taxSystem.progressiveTax) {
      missed.push('Social market economy without progressive tax misses equity synergy');
    }

    const passed = synergies.length >= 2 && missed.length === 0;
    const severity: 'low' | 'medium' | 'high' = missed.length > 2 ? 'high' : missed.length > 0 ? 'medium' : 'low';

    return {
      ruleId: 'cross-system-synergy',
      passed,
      severity,
      message: `Found ${synergies.length} synergies and ${missed.length} missed opportunities`,
      details: [...synergies, ...missed],
      suggestions: missed.length > 0 ? [
        'Optimize system combinations for better synergies',
        'Review component selections across all systems',
        'Consider adding synergistic components'
      ] : [
        'Excellent synergy optimization',
        'Maintain current system alignment'
      ],
      impact: {
        overall: synergies.length * 5 - missed.length * 3
      }
    };
  }

  private validatePolicyCoherence(context: ValidationContext): ValidationResult {
    const { economyBuilder, governmentComponents, taxSystem } = context;

    if (!economyBuilder || !taxSystem) {
      return {
        ruleId: 'policy-coherence',
        passed: true,
        severity: 'low',
        message: 'Insufficient data for policy coherence validation',
        details: ['Economy and tax systems must be configured'],
        suggestions: ['Complete system configurations'],
        impact: { overall: 0 }
      };
    }

    const coherent: string[] = [];
    const incoherent: string[] = [];

    // Check free market coherence
    const hasFreeMarket = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.FREE_MARKET_SYSTEM);
    const hasFlexibleLabor = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.FLEXIBLE_LABOR);
    const hasMinimalGov = governmentComponents.includes(ComponentType.MINIMAL_GOVERNMENT);

    if (hasFreeMarket && hasFlexibleLabor) {
      coherent.push('Free market and flexible labor policies are coherent');
    }

    if (hasFreeMarket && !hasMinimalGov && governmentComponents.length > 0) {
      incoherent.push('Free market economy with extensive government intervention lacks coherence');
    }

    // Check social market coherence
    const hasSocialMarket = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.SOCIAL_MARKET_ECONOMY);
    const hasProtectedWorkers = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.PROTECTED_WORKERS);
    const hasSocialDemocracy = governmentComponents.includes(ComponentType.SOCIAL_DEMOCRACY);

    if (hasSocialMarket && hasProtectedWorkers && hasSocialDemocracy) {
      coherent.push('Social market economy with worker protections and social democracy is highly coherent');
    }

    if (hasSocialMarket && !taxSystem.progressiveTax) {
      incoherent.push('Social market economy without progressive taxation lacks policy coherence');
    }

    // Check innovation economy coherence
    const hasInnovation = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.INNOVATION_ECONOMY);
    const hasRnD = economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.RD_INVESTMENT);
    const corporateTax = taxSystem.taxCategories?.find(cat => cat.categoryName.includes('Corporate'));

    if (hasInnovation && hasRnD && corporateTax && corporateTax.baseRate && corporateTax.baseRate <= 20) {
      coherent.push('Innovation economy with R&D investment and low corporate tax is coherent');
    }

    if (hasInnovation && corporateTax && corporateTax.baseRate && corporateTax.baseRate > 30) {
      incoherent.push('Innovation economy with high corporate tax lacks coherence');
    }

    const passed = incoherent.length === 0;
    const severity: 'low' | 'medium' | 'high' = incoherent.length > 2 ? 'high' : incoherent.length > 0 ? 'medium' : 'low';

    return {
      ruleId: 'policy-coherence',
      passed,
      severity,
      message: passed ?
        `Policy coherence is strong (${coherent.length} coherent policies)` :
        `${incoherent.length} policy incoherence issues detected`,
      details: [...coherent, ...incoherent],
      suggestions: incoherent.length > 0 ? [
        'Align economic, government, and tax policies',
        'Review conflicting policy choices',
        'Consider phased policy alignment'
      ] : [
        'Maintain excellent policy coherence',
        'Continue coherent policy development'
      ],
      impact: {
        overall: coherent.length * 4 - incoherent.length * 6
      }
    };
  }

  private validateImplementationComplexity(context: ValidationContext): ValidationResult {
    const { economyBuilder, governmentComponents, taxSystem, userPreferences } = context;

    // Calculate overall complexity score
    let complexityScore = 0;
    const complexityFactors: string[] = [];

    // Economy complexity
    const economicComponents = economyBuilder?.selectedAtomicComponents.length || 0;
    complexityScore += economicComponents * 5;
    if (economicComponents > 8) {
      complexityFactors.push(`High number of economic components (${economicComponents}) increases complexity`);
    } else if (economicComponents >= 4 && economicComponents <= 6) {
      complexityFactors.push(`Optimal number of economic components (${economicComponents})`);
    }

    // Government complexity
    const govComponents = governmentComponents.length;
    complexityScore += govComponents * 6;
    if (govComponents > 10) {
      complexityFactors.push(`High number of government components (${govComponents}) increases complexity`);
    } else if (govComponents >= 5 && govComponents <= 8) {
      complexityFactors.push(`Balanced government structure (${govComponents} components)`);
    }

    // Tax complexity
    const taxCategories = taxSystem?.taxCategories?.length || 0;
    complexityScore += taxCategories * 8;
    if (taxCategories > 7) {
      complexityFactors.push(`Complex tax structure (${taxCategories} categories) may reduce efficiency`);
    } else if (taxCategories >= 3 && taxCategories <= 5) {
      complexityFactors.push(`Well-structured tax system (${taxCategories} categories)`);
    }

    // Check user preference for complexity
    const desiredComplexity = userPreferences?.complexity || 'medium';
    const thresholds = {
      low: 50,
      medium: 100,
      high: 150
    };

    const passed = complexityScore <= thresholds[desiredComplexity];
    const severity: 'low' | 'medium' | 'high' = complexityScore > thresholds.high ? 'high' :
                                                 complexityScore > thresholds.medium ? 'medium' : 'low';

    return {
      ruleId: 'implementation-complexity',
      passed,
      severity,
      message: passed ?
        `Implementation complexity (${complexityScore}) is manageable for ${desiredComplexity} complexity preference` :
        `Implementation complexity (${complexityScore}) exceeds ${desiredComplexity} complexity threshold (${thresholds[desiredComplexity]})`,
      details: complexityFactors,
      suggestions: !passed ? [
        'Simplify system by reducing number of components',
        'Focus on core essential components first',
        'Consider phased implementation approach',
        'Consolidate overlapping components'
      ] : [
        'Complexity is well-managed',
        'Current structure is sustainable'
      ],
      impact: {
        overall: passed ? 5 : -((complexityScore - thresholds[desiredComplexity]) / 10)
      }
    };
  }

  private validateEconomicGrowthPotential(context: ValidationContext): ValidationResult {
    const { economyBuilder, governmentComponents, taxSystem, userPreferences } = context;

    if (!economyBuilder) {
      return {
        ruleId: 'economic-growth-potential',
        passed: true,
        severity: 'low',
        message: 'Insufficient data for growth potential validation',
        details: ['Economy builder must be configured'],
        suggestions: ['Configure economy builder'],
        impact: { economic: 0 }
      };
    }

    let growthScore = 50; // Base growth potential
    const growthFactors: string[] = [];

    // Check for growth-oriented components
    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.INNOVATION_ECONOMY)) {
      growthScore += 15;
      growthFactors.push('Innovation economy provides strong growth foundation (+15)');
    }

    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.RD_INVESTMENT)) {
      growthScore += 10;
      growthFactors.push('R&D investment supports long-term growth (+10)');
    }

    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.EXPORT_ORIENTED)) {
      growthScore += 12;
      growthFactors.push('Export orientation drives growth through international markets (+12)');
    }

    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.FREE_MARKET_SYSTEM)) {
      growthScore += 8;
      growthFactors.push('Free market system enables dynamic growth (+8)');
    }

    // Check for government support
    if (governmentComponents.includes(ComponentType.TECHNOCRATIC_PROCESS)) {
      growthScore += 10;
      growthFactors.push('Technocratic government supports efficient growth policies (+10)');
    }

    if (governmentComponents.includes(ComponentType.DIGITAL_GOVERNMENT)) {
      growthScore += 8;
      growthFactors.push('Digital government infrastructure enables modern growth (+8)');
    }

    // Check tax environment
    const corporateTax = taxSystem?.taxCategories?.find(cat => cat.categoryName.includes('Corporate'));
    if (corporateTax && corporateTax.baseRate && corporateTax.baseRate <= 20) {
      growthScore += 12;
      growthFactors.push('Competitive corporate tax rate attracts investment (+12)');
    } else if (corporateTax && corporateTax.baseRate && corporateTax.baseRate > 35) {
      growthScore -= 10;
      growthFactors.push('High corporate tax rate may hinder growth (-10)');
    }

    // Check if growth focus is desired
    const wantsGrowth = userPreferences?.growthFocus ?? true;
    const passed = wantsGrowth ? growthScore >= 70 : growthScore >= 50;
    const severity: 'low' | 'medium' | 'high' = growthScore < 50 ? 'high' : growthScore < 70 ? 'medium' : 'low';

    return {
      ruleId: 'economic-growth-potential',
      passed,
      severity,
      message: `Economic growth potential: ${growthScore}/100`,
      details: growthFactors,
      suggestions: !passed ? [
        'Add growth-oriented economic components',
        'Implement pro-growth tax policies',
        'Strengthen innovation and R&D support',
        'Consider export-oriented strategies'
      ] : [
        'Strong growth potential established',
        'Maintain growth-supporting policies'
      ],
      impact: {
        economic: growthScore - 50 // Impact relative to baseline
      }
    };
  }

  private validateSocialEquityBalance(context: ValidationContext): ValidationResult {
    const { economyBuilder, governmentComponents, taxSystem, userPreferences } = context;

    if (!economyBuilder || !taxSystem) {
      return {
        ruleId: 'social-equity-balance',
        passed: true,
        severity: 'low',
        message: 'Insufficient data for equity balance validation',
        details: ['Economy and tax systems must be configured'],
        suggestions: ['Complete system configurations'],
        impact: { overall: 0 }
      };
    }

    let equityScore = 50; // Base equity score
    const equityFactors: string[] = [];

    // Check for equity-oriented components
    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.SOCIAL_MARKET_ECONOMY)) {
      equityScore += 15;
      equityFactors.push('Social market economy promotes equity (+15)');
    }

    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.PROTECTED_WORKERS)) {
      equityScore += 12;
      equityFactors.push('Worker protections support social equity (+12)');
    }

    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.UNION_BASED)) {
      equityScore += 10;
      equityFactors.push('Union-based labor supports worker rights and equity (+10)');
    }

    // Check government support for equity
    if (governmentComponents.includes(ComponentType.SOCIAL_DEMOCRACY)) {
      equityScore += 15;
      equityFactors.push('Social democracy framework prioritizes equity (+15)');
    }

    if (governmentComponents.includes(ComponentType.WELFARE_STATE)) {
      equityScore += 12;
      equityFactors.push('Welfare state provides safety net for equity (+12)');
    }

    if (governmentComponents.includes(ComponentType.UNIVERSAL_HEALTHCARE)) {
      equityScore += 10;
      equityFactors.push('Universal healthcare reduces inequality (+10)');
    }

    // Check tax progressivity
    if (taxSystem.progressiveTax) {
      equityScore += 15;
      equityFactors.push('Progressive tax system promotes income equity (+15)');
    } else {
      equityScore -= 10;
      equityFactors.push('Lack of progressive taxation reduces equity (-10)');
    }

    // Balance with growth
    const hasGrowthComponents = economyBuilder.selectedAtomicComponents.some(c =>
      [EconomicComponentType.INNOVATION_ECONOMY, EconomicComponentType.FREE_MARKET_SYSTEM].includes(c)
    );

    if (equityScore > 80 && !hasGrowthComponents) {
      equityFactors.push('Warning: High equity focus without growth components may limit economic dynamism');
    }

    const wantsEquity = userPreferences?.equityFocus ?? true;
    const passed = wantsEquity ? equityScore >= 65 : equityScore >= 40;
    const severity: 'low' | 'medium' | 'high' = equityScore < 40 ? 'high' : equityScore < 60 ? 'medium' : 'low';

    return {
      ruleId: 'social-equity-balance',
      passed,
      severity,
      message: `Social equity balance score: ${equityScore}/100`,
      details: equityFactors,
      suggestions: !passed ? [
        'Strengthen social safety nets',
        'Implement progressive taxation',
        'Add worker protection policies',
        'Balance equity with economic growth'
      ] : [
        'Good equity-growth balance achieved',
        'Maintain current social policies'
      ],
      impact: {
        overall: (equityScore - 50) / 2
      }
    };
  }

  private validateEnvironmentalSustainability(context: ValidationContext): ValidationResult {
    const { economyBuilder, governmentComponents } = context;

    if (!economyBuilder) {
      return {
        ruleId: 'environmental-sustainability',
        passed: true,
        severity: 'low',
        message: 'Insufficient data for environmental validation',
        details: ['Economy builder must be configured'],
        suggestions: ['Configure economy builder'],
        impact: { overall: 0 }
      };
    }

    let sustainabilityScore = 40; // Base sustainability
    const sustainabilityFactors: string[] = [];

    // Check for sustainability-oriented components
    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.SUSTAINABLE_DEVELOPMENT)) {
      sustainabilityScore += 20;
      sustainabilityFactors.push('Sustainable development commitment (+20)');
    }

    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.RENEWABLE_ENERGY)) {
      sustainabilityScore += 15;
      sustainabilityFactors.push('Renewable energy focus reduces carbon footprint (+15)');
    }

    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.GREEN_TECHNOLOGY)) {
      sustainabilityScore += 12;
      sustainabilityFactors.push('Green technology innovation (+12)');
    }

    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.CIRCULAR_ECONOMY)) {
      sustainabilityScore += 10;
      sustainabilityFactors.push('Circular economy reduces waste (+10)');
    }

    // Check government environmental policies
    if (governmentComponents.includes(ComponentType.ENVIRONMENTAL_PROTECTION)) {
      sustainabilityScore += 15;
      sustainabilityFactors.push('Environmental protection policies (+15)');
    }

    if (governmentComponents.includes(ComponentType.ENVIRONMENTAL_FOCUS)) {
      sustainabilityScore += 12;
      sustainabilityFactors.push('Environmental focus in governance (+12)');
    }

    // Check for conflicting components
    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.EXTRACTION_FOCUSED)) {
      sustainabilityScore -= 15;
      sustainabilityFactors.push('Extraction-focused economy has environmental costs (-15)');
    }

    if (economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.MANUFACTURING_LED) &&
        !economyBuilder.selectedAtomicComponents.includes(EconomicComponentType.GREEN_TECHNOLOGY)) {
      sustainabilityScore -= 8;
      sustainabilityFactors.push('Manufacturing without green tech may impact environment (-8)');
    }

    const passed = sustainabilityScore >= 60;
    const severity: 'low' | 'medium' | 'high' = sustainabilityScore < 40 ? 'high' : sustainabilityScore < 60 ? 'medium' : 'low';

    return {
      ruleId: 'environmental-sustainability',
      passed,
      severity,
      message: `Environmental sustainability score: ${sustainabilityScore}/100`,
      details: sustainabilityFactors,
      suggestions: !passed ? [
        'Add sustainable development components',
        'Transition to renewable energy',
        'Implement circular economy practices',
        'Strengthen environmental regulations'
      ] : [
        'Good environmental sustainability established',
        'Continue green economy development'
      ],
      impact: {
        overall: (sustainabilityScore - 40) / 3
      }
    };
  }

  // Helper methods
  private getEconomicComponentDefinition(componentType: EconomicComponentType) {
    try {
      const { ATOMIC_ECONOMIC_COMPONENTS } = require('~/components/economy/atoms/AtomicEconomicComponents');
      return ATOMIC_ECONOMIC_COMPONENTS[componentType] || null;
    } catch (error) {
      console.error('Failed to load economic component definitions:', error);
      return null;
    }
  }

  private assessGovernmentComponentFeasibility(component: ComponentType): { isFeasible: boolean; reason: string } {
    // Simplified feasibility assessment
    return { isFeasible: true, reason: 'Feasible' };
  }

  private getGovernmentComponentCapacityRequirement(component: ComponentType): number {
    // Simplified capacity requirement calculation
    return 10; // Placeholder
  }

  private calculateEstimatedTaxRevenue(taxSystem: TaxSystem, gdp: number): number {
    // Simplified revenue calculation
    return gdp * 0.2; // 20% of GDP as rough estimate
  }

  private estimateRequiredGovernmentSpending(economyBuilder: EconomyBuilderState, governmentComponents: ComponentType[]): number {
    // Simplified spending estimation
    return economyBuilder.structure.totalGDP * 0.15; // 15% of GDP
  }

  /**
   * Generate comprehensive validation report
   */
  private generateReport(results: ValidationResult[]): ValidationReport {
    const totalRules = results.length;
    const passedRules = results.filter(r => r.passed).length;
    const failedRules = totalRules - passedRules;
    const passRate = (passedRules / totalRules) * 100;

    const summary = {
      critical: results.filter(r => r.severity === 'critical'),
      high: results.filter(r => r.severity === 'high'),
      medium: results.filter(r => r.severity === 'medium'),
      low: results.filter(r => r.severity === 'low')
    };

    const recommendations = this.generateRecommendations(results);
    const warnings = this.generateWarnings(results);
    
    const systemHealth = this.calculateSystemHealth(results);
    const consistencyScore = this.calculateConsistencyScore(results);
    const feasibilityScore = this.calculateFeasibilityScore(results);
    const compatibilityScore = this.calculateCompatibilityScore(results);

    return {
      timestamp: Date.now(),
      totalRules,
      passedRules,
      failedRules,
      passRate,
      results,
      summary,
      recommendations,
      warnings,
      systemHealth,
      consistencyScore,
      feasibilityScore,
      compatibilityScore,
      criticalIssues: summary.critical
    };
  }

  private generateRecommendations(results: ValidationResult[]): string[] {
    const recommendations: string[] = [];
    
    const failedResults = results.filter(r => !r.passed);
    
    if (failedResults.length > 0) {
      recommendations.push('Address failed validation rules to improve system coherence');
    }
    
    const criticalResults = results.filter(r => r.severity === 'critical' && !r.passed);
    if (criticalResults.length > 0) {
      recommendations.push('Prioritize resolving critical validation issues');
    }
    
    const highResults = results.filter(r => r.severity === 'high' && !r.passed);
    if (highResults.length > 0) {
      recommendations.push('Review and resolve high-priority validation issues');
    }
    
    recommendations.push('Consider implementing suggested improvements for better system performance');
    recommendations.push('Regular validation helps maintain system consistency and effectiveness');
    
    return recommendations;
  }

  private generateWarnings(results: ValidationResult[]): string[] {
    const warnings: string[] = [];
    
    const failedResults = results.filter(r => !r.passed);
    if (failedResults.length > 5) {
      warnings.push('Multiple validation failures detected - system coherence may be compromised');
    }
    
    const criticalResults = results.filter(r => r.severity === 'critical' && !r.passed);
    if (criticalResults.length > 0) {
      warnings.push('Critical validation issues require immediate attention');
    }
    
    return warnings;
  }

  private calculateSystemHealth(results: ValidationResult[]): { economy: number; government: number; tax: number; overall: number } {
    const economyResults = results.filter(r => r.impact.economic !== undefined);
    const governmentResults = results.filter(r => r.impact.government !== undefined);
    const taxResults = results.filter(r => r.impact.tax !== undefined);
    
    const economy = this.calculateHealthScore(economyResults);
    const government = this.calculateHealthScore(governmentResults);
    const tax = this.calculateHealthScore(taxResults);
    const overall = this.calculateHealthScore(results);
    
    return { economy, government, tax, overall };
  }

  private calculateHealthScore(results: ValidationResult[]): number {
    if (results.length === 0) return 50; // Neutral score
    
    const totalImpact = results.reduce((sum, result) => {
      const impact = result.impact.economic || result.impact.government || result.impact.tax || result.impact.overall || 0;
      return sum + (result.passed ? impact : -Math.abs(impact));
    }, 0);
    
    return Math.max(0, Math.min(100, 50 + totalImpact));
  }

  private calculateConsistencyScore(results: ValidationResult[]): number {
    const consistencyResults = results.filter(r => r.ruleId.includes('consistency') || r.ruleId.includes('alignment'));
    return this.calculateHealthScore(consistencyResults);
  }

  private calculateFeasibilityScore(results: ValidationResult[]): number {
    const feasibilityResults = results.filter(r => r.ruleId.includes('feasibility') || r.ruleId.includes('capacity'));
    return this.calculateHealthScore(feasibilityResults);
  }

  private calculateCompatibilityScore(results: ValidationResult[]): number {
    const compatibilityResults = results.filter(r => r.ruleId.includes('compatibility') || r.ruleId.includes('synergy'));
    return this.calculateHealthScore(compatibilityResults);
  }
}
