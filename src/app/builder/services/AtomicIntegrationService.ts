/**
 * Atomic Integration Service
 *
 * Phase 3 refactored: Now extends BaseBuilderService for standardized pub/sub patterns.
 *
 * This service handles real-time integration between atomic government components
 * and all government-related systems, providing live-wired updates and intelligent
 * adjustments based on component selections.
 */

import { BaseBuilderService } from "./base";
import { ComponentType } from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";
import type { GovernmentBuilderState } from "~/types/government";
import type { EconomicInputs } from "../lib/economy-data-service";
import { generateGovernmentBuilderFromAtomicComponents } from "../utils/atomicGovernmentIntegration";

export interface AtomicIntegrationState {
  selectedComponents: ComponentType[];
  governmentBuilder: GovernmentBuilderState | null;
  economicInputs: EconomicInputs | null;
  lastUpdate: number;
  isUpdating: boolean;
  errors: string[];
  warnings: string[];
}

export interface AtomicUpdateEvent {
  type: "components_changed" | "government_updated" | "economics_updated" | "error" | "warning";
  timestamp: number;
  data: any;
  message: string;
}

/**
 * Phase 3 refactored: Extends BaseBuilderService for standardized patterns
 */
export class AtomicIntegrationService extends BaseBuilderService<
  AtomicIntegrationState,
  AtomicUpdateEvent
> {
  protected getInitialState(): AtomicIntegrationState {
    return {
      selectedComponents: [],
      governmentBuilder: null,
      economicInputs: null,
      lastUpdate: Date.now(),
      isUpdating: false,
      errors: [],
      warnings: [],
    };
  }

  /**
   * Update atomic components and trigger cascade updates
   */
  async updateComponents(components: ComponentType[]): Promise<void> {
    this.addToQueue(
      {
        type: "components_changed",
        timestamp: Date.now(),
        data: components,
        message: `Updated atomic components: ${components.join(", ")}`,
      },
      { debounceMs: 100 }
    );

    this.state.selectedComponents = components;
    this.state.isUpdating = true;
    this.notifyListeners({ deepEqual: true });

    try {
      // Generate government builder from components
      if (this.state.economicInputs) {
        const generatedBuilder = generateGovernmentBuilderFromAtomicComponents(
          components,
          this.state.economicInputs.governmentSpending.totalSpending,
          this.state.economicInputs
        );

        this.state.governmentBuilder = generatedBuilder;
        this.addToQueue(
          {
            type: "government_updated",
            timestamp: Date.now(),
            data: generatedBuilder,
            message: "Government structure updated from atomic components",
          },
          { debounceMs: 100 }
        );

        // Update economic inputs if needed
        await this.updateEconomicInputsFromGovernment(generatedBuilder);
      }

      this.state.lastUpdate = Date.now();
      this.state.errors = [];
    } catch (error) {
      this.state.errors.push(error instanceof Error ? error.message : "Unknown error");
      this.addToQueue(
        {
          type: "error",
          timestamp: Date.now(),
          data: error,
          message: "Failed to update components",
        },
        { immediate: true }
      );
    } finally {
      this.state.isUpdating = false;
      this.notifyListeners({ deepEqual: true });
    }
  }

  /**
   * Update government builder data
   */
  async updateGovernmentBuilder(builder: GovernmentBuilderState): Promise<void> {
    this.addToQueue(
      {
        type: "government_updated",
        timestamp: Date.now(),
        data: builder,
        message: "Government builder updated",
      },
      { debounceMs: 100 }
    );

    this.state.governmentBuilder = builder;
    this.notifyListeners({ deepEqual: true });

    // Validate against atomic components
    if (this.state.selectedComponents.length > 0) {
      const validation = this.validateGovernmentAgainstComponents(builder);
      if (!validation.isValid) {
        this.state.warnings.push(validation.message);
        this.addToQueue(
          {
            type: "warning",
            timestamp: Date.now(),
            data: validation,
            message: validation.message,
          },
          { debounceMs: 100 }
        );
      }
    }
  }

  /**
   * Update economic inputs
   */
  async updateEconomicInputs(inputs: EconomicInputs): Promise<void> {
    this.addToQueue(
      {
        type: "economics_updated",
        timestamp: Date.now(),
        data: inputs,
        message: "Economic inputs updated",
      },
      { debounceMs: 100 }
    );

    this.state.economicInputs = inputs;
    this.notifyListeners({ deepEqual: true });

    // Regenerate government builder if components are selected
    if (this.state.selectedComponents.length > 0) {
      await this.updateComponents(this.state.selectedComponents);
    }
  }

  /**
   * Get pending updates from queue
   */
  getPendingUpdates(): AtomicUpdateEvent[] {
    return [...this.updateQueue];
  }

  /**
   * Force immediate update (uses base class method)
   */
  async forceUpdate(): Promise<void> {
    await this.forceProcessQueue();
  }

  /**
   * Process individual event from queue
   * Overrides base class method
   */
  protected override async processEvent(event: AtomicUpdateEvent): Promise<void> {
    switch (event.type) {
      case "components_changed":
        await this.handleComponentsChanged(event.data);
        break;
      case "government_updated":
        await this.handleGovernmentUpdated(event.data);
        break;
      case "economics_updated":
        await this.handleEconomicsUpdated(event.data);
        break;
      case "error":
        this.handleError(event.data);
        break;
      case "warning":
        this.handleWarning(event.data);
        break;
    }
  }

  /**
   * Handle components changed event
   */
  private async handleComponentsChanged(components: ComponentType[]): Promise<void> {
    // Validate component combinations
    const validation = this.validateComponentCombination(components);
    if (!validation.isValid) {
      this.state.warnings.push(validation.message);
    }

    // Check for synergies and conflicts
    const synergies = this.detectSynergies(components);
    const conflicts = this.detectConflicts(components);

    if (synergies.length > 0) {
      this.state.warnings.push(
        `Synergies detected: ${synergies.map((s) => s.description).join(", ")}`
      );
    }

    if (conflicts.length > 0) {
      this.state.warnings.push(
        `Conflicts detected: ${conflicts.map((c) => c.description).join(", ")}`
      );
    }
  }

  /**
   * Handle government updated event
   */
  private async handleGovernmentUpdated(builder: GovernmentBuilderState): Promise<void> {
    // Validate budget allocations - only add warning once
    const totalAllocation = builder.budgetAllocations.reduce(
      (sum, alloc) => sum + alloc.allocatedPercent,
      0
    );
    if (Math.abs(totalAllocation - 100) > 1) {
      const budgetWarning = `Budget allocation totals ${totalAllocation.toFixed(1)}%, should be 100%`;
      // Only add if not already present
      if (!this.state.warnings.includes(budgetWarning)) {
        this.state.warnings.push(budgetWarning);
      }
    }
  }

  /**
   * Handle economics updated event
   */
  private async handleEconomicsUpdated(inputs: EconomicInputs): Promise<void> {
    // Validate economic inputs against government structure
    if (this.state.governmentBuilder) {
      const validation = this.validateEconomicsAgainstGovernment(
        inputs,
        this.state.governmentBuilder
      );
      if (!validation.isValid) {
        this.state.warnings.push(validation.message);
      }
    }
  }

  /**
   * Handle error event
   */
  private handleError(error: any): void {
    console.error("[AtomicIntegrationService] Error:", error);
  }

  /**
   * Handle warning event
   */
  private handleWarning(warning: any): void {
    console.warn("[AtomicIntegrationService] Warning:", warning);
  }

  /**
   * Update economic inputs based on government builder changes
   */
  private async updateEconomicInputsFromGovernment(builder: GovernmentBuilderState): Promise<void> {
    if (!this.state.economicInputs) return;

    // Calculate new government spending based on allocations
    const totalSpending = builder.budgetAllocations.reduce(
      (sum, alloc) => sum + (alloc.allocatedAmount || 0),
      0
    );

    // Update government spending in economic inputs
    const existingBreakdown = this.state.economicInputs.governmentSpending.spendingCategories ?? [];
    const updatedInputs: EconomicInputs = {
      ...this.state.economicInputs,
      governmentSpending: {
        ...this.state.economicInputs.governmentSpending,
        totalSpending,
        spendingCategories: existingBreakdown.map((item: any) => {
          const allocation = builder.budgetAllocations.find((a) => {
            const deptIndex = parseInt(a.departmentId);
            const dept = !isNaN(deptIndex) ? builder.departments[deptIndex] : null;
            return (
              a.departmentId === item.category ||
              (dept && (dept.name === item.category || dept.shortName === item.category))
            );
          });
          return allocation ? { ...item, amount: allocation.allocatedAmount || item.amount } : item;
        }),
      },
    };

    this.state.economicInputs = updatedInputs;
  }

  /**
   * Validate government structure against atomic components
   */
  private validateGovernmentAgainstComponents(builder: GovernmentBuilderState): {
    isValid: boolean;
    message: string;
  } {
    const requiredDepartments = this.getRequiredDepartments(this.state.selectedComponents);
    const existingDepartments = builder.departments.map((d) => d.name);

    const missingDepartments = requiredDepartments.filter((d) => !existingDepartments.includes(d));

    if (missingDepartments.length > 0) {
      return {
        isValid: false,
        message: `Missing required departments: ${missingDepartments.join(", ")}`,
      };
    }

    return { isValid: true, message: "" };
  }

  /**
   * Validate economic inputs against government structure
   */
  private validateEconomicsAgainstGovernment(
    inputs: EconomicInputs,
    builder: GovernmentBuilderState
  ): { isValid: boolean; message: string } {
    // Check if government spending matches economic expectations
    const governmentSpending = inputs.governmentSpending?.totalSpending || 0;
    const budgetTotal = builder.budgetAllocations.reduce(
      (sum, alloc) => sum + (alloc.allocatedAmount || 0),
      0
    );

    const difference = Math.abs(governmentSpending - budgetTotal);
    const percentDiff = governmentSpending > 0 ? (difference / governmentSpending) * 100 : 0;

    if (percentDiff > 10) {
      return {
        isValid: false,
        message: `Government spending mismatch: Economic inputs show ${governmentSpending.toLocaleString()} but budget allocations total ${budgetTotal.toLocaleString()} (${percentDiff.toFixed(1)}% difference)`,
      };
    }

    return { isValid: true, message: "" };
  }

  /**
   * Validate component combinations
   */
  private validateComponentCombination(components: ComponentType[]): {
    isValid: boolean;
    message: string;
  } {
    // Basic validation - can be extended
    if (components.length === 0) {
      return { isValid: true, message: "" };
    }

    // Check for incompatible combinations
    // This is a simplified version - full validation would use ATOMIC_COMPONENTS data
    return { isValid: true, message: "" };
  }

  /**
   * Detect synergies between components
   */
  private detectSynergies(
    components: ComponentType[]
  ): Array<{ components: ComponentType[]; description: string }> {
    // Synergies are now handled by atomicGovernmentIntegration utility
    // This prevents duplicate synergy messages in the UI
    return [];
  }

  /**
   * Detect conflicts between components
   * Note: Conflicts are now handled by atomicGovernmentIntegration utility to avoid duplicates
   */
  private detectConflicts(
    components: ComponentType[]
  ): Array<{ components: ComponentType[]; description: string }> {
    // Conflicts are now handled by atomicGovernmentIntegration utility
    // This prevents duplicate conflict messages in the UI
    return [];
  }

  /**
   * Get required departments for components
   */
  private getRequiredDepartments(components: ComponentType[]): string[] {
    const departments = new Set<string>();

    // This would use the ATOMIC_TO_GOVERNMENT_MAPPING
    // For now, return empty array
    return Array.from(departments);
  }
}

// Singleton instance
export const atomicIntegrationService = new AtomicIntegrationService();
