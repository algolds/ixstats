/**
 * Embassy Synergy Calculator
 *
 * Business logic for calculating atomic government component synergies
 * between countries in the diplomatic network. Synergies are based on
 * shared atomic government components and provide economic, diplomatic,
 * and cultural bonuses.
 *
 * Phase 4 Migration: Enhanced with database synergy support and fallback to hardcoded data.
 *
 * @module synergy-calculator
 */

import type { Embassy } from "~/types/diplomatic-network";
import { ATOMIC_COMPONENTS } from "./atomic-government-data";
import type { ComponentType } from "@prisma/client";

/**
 * Atomic government component used in synergy calculations
 */
export interface AtomicComponent {
  componentType: string;
  effectivenessScore: number;
}

/**
 * Synergy calculation result for a specific category
 *
 * @property category - The government component category (e.g., "Power Structure")
 * @property matchScore - Overall synergy match score (0-100)
 * @property sharedComponents - List of shared component names in this category
 * @property benefits - Calculated benefits from this synergy
 * @property benefits.economic - Economic growth bonus percentage
 * @property benefits.diplomatic - Diplomatic relations bonus percentage
 * @property benefits.cultural - Cultural influence bonus percentage
 */
export interface AtomicSynergy {
  category: string;
  matchScore: number;
  sharedComponents: string[];
  benefits: {
    economic: number;
    diplomatic: number;
    cultural: number;
  };
}

/**
 * Component categories for synergy calculation
 *
 * Groups atomic government components into five main categories:
 * - Power Structure: How power is distributed (centralized, federal, etc.)
 * - Decision Making: How decisions are made (democratic, autocratic, etc.)
 * - Legitimacy: Source of government authority (electoral, traditional, etc.)
 * - Institutions: Key governmental bodies (bureaucracy, judiciary, etc.)
 * - Control: Mechanisms of social order (rule of law, security, etc.)
 */
export const COMPONENT_CATEGORIES: Record<string, string[]> = {
  "Power Structure": [
    "CENTRALIZED_POWER",
    "FEDERAL_SYSTEM",
    "CONFEDERATE_SYSTEM",
    "UNITARY_SYSTEM",
  ],
  "Decision Making": [
    "DEMOCRATIC_PROCESS",
    "AUTOCRATIC_PROCESS",
    "TECHNOCRATIC_PROCESS",
    "CONSENSUS_PROCESS",
    "OLIGARCHIC_PROCESS",
  ],
  Legitimacy: [
    "ELECTORAL_LEGITIMACY",
    "TRADITIONAL_LEGITIMACY",
    "PERFORMANCE_LEGITIMACY",
    "CHARISMATIC_LEGITIMACY",
    "RELIGIOUS_LEGITIMACY",
  ],
  Institutions: [
    "PROFESSIONAL_BUREAUCRACY",
    "MILITARY_ADMINISTRATION",
    "INDEPENDENT_JUDICIARY",
    "PARTISAN_INSTITUTIONS",
    "TECHNOCRATIC_AGENCIES",
  ],
  Control: [
    "RULE_OF_LAW",
    "SURVEILLANCE_SYSTEM",
    "PROPAGANDA_APPARATUS",
    "SECURITY_FORCES",
    "CIVIL_SOCIETY",
  ],
};

/**
 * Calculate atomic synergies between two countries
 *
 * Analyzes shared atomic government components between the viewer's country
 * and an embassy partner country to determine synergy bonuses. Higher synergies
 * occur when countries share similar governance structures and those structures
 * are effective.
 *
 * Algorithm:
 * 1. Groups viewer's components by category
 * 2. For each category, calculates average component effectiveness
 * 3. Combines component effectiveness with embassy strength
 * 4. Generates synergy bonuses (economic, diplomatic, cultural) based on match score
 * 5. Filters out low-scoring synergies (< 30% match)
 *
 * @param myComponents - Viewer's country atomic government components
 * @param embassy - Embassy relationship to calculate synergies for
 * @returns Array of synergy calculations by category
 *
 * @example
 * ```typescript
 * const synergies = calculateAtomicSynergies(myComponents, embassy);
 * const totalEconomicBonus = synergies.reduce((sum, s) => sum + s.benefits.economic, 0);
 * ```
 */
export function calculateAtomicSynergies(
  myComponents: AtomicComponent[] | undefined,
  embassy: Embassy,
  dbSynergies?: DatabaseSynergy[]
): AtomicSynergy[] {
  // Early return if no components available
  if (!myComponents || myComponents.length === 0) {
    return [];
  }

  const synergies: AtomicSynergy[] = [];

  // Calculate synergies for each component category
  Object.entries(COMPONENT_CATEGORIES).forEach(([categoryName, categoryComponents]) => {
    // Find viewer's components that match this category
    const myMatchingComponents = myComponents.filter((c) =>
      categoryComponents.includes(c.componentType)
    );

    if (myMatchingComponents.length > 0) {
      // Calculate average effectiveness of matching components
      const avgEffectiveness =
        myMatchingComponents.reduce((sum, c) => sum + c.effectivenessScore, 0) /
        myMatchingComponents.length;

      // Calculate match score (0-100) based on component effectiveness and embassy strength
      // Higher embassy strength and component effectiveness = higher synergy
      const matchScore = Math.min(100, (avgEffectiveness + embassy.strength) / 2);

      // Only include synergies above threshold (30%)
      if (matchScore > 30) {
        synergies.push({
          category: categoryName,
          matchScore,
          // Format component names for display (SNAKE_CASE -> Title Case)
          sharedComponents: myMatchingComponents.map((c) =>
            c.componentType
              .replace(/_/g, " ")
              .toLowerCase()
              .replace(/\b\w/g, (l) => l.toUpperCase())
          ),
          // Calculate benefits as percentages based on match score
          benefits: {
            economic: matchScore * 0.04, // 4% per 100 match points
            diplomatic: matchScore * 0.06, // 6% per 100 match points
            cultural: matchScore * 0.03, // 3% per 100 match points
          },
        });
      }
    }
  });

  return synergies;
}

/**
 * Database synergy from API
 */
export interface DatabaseSynergy {
  component1: ComponentType;
  component2: ComponentType;
  synergyType: "STRONG" | "MODERATE" | "WEAK" | "CONFLICT";
  bonusPercent: number;
  description?: string;
}

/**
 * Get synergies for a component type from database or fallback data
 *
 * This function queries database synergies if available, otherwise falls back
 * to extracting synergies/conflicts from ATOMIC_COMPONENTS hardcoded data.
 *
 * @param componentType - The component to get synergies for
 * @param dbSynergies - Optional database synergies from API
 * @returns Array of synergy relationships
 *
 * @example
 * ```typescript
 * // With database synergies
 * const synergies = getSynergiesFromDatabase(
 *   ComponentType.DEMOCRATIC_PROCESS,
 *   dbSynergiesFromAPI
 * );
 *
 * // Fallback mode
 * const synergies = getSynergiesFromDatabase(ComponentType.DEMOCRATIC_PROCESS);
 * ```
 */
export function getSynergiesFromDatabase(
  componentType: ComponentType,
  dbSynergies?: DatabaseSynergy[]
): DatabaseSynergy[] {
  // Use database synergies if available
  if (dbSynergies && dbSynergies.length > 0) {
    return dbSynergies.filter(
      (synergy) => synergy.component1 === componentType || synergy.component2 === componentType
    );
  }

  // Fallback to hardcoded ATOMIC_COMPONENTS data
  const component = ATOMIC_COMPONENTS[componentType];
  if (!component) {
    console.warn(
      `[getSynergiesFromDatabase] Component ${componentType} not found in ATOMIC_COMPONENTS`
    );
    return [];
  }

  const fallbackSynergies: DatabaseSynergy[] = [];

  // Extract positive synergies
  component.synergies.forEach((synergyType) => {
    fallbackSynergies.push({
      component1: componentType,
      component2: synergyType,
      synergyType: "STRONG",
      bonusPercent: 15,
      description: `Strong synergy between ${component.name} and ${ATOMIC_COMPONENTS[synergyType]?.name || synergyType}`,
    });
  });

  // Extract conflicts
  component.conflicts.forEach((conflictType) => {
    fallbackSynergies.push({
      component1: componentType,
      component2: conflictType,
      synergyType: "CONFLICT",
      bonusPercent: -20,
      description: `Conflict between ${component.name} and ${ATOMIC_COMPONENTS[conflictType]?.name || conflictType}`,
    });
  });

  return fallbackSynergies;
}

/**
 * Calculate synergy bonus for a set of components
 *
 * @param selectedComponents - Array of selected component types
 * @param dbSynergies - Optional database synergies
 * @returns Total synergy bonus percentage
 */
export function calculateSynergyBonus(
  selectedComponents: ComponentType[],
  dbSynergies?: DatabaseSynergy[]
): number {
  let totalBonus = 0;
  const processedPairs = new Set<string>();

  selectedComponents.forEach((comp1) => {
    const synergies = getSynergiesFromDatabase(comp1, dbSynergies);

    synergies.forEach((synergy) => {
      // Only count if both components are selected
      const hasComp2 = selectedComponents.includes(synergy.component2);
      if (!hasComp2) return;

      // Avoid counting the same pair twice (A->B and B->A)
      const pairKey = [comp1, synergy.component2].sort().join("|");
      if (processedPairs.has(pairKey)) return;

      processedPairs.add(pairKey);
      totalBonus += synergy.bonusPercent;
    });
  });

  return totalBonus;
}
