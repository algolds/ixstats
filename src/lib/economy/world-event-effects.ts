/**
 * Admin world events → economic impact. One mapping serves the "simulate" preview and the
 * StorytellerEffects an event leaves, so what the admin previews is what the projection applies:
 * a GDP per capita and a population level shift per affected country, phased in over the event's
 * duration (IxTime years) and kept.
 */
import { StorytellerEffectType } from "./calculations";
import type { StorytellerEffectDraft } from "./storyteller-effects";

/** Event types that hurt the economy; every other type (peace, tech, custom) helps it. */
const NEGATIVE_WORLD_EVENTS = new Set([
  "economic_crisis",
  "trade_war",
  "natural_disaster",
  "pandemic",
  "political_upheaval",
  "global_recession",
  "currency_crisis",
  "cyber_attack",
  "climate_disaster",
  "financial_crisis",
]);

export interface WorldEventImpact {
  /** GDP level shift (decimal): up to -20% / +15% at severity 1. */
  gdp: number;
  /** Population level shift (decimal): up to -2% / +1% at severity 1. */
  population: number;
  /** Stability points: up to -30 / +10 at severity 1 (preview only). */
  stability: number;
}

export function worldEventImpact(type: string, severity: number): WorldEventImpact {
  const negative = NEGATIVE_WORLD_EVENTS.has(type);
  return {
    gdp: negative ? -(severity * 0.2) : severity * 0.15,
    population: negative ? -(severity * 0.02) : severity * 0.01,
    stability: negative ? -(severity * 30) : severity * 10,
  };
}

/** The GDP and population level effects a world event leaves on one country. */
export function worldEventEffectDrafts(input: {
  countryId: string;
  type: string;
  severity: number;
  label: string;
  /** IxTime years to phase in; null = at once. */
  duration: number | null;
  startIxTime: number;
  worldEventId: string;
  createdBy: string;
}): StorytellerEffectDraft[] {
  const impact = worldEventImpact(input.type, input.severity);
  const shared = {
    countryId: input.countryId,
    description: input.label,
    duration: input.duration,
    ixTime: input.startIxTime,
    worldEventId: input.worldEventId,
    createdBy: input.createdBy,
  };
  return [
    { ...shared, inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT, value: impact.gdp },
    {
      ...shared,
      inputType: StorytellerEffectType.POPULATION_LEVEL_ADJUSTMENT,
      value: impact.population,
    },
  ].filter((d) => d.value !== 0);
}
