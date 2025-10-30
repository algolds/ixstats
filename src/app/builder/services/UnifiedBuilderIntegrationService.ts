/**
 * Unified Builder Integration Service
 *
 * This service manages seamless bidirectional data flow across ALL builder subsystems:
 * - National Identity → Government → Economy → Tax
 * - All components auto-sync and influence each other
 * - Complete data continuity from start to finish
 */

import { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import { EconomicComponentType } from '~/lib/atomic-economic-data';
import type { GovernmentBuilderState } from '~/types/government';
import type { EconomyBuilderState } from '~/types/economy-builder';
import type { EconomicInputs } from '../lib/economy-data-service';
import type { TaxBuilderState } from '~/components/tax-system/TaxBuilder';

/**
 * Government → Economy Component Mapping
 * Maps government atomic components to their corresponding economic components
 */
export const GOVERNMENT_TO_ECONOMY_MAPPING: Partial<Record<ComponentType, EconomicComponentType[]>> = {
  // Economic System Components (Direct Mapping)
  [ComponentType.FREE_MARKET_SYSTEM]: [
    EconomicComponentType.FREE_MARKET_SYSTEM,
    EconomicComponentType.FLEXIBLE_LABOR,
    EconomicComponentType.FREE_TRADE
  ],
  [ComponentType.PLANNED_ECONOMY]: [
    EconomicComponentType.PLANNED_ECONOMY,
    EconomicComponentType.PROTECTED_WORKERS,
    EconomicComponentType.IMPORT_SUBSTITUTION
  ],
  [ComponentType.MIXED_ECONOMY]: [
    EconomicComponentType.MIXED_ECONOMY,
    EconomicComponentType.BALANCED_TRADE
  ],
  [ComponentType.SOCIAL_MARKET_ECONOMY]: [
    EconomicComponentType.SOCIAL_MARKET_ECONOMY,
    EconomicComponentType.PROTECTED_WORKERS,
    EconomicComponentType.UNION_BASED
  ],
  [ComponentType.STATE_CAPITALISM]: [
    EconomicComponentType.STATE_CAPITALISM,
    EconomicComponentType.EXPORT_ORIENTED
  ],
  [ComponentType.RESOURCE_BASED_ECONOMY]: [
    EconomicComponentType.RESOURCE_BASED_ECONOMY,
    EconomicComponentType.EXTRACTION_FOCUSED
  ],
  [ComponentType.KNOWLEDGE_ECONOMY]: [
    EconomicComponentType.KNOWLEDGE_ECONOMY,
    EconomicComponentType.EDUCATION_FIRST,
    EconomicComponentType.RD_INVESTMENT,
    EconomicComponentType.UNIVERSITY_PARTNERSHIPS
  ],

  // Power Distribution → Economic Effects
  [ComponentType.CENTRALIZED_POWER]: [
    EconomicComponentType.STATE_CAPITALISM,
    EconomicComponentType.PLANNED_ECONOMY
  ],
  [ComponentType.FEDERAL_SYSTEM]: [
    EconomicComponentType.MIXED_ECONOMY,
    EconomicComponentType.BALANCED_TRADE
  ],
  [ComponentType.CONFEDERATE_SYSTEM]: [
    EconomicComponentType.FREE_MARKET_SYSTEM,
    EconomicComponentType.FREE_TRADE
  ],

  // Decision Process → Labor & Innovation
  [ComponentType.DEMOCRATIC_PROCESS]: [
    EconomicComponentType.SOCIAL_MARKET_ECONOMY,
    EconomicComponentType.PROTECTED_WORKERS
  ],
  [ComponentType.TECHNOCRATIC_PROCESS]: [
    EconomicComponentType.KNOWLEDGE_ECONOMY,
    EconomicComponentType.INNOVATION_ECONOMY,
    EconomicComponentType.MERIT_BASED
  ],
  [ComponentType.AUTOCRATIC_PROCESS]: [
    EconomicComponentType.STATE_CAPITALISM,
    EconomicComponentType.EXPORT_ORIENTED
  ],

  // Economic Incentives → Market Structure
  [ComponentType.ECONOMIC_INCENTIVES]: [
    EconomicComponentType.FREE_MARKET_SYSTEM,
    EconomicComponentType.FLEXIBLE_LABOR,
    EconomicComponentType.GIG_ECONOMY
  ],

  // Professional Bureaucracy → Service Economy
  [ComponentType.PROFESSIONAL_BUREAUCRACY]: [
    EconomicComponentType.PROFESSIONAL_SERVICES,
    EconomicComponentType.SERVICE_BASED
  ],

  // Digital Government → Tech Focus
  [ComponentType.DIGITAL_GOVERNMENT]: [
    EconomicComponentType.TECHNOLOGY_FOCUSED,
    EconomicComponentType.INNOVATION_ECONOMY,
    EconomicComponentType.STARTUP_ECOSYSTEM
  ],
  [ComponentType.E_GOVERNANCE]: [
    EconomicComponentType.TECHNOLOGY_FOCUSED,
    EconomicComponentType.INNOVATION_ECONOMY
  ],

  // Performance Management → Merit-Based Systems
  [ComponentType.PERFORMANCE_MANAGEMENT]: [
    EconomicComponentType.MERIT_BASED,
    EconomicComponentType.SKILL_BASED
  ],
  [ComponentType.MERIT_BASED_SYSTEM]: [
    EconomicComponentType.MERIT_BASED,
    EconomicComponentType.EDUCATION_FIRST
  ],

  // Strategic Planning → Innovation
  [ComponentType.STRATEGIC_PLANNING]: [
    EconomicComponentType.RD_INVESTMENT,
    EconomicComponentType.TECH_TRANSFER
  ],

  // Environmental Protection → Green Economy
  [ComponentType.ENVIRONMENTAL_PROTECTION]: [
    EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
    EconomicComponentType.RENEWABLE_ENERGY,
    EconomicComponentType.GREEN_TECHNOLOGY,
    EconomicComponentType.CIRCULAR_ECONOMY
  ],

  // Social Programs → Labor Protection
  [ComponentType.WELFARE_STATE]: [
    EconomicComponentType.SOCIAL_MARKET_ECONOMY,
    EconomicComponentType.PROTECTED_WORKERS,
    EconomicComponentType.UNION_BASED
  ],
  [ComponentType.UNIVERSAL_HEALTHCARE]: [
    EconomicComponentType.SOCIAL_MARKET_ECONOMY
  ],

  // Social Policy Components
  [ComponentType.COMPREHENSIVE_WELFARE]: [
    EconomicComponentType.SOCIAL_MARKET_ECONOMY,
    EconomicComponentType.PROTECTED_WORKERS,
    EconomicComponentType.HEALTHCARE_FOCUSED
  ],

  // Additional Government Systems
  [ComponentType.MINIMAL_GOVERNMENT]: [
    EconomicComponentType.FREE_MARKET_SYSTEM,
    EconomicComponentType.FLEXIBLE_LABOR
  ],
  [ComponentType.PRIVATE_SECTOR_LEADERSHIP]: [
    EconomicComponentType.FREE_MARKET_SYSTEM,
    EconomicComponentType.STARTUP_ECOSYSTEM
  ],
  [ComponentType.SOCIAL_DEMOCRACY]: [
    EconomicComponentType.SOCIAL_MARKET_ECONOMY,
    EconomicComponentType.PROTECTED_WORKERS,
    EconomicComponentType.UNION_BASED
  ],
  [ComponentType.PUBLIC_SECTOR_LEADERSHIP]: [
    EconomicComponentType.STATE_CAPITALISM,
    EconomicComponentType.MIXED_ECONOMY
  ],
  [ComponentType.ENVIRONMENTAL_FOCUS]: [
    EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
    EconomicComponentType.RENEWABLE_ENERGY,
    EconomicComponentType.GREEN_TECHNOLOGY
  ],
  [ComponentType.ECONOMIC_PLANNING]: [
    EconomicComponentType.PLANNED_ECONOMY,
    EconomicComponentType.STATE_CAPITALISM
  ],
  [ComponentType.DEVELOPMENTAL_STATE]: [
    EconomicComponentType.STATE_CAPITALISM,
    EconomicComponentType.EXPORT_ORIENTED,
    EconomicComponentType.MANUFACTURING_LED
  ],
  [ComponentType.MERITOCRATIC_SYSTEM]: [
    EconomicComponentType.MERIT_BASED,
    EconomicComponentType.EDUCATION_FIRST
  ],
  [ComponentType.REGIONAL_DEVELOPMENT]: [
    EconomicComponentType.BALANCED_TRADE,
    EconomicComponentType.DOMESTIC_FOCUSED
  ],

  // Default mappings for components without specific economic implications
  [ComponentType.UNITARY_SYSTEM]: [],
  [ComponentType.CONSENSUS_PROCESS]: [],
  [ComponentType.OLIGARCHIC_PROCESS]: [],
  [ComponentType.ELECTORAL_LEGITIMACY]: [],
  [ComponentType.TRADITIONAL_LEGITIMACY]: [],
  [ComponentType.PERFORMANCE_LEGITIMACY]: [],
  [ComponentType.CHARISMATIC_LEGITIMACY]: [],
  [ComponentType.RELIGIOUS_LEGITIMACY]: [],
  [ComponentType.INSTITUTIONAL_LEGITIMACY]: [],
  [ComponentType.MILITARY_ADMINISTRATION]: [],
  [ComponentType.INDEPENDENT_JUDICIARY]: [],
  [ComponentType.PARTISAN_INSTITUTIONS]: [],
  [ComponentType.TECHNOCRATIC_AGENCIES]: [],
  [ComponentType.RULE_OF_LAW]: [],
  [ComponentType.SURVEILLANCE_SYSTEM]: [],
  [ComponentType.SOCIAL_PRESSURE]: [],
  [ComponentType.MILITARY_ENFORCEMENT]: [],
  [ComponentType.CORPORATIST_SYSTEM]: [],
  [ComponentType.ADMINISTRATIVE_DECENTRALIZATION]: [],
  [ComponentType.QUALITY_ASSURANCE]: [],
  [ComponentType.DIGITAL_INFRASTRUCTURE]: [],
  [ComponentType.SMART_CITIES]: [],
  [ComponentType.ANTI_CORRUPTION]: [],
  [ComponentType.TRANSPARENCY_INITIATIVE]: [],
  [ComponentType.PUBLIC_EDUCATION]: [],
  [ComponentType.SOCIAL_SAFETY_NET]: [],
  [ComponentType.WORKER_PROTECTION]: [],
  [ComponentType.CULTURAL_PRESERVATION]: [],
  [ComponentType.MINORITY_RIGHTS]: [],
  [ComponentType.MULTILATERAL_DIPLOMACY]: [],
  [ComponentType.BILATERAL_RELATIONS]: [],
  [ComponentType.INTERNATIONAL_LAW]: [],
  [ComponentType.DEVELOPMENT_AID]: [],
  [ComponentType.HUMANITARIAN_INTERVENTION]: [],
  [ComponentType.TRADE_AGREEMENTS]: [],
  [ComponentType.SECURITY_ALLIANCES]: [],
  [ComponentType.RESEARCH_AND_DEVELOPMENT]: [],
  [ComponentType.INNOVATION_ECOSYSTEM]: [],
  [ComponentType.TECHNOLOGY_TRANSFER]: [],
  [ComponentType.ENTREPRENEURSHIP_SUPPORT]: [],
  [ComponentType.INTELLECTUAL_PROPERTY]: [],
  [ComponentType.STARTUP_INCUBATION]: [],
  [ComponentType.EMERGENCY_RESPONSE]: [],
  [ComponentType.DISASTER_PREPAREDNESS]: [],
  [ComponentType.PANDEMIC_MANAGEMENT]: [],
  [ComponentType.CYBERSECURITY]: [],
  [ComponentType.COUNTER_TERRORISM]: [],
  [ComponentType.CRISIS_COMMUNICATION]: [],
  [ComponentType.RECOVERY_PLANNING]: [],
  [ComponentType.RESILIENCE_BUILDING]: [],
  [ComponentType.RISK_MANAGEMENT]: [],
  [ComponentType.REGIONAL_INTEGRATION]: []
};

export interface UnifiedBuilderState {
  nationalIdentity: {
    countryName: string;
    capital: string;
    currency: string;
    language: string;
    flag?: string;
    anthem?: string;
    motto?: string;
  };
  government: {
    components: ComponentType[];
    builder: GovernmentBuilderState | null;
  };
  economy: {
    components: EconomicComponentType[];
    builder: EconomyBuilderState | null;
    inputs: EconomicInputs | null;
  };
  tax: {
    builder: TaxBuilderState | null;
  };
  lastUpdate: number;
  syncStatus: {
    nationalIdentity: boolean;
    government: boolean;
    economy: boolean;
    tax: boolean;
  };
}

export class UnifiedBuilderIntegrationService {
  private state: UnifiedBuilderState;
  private listeners: Array<(state: UnifiedBuilderState) => void> = [];

  constructor() {
    this.state = {
      nationalIdentity: {
        countryName: '',
        capital: '',
        currency: '',
        language: ''
      },
      government: {
        components: [],
        builder: null
      },
      economy: {
        components: [],
        builder: null,
        inputs: null
      },
      tax: {
        builder: null
      },
      lastUpdate: Date.now(),
      syncStatus: {
        nationalIdentity: false,
        government: false,
        economy: false,
        tax: false
      }
    };
  }

  /**
   * Subscribe to unified state changes
   */
  subscribe(listener: (state: UnifiedBuilderState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current unified state
   */
  getState(): UnifiedBuilderState {
    return { ...this.state };
  }

  /**
   * Update National Identity and cascade changes
   */
  updateNationalIdentity(identity: Partial<UnifiedBuilderState['nationalIdentity']>): void {
    this.state.nationalIdentity = {
      ...this.state.nationalIdentity,
      ...identity
    };
    this.state.syncStatus.nationalIdentity = true;
    this.state.lastUpdate = Date.now();

    // Cascade to economy inputs
    if (this.state.economy.inputs && this.state.economy.inputs.nationalIdentity) {
      this.state.economy.inputs.nationalIdentity = {
        ...this.state.economy.inputs.nationalIdentity,
        countryName: this.state.nationalIdentity.countryName,
        capitalCity: this.state.nationalIdentity.capital,
        currency: this.state.nationalIdentity.currency,
        officialName: this.state.nationalIdentity.countryName
      };
    }

    // Note: TaxSystem doesn't have a currency field - currency is stored in the country's budget

    this.notifyListeners();
  }

  /**
   * Update Government Components and auto-select economic components
   */
  updateGovernmentComponents(components: ComponentType[]): void {
    this.state.government.components = components;

    // Auto-select corresponding economic components
    const suggestedEconomicComponents = this.mapGovernmentToEconomyComponents(components);

    // Merge with existing economic components (don't replace, add)
    const existingComponents = new Set(this.state.economy.components);
    suggestedEconomicComponents.forEach(comp => existingComponents.add(comp));
    this.state.economy.components = Array.from(existingComponents);

    this.state.syncStatus.government = true;
    this.state.lastUpdate = Date.now();
    this.notifyListeners();
  }

  /**
   * Update Government Builder and cascade to economy
   */
  updateGovernmentBuilder(builder: GovernmentBuilderState): void {
    this.state.government.builder = builder;

    // Sync government spending to economy
    if (this.state.economy.inputs) {
      this.syncGovernmentToEconomy();
    }

    // Sync government revenue to tax system
    if (this.state.tax.builder) {
      this.syncGovernmentToTax();
    }

    this.state.syncStatus.government = true;
    this.state.lastUpdate = Date.now();
    this.notifyListeners();
  }

  /**
   * Update Economic Components
   */
  updateEconomicComponents(components: EconomicComponentType[]): void {
    this.state.economy.components = components;
    this.state.syncStatus.economy = true;
    this.state.lastUpdate = Date.now();
    this.notifyListeners();
  }

  /**
   * Update Economy Builder and cascade changes
   */
  updateEconomyBuilder(builder: EconomyBuilderState, inputs: EconomicInputs): void {
    this.state.economy.builder = builder;
    this.state.economy.inputs = inputs;

    // Sync economy to tax system (GDP, sectors affect tax base)
    if (this.state.tax.builder) {
      this.syncEconomyToTax();
    }

    this.state.syncStatus.economy = true;
    this.state.lastUpdate = Date.now();
    this.notifyListeners();
  }

  /**
   * Update Tax Builder and cascade changes
   */
  updateTaxBuilder(builder: TaxBuilderState): void {
    this.state.tax.builder = builder;

    // Sync tax revenue to government revenue sources
    if (this.state.government.builder) {
      this.syncTaxToGovernment();
    }

    // Sync tax policies to economy inputs
    if (this.state.economy.inputs) {
      this.syncTaxToEconomy();
    }

    this.state.syncStatus.tax = true;
    this.state.lastUpdate = Date.now();
    this.notifyListeners();
  }

  /**
   * Map government components to suggested economic components
   */
  private mapGovernmentToEconomyComponents(govComponents: ComponentType[]): EconomicComponentType[] {
    const suggested = new Set<EconomicComponentType>();

    govComponents.forEach(govComp => {
      const mapping = GOVERNMENT_TO_ECONOMY_MAPPING[govComp];
      if (mapping) {
        mapping.forEach(econComp => suggested.add(econComp));
      }
    });

    return Array.from(suggested);
  }

  /**
   * Sync government builder data to economy inputs
   */
  private syncGovernmentToEconomy(): void {
    if (!this.state.government.builder || !this.state.economy.inputs) return;

    const totalBudget = this.state.government.builder.structure?.totalBudget || 0;
    const gdp = this.state.economy.inputs.coreIndicators.nominalGDP;

    this.state.economy.inputs.governmentSpending = {
      ...this.state.economy.inputs.governmentSpending,
      totalSpending: totalBudget,
      spendingGDPPercent: gdp > 0 ? (totalBudget / gdp) * 100 : 35,
      spendingCategories: this.state.government.builder.departments.map((dept, index) => {
        const allocation = this.state.government.builder!.budgetAllocations.find(
          a => a.departmentId === index.toString()
        );
        return {
          category: dept.name,
          amount: allocation?.allocatedAmount || 0,
          percent: allocation?.allocatedPercent || 0,
          icon: dept.icon,
          color: dept.color,
          description: dept.description
        };
      })
    };
  }

  /**
   * Sync government revenue needs to tax system
   */
  private syncGovernmentToTax(): void {
    if (!this.state.government.builder || !this.state.tax.builder) return;

    const totalBudget = this.state.government.builder.structure?.totalBudget || 0;
    const currentRevenue = this.state.government.builder.revenueSources?.reduce(
      (sum, r) => sum + (r.revenueAmount || 0), 0
    ) || 0;

    // Calculate current revenue from tax categories
    const taxRevenue = this.state.tax.builder.categories.reduce(
      (sum, cat) => sum + ((cat.baseRate || 0) * (this.state.economy.inputs?.coreIndicators.nominalGDP || 0) / 100),
      0
    );

    // Store revenue data in taxSystem metadata (if taxSystem exists)
    if (this.state.tax.builder.taxSystem) {
      (this.state.tax.builder.taxSystem as any).revenueTarget = totalBudget;
      (this.state.tax.builder.taxSystem as any).currentRevenue = taxRevenue;
    }
  }

  /**
   * Sync economy data to tax system (GDP, sectors define tax base)
   */
  private syncEconomyToTax(): void {
    if (!this.state.economy.inputs || !this.state.tax.builder) return;

    const gdp = this.state.economy.inputs.coreIndicators.nominalGDP;

    // Tax base is determined by GDP and economic structure
    // Store in taxSystem metadata (if taxSystem exists)
    if (this.state.tax.builder.taxSystem) {
      (this.state.tax.builder.taxSystem as any).economicBase = {
        gdp,
        corporateRevenue: gdp * 0.6, // Simplified: 60% of GDP is corporate
        individualIncome: gdp * 0.4, // 40% is individual income
        consumption: gdp * 0.7 // Total consumption spending
      };
    }
  }

  /**
   * Sync tax revenue to government revenue sources
   */
  private syncTaxToGovernment(): void {
    if (!this.state.tax.builder || !this.state.government.builder) return;

    // Calculate tax revenue from categories
    const taxRevenue = this.state.tax.builder.categories.reduce(
      (sum, cat) => sum + ((cat.baseRate || 0) * (this.state.economy.inputs?.coreIndicators.nominalGDP || 0) / 100),
      0
    );

    // Update government revenue sources with tax data
    const taxRevenueSource = this.state.government.builder.revenueSources.find(
      r => r.name === 'Tax Revenue'
    );

    if (taxRevenueSource) {
      taxRevenueSource.revenueAmount = taxRevenue;
    } else {
      this.state.government.builder.revenueSources.push({
        name: 'Tax Revenue',
        category: 'Direct Tax',
        revenueAmount: taxRevenue,
        revenuePercent: 100,
        description: 'Revenue from tax system'
      });
    }
  }

  /**
   * Sync tax policies to economy inputs
   */
  private syncTaxToEconomy(): void {
    if (!this.state.tax.builder || !this.state.economy.inputs) return;

    // Update fiscal system with tax rates
    const avgTaxRate = this.state.tax.builder.categories?.reduce(
      (sum, cat) => sum + (cat.baseRate || 0), 0
    ) / (this.state.tax.builder.categories?.length || 1);

    this.state.economy.inputs.fiscalSystem = {
      ...this.state.economy.inputs.fiscalSystem,
      taxRevenueGDPPercent: avgTaxRate
    };
  }

  /**
   * Get suggested economic components based on current government setup
   */
  getSuggestedEconomicComponents(): EconomicComponentType[] {
    return this.mapGovernmentToEconomyComponents(this.state.government.components);
  }

  /**
   * Check if all builders are synced
   */
  isFullySynced(): boolean {
    return Object.values(this.state.syncStatus).every(status => status);
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }
}

// Export singleton instance
export const unifiedBuilderService = new UnifiedBuilderIntegrationService();
