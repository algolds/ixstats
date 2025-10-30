/**
 * Bidirectional Government Sync Service
 * 
 * This service provides real-time bidirectional synchronization between the economy builder
 * and government system, ensuring optimal government structure and policies based on economic
 * components and providing economic impact feedback for government policy changes.
 */

import { EconomicComponentType, ATOMIC_ECONOMIC_COMPONENTS } from '~/lib/atomic-economic-data';
import { ComponentType, ATOMIC_COMPONENTS } from '~/components/government/atoms/AtomicGovernmentComponents';
import type { EconomyBuilderState } from '~/types/economy-builder';
import type { GovernmentBuilderState } from '~/types/government';

export interface GovernmentSyncEvent {
  type: 'economy_to_government' | 'government_to_economy' | 'bidirectional_sync' | 'error';
  timestamp: number;
  source: 'economy' | 'government';
  data: any;
  message: string;
}

export interface GovernmentRecommendation {
  componentType: ComponentType;
  currentStatus: 'present' | 'absent' | 'partial';
  recommendation: 'add' | 'remove' | 'enhance' | 'reduce';
  rationale: string;
  economicImpact: {
    gdpImpact: number; // percentage change
    employmentImpact: number; // percentage change
    investmentImpact: number; // percentage change
    stabilityImpact: number; // percentage change
  };
  implementationCost: number;
  maintenanceCost: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  timeToImplement: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
}

export interface EconomicImpactOfGovernment {
  governmentChange: {
    componentType: ComponentType;
    changeType: 'added' | 'removed' | 'modified';
    effectivenessChange: number;
  };
  economicImpact: {
    gdpGrowthImpact: number; // percentage change
    employmentImpact: number; // percentage change
    investmentImpact: number; // percentage change
    tradeImpact: number; // percentage change
    innovationImpact: number; // percentage change
    stabilityImpact: number; // percentage change
  };
  sectorImpacts: Record<string, number>; // sector-specific impacts
  timeToEffect: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  confidence: number; // 0-100
}

export interface BidirectionalGovernmentSyncState {
  economyBuilder: EconomyBuilderState | null;
  governmentBuilder: GovernmentBuilderState | null;
  governmentRecommendations: GovernmentRecommendation[];
  economicImpacts: EconomicImpactOfGovernment[];
  isSyncing: boolean;
  lastSync: number;
  syncHistory: GovernmentSyncEvent[];
  errors: string[];
}

export class BidirectionalGovernmentSyncService {
  private state: BidirectionalGovernmentSyncState;
  private listeners: Array<(state: BidirectionalGovernmentSyncState) => void> = [];
  private syncQueue: GovernmentSyncEvent[] = [];
  private isProcessingQueue = false;

  constructor() {
    this.state = {
      economyBuilder: null,
      governmentBuilder: null,
      governmentRecommendations: [],
      economicImpacts: [],
      isSyncing: false,
      lastSync: Date.now(),
      syncHistory: [],
      errors: []
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: BidirectionalGovernmentSyncState) => void): () => void {
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
  getState(): BidirectionalGovernmentSyncState {
    return { ...this.state };
  }

  /**
   * Update economy builder and trigger government recommendations
   */
  async updateEconomyBuilder(economyBuilder: EconomyBuilderState): Promise<void> {
    this.state.economyBuilder = economyBuilder;
    this.state.isSyncing = true;
    this.notifyListeners();

    try {
      // Generate government recommendations based on economic components
      const recommendations = await this.generateGovernmentRecommendations(economyBuilder);
      this.state.governmentRecommendations = recommendations;

      // Add sync event
      this.addSyncEvent({
        type: 'economy_to_government',
        timestamp: Date.now(),
        source: 'economy',
        data: { economyBuilder, recommendations },
        message: `Generated ${recommendations.length} government recommendations from economy builder`
      });

      this.state.lastSync = Date.now();
      this.state.errors = [];
    } catch (error) {
      this.state.errors.push(error instanceof Error ? error.message : 'Unknown error');
      this.addSyncEvent({
        type: 'error',
        timestamp: Date.now(),
        source: 'economy',
        data: error,
        message: 'Failed to update economy builder'
      });
    } finally {
      this.state.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Update government builder and calculate economic impacts
   */
  async updateGovernmentBuilder(governmentBuilder: GovernmentBuilderState): Promise<void> {
    this.state.governmentBuilder = governmentBuilder;
    this.state.isSyncing = true;
    this.notifyListeners();

    try {
      // Calculate economic impacts of government changes
      const impacts = await this.calculateEconomicImpacts(governmentBuilder);
      this.state.economicImpacts = impacts;

      // Add sync event
      this.addSyncEvent({
        type: 'government_to_economy',
        timestamp: Date.now(),
        source: 'government',
        data: { governmentBuilder, impacts },
        message: `Calculated ${impacts.length} economic impacts from government builder`
      });

      this.state.lastSync = Date.now();
      this.state.errors = [];
    } catch (error) {
      this.state.errors.push(error instanceof Error ? error.message : 'Unknown error');
      this.addSyncEvent({
        type: 'error',
        timestamp: Date.now(),
        source: 'government',
        data: error,
        message: 'Failed to update government builder'
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
    if (!this.state.economyBuilder || !this.state.governmentBuilder) return;

    this.state.isSyncing = true;
    this.notifyListeners();

    try {
      // Economy -> Government recommendations
      const recommendations = await this.generateGovernmentRecommendations(this.state.economyBuilder);
      
      // Government -> Economy impacts
      const impacts = await this.calculateEconomicImpacts(this.state.governmentBuilder);

      // Update state
      this.state.governmentRecommendations = recommendations;
      this.state.economicImpacts = impacts;

      // Add sync event
      this.addSyncEvent({
        type: 'bidirectional_sync',
        timestamp: Date.now(),
        source: 'economy',
        data: { recommendations, impacts },
        message: 'Performed bidirectional sync between economy and government systems'
      });

      this.state.lastSync = Date.now();
      this.state.errors = [];
    } catch (error) {
      this.state.errors.push(error instanceof Error ? error.message : 'Unknown error');
      this.addSyncEvent({
        type: 'error',
        timestamp: Date.now(),
        source: 'economy',
        data: error,
        message: 'Failed to perform bidirectional sync'
      });
    } finally {
      this.state.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Generate government recommendations based on economic components
   */
  private async generateGovernmentRecommendations(economyBuilder: EconomyBuilderState): Promise<GovernmentRecommendation[]> {
    const recommendations: GovernmentRecommendation[] = [];
    const components = economyBuilder.selectedAtomicComponents;
    const currentGovernmentComponents = this.state.governmentBuilder?.selectedComponents || [];

    // Analyze each economic component for government synergies
    components.forEach(economicComp => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[economicComp];
      if (component?.governmentSynergies) {
        component.governmentSynergies.forEach(govSynergy => {
          const govComponent = this.mapGovernmentSynergyToComponent(govSynergy);
          if (govComponent) {
            const recommendation = this.createGovernmentRecommendation(
              economicComp,
              govComponent,
              currentGovernmentComponents.includes(govComponent as any)
            );
            if (recommendation) {
              recommendations.push(recommendation);
            }
          }
        });
      }
    });

    // Analyze each economic component for government conflicts
    components.forEach(economicComp => {
      const component = ATOMIC_ECONOMIC_COMPONENTS[economicComp];
      if (component?.governmentConflicts) {
        component.governmentConflicts.forEach(govConflict => {
          const govComponent = this.mapGovernmentConflictToComponent(govConflict);
          if (govComponent && currentGovernmentComponents.includes(govComponent as any)) {
            const recommendation = this.createGovernmentConflictRecommendation(
              economicComp,
              govComponent
            );
            if (recommendation) {
              recommendations.push(recommendation);
            }
          }
        });
      }
    });

    return recommendations;
  }

  /**
   * Map government synergy string to component type
   */
  private mapGovernmentSynergyToComponent(synergy: string): ComponentType | null {
    const mapping: Record<string, ComponentType> = {
      'CENTRALIZED_POWER': ComponentType.CENTRALIZED_POWER,
      'FEDERAL_SYSTEM': ComponentType.FEDERAL_SYSTEM,
      'DEMOCRATIC_PROCESS': ComponentType.DEMOCRATIC_PROCESS,
      'AUTOCRATIC_PROCESS': ComponentType.AUTOCRATIC_PROCESS,
      'TECHNOCRATIC_PROCESS': ComponentType.TECHNOCRATIC_PROCESS,
      'PROFESSIONAL_BUREAUCRACY': ComponentType.PROFESSIONAL_BUREAUCRACY,
      'RULE_OF_LAW': ComponentType.RULE_OF_LAW,
      'INDEPENDENT_JUDICIARY': ComponentType.INDEPENDENT_JUDICIARY,
      'DIGITAL_GOVERNMENT': ComponentType.DIGITAL_GOVERNMENT,
      'MERIT_BASED_SYSTEM': ComponentType.MERIT_BASED_SYSTEM
    };

    return mapping[synergy] || null;
  }

  /**
   * Map government conflict string to component type
   */
  private mapGovernmentConflictToComponent(conflict: string): ComponentType | null {
    return this.mapGovernmentSynergyToComponent(conflict); // Same mapping
  }

  /**
   * Create government recommendation for synergy
   */
  private createGovernmentRecommendation(
    economicComp: EconomicComponentType,
    govComponent: ComponentType,
    isPresent: boolean
  ): GovernmentRecommendation | null {
    const economicComponent = ATOMIC_ECONOMIC_COMPONENTS[economicComp];
    const govComponentData = ATOMIC_COMPONENTS[govComponent];
    
    if (!economicComponent || !govComponentData) return null;

    const recommendation: GovernmentRecommendation = {
      componentType: govComponent,
      currentStatus: isPresent ? 'present' : 'absent',
      recommendation: isPresent ? 'enhance' : 'add',
      rationale: `${economicComponent.name} would benefit from ${govComponentData.name} for optimal economic performance`,
      economicImpact: this.calculateGovernmentEconomicImpact(economicComp, govComponent, 'synergy'),
      implementationCost: govComponentData.implementationCost,
      maintenanceCost: govComponentData.maintenanceCost,
      priority: this.calculatePriority(economicComp, govComponent, 'synergy'),
      timeToImplement: this.calculateTimeToImplement(govComponent, 'add')
    };

    return recommendation;
  }

  /**
   * Create government recommendation for conflict resolution
   */
  private createGovernmentConflictRecommendation(
    economicComp: EconomicComponentType,
    govComponent: ComponentType
  ): GovernmentRecommendation | null {
    const economicComponent = ATOMIC_ECONOMIC_COMPONENTS[economicComp];
    const govComponentData = ATOMIC_COMPONENTS[govComponent];
    
    if (!economicComponent || !govComponentData) return null;

    const recommendation: GovernmentRecommendation = {
      componentType: govComponent,
      currentStatus: 'present',
      recommendation: 'remove',
      rationale: `${govComponentData.name} conflicts with ${economicComponent.name}, reducing economic effectiveness`,
      economicImpact: this.calculateGovernmentEconomicImpact(economicComp, govComponent, 'conflict'),
      implementationCost: -govComponentData.implementationCost * 0.5, // Cost savings from removal
      maintenanceCost: -govComponentData.maintenanceCost, // Maintenance savings
      priority: 'high' as const,
      timeToImplement: this.calculateTimeToImplement(govComponent, 'remove')
    };

    return recommendation;
  }

  /**
   * Calculate economic impact of government component
   */
  private calculateGovernmentEconomicImpact(
    economicComp: EconomicComponentType,
    govComp: ComponentType,
    type: 'synergy' | 'conflict'
  ) {
    const economicComponent = ATOMIC_ECONOMIC_COMPONENTS[economicComp];
    const govComponent = ATOMIC_COMPONENTS[govComp];
    
    if (!economicComponent || !govComponent) {
      return {
        gdpImpact: 0,
        employmentImpact: 0,
        investmentImpact: 0,
        stabilityImpact: 0
      };
    }

    const multiplier = type === 'synergy' ? 1 : -1;
    const baseImpact = type === 'synergy' ? 5 : -3;

    // Calculate impacts based on component effectiveness and synergy
    const gdpImpact = baseImpact * multiplier * (govComponent.effectiveness / 100);
    const employmentImpact = baseImpact * 0.8 * multiplier * (govComponent.effectiveness / 100);
    const investmentImpact = baseImpact * 1.2 * multiplier * (govComponent.effectiveness / 100);
    const stabilityImpact = baseImpact * 0.6 * multiplier * (govComponent.effectiveness / 100);

    // Adjust based on economic component type
    if (economicComp === EconomicComponentType.INNOVATION_ECONOMY && govComp === ComponentType.TECHNOCRATIC_PROCESS) {
      return {
        gdpImpact: gdpImpact * 1.5,
        employmentImpact: employmentImpact * 1.3,
        investmentImpact: investmentImpact * 2.0,
        stabilityImpact: stabilityImpact * 1.2
      };
    }

    if (economicComp === EconomicComponentType.FREE_MARKET_SYSTEM && govComp === ComponentType.DEMOCRATIC_PROCESS) {
      return {
        gdpImpact: gdpImpact * 1.3,
        employmentImpact: employmentImpact * 1.1,
        investmentImpact: investmentImpact * 1.4,
        stabilityImpact: stabilityImpact * 1.5
      };
    }

    return {
      gdpImpact,
      employmentImpact,
      investmentImpact,
      stabilityImpact
    };
  }

  /**
   * Calculate priority level
   */
  private calculatePriority(
    economicComp: EconomicComponentType,
    govComp: ComponentType,
    type: 'synergy' | 'conflict'
  ): 'critical' | 'high' | 'medium' | 'low' {
    const economicComponent = ATOMIC_ECONOMIC_COMPONENTS[economicComp];
    const govComponent = ATOMIC_COMPONENTS[govComp];
    
    if (!economicComponent || !govComponent) return 'low';

    // High-impact economic components get higher priority
    if (economicComponent.effectiveness > 85) {
      return type === 'conflict' ? 'critical' : 'high';
    }
    
    if (economicComponent.effectiveness > 70) {
      return type === 'conflict' ? 'high' : 'medium';
    }
    
    return type === 'conflict' ? 'medium' : 'low';
  }

  /**
   * Calculate time to implement
   */
  private calculateTimeToImplement(
    govComp: ComponentType,
    action: 'add' | 'remove'
  ): 'immediate' | 'short_term' | 'medium_term' | 'long_term' {
    const govComponent = ATOMIC_COMPONENTS[govComp];
    if (!govComponent) return 'medium_term';

    if (action === 'remove') {
      return 'short_term'; // Generally easier to remove than add
    }

    // Implementation time based on component complexity and cost
    if (govComponent.implementationCost < 50000) return 'short_term';
    if (govComponent.implementationCost < 150000) return 'medium_term';
    return 'long_term';
  }

  /**
   * Calculate economic impacts of government system changes
   */
  private async calculateEconomicImpacts(governmentBuilder: GovernmentBuilderState): Promise<EconomicImpactOfGovernment[]> {
    const impacts: EconomicImpactOfGovernment[] = [];
    const selectedComponents = governmentBuilder.selectedComponents || [];

    // Calculate impact for each government component
    selectedComponents.forEach(component => {
      const impact = this.calculateSingleGovernmentImpact(component as ComponentType, governmentBuilder);
      if (impact) {
        impacts.push(impact);
      }
    });

    return impacts;
  }

  /**
   * Calculate impact of a single government component
   */
  private calculateSingleGovernmentImpact(
    component: ComponentType,
    governmentBuilder: GovernmentBuilderState
  ): EconomicImpactOfGovernment | null {
    const govComponent = ATOMIC_COMPONENTS[component];
    if (!govComponent) return null;

    // Calculate economic impacts based on government component
    const economicImpact = this.calculateGovernmentComponentEconomicImpact(component, governmentBuilder);

    // Determine sector impacts
    const sectorImpacts = this.calculateGovernmentSectorImpacts(component);

    // Determine time to effect
    const timeToEffect = this.determineGovernmentTimeToEffect(component);

    // Calculate confidence based on component data
    const confidence = this.calculateGovernmentConfidence(component, governmentBuilder);

    return {
      governmentChange: {
        componentType: component,
        changeType: 'added', // This would be calculated from previous state
        effectivenessChange: govComponent.effectiveness
      },
      economicImpact,
      sectorImpacts,
      timeToEffect,
      confidence
    };
  }

  /**
   * Calculate economic impact of government component
   */
  private calculateGovernmentComponentEconomicImpact(
    component: ComponentType,
    governmentBuilder: GovernmentBuilderState
  ) {
    const govComponent = ATOMIC_COMPONENTS[component];
    if (!govComponent) {
      return {
        gdpGrowthImpact: 0,
        employmentImpact: 0,
        investmentImpact: 0,
        tradeImpact: 0,
        innovationImpact: 0,
        stabilityImpact: 0
      };
    }

    // Base impact based on component effectiveness
    const baseImpact = govComponent.effectiveness / 100;

    // Component-specific impacts
    let gdpGrowthImpact = 0;
    let employmentImpact = 0;
    let investmentImpact = 0;
    let tradeImpact = 0;
    let innovationImpact = 0;
    let stabilityImpact = 0;

    switch (component) {
      case ComponentType.DEMOCRATIC_PROCESS:
        gdpGrowthImpact = baseImpact * 0.5;
        employmentImpact = baseImpact * 0.3;
        investmentImpact = baseImpact * 0.8;
        stabilityImpact = baseImpact * 1.0;
        break;
      
      case ComponentType.AUTOCRATIC_PROCESS:
        gdpGrowthImpact = baseImpact * 0.8;
        employmentImpact = baseImpact * 0.6;
        investmentImpact = baseImpact * 0.4;
        stabilityImpact = baseImpact * 0.7;
        break;
      
      case ComponentType.TECHNOCRATIC_PROCESS:
        gdpGrowthImpact = baseImpact * 0.6;
        employmentImpact = baseImpact * 0.4;
        investmentImpact = baseImpact * 1.0;
        innovationImpact = baseImpact * 1.5;
        break;
      
      case ComponentType.PROFESSIONAL_BUREAUCRACY:
        gdpGrowthImpact = baseImpact * 0.4;
        employmentImpact = baseImpact * 0.2;
        investmentImpact = baseImpact * 0.6;
        stabilityImpact = baseImpact * 1.2;
        break;
      
      case ComponentType.RULE_OF_LAW:
        gdpGrowthImpact = baseImpact * 0.7;
        employmentImpact = baseImpact * 0.5;
        investmentImpact = baseImpact * 1.2;
        tradeImpact = baseImpact * 0.8;
        stabilityImpact = baseImpact * 1.5;
        break;
      
      case ComponentType.DIGITAL_GOVERNMENT:
        gdpGrowthImpact = baseImpact * 0.5;
        employmentImpact = baseImpact * 0.3;
        investmentImpact = baseImpact * 0.9;
        innovationImpact = baseImpact * 1.0;
        break;
      
      default:
        gdpGrowthImpact = baseImpact * 0.3;
        employmentImpact = baseImpact * 0.2;
        investmentImpact = baseImpact * 0.4;
        stabilityImpact = baseImpact * 0.5;
    }

    return {
      gdpGrowthImpact,
      employmentImpact,
      investmentImpact,
      tradeImpact,
      innovationImpact,
      stabilityImpact
    };
  }

  /**
   * Calculate sector-specific impacts of government components
   */
  private calculateGovernmentSectorImpacts(component: ComponentType): Record<string, number> {
    const sectorImpacts: Record<string, number> = {};

    switch (component) {
      case ComponentType.TECHNOCRATIC_PROCESS:
        sectorImpacts.technology = 0.5;
        sectorImpacts.research = 0.8;
        sectorImpacts.education = 0.6;
        break;
      
      case ComponentType.PROFESSIONAL_BUREAUCRACY:
        sectorImpacts.government = 0.4;
        sectorImpacts.public_administration = 0.6;
        sectorImpacts.services = 0.2;
        break;
      
      case ComponentType.RULE_OF_LAW:
        sectorImpacts.finance = 0.7;
        sectorImpacts.legal_services = 0.9;
        sectorImpacts.business_services = 0.5;
        break;
      
      case ComponentType.DIGITAL_GOVERNMENT:
        sectorImpacts.technology = 0.6;
        sectorImpacts.information = 0.8;
        sectorImpacts.telecommunications = 0.4;
        break;
      
      default:
        // Default minimal impact
        sectorImpacts.general = 0.1;
    }

    return sectorImpacts;
  }

  /**
   * Determine time to effect for government changes
   */
  private determineGovernmentTimeToEffect(component: ComponentType): 'immediate' | 'short_term' | 'medium_term' | 'long_term' {
    switch (component) {
      case ComponentType.AUTOCRATIC_PROCESS:
        return 'immediate';
      case ComponentType.DEMOCRATIC_PROCESS:
        return 'short_term';
      case ComponentType.TECHNOCRATIC_PROCESS:
      case ComponentType.PROFESSIONAL_BUREAUCRACY:
        return 'medium_term';
      case ComponentType.RULE_OF_LAW:
        return 'long_term';
      default:
        return 'medium_term';
    }
  }

  /**
   * Calculate confidence in impact estimates
   */
  private calculateGovernmentConfidence(component: ComponentType, governmentBuilder: GovernmentBuilderState): number {
    let confidence = 70; // Base confidence for government components

    const govComponent = ATOMIC_COMPONENTS[component];
    if (govComponent) {
      // Higher effectiveness components have higher confidence
      confidence += (govComponent.effectiveness - 75) * 0.2;
    }

    // Increase confidence if government builder has good data
    if (governmentBuilder.structure.totalBudget > 0) confidence += 10;
    if (governmentBuilder.departments.length > 0) confidence += 10;

    return Math.max(50, Math.min(95, confidence));
  }

  /**
   * Add sync event to history
   */
  private addSyncEvent(event: GovernmentSyncEvent): void {
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
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Update government structure based on economy builder state
   * Stub implementation - returns a basic GovernmentStructure
   */
  updateGovernmentFromEconomy(economyBuilder: EconomyBuilderState): any {
    const recommendations = this.state.governmentRecommendations.length > 0
      ? this.state.governmentRecommendations
      : [];

    // Extract recommended components
    const recommendedComponents = recommendations
      .filter(r => r.recommendation === 'add' || r.recommendation === 'enhance')
      .map(r => r.componentType);

    // Return basic GovernmentStructure
    return {
      id: 'auto-generated-government',
      countryId: '', // economyBuilder doesn't have countryId property
      systemType: this.determineSystemType(economyBuilder),
      recommendedComponents,
      totalBudget: this.estimateBudgetFromEconomy(economyBuilder),
      effectivenessScore: this.calculateEffectivenessScore(recommendations),
      stabilityScore: this.calculateStabilityScore(recommendations),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get government impact analysis of economy builder state
   * Stub implementation - returns impact data
   */
  getGovernmentImpactOfEconomy(economyBuilder: EconomyBuilderState): any {
    const recommendations = this.state.governmentRecommendations.length > 0
      ? this.state.governmentRecommendations
      : [];
    const impacts = this.state.economicImpacts.length > 0
      ? this.state.economicImpacts
      : [];

    return {
      totalRecommendations: recommendations.length,
      criticalPriorityCount: recommendations.filter(r => r.priority === 'critical').length,
      highPriorityCount: recommendations.filter(r => r.priority === 'high').length,
      estimatedImplementationCost: recommendations.reduce((sum, r) => sum + r.implementationCost, 0),
      estimatedMaintenanceCost: recommendations.reduce((sum, r) => sum + r.maintenanceCost, 0),
      averageGDPImpact: impacts.length > 0
        ? impacts.reduce((sum, i) => sum + i.economicImpact.gdpGrowthImpact, 0) / impacts.length
        : 0,
      averageStabilityImpact: impacts.length > 0
        ? impacts.reduce((sum, i) => sum + i.economicImpact.stabilityImpact, 0) / impacts.length
        : 0,
      recommendations: recommendations.map(r => ({
        component: r.componentType,
        recommendation: r.recommendation,
        priority: r.priority,
        rationale: r.rationale,
        timeToImplement: r.timeToImplement
      })),
      impacts: impacts.map(i => ({
        component: i.governmentChange.componentType,
        gdpImpact: i.economicImpact.gdpGrowthImpact,
        stabilityImpact: i.economicImpact.stabilityImpact,
        confidence: i.confidence
      }))
    };
  }

  /**
   * Determine government system type based on economy
   */
  private determineSystemType(economyBuilder: EconomyBuilderState): string {
    const components = economyBuilder.selectedAtomicComponents;

    if (components.includes(EconomicComponentType.FREE_MARKET_SYSTEM)) {
      return 'Democratic Republic';
    }
    if (components.includes(EconomicComponentType.PLANNED_ECONOMY)) {
      return 'Centralized State';
    }
    if (components.includes(EconomicComponentType.SOCIAL_MARKET_ECONOMY)) {
      return 'Social Democracy';
    }

    return 'Mixed System';
  }

  /**
   * Estimate government budget from economy
   */
  private estimateBudgetFromEconomy(economyBuilder: EconomyBuilderState): number {
    // Stub: estimate 20-35% of GDP as government budget
    const population = economyBuilder.demographics?.totalPopulation ?? 0;
    const gdpEstimate = population > 0 ? population * 40000 : 1000000000;
    return gdpEstimate * 0.25;
  }

  /**
   * Calculate government effectiveness score
   */
  private calculateEffectivenessScore(recommendations: GovernmentRecommendation[]): number {
    if (recommendations.length === 0) return 50;

    const avgImpact = recommendations.reduce((sum, r) => sum + r.economicImpact.gdpImpact, 0) / recommendations.length;
    return Math.max(0, Math.min(100, 50 + avgImpact * 10));
  }

  /**
   * Calculate government stability score
   */
  private calculateStabilityScore(recommendations: GovernmentRecommendation[]): number {
    if (recommendations.length === 0) return 50;

    const avgStability = recommendations.reduce((sum, r) => sum + r.economicImpact.stabilityImpact, 0) / recommendations.length;
    return Math.max(0, Math.min(100, 50 + avgStability * 10));
  }
}

// Export singleton instance
export const bidirectionalGovernmentSyncService = new BidirectionalGovernmentSyncService();
