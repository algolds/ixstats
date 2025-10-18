/**
 * Atomic Integration Service
 * 
 * This service handles real-time integration between atomic government components
 * and all government-related systems, providing live-wired updates and intelligent
 * adjustments based on component selections.
 */

import { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import type { GovernmentBuilderState } from '~/types/government';
import type { EconomicInputs } from '../lib/economy-data-service';
import { generateGovernmentBuilderFromAtomicComponents } from '../utils/atomicGovernmentIntegration';

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
  type: 'components_changed' | 'government_updated' | 'economics_updated' | 'error' | 'warning';
  timestamp: number;
  data: any;
  message: string;
}

export class AtomicIntegrationService {
  private state: AtomicIntegrationState;
  private listeners: Array<(state: AtomicIntegrationState) => void> = [];
  private updateQueue: AtomicUpdateEvent[] = [];
  private isProcessingQueue = false;
  private updateTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.state = {
      selectedComponents: [],
      governmentBuilder: null,
      economicInputs: null,
      lastUpdate: Date.now(),
      isUpdating: false,
      errors: [],
      warnings: []
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: AtomicIntegrationState) => void): () => void {
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
  getState(): AtomicIntegrationState {
    return { ...this.state };
  }

  /**
   * Update atomic components and trigger cascade updates
   */
  async updateComponents(components: ComponentType[]): Promise<void> {
    this.addToQueue({
      type: 'components_changed',
      timestamp: Date.now(),
      data: components,
      message: `Updated atomic components: ${components.join(', ')}`
    });

    this.state.selectedComponents = components;
    this.state.isUpdating = true;
    this.notifyListeners();

    try {
      // Generate government builder from components
      if (this.state.economicInputs) {
        const generatedBuilder = generateGovernmentBuilderFromAtomicComponents(
          components,
          this.state.economicInputs.governmentSpending.totalSpending,
          this.state.economicInputs
        );

        this.state.governmentBuilder = generatedBuilder;
        this.addToQueue({
          type: 'government_updated',
          timestamp: Date.now(),
          data: generatedBuilder,
          message: 'Government structure updated from atomic components'
        });

        // Update economic inputs if needed
        await this.updateEconomicInputsFromGovernment(generatedBuilder);
      }

      this.state.lastUpdate = Date.now();
      this.state.errors = [];
    } catch (error) {
      this.state.errors.push(error instanceof Error ? error.message : 'Unknown error');
      this.addToQueue({
        type: 'error',
        timestamp: Date.now(),
        data: error,
        message: 'Failed to update components'
      });
    } finally {
      this.state.isUpdating = false;
      this.notifyListeners();
    }
  }

  /**
   * Update government builder data
   */
  async updateGovernmentBuilder(builder: GovernmentBuilderState): Promise<void> {
    this.addToQueue({
      type: 'government_updated',
      timestamp: Date.now(),
      data: builder,
      message: 'Government builder updated'
    });

    this.state.governmentBuilder = builder;
    this.notifyListeners();

    // Validate against atomic components
    if (this.state.selectedComponents.length > 0) {
      const validation = this.validateGovernmentAgainstComponents(builder);
      if (!validation.isValid) {
        this.state.warnings.push(validation.message);
        this.addToQueue({
          type: 'warning',
          timestamp: Date.now(),
          data: validation,
          message: validation.message
        });
      }
    }
  }

  /**
   * Update economic inputs
   */
  async updateEconomicInputs(inputs: EconomicInputs): Promise<void> {
    this.addToQueue({
      type: 'economics_updated',
      timestamp: Date.now(),
      data: inputs,
      message: 'Economic inputs updated'
    });

    this.state.economicInputs = inputs;
    this.notifyListeners();

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
   * Clear update queue
   */
  clearUpdateQueue(): void {
    this.updateQueue = [];
  }

  /**
   * Force immediate update
   */
  async forceUpdate(): Promise<void> {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }

    await this.processUpdateQueue();
  }

  /**
   * Add event to update queue
   */
  private addToQueue(event: AtomicUpdateEvent): void {
    this.updateQueue.push(event);

    // Process queue after a short delay to batch updates
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(() => {
      this.processUpdateQueue();
    }, 100);
  }

  /**
   * Process update queue
   */
  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessingQueue || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const updates = [...this.updateQueue];
      this.updateQueue = [];

      // Process updates in order
      for (const update of updates) {
        await this.processUpdate(update);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Process individual update
   */
  private async processUpdate(event: AtomicUpdateEvent): Promise<void> {
    switch (event.type) {
      case 'components_changed':
        await this.handleComponentsChanged(event.data);
        break;
      case 'government_updated':
        await this.handleGovernmentUpdated(event.data);
        break;
      case 'economics_updated':
        await this.handleEconomicsUpdated(event.data);
        break;
      case 'error':
        this.handleError(event.data);
        break;
      case 'warning':
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
      this.state.warnings.push(`Synergies detected: ${synergies.map(s => s.description).join(', ')}`);
    }

    if (conflicts.length > 0) {
      this.state.warnings.push(`Conflicts detected: ${conflicts.map(c => c.description).join(', ')}`);
    }
  }

  /**
   * Handle government updated event
   */
  private async handleGovernmentUpdated(builder: GovernmentBuilderState): Promise<void> {
    // Validate budget allocations - only add warning once
    const totalAllocation = builder.budgetAllocations.reduce((sum, alloc) => sum + alloc.allocatedPercent, 0);
    if (Math.abs(totalAllocation - 100) > 1) {
      const budgetWarning = `Budget allocation totals ${totalAllocation.toFixed(1)}%, should be 100%`;
      // Only add if not already present
      if (!this.state.warnings.includes(budgetWarning)) {
        this.state.warnings.push(budgetWarning);
      }
    }

    // Check department coverage
    const requiredDepartments = this.getRequiredDepartments(this.state.selectedComponents);
    const actualDepartments = builder.departments.map(d => d.name);
    const missingDepartments = requiredDepartments.filter(d => !actualDepartments.includes(d));

    if (missingDepartments.length > 0) {
      this.state.warnings.push(`Missing departments: ${missingDepartments.join(', ')}`);
    }
  }

  /**
   * Handle economics updated event
   */
  private async handleEconomicsUpdated(inputs: EconomicInputs): Promise<void> {
    // Validate spending against GDP
    const spendingPercent = (inputs.governmentSpending.totalSpending / inputs.coreIndicators.nominalGDP) * 100;
    if (spendingPercent > 50) {
      this.state.warnings.push(`Government spending is ${spendingPercent.toFixed(1)}% of GDP, which is very high`);
    } else if (spendingPercent < 10) {
      this.state.warnings.push(`Government spending is ${spendingPercent.toFixed(1)}% of GDP, which is very low`);
    }
  }

  /**
   * Handle error event
   */
  private handleError(error: any): void {
    this.state.errors.push(error instanceof Error ? error.message : String(error));
  }

  /**
   * Handle warning event
   */
  private handleWarning(warning: any): void {
    this.state.warnings.push(warning instanceof Error ? warning.message : String(warning));
  }

  /**
   * Update economic inputs from government builder
   */
  private async updateEconomicInputsFromGovernment(builder: GovernmentBuilderState): Promise<void> {
    if (!this.state.economicInputs) return;

    const updatedInputs = {
      ...this.state.economicInputs,
      governmentSpending: {
        ...this.state.economicInputs.governmentSpending,
        totalSpending: builder.structure.totalBudget,
        spendingGDPPercent: this.state.economicInputs.coreIndicators.nominalGDP > 0 
          ? (builder.structure.totalBudget / this.state.economicInputs.coreIndicators.nominalGDP) * 100 
          : 35,
        spendingCategories: builder.departments.map((dept, index) => {
          const allocation = builder.budgetAllocations.find(a => a.departmentId === index.toString());
          return {
            category: dept.name,
            amount: allocation?.allocatedAmount || 0,
            percent: allocation?.allocatedPercent || 0,
            icon: dept.icon,
            color: dept.color,
            description: dept.description
          };
        })
      }
    };

    this.state.economicInputs = updatedInputs;
  }

  /**
   * Validate government against atomic components
   */
  private validateGovernmentAgainstComponents(builder: GovernmentBuilderState): { isValid: boolean; message: string } {
    const requiredDepartments = this.getRequiredDepartments(this.state.selectedComponents);
    const actualDepartments = builder.departments.map(d => d.name);
    const missingDepartments = requiredDepartments.filter(d => !actualDepartments.includes(d));

    if (missingDepartments.length > 0) {
      return {
        isValid: false,
        message: `Government structure missing departments required by atomic components: ${missingDepartments.join(', ')}`
      };
    }

    return { isValid: true, message: '' };
  }

  /**
   * Validate component combination
   */
  private validateComponentCombination(components: ComponentType[]): { isValid: boolean; message: string } {
    // Check for mutually exclusive components
    const exclusivePairs = [
      [ComponentType.CENTRALIZED_POWER, ComponentType.FEDERAL_SYSTEM],
      [ComponentType.DEMOCRATIC_PROCESS, ComponentType.AUTOCRATIC_PROCESS],
      [ComponentType.CONSENSUS_PROCESS, ComponentType.AUTOCRATIC_PROCESS]
    ];

    for (const [comp1, comp2] of exclusivePairs) {
      if (components.includes(comp1) && components.includes(comp2)) {
        return {
          isValid: false,
          message: `Components ${comp1} and ${comp2} are mutually exclusive`
        };
      }
    }

    return { isValid: true, message: '' };
  }

  /**
   * Detect synergies between components
   */
  private detectSynergies(components: ComponentType[]): Array<{ components: ComponentType[]; description: string }> {
    const synergies: Array<{ components: ComponentType[]; description: string }> = [];

    // Define synergy patterns
    const synergyPatterns = [
      {
        components: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.RULE_OF_LAW],
        description: 'Democratic rule of law creates strong legitimacy'
      },
      {
        components: [ComponentType.FEDERAL_SYSTEM, ComponentType.PROFESSIONAL_BUREAUCRACY],
        description: 'Professional federal administration enhances efficiency'
      }
    ];

    for (const pattern of synergyPatterns) {
      if (pattern.components.every(comp => components.includes(comp))) {
        synergies.push(pattern);
      }
    }

    return synergies;
  }

  /**
   * Detect conflicts between components
   * Note: Conflicts are now handled by atomicGovernmentIntegration utility to avoid duplicates
   */
  private detectConflicts(components: ComponentType[]): Array<{ components: ComponentType[]; description: string }> {
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

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Error in atomic integration listener:', error);
      }
    });
  }
}

// Singleton instance
export const atomicIntegrationService = new AtomicIntegrationService();
