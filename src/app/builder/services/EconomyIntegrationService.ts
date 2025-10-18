/**
 * Economy Integration Service
 * 
 * This service handles real-time integration between atomic economic components
 * and the economy builder system, providing live-wired updates and intelligent
 * adjustments based on component selections and cross-builder synchronization.
 */

import { EconomicComponentType, ATOMIC_ECONOMIC_COMPONENTS } from '~/components/economy/atoms/AtomicEconomicComponents';
import { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import type { EconomyBuilderState } from '~/types/economy-builder';
import type { GovernmentBuilderState } from '~/types/government';
import type { EconomicInputs } from '../lib/economy-data-service';
import { crossBuilderSynergyService, type CrossBuilderAnalysis } from './CrossBuilderSynergyService';

export interface EconomyIntegrationState {
  selectedAtomicComponents: EconomicComponentType[];
  economyBuilder: EconomyBuilderState | null;
  economicInputs: EconomicInputs | null;
  governmentBuilder: GovernmentBuilderState | null;
  lastUpdate: number;
  isUpdating: boolean;
  errors: string[];
  warnings: string[];
  crossBuilderSynergies: CrossBuilderSynergy[];
  crossBuilderConflicts: CrossBuilderConflict[];
  crossBuilderAnalysis: CrossBuilderAnalysis | null;
}

export interface CrossBuilderSynergy {
  id: string;
  type: 'government-economy' | 'tax-economy' | 'economy-government' | 'economy-tax' | 'government-tax' | 'tax-government';
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
  };
}

export interface CrossBuilderConflict {
  id: string;
  type: 'government-economy' | 'tax-economy' | 'economy-government' | 'economy-tax' | 'government-tax' | 'tax-government';
  components: {
    economic?: EconomicComponentType;
    government?: ComponentType;
    tax?: string;
  };
  severity: number; // 0-100
  description: string;
  penalty: {
    effectiveness: number;
    economicGrowth: number;
    taxEfficiency: number;
    governmentCapacity: number;
  };
}

export interface EconomyUpdateEvent {
  type: 'components_changed' | 'economy_updated' | 'government_sync' | 'tax_sync' | 'error';
  timestamp: number;
  data: unknown;
  message: string;
}

export class EconomyIntegrationService {
  private state: EconomyIntegrationState;
  private listeners: Array<(state: EconomyIntegrationState) => void> = [];
  private updateQueue: EconomyUpdateEvent[] = [];
  private isProcessingQueue = false;
  private updateTimeout: NodeJS.Timeout | null = null;
  private lastNotifiedState: EconomyIntegrationState | null = null;

  constructor() {
    this.state = {
      selectedAtomicComponents: [],
      economyBuilder: null,
      economicInputs: null,
      governmentBuilder: null,
      lastUpdate: Date.now(),
      isUpdating: false,
      errors: [],
      warnings: [],
      crossBuilderSynergies: [],
      crossBuilderConflicts: [],
      crossBuilderAnalysis: null
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: EconomyIntegrationState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current state
   */
  getState(): EconomyIntegrationState {
    return { ...this.state };
  }

  /**
   * Get cross-builder analysis
   */
  getCrossBuilderAnalysis(): CrossBuilderAnalysis | null {
    return this.state.crossBuilderAnalysis;
  }

  /**
   * Update atomic economic components and trigger cascade updates
   */
  async updateEconomicComponents(components: EconomicComponentType[]): Promise<void> {
    this.addToQueue({
      type: 'components_changed',
      timestamp: Date.now(),
      data: components,
      message: `Updated economic components: ${components.join(', ')}`
    });

    this.state.selectedAtomicComponents = components;
    this.state.isUpdating = true;
    this.notifyListeners();

    try {
      // Generate economy builder from components
      if (this.state.economicInputs) {
        const generatedBuilder = this.generateEconomyBuilderFromAtomicComponents(
          components,
          this.state.economicInputs
        );

        this.state.economyBuilder = generatedBuilder;
        this.addToQueue({
          type: 'economy_updated',
          timestamp: Date.now(),
          data: generatedBuilder,
          message: 'Economy builder updated from atomic components'
        });

        // Sync with government and tax systems
        await this.syncWithGovernmentSystem();
        await this.syncWithTaxSystemInternal();
      }

      // Update cross-builder synergies and conflicts
      this.updateCrossBuilderAnalysis();

      this.state.lastUpdate = Date.now();
      this.state.errors = [];
    } catch (error) {
      this.state.errors.push(error instanceof Error ? error.message : 'Unknown error');
      this.addToQueue({
        type: 'error',
        timestamp: Date.now(),
        data: error,
        message: 'Failed to update economic components'
      });
    } finally {
      this.state.isUpdating = false;
      this.notifyListeners();
    }
  }

  /**
   * Update economy builder data
   */
  async updateEconomyBuilder(builder: EconomyBuilderState): Promise<void> {
    // Validate input
    if (!builder) {
      throw new Error('Economy builder state cannot be null or undefined');
    }
    if (!builder.structure) {
      throw new Error('Economy builder must have a structure');
    }

    this.addToQueue({
      type: 'economy_updated',
      timestamp: Date.now(),
      data: builder,
      message: 'Economy builder manually updated'
    });

    this.state.economyBuilder = builder;
    this.state.isUpdating = true;
    this.notifyListeners();

    try {
      // Sync with other systems
      await this.syncWithGovernmentSystem();
      await this.syncWithTaxSystemInternal();
      
      // Update cross-builder analysis
      this.updateCrossBuilderAnalysis();

      this.state.lastUpdate = Date.now();
      this.state.errors = [];
    } catch (error) {
      this.state.errors.push(error instanceof Error ? error.message : 'Unknown error');
      this.addToQueue({
        type: 'error',
        timestamp: Date.now(),
        data: error,
        message: 'Failed to update economy builder'
      });
    } finally {
      this.state.isUpdating = false;
      this.notifyListeners();
    }
  }

  /**
   * Update economic inputs
   */
  async updateEconomicInputs(inputs: EconomicInputs): Promise<void> {
    this.state.economicInputs = inputs;
    this.notifyListeners();
  }

  /**
   * Update government builder reference
   */
  async updateGovernmentBuilder(builder: GovernmentBuilderState | null): Promise<void> {
    this.state.governmentBuilder = builder;
    
    if (builder) {
      await this.syncWithGovernmentSystem();
      this.updateCrossBuilderAnalysis();
    }
    
    this.notifyListeners();
  }

  /**
   * Generate economy builder from atomic components
   */
  private generateEconomyBuilderFromAtomicComponents(
    components: EconomicComponentType[],
    economicInputs: EconomicInputs
  ): EconomyBuilderState {
    const totalGDP = economicInputs.coreIndicators.nominalGDP;
    const population = economicInputs.coreIndicators.totalPopulation;
    
    // Calculate sector impacts from components
    const sectorImpacts = this.calculateSectorImpacts(components);
    const laborImpacts = this.calculateLaborImpacts(components);
    const demographicImpacts = this.calculateDemographicImpacts(components);
    
    // Generate sectors configuration
    const sectors = this.generateSectorsFromComponents(components, sectorImpacts, totalGDP);
    
    // Generate labor configuration
    const laborMarket = this.generateLaborFromComponents(components, laborImpacts, population);
    
    // Generate demographics configuration
    const demographics = this.generateDemographicsFromComponents(components, demographicImpacts, population);
    
    // Determine economic model and structure
    const structure = this.determineEconomicStructure(components);
    
    return {
      structure,
      sectors,
      laborMarket,
      demographics,
      selectedAtomicComponents: components,
      isValid: true,
      errors: {},
      lastUpdated: new Date(),
      version: '1.0.0'
    };
  }

  /**
   * Calculate sector impacts from atomic components
   */
  private calculateSectorImpacts(components: EconomicComponentType[]): Record<string, number> {
    const impacts: Record<string, number> = {};
    const sectors = ['agriculture', 'manufacturing', 'services', 'technology', 'finance', 'government'];
    
    sectors.forEach(sector => {
      impacts[sector] = components.reduce((sum, compType) => {
        const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
        return sum + (component?.sectorImpact[sector] || 1);
      }, 0) / components.length || 1;
    });
    
    return impacts;
  }

  /**
   * Calculate labor impacts from atomic components
   */
  private calculateLaborImpacts(components: EconomicComponentType[]): Record<string, number> {
    return components.reduce((sum, compType) => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
      return {
        unemployment: sum.unemployment + (component?.employmentImpact.unemploymentModifier || 0),
        participation: sum.participation + (component?.employmentImpact.participationModifier || 1),
        wageGrowth: sum.wageGrowth + (component?.employmentImpact.wageGrowthModifier || 1)
      };
    }, { unemployment: 0, participation: 1, wageGrowth: 1 });
  }

  /**
   * Calculate demographic impacts from atomic components
   */
  private calculateDemographicImpacts(components: EconomicComponentType[]): Record<string, number> {
    // For now, return neutral impacts
    // This could be expanded based on component effects on demographics
    return {
      populationGrowth: 1.0,
      lifeExpectancy: 1.0,
      literacyRate: 1.0,
      urbanization: 1.0
    };
  }

  /**
   * Generate sectors from components
   */
  private generateSectorsFromComponents(
    components: EconomicComponentType[],
    impacts: Record<string, number>,
    totalGDP: number
  ) {
    const sectors = [
      { id: 'agriculture', name: 'Agriculture', base: 5 },
      { id: 'manufacturing', name: 'Manufacturing', base: 20 },
      { id: 'services', name: 'Services', base: 60 },
      { id: 'technology', name: 'Technology', base: 8 },
      { id: 'finance', name: 'Finance', base: 5 },
      { id: 'government', name: 'Government', base: 2 }
    ];

    return sectors.map(sector => ({
      id: sector.id,
      name: sector.name,
      category: this.getSectorCategory(sector.id),
      gdpContribution: sector.base * impacts[sector.id] || sector.base,
      employmentShare: sector.base * impacts[sector.id] || sector.base,
      productivity: 75 + (impacts[sector.id] - 1) * 25,
      growthRate: 2 + (impacts[sector.id] - 1) * 2,
      exports: sector.id === 'manufacturing' ? 30 : sector.id === 'agriculture' ? 20 : 10,
      imports: sector.id === 'technology' ? 25 : 15,
      technologyLevel: impacts[sector.id] > 1.2 ? 'Advanced' as const : impacts[sector.id] > 1.0 ? 'Modern' as const : 'Traditional' as const,
      automation: Math.min(80, 20 + (impacts[sector.id] - 1) * 30),
      regulation: 'Moderate' as const,
      subsidy: sector.id === 'agriculture' ? 15 : 5,
      innovation: Math.min(100, 50 + (impacts[sector.id] - 1) * 25),
      sustainability: 70,
      competitiveness: Math.min(100, 60 + (impacts[sector.id] - 1) * 20)
    }));
  }

  /**
   * Generate labor configuration from components
   */
  private generateLaborFromComponents(
    components: EconomicComponentType[],
    impacts: Record<string, number>,
    population: number
  ) {
    const baseUnemployment = 5;
    const baseParticipation = 65;
    
    return {
      totalWorkforce: Math.round(population * 0.65 * (impacts.participation || 1)),
      laborForceParticipationRate: baseParticipation * (impacts.participation || 1),
      employmentRate: 100 - (baseUnemployment + (impacts.unemployment || 0)),
      unemploymentRate: baseUnemployment + (impacts.unemployment || 0),
      underemploymentRate: (baseUnemployment + (impacts.unemployment || 0)) * 0.6,
      
      youthUnemploymentRate: (baseUnemployment + (impacts.unemployment || 0)) * 2.2,
      seniorEmploymentRate: 55,
      femaleParticipationRate: baseParticipation * 0.85,
      maleParticipationRate: baseParticipation * 1.15,
      
      sectorDistribution: {
        agriculture: 3.5,
        mining: 0.8,
        manufacturing: 12.5,
        construction: 6.5,
        utilities: 1.2,
        wholesale: 5.5,
        retail: 11.0,
        transportation: 4.8,
        information: 3.2,
        finance: 5.5,
        professional: 13.5,
        education: 9.0,
        healthcare: 14.0,
        hospitality: 7.5,
        government: 15.0,
        other: 6.5
      },
      
      employmentType: {
        fullTime: 72.0,
        partTime: 18.5,
        temporary: 4.5,
        seasonal: 2.0,
        selfEmployed: 9.5,
        gig: 5.5,
        informal: 3.0
      },
      
      averageWorkweekHours: 38.5,
      averageOvertimeHours: 3.2,
      paidVacationDays: 15,
      paidSickLeaveDays: 8,
      parentalLeaveWeeks: 12,
      
      unionizationRate: 12.5,
      collectiveBargainingCoverage: 18.0,
      minimumWageHourly: 12.50,
      livingWageHourly: 18.75,
      workplaceSafetyIndex: 72,
      laborRightsScore: 68,
      workerProtections: {
        jobSecurity: 65,
        wageProtection: 70,
        healthSafety: 75,
        discriminationProtection: 80,
        collectiveRights: 60
      }
    };
  }

  /**
   * Generate demographics configuration from components
   */
  private generateDemographicsFromComponents(
    components: EconomicComponentType[],
    impacts: Record<string, number>,
    population: number
  ) {
    return {
      totalPopulation: population,
      populationGrowthRate: 0.5 * (impacts.populationGrowth || 1),
      
      ageDistribution: {
        under15: 18,
        age15to64: 65,
        over65: 17
      },
      
      urbanRuralSplit: {
        urban: 75 * (impacts.urbanization || 1),
        rural: 25 / (impacts.urbanization || 1)
      },
      
      regions: [
        {
          name: 'Capital Region',
          population: Math.round(population * 0.3),
          populationPercent: 30,
          urbanPercent: 90,
          economicActivity: 40,
          developmentLevel: 'Advanced' as const
        },
        {
          name: 'Industrial Region',
          population: Math.round(population * 0.25),
          populationPercent: 25,
          urbanPercent: 80,
          economicActivity: 30,
          developmentLevel: 'Developed' as const
        },
        {
          name: 'Agricultural Region',
          population: Math.round(population * 0.45),
          populationPercent: 45,
          urbanPercent: 60,
          economicActivity: 30,
          developmentLevel: 'Developing' as const
        }
      ],
      
      lifeExpectancy: 78 * (impacts.lifeExpectancy || 1),
      literacyRate: 95 * (impacts.literacyRate || 1),
      educationLevels: {
        noEducation: 2,
        primary: 25,
        secondary: 45,
        tertiary: 28
      },
      
      netMigrationRate: 2.5,
      immigrationRate: 5.0,
      emigrationRate: 2.5,
      
      infantMortalityRate: 5,
      maternalMortalityRate: 15,
      healthExpenditureGDP: 8.5,
      
      youthDependencyRatio: 28,
      elderlyDependencyRatio: 26,
      totalDependencyRatio: 54
    };
  }

  /**
   * Determine economic structure from components
   */
  private determineEconomicStructure(components: EconomicComponentType[]) {
    // Determine primary economic model
    let economicModel = 'Mixed Economy';
    if (components.includes(EconomicComponentType.FREE_MARKET_SYSTEM)) {
      economicModel = 'Free Market System';
    } else if (components.includes(EconomicComponentType.STATE_CAPITALISM)) {
      economicModel = 'State Capitalism';
    } else if (components.includes(EconomicComponentType.KNOWLEDGE_ECONOMY)) {
      economicModel = 'Knowledge Economy';
    } else if (components.includes(EconomicComponentType.INNOVATION_ECONOMY)) {
      economicModel = 'Innovation Economy';
    }

    // Determine primary sectors
    const primarySectors: string[] = [];
    const secondarySectors: string[] = [];
    const tertiarySectors: string[] = [];

    if (components.includes(EconomicComponentType.AGRICULTURE_LED)) {
      primarySectors.push('Agriculture');
    }
    if (components.includes(EconomicComponentType.MANUFACTURING_LED)) {
      secondarySectors.push('Manufacturing');
    }
    if (components.includes(EconomicComponentType.SERVICE_BASED)) {
      tertiarySectors.push('Services');
    }
    if (components.includes(EconomicComponentType.TECHNOLOGY_FOCUSED)) {
      tertiarySectors.push('Technology');
    }
    if (components.includes(EconomicComponentType.FINANCE_CENTERED)) {
      tertiarySectors.push('Finance');
    }

    // Determine growth strategy
    let growthStrategy: 'Export-Led' | 'Import-Substitution' | 'Balanced' | 'Innovation-Driven' = 'Balanced';
    if (components.includes(EconomicComponentType.EXPORT_ORIENTED)) {
      growthStrategy = 'Export-Led';
    } else if (components.includes(EconomicComponentType.IMPORT_SUBSTITUTION)) {
      growthStrategy = 'Import-Substitution';
    } else if (components.includes(EconomicComponentType.INNOVATION_ECONOMY)) {
      growthStrategy = 'Innovation-Driven';
    }

    return {
      economicModel,
      primarySectors,
      secondarySectors,
      tertiarySectors,
      totalGDP: this.state.economicInputs?.coreIndicators.nominalGDP || 0,
      gdpCurrency: 'USD',
      economicTier: this.determineEconomicTier(),
      growthStrategy
    };
  }

  /**
   * Determine economic tier based on GDP per capita
   */
  private determineEconomicTier(): 'Developing' | 'Emerging' | 'Developed' | 'Advanced' {
    const gdpPerCapita = this.state.economicInputs?.coreIndicators.gdpPerCapita || 0;
    
    if (gdpPerCapita >= 40000) return 'Advanced';
    if (gdpPerCapita >= 20000) return 'Developed';
    if (gdpPerCapita >= 8000) return 'Emerging';
    return 'Developing';
  }

  /**
   * Get sector category
   */
  private getSectorCategory(sectorId: string): 'Primary' | 'Secondary' | 'Tertiary' {
    if (['agriculture', 'mining'].includes(sectorId)) return 'Primary';
    if (['manufacturing', 'construction'].includes(sectorId)) return 'Secondary';
    return 'Tertiary';
  }

  /**
   * Sync with government system
   */
  private async syncWithGovernmentSystem(): Promise<void> {
    if (!this.state.governmentBuilder || !this.state.economyBuilder) return;

    // Calculate optimal government spending based on economic structure
    const spendingNeeds = this.calculateGovernmentSpendingNeeds();
    
    // Suggest department budgets based on economic priorities
    const budgetSuggestions = this.suggestDepartmentBudgets();
    
    // Detect policy conflicts
    const conflicts = this.detectPolicyConflicts();
    
    if (conflicts.length > 0) {
      this.state.warnings.push(`Policy conflicts detected: ${conflicts.join(', ')}`);
    }

    this.addToQueue({
      type: 'government_sync',
      timestamp: Date.now(),
      data: { spendingNeeds, budgetSuggestions, conflicts },
      message: 'Synced with government system'
    });
  }

  /**
   * Sync with tax system (internal)
   */
  private async syncWithTaxSystemInternal(): Promise<void> {
    if (!this.state.economyBuilder) return;

    // Calculate optimal tax rates based on economic structure
    const optimalRates = this.calculateOptimalTaxRates();
    
    // Update tax revenue projections
    const revenueProjections = this.updateTaxRevenueProjections();
    
    // Suggest tax policy adjustments
    const policySuggestions = this.suggestTaxPolicyAdjustments();

    this.addToQueue({
      type: 'tax_sync',
      timestamp: Date.now(),
      data: { optimalRates, revenueProjections, policySuggestions },
      message: 'Synced with tax system'
    });
  }

  /**
   * Calculate optimal tax rates for economy
   */
  private calculateOptimalTaxRates() {
    const components = this.state.selectedAtomicComponents;
    
    let corporateRate = 25;
    let incomeRate = 30;
    
    components.forEach(compType => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
      if (component) {
        corporateRate = (corporateRate + component.taxImpact.optimalCorporateRate) / 2;
        incomeRate = (incomeRate + component.taxImpact.optimalIncomeRate) / 2;
      }
    });
    
    return {
      corporate: Math.round(corporateRate),
      income: Math.round(incomeRate),
      consumption: 15, // Standard VAT
      rationale: 'Based on economic component optimization'
    };
  }

  /**
   * Calculate government spending needs
   */
  private calculateGovernmentSpendingNeeds() {
    const components = this.state.selectedAtomicComponents;
    let spendingMultiplier = 1.0;
    
    components.forEach(compType => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
      if (component?.governmentSynergies.length) {
        spendingMultiplier += 0.1; // Increase spending for government synergies
      }
    });
    
    const totalGDP = this.state.economyBuilder?.structure.totalGDP || 0;
    return {
      totalSpending: totalGDP * 0.35 * spendingMultiplier,
      education: totalGDP * 0.08 * spendingMultiplier,
      healthcare: totalGDP * 0.10 * spendingMultiplier,
      infrastructure: totalGDP * 0.06 * spendingMultiplier,
      social: totalGDP * 0.08 * spendingMultiplier
    };
  }

  /**
   * Suggest department budgets
   */
  private suggestDepartmentBudgets() {
    const components = this.state.selectedAtomicComponents;
    const suggestions: Record<string, number> = {};
    
    // Default budget allocations
    suggestions['Education'] = 15;
    suggestions['Healthcare'] = 20;
    suggestions['Infrastructure'] = 12;
    suggestions['Social Services'] = 18;
    suggestions['Defense'] = 8;
    suggestions['Research'] = 5;
    
    // Adjust based on components
    if (components.includes(EconomicComponentType.EDUCATION_FIRST)) {
      suggestions['Education'] += 10;
      suggestions['Research'] += 5;
    }
    
    if (components.includes(EconomicComponentType.RD_INVESTMENT)) {
      suggestions['Research'] += 8;
      suggestions['Education'] += 3;
    }
    
    if (components.includes(EconomicComponentType.SOCIAL_MARKET_ECONOMY)) {
      suggestions['Social Services'] += 8;
      suggestions['Healthcare'] += 5;
    }
    
    return suggestions;
  }

  /**
   * Detect policy conflicts
   */
  private detectPolicyConflicts(): string[] {
    const conflicts: string[] = [];
    const components = this.state.selectedAtomicComponents;
    
    if (components.includes(EconomicComponentType.FREE_MARKET_SYSTEM) && 
        components.includes(EconomicComponentType.PROTECTED_WORKERS)) {
      conflicts.push('Free market conflicts with worker protections');
    }
    
    if (components.includes(EconomicComponentType.PLANNED_ECONOMY) && 
        components.includes(EconomicComponentType.FLEXIBLE_LABOR)) {
      conflicts.push('Planned economy conflicts with flexible labor');
    }
    
    return conflicts;
  }

  /**
   * Update tax revenue projections
   */
  private updateTaxRevenueProjections() {
    const gdp = this.state.economyBuilder?.structure.totalGDP || 0;
    const optimalRates = this.calculateOptimalTaxRates();
    
    return {
      corporateTax: gdp * (optimalRates.corporate / 100) * 0.3,
      incomeTax: gdp * (optimalRates.income / 100) * 0.4,
      consumptionTax: gdp * (optimalRates.consumption / 100) * 0.3,
      total: gdp * 0.25 // 25% of GDP as total tax revenue
    };
  }

  /**
   * Suggest tax policy adjustments
   */
  private suggestTaxPolicyAdjustments() {
    const suggestions: string[] = [];
    const components = this.state.selectedAtomicComponents;
    
    if (components.includes(EconomicComponentType.KNOWLEDGE_ECONOMY)) {
      suggestions.push('Consider R&D tax credits for innovation');
    }
    
    if (components.includes(EconomicComponentType.MANUFACTURING_LED)) {
      suggestions.push('Lower corporate tax rates for manufacturing competitiveness');
    }
    
    if (components.includes(EconomicComponentType.SOCIAL_MARKET_ECONOMY)) {
      suggestions.push('Implement progressive income tax for social equity');
    }
    
    return suggestions;
  }

  /**
   * Update cross-builder analysis
   */
  private updateCrossBuilderAnalysis(): void {
    // Use the new comprehensive synergy service
    if (this.state.economyBuilder && this.state.governmentBuilder) {
      this.state.crossBuilderAnalysis = crossBuilderSynergyService.analyzeCrossBuilderIntegration(
        this.state.economyBuilder,
        this.state.governmentBuilder
      );
      
      // Convert to legacy format for backward compatibility
      this.state.crossBuilderSynergies = this.state.crossBuilderAnalysis.synergies.map(synergy => ({
        id: synergy.id,
        type: synergy.type,
        components: synergy.components,
        strength: synergy.strength,
        description: synergy.description,
        impact: {
          effectiveness: synergy.impact.effectiveness,
          economicGrowth: synergy.impact.economicGrowth,
          taxEfficiency: synergy.impact.taxEfficiency,
          governmentCapacity: synergy.impact.governmentCapacity
        }
      }));

      this.state.crossBuilderConflicts = this.state.crossBuilderAnalysis.conflicts.map(conflict => ({
        id: conflict.id,
        type: conflict.type,
        components: conflict.components,
        severity: conflict.strength,
        description: conflict.description,
        penalty: {
          effectiveness: Math.abs(conflict.impact.effectiveness),
          economicGrowth: Math.abs(conflict.impact.economicGrowth),
          taxEfficiency: Math.abs(conflict.impact.taxEfficiency),
          governmentCapacity: Math.abs(conflict.impact.governmentCapacity)
        }
      }));
    } else {
      // Fallback to legacy detection
      this.state.crossBuilderSynergies = this.detectCrossBuilderSynergies();
      this.state.crossBuilderConflicts = this.detectCrossBuilderConflicts();
    }
  }

  /**
   * Detect cross-builder synergies
   */
  private detectCrossBuilderSynergies(): CrossBuilderSynergy[] {
    const synergies: CrossBuilderSynergy[] = [];
    const components = this.state.selectedAtomicComponents;
    
    components.forEach(compType => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
      if (component?.governmentSynergies) {
        component.governmentSynergies.forEach(govSynergy => {
          synergies.push({
            id: `${compType}-${govSynergy}`,
            type: 'economy-government',
            components: { economic: compType, government: govSynergy as ComponentType },
            strength: 75,
            description: `${component.name} synergizes with ${govSynergy}`,
            impact: {
              effectiveness: 15,
              economicGrowth: 10,
              taxEfficiency: 5,
              governmentCapacity: 12
            }
          });
        });
      }
    });
    
    return synergies;
  }

  /**
   * Detect cross-builder conflicts
   */
  private detectCrossBuilderConflicts(): CrossBuilderConflict[] {
    const conflicts: CrossBuilderConflict[] = [];
    const components = this.state.selectedAtomicComponents;
    
    components.forEach(compType => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
      if (component?.governmentConflicts) {
        component.governmentConflicts.forEach(govConflict => {
          conflicts.push({
            id: `${compType}-${govConflict}`,
            type: 'economy-government',
            components: { economic: compType, government: govConflict as ComponentType },
            severity: 65,
            description: `${component.name} conflicts with ${govConflict}`,
            penalty: {
              effectiveness: -10,
              economicGrowth: -8,
              taxEfficiency: -5,
              governmentCapacity: -12
            }
          });
        });
      }
    });
    
    return conflicts;
  }

  /**
   * Add event to update queue
   */
  private addToQueue(event: EconomyUpdateEvent): void {
    this.updateQueue.push(event);
    this.processQueue();
  }

  /**
   * Process update queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    while (this.updateQueue.length > 0) {
      const event = this.updateQueue.shift();
      if (event) {
        await this.processUpdate(event);
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Process individual update
   */
  private async processUpdate(event: EconomyUpdateEvent): Promise<void> {
    switch (event.type) {
      case 'components_changed':
        await this.handleComponentsChanged(event.data);
        break;
      case 'economy_updated':
        await this.handleEconomyUpdated(event.data);
        break;
      case 'government_sync':
        await this.handleGovernmentSync(event.data);
        break;
      case 'tax_sync':
        await this.handleTaxSync(event.data);
        break;
      case 'error':
        this.handleError(event.data);
        break;
    }
  }

  /**
   * Handle components changed event
   */
  private async handleComponentsChanged(components: unknown): Promise<void> {
    if (!Array.isArray(components)) {
      this.state.warnings.push('Invalid components data received');
      return;
    }
    // Validate component combinations
    const validation = this.validateComponentCombination(components);
    if (!validation.isValid) {
      this.state.warnings.push(validation.message);
    }

    // Check for synergies and conflicts
    const synergies = this.detectEconomicSynergies(components);
    const conflicts = this.detectEconomicConflicts(components);

    if (synergies.length > 0) {
      this.state.warnings.push(`Economic synergies detected: ${synergies.map(s => s.description).join(', ')}`);
    }

    if (conflicts.length > 0) {
      this.state.warnings.push(`Economic conflicts detected: ${conflicts.map(c => c.description).join(', ')}`);
    }
  }

  /**
   * Handle economy updated event
   */
  private async handleEconomyUpdated(builder: unknown): Promise<void> {
    if (!builder || typeof builder !== 'object') {
      this.state.errors.push('Invalid economy builder data received');
      return;
    }

    const builderState = builder as EconomyBuilderState;
    // Validate economy builder
    const validation = this.validateEconomyBuilder(builderState);
    if (!validation.isValid) {
      this.state.errors.push(...validation.errors);
    }

    // Update cross-builder synergies
    this.updateCrossBuilderAnalysis();
  }

  /**
   * Handle government sync event
   */
  private async handleGovernmentSync(data: unknown): Promise<void> {
    // Process government synchronization data
    console.log('Government sync processed:', data);
  }

  /**
   * Handle tax sync event
   */
  private async handleTaxSync(data: unknown): Promise<void> {
    // Process tax synchronization data
    console.log('Tax sync processed:', data);
  }

  /**
   * Handle error event
   */
  private handleError(error: unknown): void {
    console.error('Economy integration error:', error);
    const errorMessage = error instanceof Error ? error.message :
                        (typeof error === 'object' && error !== null && 'message' in error ?
                         String((error as { message: unknown }).message) : 'Unknown error');
    this.state.errors.push(errorMessage);
  }

  /**
   * Validate component combination
   */
  private validateComponentCombination(components: EconomicComponentType[]): { isValid: boolean; message: string } {
    if (components.length === 0) {
      return { isValid: false, message: 'At least one economic component is required' };
    }

    if (components.length > 12) {
      return { isValid: false, message: 'Maximum 12 economic components allowed' };
    }

    // Check for impossible combinations
    if (components.includes(EconomicComponentType.FREE_MARKET_SYSTEM) && 
        components.includes(EconomicComponentType.PLANNED_ECONOMY)) {
      return { isValid: false, message: 'Free market and planned economy are mutually exclusive' };
    }

    return { isValid: true, message: 'Component combination is valid' };
  }

  /**
   * Validate economy builder
   */
  private validateEconomyBuilder(builder: EconomyBuilderState): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check sector contributions sum to 100%
    const sectorSum = builder.sectors.reduce((sum, sector) => sum + sector.gdpContribution, 0);
    if (Math.abs(sectorSum - 100) > 1) {
      errors.push(`Sector GDP contributions must sum to 100% (currently ${sectorSum.toFixed(1)}%)`);
    }

    // Check labor force makes sense
    if (builder.laborMarket.laborForceParticipationRate > 90) {
      errors.push('Labor force participation rate seems too high');
    }

    if (builder.laborMarket.unemploymentRate < 0 || builder.laborMarket.unemploymentRate > 50) {
      errors.push('Unemployment rate seems unrealistic');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Detect economic synergies
   */
  private detectEconomicSynergies(components: EconomicComponentType[]): Array<{components: string[], description: string}> {
    const synergies: Array<{components: string[], description: string}> = [];
    
    // Define synergy patterns
    const synergyPatterns = [
      {
        components: [EconomicComponentType.FREE_MARKET_SYSTEM, EconomicComponentType.FLEXIBLE_LABOR],
        description: 'Free market with flexible labor creates efficiency'
      },
      {
        components: [EconomicComponentType.KNOWLEDGE_ECONOMY, EconomicComponentType.RD_INVESTMENT],
        description: 'Knowledge economy with R&D investment drives innovation'
      },
      {
        components: [EconomicComponentType.SOCIAL_MARKET_ECONOMY, EconomicComponentType.PROTECTED_WORKERS],
        description: 'Social market economy with worker protections ensures equity'
      }
    ];
    
    synergyPatterns.forEach(pattern => {
      if (pattern.components.every(comp => components.includes(comp))) {
        synergies.push({
          components: pattern.components,
          description: pattern.description
        });
      }
    });
    
    return synergies;
  }

  /**
   * Detect economic conflicts
   */
  private detectEconomicConflicts(components: EconomicComponentType[]): Array<{components: string[], description: string}> {
    const conflicts: Array<{components: string[], description: string}> = [];
    
    // Define conflict patterns
    const conflictPatterns = [
      {
        components: [EconomicComponentType.FREE_MARKET_SYSTEM, EconomicComponentType.PROTECTED_WORKERS],
        description: 'Free market conflicts with worker protections'
      },
      {
        components: [EconomicComponentType.PLANNED_ECONOMY, EconomicComponentType.FLEXIBLE_LABOR],
        description: 'Planned economy conflicts with flexible labor'
      },
      {
        components: [EconomicComponentType.AGRICULTURE_LED, EconomicComponentType.TECHNOLOGY_FOCUSED],
        description: 'Agriculture-led economy conflicts with technology focus'
      }
    ];
    
    conflictPatterns.forEach(pattern => {
      if (pattern.components.every(comp => components.includes(comp))) {
        conflicts.push({
          components: pattern.components,
          description: pattern.description
        });
      }
    });
    
    return conflicts;
  }

  /**
   * Save economy configuration with live-wired tRPC integration
   */
  async saveEconomyConfiguration(countryId: string, trpcClient: any): Promise<{ success: boolean; countryId?: string; error?: string }> {
    try {
      // Validate that we have the necessary data
      if (!this.state.economyBuilder) {
        return {
          success: false,
          error: 'No economy configuration to save'
        };
      }

      // Validate economy builder before saving
      const validation = this.validateEconomyBuilder(this.state.economyBuilder);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Prepare economy builder state for save
      const economyBuilderState = {
        structure: this.state.economyBuilder.structure,
        sectors: this.state.economyBuilder.sectors,
        laborMarket: this.state.economyBuilder.laborMarket,
        demographics: this.state.economyBuilder.demographics,
        selectedAtomicComponents: this.state.economyBuilder.selectedAtomicComponents || this.state.selectedAtomicComponents,
        lastUpdated: new Date(),
        version: this.state.economyBuilder.version || '1.0.0'
      };

      // Call new tRPC mutation for comprehensive save
      const result = await trpcClient.economics.saveEconomyBuilderState.mutate({
        countryId,
        economyBuilder: economyBuilderState
      });

      if (result.success) {
        this.state.lastUpdate = Date.now();
        this.state.errors = [];
        this.notifyListeners();

        return {
          success: true,
          countryId: result.countryId
        };
      }

      return {
        success: false,
        error: result.message || 'Failed to save economy configuration'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save economy configuration';
      this.state.errors.push(errorMessage);
      this.notifyListeners();

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Auto-save economy builder changes with debouncing
   */
  async autoSaveEconomyBuilder(countryId: string, trpcClient: any, changes: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await trpcClient.economics.autoSaveEconomyBuilder.mutate({
        countryId,
        changes
      });

      if (result.success) {
        this.state.lastUpdate = Date.now();
        this.notifyListeners();
        return { success: true };
      }

      return {
        success: false,
        error: result.message || 'Auto-save failed'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Auto-save failed';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Sync economy with government components
   */
  async syncWithGovernmentComponents(countryId: string, trpcClient: any, governmentComponents: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await trpcClient.economics.syncEconomyWithGovernment.mutate({
        countryId,
        governmentComponents
      });

      if (result.success) {
        // Update cross-builder analysis after sync
        this.updateCrossBuilderAnalysis();
        this.notifyListeners();
        return { success: true };
      }

      return {
        success: false,
        error: result.message || 'Government sync failed'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Government sync failed';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Sync economy with tax system
   */
  async syncWithTaxSystem(countryId: string, trpcClient: any, taxData: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await trpcClient.economics.syncEconomyWithTax.mutate({
        countryId,
        taxData
      });

      if (result.success) {
        this.notifyListeners();
        return { success: true };
      }

      return {
        success: false,
        error: result.message || 'Tax sync failed'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Tax sync failed';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Load economy configuration from database
   */
  async loadEconomyConfiguration(countryId: string, trpcClient: any): Promise<boolean> {
    try {
      const configuration = await trpcClient.economics.getEconomyConfiguration.query({
        countryId
      });

      if (!configuration) {
        return false;
      }

      // Update state with loaded configuration
      this.state.economyBuilder = {
        ...configuration,
        isValid: true,
        errors: {}
      };

      this.state.selectedAtomicComponents = configuration.selectedAtomicComponents || [];
      this.state.lastUpdate = Date.now();
      this.state.errors = [];
      this.notifyListeners();

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load economy configuration';
      this.state.errors.push(errorMessage);
      this.notifyListeners();

      return false;
    }
  }

  /**
   * Notify listeners of state changes
   */
  private notifyListeners(): void {
    const newState = { ...this.state };
    
    // Only notify if state actually changed (deep equality check)
    if (!this.lastNotifiedState || JSON.stringify(newState) !== JSON.stringify(this.lastNotifiedState)) {
      this.lastNotifiedState = newState;
      this.listeners.forEach(listener => {
        try {
          listener(newState);
        } catch (error) {
          console.error('Error in economy integration listener:', error);
        }
      });
    }
  }
}

// Export singleton instance
export const economyIntegrationService = new EconomyIntegrationService();
