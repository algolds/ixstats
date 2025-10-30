/**
 * Economic Archetype Service
 *
 * Provides access to economic archetypes and related utilities.
 * This service acts as a facade for the modular archetype system.
 */

import type {
  EconomicArchetype,
  ArchetypeCategory,
  ArchetypeComparison,
} from "../data/archetype-types";
import {
  allArchetypes,
  getArchetypeById,
  getArchetypesByCategory,
  searchArchetypes,
  filterArchetypes,
  getRecommendedArchetypes as getRecommendedArchetypesFromIndex,
  compareArchetypes as compareArchetypesFromIndex,
} from "../data/archetypes";
import {
  calculateArchetypeFit,
  findBestArchetype,
  getArchetypeRecommendations,
  compareArchetypes as compareArchetypesFromUtils,
  generateTransitionPlan,
} from "../utils/archetype-utilities";
import {
  calculateSynergyScore,
  detectConflicts,
  generateComparisonMetrics,
  rankArchetypes,
} from "../utils/archetype-comparison";
import {
  getRecommendedArchetype,
  generateImplementationSteps,
  calculateTransitionCost,
  calculateTransitionComplexity,
  identifyKeySuccessFactors,
  generateWarningsAndRisks,
} from "../utils/archetype-recommendations";

// Re-export types for backward compatibility
export type {
  EconomicArchetype,
  ArchetypeCategory,
  ArchetypeComparison,
} from "../data/archetype-types";

/**
 * Economic Archetype Service
 * Provides a unified interface for working with economic archetypes
 */
export class EconomicArchetypeService {
  private static instance: EconomicArchetypeService;

  private constructor() {}

  /**
   * Get singleton instance of the service
   */
  public static getInstance(): EconomicArchetypeService {
    if (!EconomicArchetypeService.instance) {
      EconomicArchetypeService.instance = new EconomicArchetypeService();
    }
    return EconomicArchetypeService.instance;
  }

  /**
   * Get all available archetypes
   */
  public getAllArchetypes(): Map<string, EconomicArchetype> {
    return allArchetypes;
  }

  /**
   * Get a specific archetype by ID
   */
  public getArchetype(id: string): EconomicArchetype | undefined {
    return getArchetypeById(id);
  }

  /**
   * Get archetypes by category
   */
  public getArchetypesByCategory(category: ArchetypeCategory): EconomicArchetype[] {
    return getArchetypesByCategory(category);
  }

  /**
   * Search archetypes by query string
   */
  public searchArchetypes(query: string): EconomicArchetype[] {
    return searchArchetypes(query);
  }

  /**
   * Filter archetypes by multiple criteria
   */
  public filterArchetypes(filters: {
    region?: string;
    complexity?: "low" | "medium" | "high";
    minGdpGrowth?: number;
    minInnovation?: number;
    requiredComponents?: string[];
  }): EconomicArchetype[] {
    return filterArchetypes(filters);
  }

  /**
   * Calculate how well an archetype fits current economic state
   */
  public calculateArchetypeFit(archetype: EconomicArchetype, currentState: any): number {
    return calculateArchetypeFit(archetype, currentState);
  }

  /**
   * Find the best matching archetype for current state
   */
  public findBestArchetype(
    currentState: any,
    archetypes?: Map<string, EconomicArchetype>
  ): { archetype: EconomicArchetype; fitScore: number } | null {
    const archetypeArray = archetypes
      ? Array.from(archetypes.values())
      : Array.from(allArchetypes.values());
    return findBestArchetype(archetypeArray, currentState);
  }

  /**
   * Get archetype recommendations based on preferences
   */
  public getArchetypeRecommendations(
    currentState: any,
    preferences?: {
      maxComplexity?: "low" | "medium" | "high";
      minFitScore?: number;
      focusAreas?: ("growth" | "stability" | "innovation" | "equity")[];
      growthFocus?: boolean;
      stabilityFocus?: boolean;
      innovationFocus?: boolean;
      equityFocus?: boolean;
      complexity?: "low" | "medium" | "high";
    },
    archetypes?: Map<string, EconomicArchetype>
  ): Array<{
    archetype: EconomicArchetype;
    fitScore: number;
    reasons: string[];
  }> {
    const archetypeArray = archetypes
      ? Array.from(archetypes.values())
      : Array.from(allArchetypes.values());
    return getArchetypeRecommendations(archetypeArray, currentState, preferences);
  }

  /**
   * Compare multiple archetypes
   */
  public compareArchetypes(archetypeIds: string[]): ArchetypeComparison | null {
    const archetypes = archetypeIds
      .map((id) => getArchetypeById(id))
      .filter((a): a is EconomicArchetype => a !== undefined);
    if (archetypes.length === 0) return null;
    return compareArchetypesFromUtils(archetypes);
  }

  /**
   * Generate transition plan from current state to target archetype
   */
  public generateTransitionPlan(currentState: any, targetArchetype: EconomicArchetype): any {
    return generateTransitionPlan(currentState, targetArchetype);
  }

  /**
   * Calculate synergy score for an archetype
   */
  public calculateSynergyScore(archetype: EconomicArchetype): number {
    return calculateSynergyScore(archetype);
  }

  /**
   * Detect conflicts within an archetype
   */
  public detectConflicts(archetype: EconomicArchetype): string[] {
    return detectConflicts(archetype);
  }

  /**
   * Generate comparison metrics for an archetype
   */
  public generateComparisonMetrics(archetype: EconomicArchetype): any {
    return generateComparisonMetrics(archetype);
  }

  /**
   * Rank archetypes based on preferences
   */
  public rankArchetypes(
    archetypes: EconomicArchetype[],
    preferences?: any
  ): Array<{
    archetype: EconomicArchetype;
    score: number;
    strengths: string[];
    weaknesses: string[];
  }> {
    return rankArchetypes(archetypes, preferences);
  }

  /**
   * Get recommended archetype based on country characteristics
   */
  public getRecommendedArchetype(
    countryCharacteristics: any,
    preferences?: {
      focusArea?: "growth" | "stability" | "innovation" | "equity";
      riskTolerance?: "low" | "medium" | "high";
      timeHorizon?: "short" | "medium" | "long";
    }
  ): any {
    return getRecommendedArchetype(countryCharacteristics, preferences);
  }

  /**
   * Generate implementation steps for archetype transition
   */
  public generateImplementationSteps(targetArchetype: EconomicArchetype, currentState: any): any {
    return generateImplementationSteps(targetArchetype, currentState);
  }

  /**
   * Calculate transition cost to target archetype
   */
  public calculateTransitionCost(
    targetArchetype: EconomicArchetype,
    currentState: any,
    currentGDP: number
  ): any {
    return calculateTransitionCost(targetArchetype, currentState, currentGDP);
  }

  /**
   * Calculate transition complexity
   */
  public calculateTransitionComplexity(targetArchetype: EconomicArchetype, currentState: any): any {
    return calculateTransitionComplexity(targetArchetype, currentState);
  }

  /**
   * Identify key success factors for archetype implementation
   */
  public identifyKeySuccessFactors(targetArchetype: EconomicArchetype, currentState: any): any {
    return identifyKeySuccessFactors(targetArchetype, currentState);
  }

  /**
   * Generate warnings and risks for archetype transition
   */
  public generateWarningsAndRisks(
    targetArchetype: EconomicArchetype,
    currentState: any,
    complexity: any
  ): any {
    return generateWarningsAndRisks(targetArchetype, currentState, complexity);
  }

  /**
   * Get archetypes suitable for a specific region
   */
  public getArchetypesForRegion(region: string): EconomicArchetype[] {
    return this.filterArchetypes({ region });
  }

  /**
   * Get archetypes by implementation complexity
   */
  public getArchetypesByComplexity(complexity: "low" | "medium" | "high"): EconomicArchetype[] {
    return this.filterArchetypes({ complexity });
  }

  /**
   * Get high-growth archetypes
   */
  public getHighGrowthArchetypes(minGrowth: number = 3): EconomicArchetype[] {
    return this.filterArchetypes({ minGdpGrowth: minGrowth });
  }

  /**
   * Get innovation-focused archetypes
   */
  public getInnovationArchetypes(minScore: number = 80): EconomicArchetype[] {
    return this.filterArchetypes({ minInnovation: minScore });
  }

  /**
   * Validate archetype configuration
   */
  public validateArchetype(archetype: Partial<EconomicArchetype>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!archetype.id) errors.push("Archetype ID is required");
    if (!archetype.name) errors.push("Archetype name is required");
    if (!archetype.description) errors.push("Archetype description is required");
    if (!archetype.economicComponents || archetype.economicComponents.length === 0) {
      errors.push("At least one economic component is required");
    }
    if (!archetype.governmentComponents || archetype.governmentComponents.length === 0) {
      errors.push("At least one government component is required");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export archetype data for analysis
   */
  public exportArchetypeData(archetypeId: string): any {
    const archetype = this.getArchetype(archetypeId);
    if (!archetype) return null;

    return {
      ...archetype,
      metrics: this.generateComparisonMetrics(archetype),
      synergy: this.calculateSynergyScore(archetype),
      conflicts: this.detectConflicts(archetype),
      successFactors: this.identifyKeySuccessFactors(archetype, {}),
    };
  }
}

// Export singleton instance
export const economicArchetypeService = EconomicArchetypeService.getInstance();
