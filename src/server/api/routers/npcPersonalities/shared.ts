import { z } from "zod";

export const archetypeEnum = z.enum([
  "aggressive_expansionist",
  "peaceful_merchant",
  "cautious_isolationist",
  "cultural_diplomat",
  "pragmatic_realist",
  "ideological_hardliner",
]);

/**
 * Parse JSON fields from database personality record
 */
export function parsePersonalityJSON(personality: any) {
  return {
    ...personality,
    traitDescriptions: personality.traitDescriptions
      ? JSON.parse(personality.traitDescriptions)
      : {},
    culturalProfile: personality.culturalProfile ? JSON.parse(personality.culturalProfile) : null,
    toneMatrix: personality.toneMatrix ? JSON.parse(personality.toneMatrix) : {},
    responsePatterns: personality.responsePatterns ? JSON.parse(personality.responsePatterns) : [],
    scenarioResponses: personality.scenarioResponses
      ? JSON.parse(personality.scenarioResponses)
      : {},
    eventModifiers: personality.eventModifiers ? JSON.parse(personality.eventModifiers) : {},
  };
}
