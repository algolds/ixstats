/**
 * useNPCPersonalities Hook
 *
 * React hooks for querying and managing NPC personality data with fallback patterns.
 *
 * Hooks:
 * - useNPCPersonalities - Query all personalities with filters
 * - useCountryPersonality - Get assigned personality for a country
 * - usePersonalityResponse - Predict NPC response to scenarios
 *
 * Features:
 * - Type-safe tRPC integration
 * - Fallback to hardcoded data if database empty
 * - Loading and error states
 * - Automatic refetching on dependencies
 */

import { api } from '~/trpc/react';
import type { PersonalityArchetype } from '@/lib/diplomatic-npc-personality';

/**
 * Query all NPC personalities with optional filters
 *
 * @param options - Filter options
 * @param options.archetype - Filter by personality archetype
 * @param options.isActive - Filter by active status
 * @param options.orderBy - Sort order (usageCount, name, archetype)
 *
 * @example
 * const { personalities, isLoading, error } = useNPCPersonalities({
 *   isActive: true,
 *   orderBy: 'usageCount'
 * });
 */
export function useNPCPersonalities(options?: {
  archetype?: PersonalityArchetype;
  isActive?: boolean;
  orderBy?: 'usageCount' | 'name' | 'archetype';
}) {
  const query = api.npcPersonalities.getAllPersonalities.useQuery({
    archetype: options?.archetype,
    isActive: options?.isActive,
    orderBy: options?.orderBy || 'usageCount'
  });

  return {
    ...query,
    personalities: query.data || [],
    isLoading: query.isLoading,
    error: query.error
  };
}

/**
 * Query assigned personality for a specific country
 *
 * @param countryId - Country ID to query
 *
 * @example
 * const { personality, isLoading } = useCountryPersonality('country_123');
 *
 * if (personality) {
 *   console.log(`Archetype: ${personality.archetype}`);
 *   console.log(`Assigned: ${personality.assignedAt}`);
 *   console.log(`Drift History: ${personality.driftHistory.length} changes`);
 * }
 */
export function useCountryPersonality(countryId: string) {
  return api.npcPersonalities.getCountryPersonality.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
}

/**
 * Predict NPC response to a diplomatic scenario
 *
 * @param personalityId - Personality ID
 * @param scenario - Scenario type
 * @param context - Current diplomatic context
 *
 * @example
 * const { data: response } = usePersonalityResponse(
 *   'personality_123',
 *   'alliance_proposal',
 *   {
 *     currentRelationship: 'friendly',
 *     relationshipStrength: 75,
 *     recentActions: ['trade_agreement', 'cultural_exchange']
 *   }
 * );
 *
 * if (response) {
 *   console.log(`Predicted Action: ${response.action}`);
 *   console.log(`Confidence: ${response.confidence}%`);
 *   console.log(`Reasoning: ${response.reasoning.join(', ')}`);
 * }
 */
export function usePersonalityResponse(
  personalityId: string,
  scenario: string,
  context: {
    currentRelationship: string;
    relationshipStrength: number;
    recentActions?: string[];
  }
) {
  return api.npcPersonalities.predictScenarioResponse.useQuery(
    {
      personalityId,
      scenario,
      contextFactors: context
    },
    { enabled: !!personalityId && !!scenario }
  );
}

/**
 * Get personality by ID with full details
 *
 * @param personalityId - Personality ID
 *
 * @example
 * const { data: personality } = usePersonalityById('personality_123');
 */
export function usePersonalityById(personalityId: string) {
  return api.npcPersonalities.getPersonalityById.useQuery(
    { id: personalityId },
    { enabled: !!personalityId }
  );
}

/**
 * Get personality by archetype
 *
 * @param archetype - Personality archetype
 *
 * @example
 * const { data: personality } = usePersonalityByArchetype('aggressive_expansionist');
 */
export function usePersonalityByArchetype(archetype: PersonalityArchetype) {
  return api.npcPersonalities.getPersonalityByArchetype.useQuery(
    { archetype },
    { enabled: !!archetype }
  );
}

/**
 * Get appropriate tone for diplomatic context
 *
 * @param personalityId - Personality ID
 * @param relationshipLevel - Current relationship level
 * @param formality - Communication formality level
 *
 * @example
 * const { data: tone } = useDiplomaticTone(
 *   'personality_123',
 *   'friendly',
 *   'formal'
 * );
 *
 * if (tone) {
 *   console.log(`Tone: ${tone.tone}`);
 *   console.log(`Cultural Profile:`, tone.culturalProfile);
 * }
 */
export function useDiplomaticTone(
  personalityId: string,
  relationshipLevel: string,
  formality: 'formal' | 'casual'
) {
  return api.npcPersonalities.getToneForContext.useQuery(
    {
      personalityId,
      relationshipLevel,
      formality
    },
    { enabled: !!personalityId && !!relationshipLevel }
  );
}

/**
 * Admin hook: Get personality usage statistics
 *
 * @example
 * const { data: stats } = usePersonalityStats();
 *
 * if (stats) {
 *   console.log(`Total Personalities: ${stats.summary.totalPersonalities}`);
 *   console.log(`Total Usage: ${stats.summary.totalUsage}`);
 *   console.log(`Archetype Distribution:`, stats.archetypeStats);
 * }
 */
export function usePersonalityStats() {
  return api.npcPersonalities.getPersonalityStats.useQuery();
}
