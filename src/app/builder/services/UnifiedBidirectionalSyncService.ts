/**
 * Unified Bidirectional Builder Sync Service
 *
 * Phase 3 optimization: Merges BidirectionalGovernmentSyncService and BidirectionalTaxSyncService
 * into a single service that extends BidirectionalSyncService base class.
 *
 * This service provides real-time bidirectional synchronization between:
 * - Economy Builder ↔ Government System
 * - Economy Builder ↔ Tax System
 *
 * Features:
 * - Unified sync state management
 * - Shared recommendation and impact calculation infrastructure
 * - Configurable sync targets (government, tax, or both)
 */

import {
  BidirectionalSyncService,
  type BidirectionalSyncState,
  type SyncRecommendation,
  type SyncImpact,
  // eslint-disable-next-line unused-imports/no-unused-imports
  type SyncEvent,
} from "./base";
// eslint-disable-next-line unused-imports/no-unused-imports
import { EconomicComponentType, ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/atomic-economic-data";
import {
  ComponentType,
  // eslint-disable-next-line unused-imports/no-unused-imports
  ATOMIC_COMPONENTS,
} from "~/components/government/atoms/AtomicGovernmentComponents";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { GovernmentBuilderState } from "~/types/government";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export type SyncTarget = "government" | "tax" | "both";

export interface BuilderSyncRecommendation extends SyncRecommendation {
  target: SyncTarget;
  componentType?: ComponentType | string;
  currentStatus: "present" | "absent" | "partial";
  recommendation: "add" | "remove" | "enhance" | "reduce" | "adjust";
  economicImpact: {
    gdpImpact: number;
    employmentImpact: number;
    investmentImpact: number;
    stabilityImpact: number;
    taxEfficiencyImpact?: number;
  };
  implementationCost: number;
  maintenanceCost: number;
  timeToImplement: "immediate" | "short_term" | "medium_term" | "long_term";
}

export interface BuilderSyncImpact extends SyncImpact {
  target: SyncTarget;
  sectorImpacts?: Record<string, number>;
  timeToEffect: "immediate" | "short_term" | "medium_term" | "long_term";
  confidence: number;
}

export interface UnifiedBuilderSyncState extends BidirectionalSyncState<
  BuilderSyncRecommendation,
  BuilderSyncImpact
> {
  economyBuilder: EconomyBuilderState | null;
  governmentBuilder: GovernmentBuilderState | null;
  taxBuilder: TaxBuilderState | null;
  governmentRecommendations: BuilderSyncRecommendation[];
  taxRecommendations: BuilderSyncRecommendation[];
  governmentImpacts: BuilderSyncImpact[];
  taxImpacts: BuilderSyncImpact[];
  lastGovernmentSync: number | null;
  lastTaxSync: number | null;
  errors: string[];
}

export interface BuilderSyncEvent {
  type:
    | "economy_to_government"
    | "government_to_economy"
    | "economy_to_tax"
    | "tax_to_economy"
    | "bidirectional_sync"
    | "error";
  target: SyncTarget;
  timestamp: number;
  source: "economy" | "government" | "tax";
  data: unknown;
  message: string;
  success: boolean;
}

// ============================================================
// SERVICE IMPLEMENTATION
// ============================================================

/**
 * Unified service for bidirectional sync between Economy, Government, and Tax builders
 */
export class UnifiedBidirectionalSyncService extends BidirectionalSyncService<
  UnifiedBuilderSyncState,
  BuilderSyncRecommendation,
  BuilderSyncImpact,
  EconomyBuilderState,
  GovernmentBuilderState | TaxBuilderState
> {
  protected override getInitialState(): UnifiedBuilderSyncState {
    return {
      economyBuilder: null,
      governmentBuilder: null,
      taxBuilder: null,
      isSyncing: false,
      lastSyncTimestamp: null,
      syncError: null,
      recommendations: [],
      impacts: [],
      governmentRecommendations: [],
      taxRecommendations: [],
      governmentImpacts: [],
      taxImpacts: [],
      lastGovernmentSync: null,
      lastTaxSync: null,
      errors: [],
    };
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /**
   * Update economy builder and trigger sync recommendations
   */
  async updateEconomyBuilder(builder: EconomyBuilderState): Promise<void> {
    this.state.economyBuilder = builder;

    // Generate recommendations for both government and tax
    if (this.state.governmentBuilder) {
      const govRecs = await this.generateGovernmentRecommendations(builder);
      this.state.governmentRecommendations = govRecs;
    }

    if (this.state.taxBuilder) {
      const taxRecs = await this.generateTaxRecommendations(builder);
      this.state.taxRecommendations = taxRecs;
    }

    // Combine recommendations
    this.state.recommendations = [
      ...this.state.governmentRecommendations,
      ...this.state.taxRecommendations,
    ];

    this.notifyListeners({ deepEqual: true });
  }

  /**
   * Update government builder and calculate economic impacts
   */
  async updateGovernmentBuilder(builder: GovernmentBuilderState): Promise<void> {
    const previousBuilder = this.state.governmentBuilder;
    this.state.governmentBuilder = builder;

    if (this.state.economyBuilder && previousBuilder) {
      const impacts = await this.calculateGovernmentImpacts(builder, previousBuilder);
      this.state.governmentImpacts = impacts;
      this.state.impacts = [...impacts, ...this.state.taxImpacts];
    }

    this.notifyListeners({ deepEqual: true });
  }

  /**
   * Update tax builder and calculate economic impacts
   */
  async updateTaxBuilder(builder: TaxBuilderState): Promise<void> {
    const previousBuilder = this.state.taxBuilder;
    this.state.taxBuilder = builder;

    if (this.state.economyBuilder && previousBuilder) {
      const impacts = await this.calculateTaxImpacts(builder, previousBuilder);
      this.state.taxImpacts = impacts;
      this.state.impacts = [...this.state.governmentImpacts, ...impacts];
    }

    this.notifyListeners({ deepEqual: true });
  }

  /**
   * Perform full bidirectional sync for specified target(s)
   */
  async performSync(target: SyncTarget = "both"): Promise<void> {
    this.setSyncing(true);

    try {
      if ((target === "government" || target === "both") && this.state.governmentBuilder) {
        await this.syncWithGovernment();
        this.state.lastGovernmentSync = Date.now();
      }

      if ((target === "tax" || target === "both") && this.state.taxBuilder) {
        await this.syncWithTax();
        this.state.lastTaxSync = Date.now();
      }

      this.state.lastSyncTimestamp = new Date();
      this.state.syncError = null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sync failed";
      this.state.errors.push(errorMessage);
      this.setSyncError(errorMessage);
    } finally {
      this.setSyncing(false);
    }
  }

  /**
   * Get recommendations for a specific target
   */
  getRecommendationsForTarget(target: SyncTarget): BuilderSyncRecommendation[] {
    if (target === "government") return this.state.governmentRecommendations;
    if (target === "tax") return this.state.taxRecommendations;
    return this.state.recommendations;
  }

  /**
   * Get impacts for a specific target
   */
  getImpactsForTarget(target: SyncTarget): BuilderSyncImpact[] {
    if (target === "government") return this.state.governmentImpacts;
    if (target === "tax") return this.state.taxImpacts;
    return this.state.impacts;
  }

  // ============================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ============================================================

  protected override async generateRecommendations(
    source: EconomyBuilderState
  ): Promise<BuilderSyncRecommendation[]> {
    const govRecs = await this.generateGovernmentRecommendations(source);
    const taxRecs = await this.generateTaxRecommendations(source);
    return [...govRecs, ...taxRecs];
  }

  protected override async calculateImpacts(
    source: EconomyBuilderState,
    target: GovernmentBuilderState | TaxBuilderState
  ): Promise<BuilderSyncImpact[]> {
    // Determine target type and calculate appropriate impacts
    if ("departments" in target) {
      return this.calculateGovernmentImpacts(
        target as GovernmentBuilderState,
        this.state.governmentBuilder
      );
    } else {
      return this.calculateTaxImpacts(target as TaxBuilderState, this.state.taxBuilder);
    }
  }

  protected override async applyRecommendations(
    recommendations: BuilderSyncRecommendation[],
    target: GovernmentBuilderState | TaxBuilderState
  ): Promise<GovernmentBuilderState | TaxBuilderState> {
    // For now, return target unchanged - full implementation would apply recommendations
    return target;
  }

  // ============================================================
  // GOVERNMENT SYNC METHODS
  // ============================================================

  private async syncWithGovernment(): Promise<void> {
    if (!this.state.economyBuilder || !this.state.governmentBuilder) return;

    const recommendations = await this.generateGovernmentRecommendations(this.state.economyBuilder);
    this.state.governmentRecommendations = recommendations;

    const syncEvent: BuilderSyncEvent = {
      type: "bidirectional_sync",
      target: "government",
      timestamp: Date.now(),
      source: "economy",
      data: { recommendations },
      message: `Generated ${recommendations.length} government recommendations`,
      success: true,
    };

    this.addSyncEvent(syncEvent as any);
  }

  private async generateGovernmentRecommendations(
    economyBuilder: EconomyBuilderState
  ): Promise<BuilderSyncRecommendation[]> {
    const recommendations: BuilderSyncRecommendation[] = [];
    const selectedComponents = economyBuilder.selectedAtomicComponents || [];

    // Analyze economy builder and generate government recommendations
    for (const componentType of selectedComponents) {
      const component = ATOMIC_ECONOMIC_COMPONENTS[componentType];
      if (!component) continue;

      // Check government synergies
      const synergies = component.governmentSynergies || [];
      for (const govType of synergies) {
        const isPresent = this.isGovernmentComponentPresent(govType);

        if (!isPresent) {
          recommendations.push({
            id: `gov_rec_${govType}_${Date.now()}`,
            type: "government_recommendation",
            title: `Add ${govType} for synergy with ${componentType}`,
            description: `Adding ${govType} would create synergy with your ${componentType} economic component`,
            priority: "medium",
            impact: 65,
            autoApply: false,
            target: "government",
            componentType: govType,
            currentStatus: "absent",
            recommendation: "add",
            economicImpact: {
              gdpImpact: 2.5,
              employmentImpact: 1.5,
              investmentImpact: 3.0,
              stabilityImpact: 1.0,
            },
            implementationCost: 50000000,
            maintenanceCost: 10000000,
            timeToImplement: "medium_term",
          });
        }
      }
    }

    return recommendations;
  }

  private async calculateGovernmentImpacts(
    currentBuilder: GovernmentBuilderState,
    previousBuilder: GovernmentBuilderState | null
  ): Promise<BuilderSyncImpact[]> {
    const impacts: BuilderSyncImpact[] = [];

    if (!previousBuilder || !this.state.economyBuilder) return impacts;

    // Compare departments
    const currentDepts = new Set(currentBuilder.departments.map((d) => d.name));
    const previousDepts = new Set(previousBuilder.departments.map((d) => d.name));

    // Check for added departments
    for (const dept of currentDepts) {
      if (!previousDepts.has(dept)) {
        impacts.push({
          field: `department.${dept}`,
          currentValue: "added",
          projectedValue: "active",
          changePercent: 100,
          direction: "increase",
          severity: "positive",
          target: "government",
          timeToEffect: "short_term",
          confidence: 75,
        });
      }
    }

    return impacts;
  }

  private isGovernmentComponentPresent(componentType: string): boolean {
    if (!this.state.governmentBuilder) return false;
    // Check if the component type exists in the government builder
    // This is a simplified check - full implementation would check atomic components
    return this.state.governmentBuilder.departments.some((d) =>
      d.name.toLowerCase().includes(componentType.toLowerCase())
    );
  }

  // ============================================================
  // TAX SYNC METHODS
  // ============================================================

  private async syncWithTax(): Promise<void> {
    if (!this.state.economyBuilder || !this.state.taxBuilder) return;

    const recommendations = await this.generateTaxRecommendations(this.state.economyBuilder);
    this.state.taxRecommendations = recommendations;

    const syncEvent: BuilderSyncEvent = {
      type: "bidirectional_sync",
      target: "tax",
      timestamp: Date.now(),
      source: "economy",
      data: { recommendations },
      message: `Generated ${recommendations.length} tax recommendations`,
      success: true,
    };

    this.addSyncEvent(syncEvent as any);
  }

  private async generateTaxRecommendations(
    economyBuilder: EconomyBuilderState
  ): Promise<BuilderSyncRecommendation[]> {
    const recommendations: BuilderSyncRecommendation[] = [];

    // Analyze economic structure and recommend tax adjustments
    // eslint-disable-next-line unused-imports/no-unused-vars
    const { structure, sectors } = economyBuilder;

    // GDP-based recommendations
    if (structure.economicTier === "Developing") {
      recommendations.push({
        id: `tax_rec_low_rates_${Date.now()}`,
        type: "tax_recommendation",
        title: "Consider lower tax rates for developing economy",
        description:
          "Lower tax rates can stimulate growth in developing economies by encouraging investment",
        priority: "medium",
        impact: 55,
        autoApply: false,
        target: "tax",
        currentStatus: "partial",
        recommendation: "adjust",
        economicImpact: {
          gdpImpact: 3.0,
          employmentImpact: 2.0,
          investmentImpact: 5.0,
          stabilityImpact: -1.0,
          taxEfficiencyImpact: -2.0,
        },
        implementationCost: 0,
        maintenanceCost: 0,
        timeToImplement: "short_term",
      });
    }

    return recommendations;
  }

  private async calculateTaxImpacts(
    currentBuilder: TaxBuilderState,
    previousBuilder: TaxBuilderState | null
  ): Promise<BuilderSyncImpact[]> {
    const impacts: BuilderSyncImpact[] = [];

    if (!previousBuilder || !this.state.economyBuilder) return impacts;

    // Compare tax rates
    const currentRate = currentBuilder.taxSystem?.baseRate || 0;
    const previousRate = previousBuilder.taxSystem?.baseRate || 0;

    if (currentRate !== previousRate) {
      const changePercent =
        previousRate > 0 ? ((currentRate - previousRate) / previousRate) * 100 : 0;

      impacts.push({
        field: "taxSystem.baseRate",
        currentValue: previousRate,
        projectedValue: currentRate,
        changePercent,
        direction: changePercent > 0 ? "increase" : "decrease",
        severity: Math.abs(changePercent) > 10 ? "negative" : "neutral",
        target: "tax",
        timeToEffect: "immediate",
        confidence: 85,
      });
    }

    return impacts;
  }
}

// Singleton instance
export const unifiedBidirectionalSyncService = new UnifiedBidirectionalSyncService();

// Legacy exports for backward compatibility
export {
  unifiedBidirectionalSyncService as bidirectionalGovernmentSyncService,
  unifiedBidirectionalSyncService as bidirectionalTaxSyncService,
};

export default UnifiedBidirectionalSyncService;
