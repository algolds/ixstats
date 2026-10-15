/**
 * The archetypes the Start step offers: the 20 built-in archetypes with their written display
 * copy, in the catalogue's order (modern first). The server looks archetypes up by key, so the
 * key is what a founding sends as `archetypeId`.
 */

import { modernArchetypes } from "~/lib/economy/archetypes/modern";
import { historicalArchetypes } from "~/lib/economy/archetypes/historical";
import {
  getArchetypeDisplay,
  type ArchetypeDisplay,
  type GovernmentFormId,
} from "~/lib/economy/archetypes/display";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";
import {
  POPULATION_BANDS,
  WEALTH_BANDS,
  WEALTH_BAND_IDS,
  type WealthBandId,
} from "~/lib/builder/founding-bands";
import { getGovernmentForm } from "~/lib/government/forms";

export const bandLabel = {
  population: (id: string) => POPULATION_BANDS.find((band) => band.id === id)?.label ?? id,
  wealth: (id: string) => WEALTH_BANDS.find((band) => band.id === id)?.label ?? id,
};

export type ArchetypeEra = "modern" | "historical";

export interface ArchetypeOption {
  key: string;
  era: ArchetypeEra;
  display: ArchetypeDisplay;
  data: EconomicArchetype;
}

function optionsOf(source: Map<string, EconomicArchetype>, era: ArchetypeEra): ArchetypeOption[] {
  return [...source.values()].flatMap((data) => {
    const display = getArchetypeDisplay(data.id);
    return display ? [{ key: data.id, era, display, data }] : [];
  });
}

export const ARCHETYPE_OPTIONS: readonly ArchetypeOption[] = [
  ...optionsOf(modernArchetypes, "modern"),
  ...optionsOf(historicalArchetypes, "historical"),
];

/** The three facts on each card: typical size, wealth and starting government. */
export function archetypeFacts(option: ArchetypeOption): string[] {
  const { display } = option;
  return [
    `${bandLabel.population(display.typicalPopulationBand)} size`,
    bandLabel.wealth(display.typicalWealthBand),
    getGovernmentForm(display.startingGovernmentForm)?.name ?? "",
  ];
}

export function getArchetypeOption(key: string | null | undefined): ArchetypeOption | undefined {
  return key ? ARCHETYPE_OPTIONS.find((option) => option.key === key) : undefined;
}

/**
 * The archetype closest to an imported nation: wealth band first (an exact band match scores 2,
 * a neighbouring band 1), then the starting government form (a match scores 2). Ties keep the
 * catalogue's order, so a modern archetype wins over a historical one. Null when nothing matches.
 */
export function suggestArchetype(match: {
  wealthBand?: WealthBandId | null;
  formId?: GovernmentFormId | null;
}): string | null {
  if (!match.wealthBand && !match.formId) return null;
  let best: { key: string; score: number } | null = null;
  for (const option of ARCHETYPE_OPTIONS) {
    let score = 0;
    if (match.wealthBand) {
      const distance = Math.abs(
        WEALTH_BAND_IDS.indexOf(option.display.typicalWealthBand) -
          WEALTH_BAND_IDS.indexOf(match.wealthBand)
      );
      score += Math.max(0, 2 - distance);
    }
    if (match.formId && option.display.startingGovernmentForm === match.formId) score += 2;
    if (score > 0 && (!best || score > best.score)) best = { key: option.key, score };
  }
  return best?.key ?? null;
}
