/**
 * Bidirectional Tax Sync Service
 *
 * This service provides real-time bidirectional synchronization between the economy builder
 * and tax system, ensuring optimal tax rates and policies based on economic components
 * and providing economic impact feedback for tax policy changes.
 */

import { EconomicComponentType, ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/atomic-economic-data";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { TaxSystem, TaxCategory, TaxBracket } from "~/types/tax-system";

export interface TaxSyncEvent {
  type: "economy_to_tax" | "tax_to_economy" | "bidirectional_sync" | "error";
  timestamp: number;
  source: "economy" | "tax";
  data: any;
  message: string;
}

export interface TaxRecommendation {
  taxType: "corporate" | "income" | "consumption" | "property" | "capital_gains";
  currentRate: number;
  recommendedRate: number;
  rationale: string;
  economicImpact: {
    gdpImpact: number; // percentage change
    employmentImpact: number; // percentage change
    investmentImpact: number; // percentage change
    competitivenessImpact: number; // 0-100 score
  };
  implementationPriority: "high" | "medium" | "low";
  estimatedRevenueChange: number; // percentage
}

export interface EconomicImpactOfTax {
  taxChange: {
    taxType: string;
    rateChange: number; // percentage points
    effectiveRate: number;
  };
  economicImpact: {
    gdpGrowthImpact: number; // percentage change
    employmentImpact: number; // percentage change
    investmentImpact: number; // percentage change
    consumptionImpact: number; // percentage change
    inflationImpact: number; // percentage change
  };
  sectorImpacts: Record<string, number>; // sector-specific impacts
  timeToEffect: "immediate" | "short_term" | "medium_term" | "long_term";
  confidence: number; // 0-100
}

export interface BidirectionalTaxSyncState {
  economyBuilder: EconomyBuilderState | null;
  taxSystem: TaxSystem | null;
  taxRecommendations: TaxRecommendation[];
  economicImpacts: EconomicImpactOfTax[];
  isSyncing: boolean;
  lastSync: number;
  syncHistory: TaxSyncEvent[];
  errors: string[];
}

export class BidirectionalTaxSyncService {
  private state: BidirectionalTaxSyncState;
  private listeners: Array<(state: BidirectionalTaxSyncState) => void> = [];
  private syncQueue: TaxSyncEvent[] = [];
  private isProcessingQueue = false;

  constructor() {
    this.state = {
      economyBuilder: null,
      taxSystem: null,
      taxRecommendations: [],
      economicImpacts: [],
      isSyncing: false,
      lastSync: Date.now(),
      syncHistory: [],
      errors: [],
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: BidirectionalTaxSyncState) => void): () => void {
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
  getState(): BidirectionalTaxSyncState {
    return { ...this.state };
  }

  /**
   * Update economy builder and trigger tax recommendations
   */
  async updateEconomyBuilder(economyBuilder: EconomyBuilderState): Promise<void> {
    this.state.economyBuilder = economyBuilder;
    this.state.isSyncing = true;
    this.notifyListeners();

    try {
      // Generate tax recommendations based on economic components
      const recommendations = await this.generateTaxRecommendations(economyBuilder);
      this.state.taxRecommendations = recommendations;

      // Add sync event
      this.addSyncEvent({
        type: "economy_to_tax",
        timestamp: Date.now(),
        source: "economy",
        data: { economyBuilder, recommendations },
        message: `Generated ${recommendations.length} tax recommendations from economy builder`,
      });

      this.state.lastSync = Date.now();
      this.state.errors = [];
    } catch (error) {
      this.state.errors.push(error instanceof Error ? error.message : "Unknown error");
      this.addSyncEvent({
        type: "error",
        timestamp: Date.now(),
        source: "economy",
        data: error,
        message: "Failed to update economy builder",
      });
    } finally {
      this.state.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Update tax system and calculate economic impacts
   */
  async updateTaxSystem(taxSystem: TaxSystem): Promise<void> {
    this.state.taxSystem = taxSystem;
    this.state.isSyncing = true;
    this.notifyListeners();

    try {
      // Calculate economic impacts of tax changes
      const impacts = await this.calculateEconomicImpacts(taxSystem);
      this.state.economicImpacts = impacts;

      // Add sync event
      this.addSyncEvent({
        type: "tax_to_economy",
        timestamp: Date.now(),
        source: "tax",
        data: { taxSystem, impacts },
        message: `Calculated ${impacts.length} economic impacts from tax system`,
      });

      this.state.lastSync = Date.now();
      this.state.errors = [];
    } catch (error) {
      this.state.errors.push(error instanceof Error ? error.message : "Unknown error");
      this.addSyncEvent({
        type: "error",
        timestamp: Date.now(),
        source: "tax",
        data: error,
        message: "Failed to update tax system",
      });
    } finally {
      this.state.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Perform bidirectional sync
   */
  async performBidirectionalSync(): Promise<void> {
    if (!this.state.economyBuilder || !this.state.taxSystem) return;

    this.state.isSyncing = true;
    this.notifyListeners();

    try {
      // Economy -> Tax recommendations
      const recommendations = await this.generateTaxRecommendations(this.state.economyBuilder);

      // Tax -> Economy impacts
      const impacts = await this.calculateEconomicImpacts(this.state.taxSystem);

      // Update state
      this.state.taxRecommendations = recommendations;
      this.state.economicImpacts = impacts;

      // Add sync event
      this.addSyncEvent({
        type: "bidirectional_sync",
        timestamp: Date.now(),
        source: "economy",
        data: { recommendations, impacts },
        message: "Performed bidirectional sync between economy and tax systems",
      });

      this.state.lastSync = Date.now();
      this.state.errors = [];
    } catch (error) {
      this.state.errors.push(error instanceof Error ? error.message : "Unknown error");
      this.addSyncEvent({
        type: "error",
        timestamp: Date.now(),
        source: "economy",
        data: error,
        message: "Failed to perform bidirectional sync",
      });
    } finally {
      this.state.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Generate tax recommendations based on economic components
   */
  private async generateTaxRecommendations(
    economyBuilder: EconomyBuilderState | null
  ): Promise<TaxRecommendation[]> {
    if (!economyBuilder) {
      return [];
    }

    const recommendations: TaxRecommendation[] = [];
    const components = economyBuilder.selectedAtomicComponents;

    // Corporate Tax Recommendations
    const corporateRecommendation = this.generateCorporateTaxRecommendation(components);
    if (corporateRecommendation) {
      recommendations.push(corporateRecommendation);
    }

    // Income Tax Recommendations
    const incomeRecommendation = this.generateIncomeTaxRecommendation(components);
    if (incomeRecommendation) {
      recommendations.push(incomeRecommendation);
    }

    // Consumption Tax Recommendations
    const consumptionRecommendation = this.generateConsumptionTaxRecommendation(components);
    if (consumptionRecommendation) {
      recommendations.push(consumptionRecommendation);
    }

    // Property Tax Recommendations
    const propertyRecommendation = this.generatePropertyTaxRecommendation(components);
    if (propertyRecommendation) {
      recommendations.push(propertyRecommendation);
    }

    // Capital Gains Tax Recommendations
    const capitalGainsRecommendation = this.generateCapitalGainsTaxRecommendation(components);
    if (capitalGainsRecommendation) {
      recommendations.push(capitalGainsRecommendation);
    }

    return recommendations;
  }

  /**
   * Generate corporate tax recommendation
   */
  private generateCorporateTaxRecommendation(
    components: EconomicComponentType[]
  ): TaxRecommendation | null {
    let baseRate = 25; // Default corporate tax rate
    let rationale = "Standard corporate tax rate for balanced economic growth";
    let priority: "high" | "medium" | "low" = "medium";

    // Adjust based on economic components
    components.forEach((compType) => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
      if (component) {
        baseRate = (baseRate + component.taxImpact.optimalCorporateRate) / 2;

        if (compType === EconomicComponentType.INNOVATION_ECONOMY) {
          baseRate = Math.max(15, baseRate - 5); // Lower for innovation
          rationale = "Reduced corporate tax to incentivize innovation and R&D investment";
          priority = "high";
        } else if (compType === EconomicComponentType.EXPORT_ORIENTED) {
          baseRate = Math.max(18, baseRate - 3); // Lower for exports
          rationale = "Competitive corporate tax rate to support export-oriented economy";
          priority = "high";
        } else if (compType === EconomicComponentType.SOCIAL_MARKET_ECONOMY) {
          baseRate = Math.min(35, baseRate + 3); // Higher for social programs
          rationale = "Higher corporate tax to fund social programs and infrastructure";
          priority = "medium";
        }
      }
    });

    // Calculate economic impact
    const economicImpact = this.calculateTaxEconomicImpact("corporate", baseRate, components);

    return {
      taxType: "corporate",
      currentRate: 25, // This would come from current tax system
      recommendedRate: Math.round(baseRate),
      rationale,
      economicImpact,
      implementationPriority: priority,
      estimatedRevenueChange: economicImpact.gdpImpact * 0.3, // Rough estimate
    };
  }

  /**
   * Generate income tax recommendation
   */
  private generateIncomeTaxRecommendation(
    components: EconomicComponentType[]
  ): TaxRecommendation | null {
    let baseRate = 30; // Default income tax rate
    let rationale = "Standard progressive income tax for economic balance";
    let priority: "high" | "medium" | "low" = "medium";

    // Adjust based on economic components
    components.forEach((compType) => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
      if (component) {
        baseRate = (baseRate + component.taxImpact.optimalIncomeRate) / 2;

        if (compType === EconomicComponentType.SOCIAL_MARKET_ECONOMY) {
          baseRate = Math.min(45, baseRate + 5); // Higher for social programs
          rationale = "Progressive income tax to support social safety nets";
          priority = "high";
        } else if (compType === EconomicComponentType.KNOWLEDGE_ECONOMY) {
          baseRate = Math.max(25, baseRate - 3); // Lower for knowledge workers
          rationale = "Competitive income tax to attract knowledge workers";
          priority = "medium";
        }
      }
    });

    const economicImpact = this.calculateTaxEconomicImpact("income", baseRate, components);

    return {
      taxType: "income",
      currentRate: 30,
      recommendedRate: Math.round(baseRate),
      rationale,
      economicImpact,
      implementationPriority: priority,
      estimatedRevenueChange: economicImpact.gdpImpact * 0.4,
    };
  }

  /**
   * Generate consumption tax recommendation
   */
  private generateConsumptionTaxRecommendation(
    components: EconomicComponentType[]
  ): TaxRecommendation | null {
    let baseRate = 15; // Default VAT/consumption tax
    let rationale = "Standard consumption tax for revenue generation";
    let priority: "high" | "medium" | "low" = "low";

    // Adjust based on economic components
    components.forEach((compType) => {
      if (compType === EconomicComponentType.FREE_MARKET_SYSTEM) {
        baseRate = Math.min(20, baseRate + 2); // Higher for free market
        rationale = "Consumption tax aligns with free market principles";
      } else if (compType === EconomicComponentType.SOCIAL_MARKET_ECONOMY) {
        baseRate = Math.min(25, baseRate + 3); // Higher for social programs
        rationale = "Consumption tax to fund social programs and infrastructure";
      }
    });

    const economicImpact = this.calculateTaxEconomicImpact("consumption", baseRate, components);

    return {
      taxType: "consumption",
      currentRate: 15,
      recommendedRate: Math.round(baseRate),
      rationale,
      economicImpact,
      implementationPriority: priority,
      estimatedRevenueChange: economicImpact.gdpImpact * 0.5,
    };
  }

  /**
   * Generate property tax recommendation
   */
  private generatePropertyTaxRecommendation(
    components: EconomicComponentType[]
  ): TaxRecommendation | null {
    let baseRate = 1.2; // Default property tax rate
    let rationale = "Standard property tax for local revenue";
    let priority: "high" | "medium" | "low" = "low";

    // Adjust based on economic components
    components.forEach((compType) => {
      if (compType === EconomicComponentType.AGRICULTURE_LED) {
        baseRate = Math.max(0.8, baseRate - 0.2); // Lower for agriculture
        rationale = "Reduced property tax to support agricultural sector";
      } else if (compType === EconomicComponentType.REAL_ESTATE_FOCUSED) {
        baseRate = Math.min(2.0, baseRate + 0.3); // Higher for real estate
        rationale = "Property tax to manage real estate market and generate revenue";
      }
    });

    const economicImpact = this.calculateTaxEconomicImpact("property", baseRate, components);

    return {
      taxType: "property",
      currentRate: 1.2,
      recommendedRate: Math.round(baseRate * 100) / 100,
      rationale,
      economicImpact,
      implementationPriority: priority,
      estimatedRevenueChange: economicImpact.gdpImpact * 0.2,
    };
  }

  /**
   * Generate capital gains tax recommendation
   */
  private generateCapitalGainsTaxRecommendation(
    components: EconomicComponentType[]
  ): TaxRecommendation | null {
    let baseRate = 20; // Default capital gains tax
    let rationale = "Standard capital gains tax for investment balance";
    let priority: "high" | "medium" | "low" = "low";

    // Adjust based on economic components
    components.forEach((compType) => {
      if (
        compType === EconomicComponentType.INNOVATION_ECONOMY ||
        compType === EconomicComponentType.STARTUP_ECOSYSTEM
      ) {
        baseRate = Math.max(15, baseRate - 3); // Lower for innovation
        rationale = "Reduced capital gains tax to encourage investment in innovation";
        priority = "high";
      } else if (compType === EconomicComponentType.FINANCE_CENTERED) {
        baseRate = Math.min(30, baseRate + 5); // Higher for finance
        rationale = "Capital gains tax to ensure fair taxation of financial gains";
      }
    });

    const economicImpact = this.calculateTaxEconomicImpact("capital_gains", baseRate, components);

    return {
      taxType: "capital_gains",
      currentRate: 20,
      recommendedRate: Math.round(baseRate),
      rationale,
      economicImpact,
      implementationPriority: priority,
      estimatedRevenueChange: economicImpact.gdpImpact * 0.3,
    };
  }

  /**
   * Calculate economic impact of tax changes
   */
  private calculateTaxEconomicImpact(
    taxType: string,
    rate: number,
    components: EconomicComponentType[]
  ) {
    // Base impact calculations
    let gdpImpact = 0;
    let employmentImpact = 0;
    let investmentImpact = 0;
    let competitivenessImpact = 75; // Base competitiveness

    // Tax-specific impacts
    switch (taxType) {
      case "corporate":
        gdpImpact = -0.1 * (rate - 25); // Each percentage point above 25% reduces GDP by 0.1%
        investmentImpact = -0.2 * (rate - 25);
        competitivenessImpact = Math.max(0, 100 - (rate - 15) * 2);
        break;
      case "income":
        gdpImpact = -0.05 * (rate - 30);
        employmentImpact = -0.1 * (rate - 30);
        break;
      case "consumption":
        gdpImpact = -0.08 * (rate - 15);
        employmentImpact = -0.05 * (rate - 15);
        break;
      case "property":
        gdpImpact = -0.02 * (rate - 1.2) * 100;
        investmentImpact = -0.1 * (rate - 1.2) * 100;
        break;
      case "capital_gains":
        investmentImpact = -0.3 * (rate - 20);
        competitivenessImpact = Math.max(0, 100 - (rate - 15) * 1.5);
        break;
    }

    // Adjust based on economic components
    components.forEach((compType) => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
      if (component) {
        // Apply component-specific modifiers
        if (compType === EconomicComponentType.INNOVATION_ECONOMY && taxType === "corporate") {
          gdpImpact *= 1.5; // Innovation economies more sensitive to corporate tax
          investmentImpact *= 2.0;
        }

        if (compType === EconomicComponentType.FREE_MARKET_SYSTEM) {
          competitivenessImpact += 5; // Free market boosts competitiveness
        }

        if (compType === EconomicComponentType.SOCIAL_MARKET_ECONOMY) {
          gdpImpact *= 0.8; // Social market economies less sensitive to tax increases
        }
      }
    });

    return {
      gdpImpact,
      employmentImpact,
      investmentImpact,
      competitivenessImpact: Math.max(0, Math.min(100, competitivenessImpact)),
    };
  }

  /**
   * Calculate economic impacts of tax system changes
   */
  private async calculateEconomicImpacts(
    taxSystem: TaxSystem | null
  ): Promise<EconomicImpactOfTax[]> {
    const impacts: EconomicImpactOfTax[] = [];

    if (!taxSystem || !taxSystem.taxCategories) return impacts;

    // Calculate impacts for each tax category
    taxSystem.taxCategories.forEach((category) => {
      if (category.baseRate !== undefined) {
        const impact = this.calculateSingleTaxImpact(category, taxSystem);
        if (impact) {
          impacts.push(impact);
        }
      }
    });

    return impacts;
  }

  /**
   * Calculate impact of a single tax category
   */
  private calculateSingleTaxImpact(
    category: TaxCategory,
    taxSystem: TaxSystem
  ): EconomicImpactOfTax | null {
    if (!category.baseRate) return null;

    const taxType = this.mapTaxCategoryToType(category.categoryName);
    if (!taxType) return null;

    // Calculate economic impacts based on tax rate and type
    const economicImpact = this.calculateTaxEconomicImpact(
      taxType,
      category.baseRate,
      this.state.economyBuilder?.selectedAtomicComponents || []
    );

    // Determine sector impacts
    const sectorImpacts = this.calculateSectorImpacts(taxType, category.baseRate);

    // Determine time to effect
    const timeToEffect = this.determineTimeToEffect(taxType);

    // Calculate confidence based on data availability
    const confidence = this.calculateConfidence(taxSystem, category);

    return {
      taxChange: {
        taxType,
        rateChange: 0, // This would be calculated from previous rate
        effectiveRate: category.baseRate,
      },
      economicImpact: {
        gdpGrowthImpact: economicImpact.gdpImpact,
        employmentImpact: economicImpact.employmentImpact,
        investmentImpact: economicImpact.investmentImpact,
        consumptionImpact: economicImpact.gdpImpact * 0.7, // Rough estimate
        inflationImpact: category.baseRate * 0.1, // Rough estimate
      },
      sectorImpacts,
      timeToEffect,
      confidence,
    };
  }

  /**
   * Map tax category name to tax type
   */
  private mapTaxCategoryToType(categoryName: string): string | null {
    const mapping: Record<string, string> = {
      "Personal Income Tax": "income",
      "Corporate Income Tax": "corporate",
      "Sales Tax / VAT": "consumption",
      "Property Tax": "property",
      "Capital Gains Tax": "capital_gains",
    };

    return mapping[categoryName] || null;
  }

  /**
   * Calculate sector-specific impacts
   */
  private calculateSectorImpacts(taxType: string, rate: number): Record<string, number> {
    const sectorImpacts: Record<string, number> = {};

    // Base sector impacts by tax type
    switch (taxType) {
      case "corporate":
        sectorImpacts.manufacturing = -0.2 * (rate - 25);
        sectorImpacts.services = -0.1 * (rate - 25);
        sectorImpacts.technology = -0.3 * (rate - 25);
        sectorImpacts.finance = -0.15 * (rate - 25);
        break;
      case "income":
        sectorImpacts.services = -0.1 * (rate - 30);
        sectorImpacts.professional = -0.15 * (rate - 30);
        break;
      case "consumption":
        sectorImpacts.retail = -0.2 * (rate - 15);
        sectorImpacts.hospitality = -0.25 * (rate - 15);
        break;
      case "property":
        sectorImpacts.real_estate = -0.3 * (rate - 1.2) * 100;
        sectorImpacts.construction = -0.2 * (rate - 1.2) * 100;
        break;
      case "capital_gains":
        sectorImpacts.finance = -0.2 * (rate - 20);
        sectorImpacts.technology = -0.25 * (rate - 20);
        break;
    }

    return sectorImpacts;
  }

  /**
   * Determine time to effect for tax changes
   */
  private determineTimeToEffect(
    taxType: string
  ): "immediate" | "short_term" | "medium_term" | "long_term" {
    switch (taxType) {
      case "consumption":
        return "immediate";
      case "income":
        return "short_term";
      case "corporate":
        return "medium_term";
      case "property":
      case "capital_gains":
        return "long_term";
      default:
        return "medium_term";
    }
  }

  /**
   * Calculate confidence in impact estimates
   */
  private calculateConfidence(taxSystem: TaxSystem, category: TaxCategory): number {
    let confidence = 60; // Base confidence

    // Increase confidence based on data availability
    if (taxSystem.collectionEfficiency) confidence += 10;
    if (taxSystem.complianceRate) confidence += 10;
    if (category.taxExemptions && category.taxExemptions.length > 0) confidence += 5;
    if (category.taxDeductions && category.taxDeductions.length > 0) confidence += 5;

    return Math.min(100, confidence);
  }

  /**
   * Add sync event to history
   */
  private addSyncEvent(event: TaxSyncEvent): void {
    this.state.syncHistory.push(event);

    // Keep only last 100 events
    if (this.state.syncHistory.length > 100) {
      this.state.syncHistory = this.state.syncHistory.slice(-100);
    }
  }

  /**
   * Notify listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  /**
   * Update tax system based on economy builder state
   * Stub implementation - returns a basic TaxSystem structure
   */
  updateTaxSystemFromEconomy(economyBuilder: EconomyBuilderState): TaxSystem {
    const recommendations =
      this.state.taxRecommendations.length > 0 ? this.state.taxRecommendations : [];

    // Create tax categories based on recommendations
    const taxCategories: TaxCategory[] = [];

    // Add recommended tax categories
    recommendations.forEach((rec) => {
      const category: TaxCategory = {
        id: `tax-${rec.taxType}`,
        taxSystemId: "auto-generated-tax-system",
        categoryName: this.mapTaxTypeToName(rec.taxType),
        categoryType: this.getCategoryTypeFromTaxType(rec.taxType),
        isActive: true,
        baseRate: rec.recommendedRate,
        calculationMethod: "percentage",
        deductionAllowed: rec.taxType === "income",
        priority: recommendations.indexOf(rec) + 1,
        taxBrackets: this.generateDefaultBrackets(rec.taxType, rec.recommendedRate),
        taxExemptions: [],
        taxDeductions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      taxCategories.push(category);
    });

    // Return basic TaxSystem structure
    return {
      id: "auto-generated-tax-system",
      countryId: "", // economyBuilder doesn't have countryId property
      taxSystemName: "Auto-Generated Tax System",
      fiscalYear: new Date().getFullYear().toString(),
      progressiveTax: true,
      alternativeMinTax: false,
      taxCategories,
      collectionEfficiency: 85,
      complianceRate: 80,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get tax impact analysis of economy builder state
   * Stub implementation - returns impact data
   */
  getTaxImpactOfEconomy(economyBuilder: EconomyBuilderState): any {
    const recommendations =
      this.state.taxRecommendations.length > 0 ? this.state.taxRecommendations : [];

    return {
      totalRecommendations: recommendations.length,
      highPriorityCount: recommendations.filter((r) => r.implementationPriority === "high").length,
      estimatedRevenueImpact: recommendations.reduce((sum, r) => sum + r.estimatedRevenueChange, 0),
      averageGDPImpact:
        recommendations.length > 0
          ? recommendations.reduce((sum, r) => sum + r.economicImpact.gdpImpact, 0) /
            recommendations.length
          : 0,
      averageEmploymentImpact:
        recommendations.length > 0
          ? recommendations.reduce((sum, r) => sum + r.economicImpact.employmentImpact, 0) /
            recommendations.length
          : 0,
      recommendations: recommendations.map((r) => ({
        taxType: r.taxType,
        recommendedRate: r.recommendedRate,
        priority: r.implementationPriority,
        rationale: r.rationale,
      })),
    };
  }

  /**
   * Map tax type to display name
   */
  private mapTaxTypeToName(taxType: string): string {
    const mapping: Record<string, string> = {
      income: "Personal Income Tax",
      corporate: "Corporate Income Tax",
      consumption: "Sales Tax / VAT",
      property: "Property Tax",
      capital_gains: "Capital Gains Tax",
    };
    return mapping[taxType] || taxType;
  }

  /**
   * Get category type from tax type
   */
  private getCategoryTypeFromTaxType(taxType: string): string {
    const mapping: Record<string, string> = {
      income: "Direct Tax",
      corporate: "Direct Tax",
      consumption: "Indirect Tax",
      property: "Direct Tax",
      capital_gains: "Direct Tax",
    };
    return mapping[taxType] || "Other";
  }

  /**
   * Generate default tax brackets for a tax type
   */
  private generateDefaultBrackets(taxType: string, rate: number): TaxBracket[] {
    if (taxType === "income") {
      // Progressive income tax brackets
      return [
        {
          id: "",
          taxSystemId: "",
          categoryId: "",
          minIncome: 0,
          maxIncome: 20000,
          rate: rate * 0.5,
          marginalRate: true,
          isActive: true,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "",
          taxSystemId: "",
          categoryId: "",
          minIncome: 20000,
          maxIncome: 50000,
          rate: rate * 0.75,
          marginalRate: true,
          isActive: true,
          priority: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "",
          taxSystemId: "",
          categoryId: "",
          minIncome: 50000,
          maxIncome: 100000,
          rate: rate,
          marginalRate: true,
          isActive: true,
          priority: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "",
          taxSystemId: "",
          categoryId: "",
          minIncome: 100000,
          maxIncome: undefined,
          rate: rate * 1.2,
          marginalRate: true,
          isActive: true,
          priority: 4,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    }

    // Flat rate for other tax types
    return [
      {
        id: "",
        taxSystemId: "",
        categoryId: "",
        minIncome: 0,
        maxIncome: undefined,
        rate,
        marginalRate: false,
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }
}

// Export singleton instance
export const bidirectionalTaxSyncService = new BidirectionalTaxSyncService();
