/**
 * Archetype Comparison Utilities
 *
 * Provides comparison, scoring, and ranking logic for economic archetypes.
 * Extracted from EconomicArchetypeService for reusability.
 */

import type { EconomicArchetype } from "../services/EconomicArchetypeService";
import { EconomicComponentType } from "~/lib/atomic-economic-data";
import { ComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";

export interface ArchetypeComparison {
  archetypes: EconomicArchetype[];
  comparisonMetrics: {
    gdpGrowth: Record<string, number>;
    innovationIndex: Record<string, number>;
    competitiveness: Record<string, number>;
    stability: Record<string, number>;
    taxEfficiency: Record<string, number>;
  };
  recommendations: string[];
  synergyScores?: Record<string, number>;
  conflicts?: Array<{
    archetypeId: string;
    conflicts: string[];
  }>;
}

export interface ComparisonMetrics {
  overallScore: number;
  growthScore: number;
  stabilityScore: number;
  innovationScore: number;
  competitivenessScore: number;
  taxEfficiencyScore: number;
  synergyScore: number;
  conflictPenalty: number;
}

export interface ArchetypeRanking {
  archetype: EconomicArchetype;
  rank: number;
  score: number;
  metrics: ComparisonMetrics;
  strengths: string[];
  weaknesses: string[];
}

export interface SynergyAnalysis {
  archetypeId: string;
  economicSynergies: Array<{
    component: EconomicComponentType;
    synergyWith: EconomicComponentType[];
    score: number;
  }>;
  governmentSynergies: Array<{
    component: ComponentType;
    synergyWith: ComponentType[];
    score: number;
  }>;
  totalSynergyScore: number;
}

export interface ConflictAnalysis {
  archetypeId: string;
  economicConflicts: Array<{
    component: EconomicComponentType;
    conflictsWith: EconomicComponentType[];
    severity: "low" | "medium" | "high";
  }>;
  governmentConflicts: Array<{
    component: ComponentType;
    conflictsWith: ComponentType[];
    severity: "low" | "medium" | "high";
  }>;
  totalConflictPenalty: number;
}

// Economic component synergy definitions
const ECONOMIC_SYNERGIES: Partial<Record<EconomicComponentType, EconomicComponentType[]>> = {
  [EconomicComponentType.INNOVATION_ECONOMY]: [
    EconomicComponentType.KNOWLEDGE_ECONOMY,
    EconomicComponentType.TECHNOLOGY_FOCUSED,
    EconomicComponentType.RESEARCH_AND_DEVELOPMENT,
    EconomicComponentType.HIGH_SKILLED_WORKERS,
    EconomicComponentType.VENTURE_CAPITAL,
  ],
  [EconomicComponentType.KNOWLEDGE_ECONOMY]: [
    EconomicComponentType.INNOVATION_ECONOMY,
    EconomicComponentType.EDUCATION_FOCUSED,
    EconomicComponentType.HIGH_SKILLED_WORKERS,
    EconomicComponentType.INTELLECTUAL_PROPERTY,
  ],
  [EconomicComponentType.TECHNOLOGY_FOCUSED]: [
    EconomicComponentType.INNOVATION_ECONOMY,
    EconomicComponentType.RESEARCH_AND_DEVELOPMENT,
    EconomicComponentType.HIGH_SKILLED_WORKERS,
    EconomicComponentType.VENTURE_CAPITAL,
  ],
  [EconomicComponentType.MANUFACTURING_LED]: [
    EconomicComponentType.EXPORT_ORIENTED,
    EconomicComponentType.VOCATIONAL_TRAINING,
    EconomicComponentType.SKILL_BASED,
  ],
  [EconomicComponentType.EXPORT_ORIENTED]: [
    EconomicComponentType.MANUFACTURING_LED,
    EconomicComponentType.FREE_TRADE,
    EconomicComponentType.COMPETITIVE_MARKETS,
  ],
  [EconomicComponentType.SOCIAL_MARKET_ECONOMY]: [
    EconomicComponentType.MIXED_ECONOMY,
    EconomicComponentType.PROTECTED_WORKERS,
    EconomicComponentType.EDUCATION_FOCUSED,
    EconomicComponentType.HEALTHCARE_FOCUSED,
  ],
  [EconomicComponentType.FREE_MARKET_SYSTEM]: [
    EconomicComponentType.FLEXIBLE_LABOR,
    EconomicComponentType.FREE_TRADE,
    EconomicComponentType.COMPETITIVE_MARKETS,
  ],
  [EconomicComponentType.GREEN_ECONOMY]: [
    EconomicComponentType.INNOVATION_ECONOMY,
    EconomicComponentType.EDUCATION_FOCUSED,
  ],
  [EconomicComponentType.FINANCE_CENTERED]: [
    EconomicComponentType.SERVICE_BASED,
    EconomicComponentType.FREE_MARKET_SYSTEM,
  ],
  [EconomicComponentType.STATE_CAPITALISM]: [
    EconomicComponentType.PLANNED_ECONOMY,
    EconomicComponentType.RESOURCE_BASED_ECONOMY,
  ],
  // Add defaults for remaining components
  [EconomicComponentType.MIXED_ECONOMY]: [],
  [EconomicComponentType.PROTECTED_WORKERS]: [],
  [EconomicComponentType.FLEXIBLE_LABOR]: [],
  [EconomicComponentType.STARTUP_ECOSYSTEM]: [],
  [EconomicComponentType.FREE_TRADE]: [],
  [EconomicComponentType.HIGH_SKILLED_WORKERS]: [],
  [EconomicComponentType.INTELLECTUAL_PROPERTY]: [],
  [EconomicComponentType.VENTURE_CAPITAL]: [],
  [EconomicComponentType.BALANCED_TRADE]: [],
  [EconomicComponentType.EDUCATION_FOCUSED]: [],
  [EconomicComponentType.HEALTHCARE_FOCUSED]: [],
  [EconomicComponentType.RESEARCH_AND_DEVELOPMENT]: [],
  [EconomicComponentType.COMPETITIVE_MARKETS]: [],
  [EconomicComponentType.SERVICE_BASED]: [],
  [EconomicComponentType.AGRICULTURE_LED]: [],
  [EconomicComponentType.RESOURCE_BASED_ECONOMY]: [],
  [EconomicComponentType.EXTRACTION_FOCUSED]: [],
  [EconomicComponentType.VOCATIONAL_TRAINING]: [],
  [EconomicComponentType.SKILL_BASED]: [],
  [EconomicComponentType.PLANNED_ECONOMY]: [],
  [EconomicComponentType.DOMESTIC_FOCUSED]: [],
  [EconomicComponentType.TOURISM_BASED]: [],
  [EconomicComponentType.PROTECTIONIST]: [],
  [EconomicComponentType.TRADE_BLOC]: [],
  [EconomicComponentType.TECH_TRANSFER]: [],
  [EconomicComponentType.RULE_OF_LAW]: [],
};

// Economic component conflicts
const ECONOMIC_CONFLICTS: Partial<
  Record<
    EconomicComponentType,
    Array<{ component: EconomicComponentType; severity: "low" | "medium" | "high" }>
  >
> = {
  [EconomicComponentType.FREE_MARKET_SYSTEM]: [
    { component: EconomicComponentType.PLANNED_ECONOMY, severity: "high" },
    { component: EconomicComponentType.STATE_CAPITALISM, severity: "medium" },
    { component: EconomicComponentType.PROTECTIONIST, severity: "medium" },
  ],
  [EconomicComponentType.PLANNED_ECONOMY]: [
    { component: EconomicComponentType.FREE_MARKET_SYSTEM, severity: "high" },
    { component: EconomicComponentType.FREE_TRADE, severity: "high" },
    { component: EconomicComponentType.FLEXIBLE_LABOR, severity: "medium" },
  ],
  [EconomicComponentType.FLEXIBLE_LABOR]: [
    { component: EconomicComponentType.PROTECTED_WORKERS, severity: "high" },
    { component: EconomicComponentType.PLANNED_ECONOMY, severity: "medium" },
  ],
  [EconomicComponentType.PROTECTED_WORKERS]: [
    { component: EconomicComponentType.FLEXIBLE_LABOR, severity: "high" },
    { component: EconomicComponentType.FREE_MARKET_SYSTEM, severity: "low" },
  ],
  [EconomicComponentType.FREE_TRADE]: [
    { component: EconomicComponentType.PROTECTIONIST, severity: "high" },
    { component: EconomicComponentType.PLANNED_ECONOMY, severity: "high" },
  ],
  [EconomicComponentType.PROTECTIONIST]: [
    { component: EconomicComponentType.FREE_TRADE, severity: "high" },
    { component: EconomicComponentType.EXPORT_ORIENTED, severity: "medium" },
  ],
  [EconomicComponentType.EXPORT_ORIENTED]: [
    { component: EconomicComponentType.DOMESTIC_FOCUSED, severity: "medium" },
  ],
  [EconomicComponentType.DOMESTIC_FOCUSED]: [
    { component: EconomicComponentType.EXPORT_ORIENTED, severity: "medium" },
  ],
  // Add defaults for remaining components
  [EconomicComponentType.INNOVATION_ECONOMY]: [],
  [EconomicComponentType.KNOWLEDGE_ECONOMY]: [],
  [EconomicComponentType.TECHNOLOGY_FOCUSED]: [],
  [EconomicComponentType.MANUFACTURING_LED]: [],
  [EconomicComponentType.SOCIAL_MARKET_ECONOMY]: [],
  [EconomicComponentType.MIXED_ECONOMY]: [],
  [EconomicComponentType.STARTUP_ECOSYSTEM]: [],
  [EconomicComponentType.HIGH_SKILLED_WORKERS]: [],
  [EconomicComponentType.INTELLECTUAL_PROPERTY]: [],
  [EconomicComponentType.VENTURE_CAPITAL]: [],
  [EconomicComponentType.BALANCED_TRADE]: [],
  [EconomicComponentType.EDUCATION_FOCUSED]: [],
  [EconomicComponentType.HEALTHCARE_FOCUSED]: [],
  [EconomicComponentType.RESEARCH_AND_DEVELOPMENT]: [],
  [EconomicComponentType.COMPETITIVE_MARKETS]: [],
  [EconomicComponentType.SERVICE_BASED]: [],
  [EconomicComponentType.AGRICULTURE_LED]: [],
  [EconomicComponentType.RESOURCE_BASED_ECONOMY]: [],
  [EconomicComponentType.EXTRACTION_FOCUSED]: [],
  [EconomicComponentType.VOCATIONAL_TRAINING]: [],
  [EconomicComponentType.SKILL_BASED]: [],
  [EconomicComponentType.TOURISM_BASED]: [],
  [EconomicComponentType.TRADE_BLOC]: [],
  [EconomicComponentType.TECH_TRANSFER]: [],
  [EconomicComponentType.RULE_OF_LAW]: [],
  [EconomicComponentType.GREEN_ECONOMY]: [],
  [EconomicComponentType.FINANCE_CENTERED]: [],
  [EconomicComponentType.STATE_CAPITALISM]: [],
};

// Government component synergies
const GOVERNMENT_SYNERGIES: Partial<Record<ComponentType, ComponentType[]>> = {
  [ComponentType.DEMOCRATIC_PROCESS]: [
    ComponentType.RULE_OF_LAW,
    ComponentType.MINORITY_RIGHTS,
    ComponentType.PUBLIC_EDUCATION,
  ],
  [ComponentType.CENTRALIZED_POWER]: [
    ComponentType.TECHNOCRATIC_PROCESS,
    ComponentType.STRATEGIC_PLANNING,
  ],
  [ComponentType.FEDERAL_SYSTEM]: [ComponentType.DEMOCRATIC_PROCESS],
  [ComponentType.SOCIAL_DEMOCRACY]: [
    ComponentType.SOCIAL_SAFETY_NET,
    ComponentType.WORKER_PROTECTION,
    ComponentType.PUBLIC_EDUCATION,
  ],
  // Add defaults for remaining components - this is a partial list
  [ComponentType.AUTOCRATIC_PROCESS]: [],
  [ComponentType.OLIGARCHIC_PROCESS]: [],
  [ComponentType.CONSENSUS_PROCESS]: [],
  [ComponentType.TECHNOCRATIC_PROCESS]: [],
  [ComponentType.RULE_OF_LAW]: [],
  [ComponentType.MINORITY_RIGHTS]: [],
  [ComponentType.SOCIAL_SAFETY_NET]: [],
  [ComponentType.WORKER_PROTECTION]: [],
  [ComponentType.PUBLIC_EDUCATION]: [],
  [ComponentType.ENVIRONMENTAL_PROTECTION]: [],
  [ComponentType.STRATEGIC_PLANNING]: [],
  [ComponentType.MILITARY_ADMINISTRATION]: [],
  [ComponentType.PROFESSIONAL_BUREAUCRACY]: [],
  [ComponentType.TECHNOCRATIC_AGENCIES]: [],
  [ComponentType.TRADITIONAL_LEGITIMACY]: [],
  [ComponentType.PERFORMANCE_LEGITIMACY]: [],
  [ComponentType.CULTURAL_PRESERVATION]: [],
  [ComponentType.ECONOMIC_INCENTIVES]: [],
  [ComponentType.FREE_MARKET_SYSTEM]: [],
  [ComponentType.STATE_CAPITALISM]: [],
  [ComponentType.SOCIAL_MARKET_ECONOMY]: [],
  [ComponentType.PLANNED_ECONOMY]: [],
  [ComponentType.CONFEDERATE_SYSTEM]: [],
  [ComponentType.MERIT_BASED_SYSTEM]: [],
  [ComponentType.SECURITY_ALLIANCES]: [],
  [ComponentType.MILITARY_ENFORCEMENT]: [],
  [ComponentType.INNOVATION_ECOSYSTEM]: [],
};

// Government component conflicts
const GOVERNMENT_CONFLICTS: Partial<
  Record<ComponentType, Array<{ component: ComponentType; severity: "low" | "medium" | "high" }>>
> = {
  [ComponentType.DEMOCRATIC_PROCESS]: [
    { component: ComponentType.AUTOCRATIC_PROCESS, severity: "high" },
    { component: ComponentType.MILITARY_ADMINISTRATION, severity: "high" },
  ],
  [ComponentType.AUTOCRATIC_PROCESS]: [
    { component: ComponentType.DEMOCRATIC_PROCESS, severity: "high" },
    { component: ComponentType.CONSENSUS_PROCESS, severity: "high" },
  ],
  [ComponentType.CENTRALIZED_POWER]: [
    { component: ComponentType.FEDERAL_SYSTEM, severity: "medium" },
  ],
  [ComponentType.FEDERAL_SYSTEM]: [
    { component: ComponentType.CENTRALIZED_POWER, severity: "medium" },
  ],
  [ComponentType.FREE_MARKET_SYSTEM]: [
    { component: ComponentType.PLANNED_ECONOMY, severity: "high" },
    { component: ComponentType.STATE_CAPITALISM, severity: "medium" },
  ],
  [ComponentType.PLANNED_ECONOMY]: [
    { component: ComponentType.FREE_MARKET_SYSTEM, severity: "high" },
  ],
  // Add defaults for remaining components
  [ComponentType.OLIGARCHIC_PROCESS]: [],
  [ComponentType.CONSENSUS_PROCESS]: [],
  [ComponentType.TECHNOCRATIC_PROCESS]: [],
  [ComponentType.RULE_OF_LAW]: [],
  [ComponentType.MINORITY_RIGHTS]: [],
  [ComponentType.SOCIAL_SAFETY_NET]: [],
  [ComponentType.WORKER_PROTECTION]: [],
  [ComponentType.PUBLIC_EDUCATION]: [],
  [ComponentType.ENVIRONMENTAL_PROTECTION]: [],
  [ComponentType.STRATEGIC_PLANNING]: [],
  [ComponentType.MILITARY_ADMINISTRATION]: [],
  [ComponentType.PROFESSIONAL_BUREAUCRACY]: [],
  [ComponentType.TECHNOCRATIC_AGENCIES]: [],
  [ComponentType.TRADITIONAL_LEGITIMACY]: [],
  [ComponentType.PERFORMANCE_LEGITIMACY]: [],
  [ComponentType.CULTURAL_PRESERVATION]: [],
  [ComponentType.ECONOMIC_INCENTIVES]: [],
  [ComponentType.STATE_CAPITALISM]: [],
  [ComponentType.SOCIAL_MARKET_ECONOMY]: [],
  [ComponentType.CONFEDERATE_SYSTEM]: [],
  [ComponentType.MERIT_BASED_SYSTEM]: [],
  [ComponentType.SECURITY_ALLIANCES]: [],
  [ComponentType.MILITARY_ENFORCEMENT]: [],
  [ComponentType.INNOVATION_ECOSYSTEM]: [],
  [ComponentType.SOCIAL_DEMOCRACY]: [],
};

/**
 * Compare multiple archetypes and generate comparison metrics
 */
export function compareArchetypes(archetypes: EconomicArchetype[]): ArchetypeComparison {
  const comparisonMetrics = {
    gdpGrowth: extractMetric(archetypes, "growthMetrics.gdpGrowth"),
    innovationIndex: extractMetric(archetypes, "growthMetrics.innovationIndex"),
    competitiveness: extractMetric(archetypes, "growthMetrics.competitiveness"),
    stability: extractMetric(archetypes, "growthMetrics.stability"),
    taxEfficiency: extractMetric(archetypes, "taxProfile.revenueEfficiency"),
  };

  const synergyScores: Record<string, number> = {};
  archetypes.forEach((archetype) => {
    synergyScores[archetype.id] = calculateSynergyScore(archetype);
  });

  const conflicts = archetypes.map((archetype) => ({
    archetypeId: archetype.id,
    conflicts: detectConflicts(archetype),
  }));

  return {
    archetypes,
    comparisonMetrics,
    recommendations: generateComparisonRecommendations(archetypes),
    synergyScores,
    conflicts,
  };
}

/**
 * Calculate synergy score for an archetype based on component interactions
 */
export function calculateSynergyScore(archetype: EconomicArchetype): number {
  let totalSynergy = 0;
  let possibleSynergies = 0;

  // Calculate economic component synergies
  archetype.economicComponents.forEach((component) => {
    const synergies = ECONOMIC_SYNERGIES[component] || [];
    synergies.forEach((synergyComponent) => {
      possibleSynergies++;
      if (archetype.economicComponents.includes(synergyComponent)) {
        totalSynergy++;
      }
    });
  });

  // Calculate government component synergies
  archetype.governmentComponents.forEach((component) => {
    const synergies = GOVERNMENT_SYNERGIES[component] || [];
    synergies.forEach((synergyComponent) => {
      possibleSynergies++;
      if (archetype.governmentComponents.includes(synergyComponent)) {
        totalSynergy++;
      }
    });
  });

  return possibleSynergies > 0 ? (totalSynergy / possibleSynergies) * 100 : 0;
}

/**
 * Detect conflicts within an archetype's components
 */
export function detectConflicts(archetype: EconomicArchetype): string[] {
  const conflicts: string[] = [];

  // Check economic component conflicts
  archetype.economicComponents.forEach((component) => {
    const potentialConflicts = ECONOMIC_CONFLICTS[component] || [];
    potentialConflicts.forEach(({ component: conflictComponent, severity }) => {
      if (archetype.economicComponents.includes(conflictComponent)) {
        conflicts.push(
          `${severity.toUpperCase()}: ${component} conflicts with ${conflictComponent}`
        );
      }
    });
  });

  // Check government component conflicts
  archetype.governmentComponents.forEach((component) => {
    const potentialConflicts = GOVERNMENT_CONFLICTS[component] || [];
    potentialConflicts.forEach(({ component: conflictComponent, severity }) => {
      if (archetype.governmentComponents.includes(conflictComponent)) {
        conflicts.push(
          `${severity.toUpperCase()}: ${component} conflicts with ${conflictComponent}`
        );
      }
    });
  });

  return conflicts;
}

/**
 * Generate detailed comparison metrics for an archetype
 */
export function generateComparisonMetrics(archetype: EconomicArchetype): ComparisonMetrics {
  const growthScore = normalizeScore(archetype.growthMetrics.gdpGrowth, 0, 5);
  const stabilityScore = archetype.growthMetrics.stability;
  const innovationScore = archetype.growthMetrics.innovationIndex;
  const competitivenessScore = archetype.growthMetrics.competitiveness;
  const taxEfficiencyScore = archetype.taxProfile.revenueEfficiency * 100;
  const synergyScore = calculateSynergyScore(archetype);
  const conflictPenalty = calculateConflictPenalty(archetype);

  const overallScore =
    growthScore * 0.2 +
    stabilityScore * 0.15 +
    innovationScore * 0.2 +
    competitivenessScore * 0.2 +
    taxEfficiencyScore * 0.15 +
    synergyScore * 0.1 -
    conflictPenalty;

  return {
    overallScore,
    growthScore,
    stabilityScore,
    innovationScore,
    competitivenessScore,
    taxEfficiencyScore,
    synergyScore,
    conflictPenalty,
  };
}

/**
 * Rank archetypes based on preferences and scoring
 */
export function rankArchetypes(
  archetypes: EconomicArchetype[],
  preferences: {
    growthFocus?: boolean;
    stabilityFocus?: boolean;
    innovationFocus?: boolean;
    equityFocus?: boolean;
    complexity?: "low" | "medium" | "high";
  } = {}
): ArchetypeRanking[] {
  const rankings: ArchetypeRanking[] = archetypes
    .filter((archetype) => {
      if (preferences.complexity && archetype.implementationComplexity !== preferences.complexity) {
        return false;
      }
      return true;
    })
    .map((archetype) => {
      let score = 0;
      const metrics = generateComparisonMetrics(archetype);

      // Apply preference weights
      if (preferences.growthFocus) {
        score += archetype.growthMetrics.gdpGrowth * 2;
      }

      if (preferences.stabilityFocus) {
        score += archetype.growthMetrics.stability * 2;
      }

      if (preferences.innovationFocus) {
        score += archetype.growthMetrics.innovationIndex * 2;
      }

      if (preferences.equityFocus) {
        score += archetype.taxProfile.revenueEfficiency * 100;
      }

      // If no specific focus, use overall metrics
      if (
        !preferences.growthFocus &&
        !preferences.stabilityFocus &&
        !preferences.innovationFocus &&
        !preferences.equityFocus
      ) {
        score = metrics.overallScore;
      }

      return {
        archetype,
        rank: 0, // Will be set after sorting
        score,
        metrics,
        strengths: identifyStrengths(archetype, metrics),
        weaknesses: identifyWeaknesses(archetype, metrics),
      };
    })
    .sort((a, b) => b.score - a.score);

  // Assign ranks
  rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;
  });

  return rankings;
}

/**
 * Perform detailed synergy analysis for an archetype
 */
export function analyzeSynergies(archetype: EconomicArchetype): SynergyAnalysis {
  const economicSynergies = archetype.economicComponents.map((component) => {
    const synergyWith = ECONOMIC_SYNERGIES[component] || [];
    const activesynergies = synergyWith.filter((s) => archetype.economicComponents.includes(s));
    const score =
      activesynergies.length > 0 ? (activesynergies.length / synergyWith.length) * 100 : 0;

    return {
      component,
      synergyWith: activesynergies,
      score,
    };
  });

  const governmentSynergies = archetype.governmentComponents.map((component) => {
    const synergyWith = GOVERNMENT_SYNERGIES[component] || [];
    const activeSynergies = synergyWith.filter((s) => archetype.governmentComponents.includes(s));
    const score =
      activeSynergies.length > 0 ? (activeSynergies.length / synergyWith.length) * 100 : 0;

    return {
      component,
      synergyWith: activeSynergies,
      score,
    };
  });

  const totalSynergyScore = calculateSynergyScore(archetype);

  return {
    archetypeId: archetype.id,
    economicSynergies,
    governmentSynergies,
    totalSynergyScore,
  };
}

/**
 * Perform detailed conflict analysis for an archetype
 */
export function analyzeConflicts(archetype: EconomicArchetype): ConflictAnalysis {
  const economicConflicts: Array<{
    component: EconomicComponentType;
    conflictsWith: EconomicComponentType[];
    severity: "low" | "medium" | "high";
  }> = [];

  archetype.economicComponents.forEach((component) => {
    const potentialConflicts = ECONOMIC_CONFLICTS[component] || [];
    potentialConflicts.forEach(({ component: conflictComponent, severity }) => {
      if (archetype.economicComponents.includes(conflictComponent)) {
        economicConflicts.push({
          component,
          conflictsWith: [conflictComponent],
          severity,
        });
      }
    });
  });

  const governmentConflicts: Array<{
    component: ComponentType;
    conflictsWith: ComponentType[];
    severity: "low" | "medium" | "high";
  }> = [];

  archetype.governmentComponents.forEach((component) => {
    const potentialConflicts = GOVERNMENT_CONFLICTS[component] || [];
    potentialConflicts.forEach(({ component: conflictComponent, severity }) => {
      if (archetype.governmentComponents.includes(conflictComponent)) {
        governmentConflicts.push({
          component,
          conflictsWith: [conflictComponent],
          severity,
        });
      }
    });
  });

  const totalConflictPenalty = calculateConflictPenalty(archetype);

  return {
    archetypeId: archetype.id,
    economicConflicts,
    governmentConflicts,
    totalConflictPenalty,
  };
}

// Helper functions

/**
 * Extract metric from archetypes using dot notation path
 */
function extractMetric(
  archetypes: EconomicArchetype[],
  metricPath: string
): Record<string, number> {
  const result: Record<string, number> = {};

  archetypes.forEach((archetype) => {
    const keys = metricPath.split(".");
    let value: any = archetype;

    for (const key of keys) {
      value = value[key];
    }

    result[archetype.id] = typeof value === "number" ? value : 0;
  });

  return result;
}

/**
 * Generate comparison recommendations based on archetype metrics
 */
function generateComparisonRecommendations(archetypes: EconomicArchetype[]): string[] {
  const recommendations: string[] = [];

  const avgGrowth =
    archetypes.reduce((sum, a) => sum + a.growthMetrics.gdpGrowth, 0) / archetypes.length;
  const avgInnovation =
    archetypes.reduce((sum, a) => sum + a.growthMetrics.innovationIndex, 0) / archetypes.length;
  const avgStability =
    archetypes.reduce((sum, a) => sum + a.growthMetrics.stability, 0) / archetypes.length;

  if (avgGrowth > 4) {
    recommendations.push("Focus on high-growth archetypes for rapid economic development");
  }

  if (avgInnovation > 90) {
    recommendations.push("Prioritize innovation-driven models for technological advancement");
  }

  if (avgStability > 90) {
    recommendations.push("Emphasize stability-focused approaches for sustainable development");
  }

  recommendations.push("Consider hybrid approaches combining strengths from multiple archetypes");
  recommendations.push("Adapt archetype elements to local cultural and institutional context");

  return recommendations;
}

/**
 * Calculate conflict penalty score for an archetype
 */
function calculateConflictPenalty(archetype: EconomicArchetype): number {
  let penalty = 0;

  // Check economic conflicts
  archetype.economicComponents.forEach((component) => {
    const potentialConflicts = ECONOMIC_CONFLICTS[component] || [];
    potentialConflicts.forEach(({ component: conflictComponent, severity }) => {
      if (archetype.economicComponents.includes(conflictComponent)) {
        switch (severity) {
          case "high":
            penalty += 15;
            break;
          case "medium":
            penalty += 8;
            break;
          case "low":
            penalty += 3;
            break;
        }
      }
    });
  });

  // Check government conflicts
  archetype.governmentComponents.forEach((component) => {
    const potentialConflicts = GOVERNMENT_CONFLICTS[component] || [];
    potentialConflicts.forEach(({ component: conflictComponent, severity }) => {
      if (archetype.governmentComponents.includes(conflictComponent)) {
        switch (severity) {
          case "high":
            penalty += 15;
            break;
          case "medium":
            penalty += 8;
            break;
          case "low":
            penalty += 3;
            break;
        }
      }
    });
  });

  return penalty;
}

/**
 * Normalize a score to 0-100 range
 */
function normalizeScore(value: number, min: number, max: number): number {
  return ((value - min) / (max - min)) * 100;
}

/**
 * Identify archetype strengths based on metrics
 */
function identifyStrengths(archetype: EconomicArchetype, metrics: ComparisonMetrics): string[] {
  const strengths: string[] = [];

  if (metrics.growthScore > 75) {
    strengths.push("High economic growth potential");
  }

  if (metrics.stabilityScore > 85) {
    strengths.push("Exceptional economic stability");
  }

  if (metrics.innovationScore > 85) {
    strengths.push("Strong innovation capabilities");
  }

  if (metrics.competitivenessScore > 85) {
    strengths.push("High global competitiveness");
  }

  if (metrics.taxEfficiencyScore > 85) {
    strengths.push("Efficient tax system");
  }

  if (metrics.synergyScore > 70) {
    strengths.push("Strong component synergies");
  }

  // Include archetype-specific strengths
  if (archetype.strengths.length > 0) {
    strengths.push(...archetype.strengths.slice(0, 3));
  }

  return strengths;
}

/**
 * Identify archetype weaknesses based on metrics
 */
function identifyWeaknesses(archetype: EconomicArchetype, metrics: ComparisonMetrics): string[] {
  const weaknesses: string[] = [];

  if (metrics.growthScore < 40) {
    weaknesses.push("Limited growth potential");
  }

  if (metrics.stabilityScore < 65) {
    weaknesses.push("Economic instability concerns");
  }

  if (metrics.innovationScore < 65) {
    weaknesses.push("Innovation challenges");
  }

  if (metrics.competitivenessScore < 65) {
    weaknesses.push("Competitiveness limitations");
  }

  if (metrics.taxEfficiencyScore < 70) {
    weaknesses.push("Tax system inefficiencies");
  }

  if (metrics.conflictPenalty > 20) {
    weaknesses.push("Significant component conflicts");
  }

  if (archetype.implementationComplexity === "high") {
    weaknesses.push("High implementation complexity");
  }

  // Include archetype-specific challenges
  if (archetype.challenges.length > 0) {
    weaknesses.push(...archetype.challenges.slice(0, 3));
  }

  return weaknesses;
}
