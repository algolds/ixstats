/**
 * Unified Atomic State Management System
 *
 * This module provides the central nervous system for atomic government components
 * across the entire IxStats platform. It serves as the single source of truth
 * for all atomic component data, calculations, and interactions.
 *
 * Key Features:
 * - Real-time component effectiveness calculation
 * - Dynamic synergy and conflict detection
 * - Economic impact modeling with government effectiveness multipliers
 * - Auto-generated traditional government structures from atomic components
 * - AI-powered intelligence feeds and recommendations
 * - Cross-system integration with all platform components
 *
 * Architecture:
 * ```
 * Atomic Components (User Selection)
 *   ↓
 * UnifiedAtomicStateManager (Central State)
 *   ↓ ┌─────────────────────────────────────────────┐
 *   ├─→ Economic Systems (GDP, Tax, Trade)
 *   ├─→ Government Structure (Auto-Generated)
 *   ├─→ Intelligence Systems (AI Analysis)
 *   ├─→ Real-time Metrics (Performance Tracking)
 *   └─→ Analytics Systems (Historical Data)
 * ```
 *
 * @fileoverview Central atomic state management for IxStats platform
 * @author IxStats Development Team
 * @since 2025-01-05
 * @version 2.0.0
 */

import { ComponentType } from "@prisma/client";
import {
  AtomicBuilderStateManager,
  type AtomicBuilderState,
  type AtomicEconomicModifiers,
  SYNERGY_RULES,
  CONFLICT_RULES,
} from "./atomic-builder-state";
import { calculateAtomicTaxEffectiveness } from "./atomic-tax-integration";
import {
  calculateClientAtomicEconomicImpact,
  getComponentBreakdown,
  detectPotentialSynergies,
  detectConflicts,
  calculateOverallEffectiveness,
  type ClientAtomicEconomicModifiers,
} from "./atomic-client-calculations";

export interface UnifiedAtomicState {
  // Core Component State
  selectedComponents: ComponentType[];
  effectivenessScore: number;
  synergies: Array<{
    id: string;
    components: ComponentType[];
    modifier: number;
    description: string;
  }>;
  conflicts: Array<{
    id: string;
    components: ComponentType[];
    penalty: number;
    description: string;
  }>;

  // Economic Integration
  economicModifiers: ClientAtomicEconomicModifiers;
  taxEffectiveness: {
    collectionEfficiency: number;
    complianceRate: number;
    auditCapacity: number;
    overallMultiplier: number;
  };
  economicPerformance: {
    gdpGrowthMultiplier: number;
    inflationControl: number;
    tradeEfficiency: number;
    investmentAttraction: number;
  };

  // Government Structure Integration
  traditionalStructure: {
    governmentType: string;
    departments: Array<{ name: string; priority: number; effectivenessBonus: number }>;
    executiveStructure: string[];
    legislativeStructure: string[];
    judicialStructure: string[];
    budgetAllocations: Record<string, number>;
  };

  // Intelligence Integration
  intelligenceFeeds: Array<{
    id: string;
    type: "opportunity" | "risk" | "trend" | "alert";
    title: string;
    description: string;
    impact: "low" | "medium" | "high" | "critical";
    source: "atomic_analysis" | "economic_model" | "comparative_analysis";
    timestamp: number;
    actionable: boolean;
  }>;

  // Real-time Metrics
  realTimeMetrics: {
    governmentCapacity: number;
    policyImplementationSpeed: number;
    citizenSatisfaction: number;
    internationalStanding: number;
    crisisResiliency: number;
  };

  // Performance Analytics
  performanceAnalytics: {
    historicalEffectiveness: Array<{ date: string; score: number }>;
    componentPerformance: Record<ComponentType, { effectiveness: number; utilizationRate: number }>;
    benchmarkComparison: { rank: number; percentile: number; similarCountries: string[] };
  };

  // Country Context
  countryContext: {
    countryId: string;
    size: "small" | "medium" | "large";
    developmentLevel: "developing" | "emerging" | "developed";
    politicalTradition: "democratic" | "authoritarian" | "mixed" | "traditional";
    primaryChallenges: Array<{ type: string; severity: "low" | "medium" | "high" }>;
  };
}

/**
 * Unified Atomic State Manager
 *
 * The central nervous system for atomic government components across the entire
 * IxStats platform. This class manages all atomic component state, calculations,
 * and cross-system integrations in real-time.
 *
 * Features:
 * - Observable state pattern with real-time listener notifications
 * - Cascade effect calculations when components change
 * - Integration with economic, intelligence, and analytics systems
 * - Auto-generated traditional government structures
 * - Performance optimized with intelligent caching
 *
 * Usage:
 * ```typescript
 * const manager = new UnifiedAtomicStateManager({
 *   countryContext: { countryId: 'country-123', size: 'medium' }
 * });
 *
 * // Subscribe to state changes
 * const unsubscribe = manager.subscribe((state) => {
 *   console.log('Effectiveness:', state.effectivenessScore);
 *   console.log('Economic Impact:', state.economicModifiers.gdpGrowthModifier);
 * });
 *
 * // Update components triggers cascade calculations
 * manager.setSelectedComponents([ComponentType.RULE_OF_LAW, ComponentType.PROFESSIONAL_BUREAUCRACY]);
 * ```
 *
 * @class UnifiedAtomicStateManager
 * @version 2.0.0
 */
export class UnifiedAtomicStateManager {
  /** Internal state object containing all atomic component data and derived calculations */
  private state: UnifiedAtomicState;

  /** Array of listener functions that receive state updates */
  private listeners: Array<(state: UnifiedAtomicState) => void> = [];

  /** Integration with the atomic builder state management system */
  private builderStateManager: AtomicBuilderStateManager;

  /** Interval ID for real-time metric updates (runs every 30 seconds) */
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(initialState?: Partial<UnifiedAtomicState>) {
    this.builderStateManager = new AtomicBuilderStateManager();

    this.state = {
      // Core defaults
      selectedComponents: [],
      effectivenessScore: 0,
      synergies: [],
      conflicts: [],

      // Economic defaults
      economicModifiers: this.getDefaultEconomicModifiers(),
      taxEffectiveness: this.getDefaultTaxEffectiveness(),
      economicPerformance: this.getDefaultEconomicPerformance(),

      // Structure defaults
      traditionalStructure: this.getDefaultTraditionalStructure(),

      // Intelligence defaults
      intelligenceFeeds: [],

      // Metrics defaults
      realTimeMetrics: this.getDefaultRealTimeMetrics(),

      // Analytics defaults
      performanceAnalytics: this.getDefaultPerformanceAnalytics(),

      // Context defaults
      countryContext: this.getDefaultCountryContext(),

      // Apply any overrides
      ...initialState,
    };

    // Subscribe to builder state changes
    this.builderStateManager.subscribe((builderState) => {
      this.syncFromBuilderState(builderState);
    });

    // Start real-time updates
    this.startRealTimeUpdates();
  }

  // Public API Methods

  /**
   * Subscribe to state changes with automatic cleanup
   *
   * Adds a listener function that will be called whenever the atomic state changes.
   * This enables real-time UI updates across all connected components.
   *
   * @param listener - Callback function that receives the updated state
   * @returns Unsubscribe function to remove the listener
   *
   * @example
   * ```typescript
   * const unsubscribe = manager.subscribe((state) => {
   *   updateUI(state.effectivenessScore);
   *   updateEconomics(state.economicModifiers);
   * });
   *
   * // Clean up when component unmounts
   * useEffect(() => unsubscribe, []);
   * ```
   */
  subscribe(listener: (state: UnifiedAtomicState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get current unified state
   */
  getState(): UnifiedAtomicState {
    return { ...this.state };
  }

  /**
   * Update country context (triggers full recalculation)
   */
  setCountryContext(context: Partial<UnifiedAtomicState["countryContext"]>) {
    this.state.countryContext = { ...this.state.countryContext, ...context };
    this.recalculateAllSystems();
    this.notifyListeners();
  }

  /**
   * Update selected atomic components with cascade effect calculations
   *
   * This is the primary method for updating the government composition. When components
   * change, it triggers a cascade of recalculations across all integrated systems:
   * - Government effectiveness scoring
   * - Economic impact modeling (GDP, tax collection, trade)
   * - Traditional government structure generation
   * - AI intelligence feed generation
   * - Real-time performance metrics
   *
   * @param components - Array of atomic government components to activate
   *
   * @example
   * ```typescript
   * // Create a technocratic democracy with strong institutions
   * manager.setSelectedComponents([
   *   ComponentType.DEMOCRATIC_PROCESS,
   *   ComponentType.TECHNOCRATIC_PROCESS,      // Creates synergy
   *   ComponentType.PROFESSIONAL_BUREAUCRACY, // Creates synergy with technocratic
   *   ComponentType.RULE_OF_LAW,
   *   ComponentType.INDEPENDENT_JUDICIARY
   * ]);
   *
   * // This triggers:
   * // 1. Effectiveness calculation (85%+ with synergies)
   * // 2. Economic boost (GDP +15%, Tax collection +20%)
   * // 3. Auto-generated departments (Civil Service, Policy Analysis)
   * // 4. Intelligence alerts about optimization opportunities
   * ```
   */
  setSelectedComponents(components: ComponentType[]) {
    this.state.selectedComponents = components;
    this.builderStateManager.setSelectedComponents(components);
    this.recalculateAllSystems();
    this.notifyListeners();
  }

  /**
   * Add a single component
   */
  addComponent(component: ComponentType) {
    if (!this.state.selectedComponents.includes(component)) {
      this.setSelectedComponents([...this.state.selectedComponents, component]);
    }
  }

  /**
   * Remove a single component
   */
  removeComponent(component: ComponentType) {
    this.setSelectedComponents(this.state.selectedComponents.filter((c) => c !== component));
  }

  /**
   * Force recalculation of all systems
   */
  refreshAllCalculations() {
    this.recalculateAllSystems();
    this.notifyListeners();
  }

  /**
   * Get component effectiveness contribution
   */
  getComponentContribution(component: ComponentType): {
    effectiveness: number;
    economicImpact: number;
    taxImpact: number;
    structureImpact: string[];
  } {
    const componentInfo = this.getComponentEffectivenessData();
    const baseEffectiveness = componentInfo[component]?.effectiveness || 0;

    // Calculate specific impacts
    const economicImpact = this.calculateComponentEconomicImpact(component);
    const taxImpact = this.calculateComponentTaxImpact(component);
    const structureImpact = this.calculateComponentStructureImpact(component);

    return {
      effectiveness: baseEffectiveness,
      economicImpact,
      taxImpact,
      structureImpact,
    };
  }

  /**
   * Get system health overview
   */
  getSystemHealth(): {
    overall: "excellent" | "good" | "fair" | "poor";
    scores: {
      effectiveness: number;
      economicPerformance: number;
      governmentCapacity: number;
      stability: number;
    };
    issues: string[];
    recommendations: string[];
  } {
    const scores = {
      effectiveness: this.state.effectivenessScore,
      economicPerformance: this.state.economicPerformance.gdpGrowthMultiplier * 100,
      governmentCapacity: this.state.realTimeMetrics.governmentCapacity,
      stability: this.state.realTimeMetrics.crisisResiliency,
    };

    const avgScore =
      Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;

    const overall: "excellent" | "good" | "fair" | "poor" =
      avgScore >= 80 ? "excellent" : avgScore >= 65 ? "good" : avgScore >= 50 ? "fair" : "poor";

    const issues = this.identifySystemIssues();
    const recommendations = this.generateSystemRecommendations();

    return { overall, scores, issues, recommendations };
  }

  // Private Methods

  /**
   * Maps server-side AtomicEconomicModifiers to client-side simplified format.
   *
   * Server format has nested projections and trend data.
   * Client format needs flat numeric multipliers for UI calculations.
   *
   * @param server - Complex server-side economic modifiers
   * @returns Simplified client-side modifiers
   */
  private mapServerToClientModifiers(
    server: AtomicEconomicModifiers
  ): ClientAtomicEconomicModifiers {
    return {
      // Tax system effectiveness → collection multiplier
      taxCollectionMultiplier: server.taxEfficiency?.currentMultiplier ?? 1.0,

      // Current GDP impact as growth modifier percentage
      gdpGrowthModifier: (server.gdpImpact?.current ?? 0) / 100,

      // Stability as bonus percentage
      stabilityBonus: (server.stabilityIndex?.current ?? 0) / 100,

      // 1-year projection delta as innovation multiplier
      innovationMultiplier:
        1.0 + ((server.gdpImpact?.projected1Year ?? 0) - (server.gdpImpact?.current ?? 0)) / 100,

      // International trade effectiveness
      internationalTradeBonus: server.internationalStanding?.tradeBonus ?? 0,

      // Tax collection as government efficiency
      governmentEfficiencyMultiplier: server.taxEfficiency?.currentMultiplier ?? 1.0,

      // Optional simplified fields (for backward compatibility)
      gdpImpact: server.gdpImpact?.current,
      stabilityIndex: server.stabilityIndex?.current,
      internationalStanding: server.internationalStanding?.tradeBonus,
      taxEfficiency: server.taxEfficiency?.currentMultiplier,
    };
  }

  private syncFromBuilderState(builderState: AtomicBuilderState) {
    // Sync core state
    this.state.selectedComponents = builderState.selectedComponents;
    this.state.effectivenessScore = builderState.effectivenessScore;
    this.state.synergies = builderState.synergies;
    this.state.conflicts = builderState.conflicts;
    // Map AtomicEconomicModifiers to ClientAtomicEconomicModifiers
    this.state.economicModifiers = this.mapServerToClientModifiers(builderState.economicImpact);
    this.state.traditionalStructure = this.convertToDetailedStructure(
      builderState.traditionalStructure
    );

    // Trigger additional calculations
    this.recalculateExtendedSystems();
    this.notifyListeners();
  }

  private recalculateAllSystems() {
    this.calculateEffectiveness();
    this.calculateSynergiesAndConflicts();
    this.calculateEconomicIntegration();
    this.calculateTaxIntegration();
    this.generateGovernmentStructure();
    this.generateIntelligenceFeeds();
    this.updateRealTimeMetrics();
    this.updatePerformanceAnalytics();
  }

  private recalculateExtendedSystems() {
    this.calculateTaxIntegration();
    this.calculateEconomicIntegration();
    this.generateIntelligenceFeeds();
    this.updateRealTimeMetrics();
  }

  private calculateEffectiveness() {
    const { selectedComponents } = this.state;

    if (selectedComponents.length === 0) {
      this.state.effectivenessScore = 0;
      return;
    }

    // Base effectiveness calculation
    const componentInfo = this.getComponentEffectivenessData();
    let baseEffectiveness =
      selectedComponents.reduce((sum, comp) => {
        return sum + (componentInfo[comp]?.effectiveness || 50);
      }, 0) / selectedComponents.length;

    // Apply synergy bonuses and conflict penalties
    const synergyBonus = this.state.synergies.reduce(
      (sum, synergy) => sum + (synergy.modifier - 1) * 100,
      0
    );
    const conflictPenalty = this.state.conflicts.reduce(
      (sum, conflict) => sum + conflict.penalty * 100,
      0
    );

    // Country context modifiers
    const contextMultiplier = this.getCountryContextMultiplier();

    // Final calculation
    this.state.effectivenessScore = Math.max(
      0,
      Math.min(100, (baseEffectiveness + synergyBonus - conflictPenalty) * contextMultiplier)
    );
  }

  private calculateSynergiesAndConflicts() {
    const { selectedComponents } = this.state;

    // Calculate active synergies
    this.state.synergies = SYNERGY_RULES.filter((synergy) =>
      synergy.components.every((comp) => selectedComponents.includes(comp))
    );

    // Calculate active conflicts
    this.state.conflicts = CONFLICT_RULES.filter((conflict) =>
      conflict.components.every((comp) => selectedComponents.includes(comp))
    );
  }

  private calculateEconomicIntegration() {
    const { selectedComponents } = this.state;

    // Use client-safe atomic economic integration
    const economicImpact = calculateClientAtomicEconomicImpact(
      selectedComponents,
      15000, // Base GDP per capita
      0.2 // Base tax revenue
    );

    // Update economic modifiers
    this.state.economicModifiers = economicImpact;

    // Map to performance structure
    this.state.economicPerformance = {
      gdpGrowthMultiplier: economicImpact.gdpGrowthModifier,
      inflationControl: 0.8,
      tradeEfficiency: 1 + economicImpact.internationalTradeBonus / 100,
      investmentAttraction: economicImpact.innovationMultiplier,
    };
  }

  private calculateTaxIntegration() {
    const { selectedComponents } = this.state;

    // Use atomic tax integration library
    const taxResult = calculateAtomicTaxEffectiveness(selectedComponents, {
      collectionEfficiency: 0.85,
      complianceRate: 0.75,
      auditCapacity: 0.3,
    });

    this.state.taxEffectiveness = {
      collectionEfficiency: taxResult.collectionEfficiency,
      complianceRate: taxResult.complianceRate,
      auditCapacity: taxResult.auditCapacity,
      overallMultiplier: taxResult.effectivenessScore,
    };
  }

  private generateGovernmentStructure() {
    const { selectedComponents } = this.state;

    // Enhanced structure generation with more detail
    this.state.traditionalStructure = {
      governmentType: this.inferGovernmentType(selectedComponents),
      departments: this.generateDetailedDepartments(selectedComponents),
      executiveStructure: this.generateExecutiveStructure(selectedComponents),
      legislativeStructure: this.generateLegislativeStructure(selectedComponents),
      judicialStructure: this.generateJudicialStructure(selectedComponents),
      budgetAllocations: this.generateOptimizedBudgetAllocations(selectedComponents),
    };
  }

  private generateIntelligenceFeeds() {
    const { selectedComponents, effectivenessScore, synergies, conflicts, economicModifiers } =
      this.state;

    // Generate client-side intelligence feeds
    const feeds = [];
    const timestamp = Date.now();

    // Effectiveness alerts
    if (effectivenessScore < 50) {
      feeds.push({
        id: `effectiveness-low-${timestamp}`,
        type: "alert" as const,
        title: "Low Government Effectiveness",
        description: `Current effectiveness at ${effectivenessScore.toFixed(0)}%. Consider optimizing component selection.`,
        impact: "high" as const,
        source: "atomic_analysis" as const,
        timestamp,
        actionable: true,
      });
    }

    // Synergy opportunities
    if (synergies.length > 0) {
      feeds.push({
        id: `synergies-active-${timestamp}`,
        type: "opportunity" as const,
        title: "Active Component Synergies",
        description: `${synergies.length} beneficial synergies detected, boosting overall effectiveness.`,
        impact: "medium" as const,
        source: "atomic_analysis" as const,
        timestamp,
        actionable: false,
      });
    }

    // Conflict warnings
    if (conflicts.length > 0) {
      feeds.push({
        id: `conflicts-detected-${timestamp}`,
        type: "risk" as const,
        title: "Component Conflicts Detected",
        description: `${conflicts.length} component conflicts may reduce effectiveness. Consider adjustments.`,
        impact: "high" as const,
        source: "atomic_analysis" as const,
        timestamp,
        actionable: true,
      });
    }

    // Economic performance
    if (economicModifiers.gdpGrowthModifier > 1.1) {
      feeds.push({
        id: `economic-positive-${timestamp}`,
        type: "trend" as const,
        title: "Strong Economic Growth Potential",
        description: `Current configuration projects ${((economicModifiers.gdpGrowthModifier - 1) * 100).toFixed(1)}% GDP growth boost.`,
        impact: "medium" as const,
        source: "economic_model" as const,
        timestamp,
        actionable: false,
      });
    }

    // Tax efficiency
    if (economicModifiers.taxCollectionMultiplier > 1.15) {
      feeds.push({
        id: `tax-efficient-${timestamp}`,
        type: "opportunity" as const,
        title: "High Tax Collection Efficiency",
        description: `Government structure enables ${((economicModifiers.taxCollectionMultiplier - 1) * 100).toFixed(1)}% improvement in tax collection.`,
        impact: "medium" as const,
        source: "economic_model" as const,
        timestamp,
        actionable: false,
      });
    }

    this.state.intelligenceFeeds = feeds;
  }

  private updateRealTimeMetrics() {
    const { effectivenessScore, economicPerformance, taxEffectiveness, economicModifiers } =
      this.state;

    this.state.realTimeMetrics = {
      governmentCapacity: effectivenessScore,
      policyImplementationSpeed:
        effectivenessScore * 0.8 + economicPerformance.gdpGrowthMultiplier * 20,
      citizenSatisfaction: (effectivenessScore + taxEffectiveness.overallMultiplier * 50) / 2,
      internationalStanding: 50 + economicModifiers.internationalTradeBonus,
      crisisResiliency: Math.max(0, Math.min(100, 50 + economicModifiers.stabilityBonus)),
    };
  }

  private updatePerformanceAnalytics() {
    // Update historical effectiveness
    const now = new Date().toISOString();
    this.state.performanceAnalytics.historicalEffectiveness.push({
      date: now,
      score: this.state.effectivenessScore,
    });

    // Keep only last 30 entries
    if (this.state.performanceAnalytics.historicalEffectiveness.length > 30) {
      this.state.performanceAnalytics.historicalEffectiveness.shift();
    }

    // Update component performance
    this.state.selectedComponents.forEach((component) => {
      const contribution = this.getComponentContribution(component);
      this.state.performanceAnalytics.componentPerformance[component] = {
        effectiveness: contribution.effectiveness,
        utilizationRate: contribution.economicImpact + contribution.taxImpact,
      };
    });
  }

  private startRealTimeUpdates() {
    // Update metrics every 30 seconds
    this.updateInterval = setInterval(() => {
      this.updateRealTimeMetrics();
      this.updatePerformanceAnalytics();
      this.notifyListeners();
    }, 30000);
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  // Helper methods for calculations

  private calculateComponentEconomicImpact(component: ComponentType): number {
    // Component-specific economic impact logic
    const impacts: Record<ComponentType, number> = {
      [ComponentType.TECHNOCRATIC_PROCESS]: 0.15,
      [ComponentType.PROFESSIONAL_BUREAUCRACY]: 0.12,
      [ComponentType.RULE_OF_LAW]: 0.1,
      [ComponentType.TECHNOCRATIC_AGENCIES]: 0.14,
      // ... other components
    } as Record<ComponentType, number>;

    return impacts[component] || 0.05;
  }

  private calculateComponentTaxImpact(component: ComponentType): number {
    // Component-specific tax impact logic
    const impacts: Record<ComponentType, number> = {
      [ComponentType.PROFESSIONAL_BUREAUCRACY]: 0.25,
      [ComponentType.RULE_OF_LAW]: 0.2,
      [ComponentType.SURVEILLANCE_SYSTEM]: 0.18,
      // ... other components
    } as Record<ComponentType, number>;

    return impacts[component] || 0.03;
  }

  private calculateComponentStructureImpact(component: ComponentType): string[] {
    // Component-specific structure impact logic
    const impacts: Record<ComponentType, string[]> = {
      [ComponentType.PROFESSIONAL_BUREAUCRACY]: [
        "Civil Service Commission",
        "Administrative Excellence Department",
      ],
      [ComponentType.INDEPENDENT_JUDICIARY]: ["Supreme Court", "Judicial Services Commission"],
      [ComponentType.TECHNOCRATIC_AGENCIES]: [
        "Strategic Planning Agency",
        "Policy Analysis Bureau",
      ],
      // ... other components
    } as Record<ComponentType, string[]>;

    return impacts[component] || [];
  }

  private getCountryContextMultiplier(): number {
    const { countryContext } = this.state;
    let multiplier = 1.0;

    // Size adjustment
    if (countryContext.size === "small") multiplier *= 1.1;
    else if (countryContext.size === "large") multiplier *= 0.95;

    // Development level adjustment
    if (countryContext.developmentLevel === "developed") multiplier *= 1.05;
    else if (countryContext.developmentLevel === "developing") multiplier *= 0.9;

    return multiplier;
  }

  private identifySystemIssues(): string[] {
    const issues: string[] = [];

    if (this.state.conflicts.length > 0) {
      issues.push(`${this.state.conflicts.length} component conflicts detected`);
    }

    if (this.state.effectivenessScore < 50) {
      issues.push("Low overall effectiveness score");
    }

    if (this.state.taxEffectiveness.overallMultiplier < 0.8) {
      issues.push("Suboptimal tax collection efficiency");
    }

    return issues;
  }

  private generateSystemRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.state.synergies.length < 2) {
      recommendations.push("Consider adding components that create synergies");
    }

    if (!this.state.selectedComponents.includes(ComponentType.RULE_OF_LAW)) {
      recommendations.push("Rule of Law component provides strong stability benefits");
    }

    return recommendations;
  }

  // Default value generators (extensive implementation)
  private getDefaultEconomicModifiers(): ClientAtomicEconomicModifiers {
    return {
      taxCollectionMultiplier: 1.0,
      gdpGrowthModifier: 1.0,
      stabilityBonus: 0,
      innovationMultiplier: 1.0,
      internationalTradeBonus: 0,
      governmentEfficiencyMultiplier: 1.0,
      gdpImpact: 0,
      stabilityIndex: 50,
      internationalStanding: 50,
      taxEfficiency: 1.0,
    };
  }

  private getDefaultTaxEffectiveness() {
    return {
      collectionEfficiency: 0.85,
      complianceRate: 0.75,
      auditCapacity: 0.3,
      overallMultiplier: 0.8,
    };
  }

  private getDefaultEconomicPerformance() {
    return {
      gdpGrowthMultiplier: 1.0,
      inflationControl: 0.8,
      tradeEfficiency: 0.7,
      investmentAttraction: 0.6,
    };
  }

  private getDefaultTraditionalStructure() {
    return {
      governmentType: "Basic Government",
      departments: [],
      executiveStructure: [],
      legislativeStructure: [],
      judicialStructure: [],
      budgetAllocations: {},
    };
  }

  private getDefaultRealTimeMetrics() {
    return {
      governmentCapacity: 50,
      policyImplementationSpeed: 50,
      citizenSatisfaction: 50,
      internationalStanding: 50,
      crisisResiliency: 50,
    };
  }

  private getDefaultPerformanceAnalytics() {
    return {
      historicalEffectiveness: [],
      componentPerformance: {} as Record<
        ComponentType,
        { effectiveness: number; utilizationRate: number }
      >,
      benchmarkComparison: { rank: 0, percentile: 50, similarCountries: [] },
    };
  }

  private getDefaultCountryContext() {
    return {
      countryId: "",
      size: "medium" as const,
      developmentLevel: "emerging" as const,
      politicalTradition: "mixed" as const,
      primaryChallenges: [],
    };
  }

  // Additional helper methods for detailed structure generation
  private inferGovernmentType(components: ComponentType[]): string {
    if (components.includes(ComponentType.DEMOCRATIC_PROCESS)) {
      if (components.includes(ComponentType.FEDERAL_SYSTEM)) return "Federal Democracy";
      return "Parliamentary Democracy";
    }
    if (components.includes(ComponentType.AUTOCRATIC_PROCESS)) return "Autocratic Republic";
    if (components.includes(ComponentType.TECHNOCRATIC_PROCESS)) return "Technocratic State";
    return "Mixed Government";
  }

  private generateDetailedDepartments(components: ComponentType[]) {
    const departments = [
      { name: "Ministry of Interior", priority: 1, effectivenessBonus: 0 },
      { name: "Ministry of Finance", priority: 1, effectivenessBonus: 0 },
    ];

    if (components.includes(ComponentType.PROFESSIONAL_BUREAUCRACY)) {
      departments.push(
        { name: "Civil Service Commission", priority: 2, effectivenessBonus: 15 },
        { name: "Administrative Excellence Department", priority: 3, effectivenessBonus: 10 }
      );
    }

    if (components.includes(ComponentType.TECHNOCRATIC_AGENCIES)) {
      departments.push(
        { name: "Strategic Planning Agency", priority: 2, effectivenessBonus: 18 },
        { name: "Policy Analysis Bureau", priority: 3, effectivenessBonus: 12 }
      );
    }

    return departments;
  }

  private generateExecutiveStructure(components: ComponentType[]): string[] {
    const structure = ["Prime Minister", "Cabinet"];
    if (components.includes(ComponentType.TECHNOCRATIC_PROCESS)) {
      structure.push("Technical Advisory Council");
    }
    return structure;
  }

  private generateLegislativeStructure(components: ComponentType[]): string[] {
    const structure = ["National Assembly"];
    if (components.includes(ComponentType.FEDERAL_SYSTEM)) {
      structure.push("Senate", "Regional Assemblies");
    }
    return structure;
  }

  private generateJudicialStructure(components: ComponentType[]): string[] {
    const structure = ["Supreme Court"];
    if (components.includes(ComponentType.INDEPENDENT_JUDICIARY)) {
      structure.push("Constitutional Court", "Administrative Courts");
    }
    return structure;
  }

  private generateOptimizedBudgetAllocations(components: ComponentType[]): Record<string, number> {
    const budget: Record<string, number> = {
      administration: 20,
      defense: 15,
      education: 20,
      healthcare: 20,
      infrastructure: 15,
      other: 10,
    };

    if (components.includes(ComponentType.PROFESSIONAL_BUREAUCRACY)) {
      budget.administration += 5;
      budget.other -= 5;
    }

    if (components.includes(ComponentType.MILITARY_ADMINISTRATION)) {
      budget.defense += 10;
      budget.education -= 5;
      budget.other -= 5;
    }

    return budget;
  }

  private convertToDetailedStructure(basicStructure: any) {
    return {
      governmentType: basicStructure.governmentType || "Mixed Government",
      departments: (basicStructure.departments || []).map((name: string, index: number) => ({
        name,
        priority: index + 1,
        effectivenessBonus: 5,
      })),
      executiveStructure: basicStructure.executiveStructure || [],
      legislativeStructure: basicStructure.legislativeStructure || [],
      judicialStructure: basicStructure.judicialStructure || [],
      budgetAllocations: basicStructure.budgetAllocations || {},
    };
  }

  private getComponentEffectivenessData(): Partial<
    Record<ComponentType, { effectiveness: number }>
  > {
    return {
      [ComponentType.CENTRALIZED_POWER]: { effectiveness: 75 },
      [ComponentType.FEDERAL_SYSTEM]: { effectiveness: 70 },
      [ComponentType.CONFEDERATE_SYSTEM]: { effectiveness: 60 },
      [ComponentType.UNITARY_SYSTEM]: { effectiveness: 72 },
      [ComponentType.DEMOCRATIC_PROCESS]: { effectiveness: 68 },
      [ComponentType.AUTOCRATIC_PROCESS]: { effectiveness: 75 },
      [ComponentType.TECHNOCRATIC_PROCESS]: { effectiveness: 85 },
      [ComponentType.CONSENSUS_PROCESS]: { effectiveness: 60 },
      [ComponentType.OLIGARCHIC_PROCESS]: { effectiveness: 70 },
      [ComponentType.ELECTORAL_LEGITIMACY]: { effectiveness: 65 },
      [ComponentType.TRADITIONAL_LEGITIMACY]: { effectiveness: 70 },
      [ComponentType.PERFORMANCE_LEGITIMACY]: { effectiveness: 80 },
      [ComponentType.CHARISMATIC_LEGITIMACY]: { effectiveness: 75 },
      [ComponentType.RELIGIOUS_LEGITIMACY]: { effectiveness: 72 },
      [ComponentType.INSTITUTIONAL_LEGITIMACY]: { effectiveness: 83 },
      [ComponentType.PROFESSIONAL_BUREAUCRACY]: { effectiveness: 85 },
      [ComponentType.MILITARY_ADMINISTRATION]: { effectiveness: 78 },
      [ComponentType.INDEPENDENT_JUDICIARY]: { effectiveness: 80 },
      [ComponentType.PARTISAN_INSTITUTIONS]: { effectiveness: 65 },
      [ComponentType.TECHNOCRATIC_AGENCIES]: { effectiveness: 82 },
      [ComponentType.RULE_OF_LAW]: { effectiveness: 85 },
      [ComponentType.SURVEILLANCE_SYSTEM]: { effectiveness: 78 },
      [ComponentType.ECONOMIC_INCENTIVES]: { effectiveness: 73 },
      [ComponentType.SOCIAL_PRESSURE]: { effectiveness: 68 },
      [ComponentType.MILITARY_ENFORCEMENT]: { effectiveness: 80 },

      // New Government Type Components
      [ComponentType.DIGITAL_GOVERNMENT]: { effectiveness: 85 },
      [ComponentType.MINIMAL_GOVERNMENT]: { effectiveness: 60 },
      [ComponentType.PRIVATE_SECTOR_LEADERSHIP]: { effectiveness: 75 },
      [ComponentType.SOCIAL_DEMOCRACY]: { effectiveness: 78 },
      [ComponentType.COMPREHENSIVE_WELFARE]: { effectiveness: 72 },
      [ComponentType.PUBLIC_SECTOR_LEADERSHIP]: { effectiveness: 70 },
      [ComponentType.ENVIRONMENTAL_FOCUS]: { effectiveness: 68 },
      [ComponentType.ECONOMIC_PLANNING]: { effectiveness: 82 },
      [ComponentType.DEVELOPMENTAL_STATE]: { effectiveness: 83 },
      [ComponentType.WORKER_PROTECTION]: { effectiveness: 65 },
      [ComponentType.MERITOCRATIC_SYSTEM]: { effectiveness: 88 },
      [ComponentType.REGIONAL_DEVELOPMENT]: { effectiveness: 67 },
    };
  }

  // Cleanup
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.listeners = [];
  }
}
