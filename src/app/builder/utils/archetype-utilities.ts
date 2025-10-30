/**
 * Archetype Utility Functions
 *
 * Standalone utility functions for working with economic archetypes.
 * Extracted from EconomicArchetypeService for better code organization and reusability.
 */

import type { EconomicArchetype, ArchetypeComparison } from '../data/archetype-types';
import type { EconomyBuilderState } from '~/types/economy-builder';
import { EconomicComponentType } from '~/lib/atomic-economic-data';

/**
 * Calculate how well an archetype fits a given economic state
 *
 * Analyzes the current economy state and returns a fitness score (0-100)
 * indicating how closely the economy matches the archetype.
 *
 * @param archetype - The archetype to evaluate
 * @param currentState - Current economy builder state
 * @returns Fitness score from 0-100, with 100 being a perfect match
 */
export function calculateArchetypeFit(
  archetype: EconomicArchetype,
  currentState: EconomyBuilderState
): number {
  let score = 0;
  let maxScore = 0;

  // Component match scoring (40 points)
  const componentMatchWeight = 40;
  const currentComponents = new Set(currentState.selectedAtomicComponents);
  const archetypeComponents = new Set(archetype.economicComponents);

  const matchingComponents = archetype.economicComponents.filter(c =>
    currentComponents.has(c)
  ).length;

  const componentScore = archetypeComponents.size > 0
    ? (matchingComponents / archetypeComponents.size) * componentMatchWeight
    : 0;

  score += componentScore;
  maxScore += componentMatchWeight;

  // GDP tier alignment (20 points)
  const tierWeight = 20;
  const currentTier = currentState.structure.economicTier;
  const expectedTier = determineExpectedTier(archetype);

  if (currentTier === expectedTier) {
    score += tierWeight;
  } else if (isAdjacentTier(currentTier, expectedTier)) {
    score += tierWeight * 0.5;
  }
  maxScore += tierWeight;

  // Growth strategy alignment (20 points)
  const strategyWeight = 20;
  const currentStrategy = currentState.structure.growthStrategy;
  const expectedStrategy = determineExpectedStrategy(archetype);

  if (currentStrategy === expectedStrategy) {
    score += strategyWeight;
  } else if (isCompatibleStrategy(currentStrategy, expectedStrategy)) {
    score += strategyWeight * 0.5;
  }
  maxScore += strategyWeight;

  // Labor market similarity (20 points)
  const laborWeight = 20;
  if (currentState.laborMarket) {
    const laborScore = calculateLaborSimilarity(
      archetype.employmentProfile,
      currentState.laborMarket
    );
    score += laborScore * laborWeight;
  }
  maxScore += laborWeight;

  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

/**
 * Find the best matching archetype for a given economic state
 *
 * Evaluates all available archetypes and returns the one with the highest
 * fitness score for the current economy state.
 *
 * @param archetypes - Array of archetypes to evaluate
 * @param currentState - Current economy builder state
 * @returns Object containing the best archetype and its fitness score
 */
export function findBestArchetype(
  archetypes: EconomicArchetype[],
  currentState: EconomyBuilderState
): { archetype: EconomicArchetype; fitScore: number } | null {
  if (archetypes.length === 0) {
    return null;
  }

  let bestArchetype = archetypes[0];
  let bestScore = calculateArchetypeFit(bestArchetype, currentState);

  for (let i = 1; i < archetypes.length; i++) {
    const archetype = archetypes[i];
    const score = calculateArchetypeFit(archetype, currentState);

    if (score > bestScore) {
      bestScore = score;
      bestArchetype = archetype;
    }
  }

  return {
    archetype: bestArchetype,
    fitScore: bestScore
  };
}

/**
 * Get archetype recommendations based on current state and preferences
 *
 * Returns a ranked list of archetypes that best match the current economy
 * state and user preferences, along with fitness scores.
 *
 * @param archetypes - Array of archetypes to evaluate
 * @param currentState - Current economy builder state
 * @param preferences - Optional user preferences for filtering/ranking
 * @returns Array of recommendations with archetypes and scores, sorted by best fit
 */
export function getArchetypeRecommendations(
  archetypes: EconomicArchetype[],
  currentState: EconomyBuilderState,
  preferences?: {
    growthFocus?: boolean;
    stabilityFocus?: boolean;
    innovationFocus?: boolean;
    equityFocus?: boolean;
    complexity?: 'low' | 'medium' | 'high';
    minFitScore?: number;
  }
): Array<{ archetype: EconomicArchetype; fitScore: number; reasons: string[] }> {
  // Filter by complexity if specified
  let filteredArchetypes = archetypes;
  if (preferences?.complexity) {
    filteredArchetypes = archetypes.filter(
      a => a.implementationComplexity === preferences.complexity
    );
  }

  // Calculate fitness scores for all archetypes
  const scoredArchetypes = filteredArchetypes.map(archetype => ({
    archetype,
    fitScore: calculateArchetypeFit(archetype, currentState),
    preferenceScore: calculatePreferenceScore(archetype, preferences)
  }));

  // Filter by minimum fit score if specified
  const minScore = preferences?.minFitScore ?? 0;
  const qualifyingArchetypes = scoredArchetypes.filter(
    item => item.fitScore >= minScore
  );

  // Sort by combined score (fit + preferences)
  qualifyingArchetypes.sort((a, b) => {
    const scoreA = a.fitScore + a.preferenceScore;
    const scoreB = b.fitScore + b.preferenceScore;
    return scoreB - scoreA;
  });

  // Generate reasons for each recommendation
  return qualifyingArchetypes.map(item => ({
    archetype: item.archetype,
    fitScore: item.fitScore,
    reasons: generateRecommendationReasons(item.archetype, currentState, preferences)
  }));
}

/**
 * Compare multiple archetypes across key metrics
 *
 * Generates a comprehensive comparison of the specified archetypes,
 * including metrics, strengths/weaknesses, and recommendations.
 *
 * @param archetypes - Array of archetypes to compare
 * @returns Comparison object with metrics and recommendations
 */
export function compareArchetypes(archetypes: EconomicArchetype[]): ArchetypeComparison {
  const comparisonMetrics = {
    gdpGrowth: extractMetric(archetypes, 'growthMetrics.gdpGrowth'),
    innovationIndex: extractMetric(archetypes, 'growthMetrics.innovationIndex'),
    competitiveness: extractMetric(archetypes, 'growthMetrics.competitiveness'),
    stability: extractMetric(archetypes, 'growthMetrics.stability'),
    taxEfficiency: extractMetric(archetypes, 'taxProfile.revenueEfficiency')
  };

  return {
    archetypes,
    comparisonMetrics,
    recommendations: generateComparisonRecommendations(archetypes)
  };
}

/**
 * Generate a transition plan from current state to target archetype
 *
 * Creates a step-by-step plan for transitioning the economy from its
 * current state to match the target archetype.
 *
 * @param currentState - Current economy builder state
 * @param targetArchetype - Target archetype to transition to
 * @returns Transition plan with steps, timeline, and considerations
 */
export function generateTransitionPlan(
  currentState: EconomyBuilderState,
  targetArchetype: EconomicArchetype
): {
  steps: Array<{
    phase: number;
    title: string;
    description: string;
    duration: string;
    actions: string[];
    risks: string[];
    successMetrics: string[];
  }>;
  totalDuration: string;
  complexity: 'low' | 'medium' | 'high';
  considerations: string[];
  resources: string[];
} {
  const steps = [];
  const currentComponents = new Set(currentState.selectedAtomicComponents);
  const targetComponents = new Set(targetArchetype.economicComponents);

  const componentsToAdd = targetArchetype.economicComponents.filter(
    c => !currentComponents.has(c)
  );
  const componentsToRemove = Array.from(currentComponents).filter(
    c => !targetComponents.has(c)
  );

  // Phase 1: Foundation and preparation
  steps.push({
    phase: 1,
    title: 'Foundation and Preparation',
    description: 'Establish prerequisites and build institutional capacity',
    duration: '6-12 months',
    actions: [
      'Conduct comprehensive economic assessment',
      'Build stakeholder consensus and political support',
      'Develop regulatory framework for new economic components',
      'Train workforce and build institutional capacity'
    ],
    risks: [
      'Political resistance to change',
      'Insufficient stakeholder buy-in',
      'Lack of technical expertise'
    ],
    successMetrics: [
      'Stakeholder agreement achieved',
      'Regulatory framework approved',
      'Training programs launched'
    ]
  });

  // Phase 2: Component integration
  if (componentsToAdd.length > 0) {
    steps.push({
      phase: 2,
      title: 'Economic Component Integration',
      description: 'Gradually introduce new economic components',
      duration: '12-24 months',
      actions: componentsToAdd.slice(0, 5).map(c =>
        `Implement ${getComponentName(c)}`
      ),
      risks: [
        'Implementation challenges',
        'Market disruption',
        'Resource constraints'
      ],
      successMetrics: [
        'Components operational',
        'Performance metrics met',
        'Market stability maintained'
      ]
    });
  }

  // Phase 3: Structural adjustment
  steps.push({
    phase: 3,
    title: 'Structural Economic Adjustment',
    description: 'Align economic structure with target archetype',
    duration: '18-36 months',
    actions: [
      `Adjust sector focus to match ${targetArchetype.name} profile`,
      'Implement tax system reforms',
      'Modernize labor market policies',
      'Develop innovation and R&D infrastructure'
    ],
    risks: [
      'Economic disruption during transition',
      'Job displacement in declining sectors',
      'Investment uncertainty'
    ],
    successMetrics: [
      'Sector alignment achieved',
      'Tax efficiency improved',
      'Labor market indicators trending positive'
    ]
  });

  // Phase 4: Optimization and refinement
  steps.push({
    phase: 4,
    title: 'Optimization and Refinement',
    description: 'Fine-tune systems and achieve target performance',
    duration: '12-18 months',
    actions: [
      'Optimize economic performance metrics',
      'Address remaining gaps and challenges',
      'Build resilience and sustainability',
      'Establish monitoring and evaluation systems'
    ],
    risks: [
      'Performance gaps',
      'Sustainability challenges',
      'External economic shocks'
    ],
    successMetrics: [
      'Target metrics achieved',
      'System stability confirmed',
      'Sustainability goals met'
    ]
  });

  // Determine overall complexity
  const complexity = determineTransitionComplexity(
    currentState,
    targetArchetype,
    componentsToAdd.length,
    componentsToRemove.length
  );

  return {
    steps,
    totalDuration: '3-5 years',
    complexity,
    considerations: [
      ...targetArchetype.culturalFactors.map(f => `Cultural consideration: ${f}`),
      ...targetArchetype.challenges.map(c => `Challenge: ${c}`),
      'Ensure gradual transition to minimize economic disruption',
      'Maintain social safety nets during structural changes',
      'Build consensus across political and economic stakeholders'
    ],
    resources: [
      'Technical advisory support for implementation',
      'Training and capacity building programs',
      'Financial resources for infrastructure development',
      'International partnerships and knowledge transfer',
      'Monitoring and evaluation frameworks'
    ]
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract a metric value from archetypes using dot notation path
 */
function extractMetric(
  archetypes: EconomicArchetype[],
  metricPath: string
): Record<string, number> {
  const result: Record<string, number> = {};

  archetypes.forEach(archetype => {
    const keys = metricPath.split('.');
    let value: any = archetype;

    for (const key of keys) {
      value = value?.[key];
    }

    result[archetype.id] = typeof value === 'number' ? value : 0;
  });

  return result;
}

/**
 * Generate comparison recommendations based on archetype analysis
 */
function generateComparisonRecommendations(archetypes: EconomicArchetype[]): string[] {
  const recommendations: string[] = [];

  if (archetypes.length === 0) {
    return recommendations;
  }

  const avgGrowth = archetypes.reduce((sum, a) => sum + a.growthMetrics.gdpGrowth, 0) / archetypes.length;
  const avgInnovation = archetypes.reduce((sum, a) => sum + a.growthMetrics.innovationIndex, 0) / archetypes.length;
  const avgStability = archetypes.reduce((sum, a) => sum + a.growthMetrics.stability, 0) / archetypes.length;

  if (avgGrowth > 4) {
    recommendations.push('Focus on high-growth archetypes for rapid economic development');
  }

  if (avgInnovation > 90) {
    recommendations.push('Prioritize innovation-driven models for technological advancement');
  }

  if (avgStability > 90) {
    recommendations.push('Emphasize stability-focused approaches for sustainable development');
  }

  recommendations.push('Consider hybrid approaches combining strengths from multiple archetypes');
  recommendations.push('Adapt archetype elements to local cultural and institutional context');

  return recommendations;
}

/**
 * Determine expected economic tier for an archetype
 */
function determineExpectedTier(archetype: EconomicArchetype): string {
  const innovationIndex = archetype.growthMetrics.innovationIndex;
  const competitiveness = archetype.growthMetrics.competitiveness;

  if (innovationIndex >= 90 && competitiveness >= 90) {
    return 'Advanced';
  } else if (innovationIndex >= 75 && competitiveness >= 75) {
    return 'Developed';
  } else if (innovationIndex >= 50) {
    return 'Emerging';
  }
  return 'Developing';
}

/**
 * Determine expected growth strategy for an archetype
 */
function determineExpectedStrategy(archetype: EconomicArchetype): string {
  if (archetype.economicComponents.includes(EconomicComponentType.INNOVATION_ECONOMY)) {
    return 'Innovation-Driven';
  } else if (archetype.economicComponents.includes(EconomicComponentType.EXPORT_ORIENTED)) {
    return 'Export-Led';
  }
  return 'Balanced';
}

/**
 * Check if two economic tiers are adjacent
 */
function isAdjacentTier(tier1: string, tier2: string): boolean {
  const tierOrder = ['Developing', 'Emerging', 'Developed', 'Advanced'];
  const index1 = tierOrder.indexOf(tier1);
  const index2 = tierOrder.indexOf(tier2);

  if (index1 === -1 || index2 === -1) return false;
  return Math.abs(index1 - index2) === 1;
}

/**
 * Check if two growth strategies are compatible
 */
function isCompatibleStrategy(strategy1: string, strategy2: string): boolean {
  const compatiblePairs = [
    ['Export-Led', 'Innovation-Driven'],
    ['Balanced', 'Export-Led'],
    ['Balanced', 'Innovation-Driven']
  ];

  return compatiblePairs.some(pair =>
    (pair[0] === strategy1 && pair[1] === strategy2) ||
    (pair[0] === strategy2 && pair[1] === strategy1)
  );
}

/**
 * Calculate labor market similarity score (0-1)
 */
function calculateLaborSimilarity(
  archetypeProfile: EconomicArchetype['employmentProfile'],
  currentLabor: EconomyBuilderState['laborMarket']
): number {
  let score = 0;
  let factors = 0;

  // Unemployment rate similarity (lower difference = higher score)
  const unemploymentDiff = Math.abs(
    archetypeProfile.unemploymentRate - currentLabor.unemploymentRate
  );
  score += Math.max(0, 1 - unemploymentDiff / 20); // 20% max difference
  factors++;

  // Labor participation similarity
  const participationDiff = Math.abs(
    archetypeProfile.laborParticipation - currentLabor.laborForceParticipationRate
  );
  score += Math.max(0, 1 - participationDiff / 30); // 30% max difference
  factors++;

  return factors > 0 ? score / factors : 0;
}

/**
 * Calculate preference-based scoring bonus
 */
function calculatePreferenceScore(
  archetype: EconomicArchetype,
  preferences?: {
    growthFocus?: boolean;
    stabilityFocus?: boolean;
    innovationFocus?: boolean;
    equityFocus?: boolean;
  }
): number {
  if (!preferences) return 0;

  let score = 0;

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
    score += archetype.taxProfile.revenueEfficiency * 2;
  }

  return score;
}

/**
 * Generate reasons for archetype recommendation
 */
function generateRecommendationReasons(
  archetype: EconomicArchetype,
  currentState: EconomyBuilderState,
  preferences?: any
): string[] {
  const reasons: string[] = [];

  // Check component overlap
  const currentComponents = new Set(currentState.selectedAtomicComponents);
  const matchingComponents = archetype.economicComponents.filter(c =>
    currentComponents.has(c)
  );

  if (matchingComponents.length > 0) {
    reasons.push(
      `Shares ${matchingComponents.length} economic components with your current setup`
    );
  }

  // Check preferences alignment
  if (preferences?.growthFocus && archetype.growthMetrics.gdpGrowth > 4) {
    reasons.push(`High growth potential (${archetype.growthMetrics.gdpGrowth}% GDP growth)`);
  }

  if (preferences?.innovationFocus && archetype.growthMetrics.innovationIndex > 85) {
    reasons.push('Strong innovation capabilities');
  }

  if (preferences?.stabilityFocus && archetype.growthMetrics.stability > 85) {
    reasons.push('High economic stability');
  }

  // Add archetype-specific strengths
  if (archetype.strengths.length > 0) {
    reasons.push(archetype.strengths[0]);
  }

  return reasons;
}

/**
 * Determine transition complexity
 */
function determineTransitionComplexity(
  currentState: EconomyBuilderState,
  targetArchetype: EconomicArchetype,
  componentsToAdd: number,
  componentsToRemove: number
): 'low' | 'medium' | 'high' {
  const totalChanges = componentsToAdd + componentsToRemove;

  if (totalChanges > 10 || targetArchetype.implementationComplexity === 'high') {
    return 'high';
  } else if (totalChanges > 5 || targetArchetype.implementationComplexity === 'medium') {
    return 'medium';
  }
  return 'low';
}

/**
 * Get human-readable name for economic component
 */
function getComponentName(component: EconomicComponentType): string {
  return component
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}
