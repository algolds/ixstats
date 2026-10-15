/**
 * What the founding flow sends: `countries.previewFounding` for the nation card and
 * `countries.createCountry` to found. Both carry the same founding fields, built here once, so
 * the card shows the numbers the nation is founded with.
 *
 * Never sends `taxSystemData`, `governmentStructure` or `economyBuilderState`: without them the
 * server generates the departments, budget, tax system and sectors from the archetype and bands.
 */

import type { RouterInputs } from "~/trpc/react";
import { getArchetypeOption } from "./founding-archetypes";
import { EMPTY_IDENTITY, activeComponents, type FoundingDraft } from "./founding-draft";

type CreateCountryInput = RouterInputs["countries"]["createCountry"];
export type PreviewFoundingInput = RouterInputs["countries"]["previewFounding"];

/** Identity fields saved to `NationalIdentity`; name and flag travel separately. */
const NATIONAL_IDENTITY_KEYS = (
  Object.keys(EMPTY_IDENTITY) as Array<keyof typeof EMPTY_IDENTITY>
).filter((key) => key !== "name" && key !== "flagUrl");

/** The fields that move the numbers: archetype, government and size and wealth. */
function figureFields(draft: FoundingDraft) {
  const { economy, government } = draft;
  const archetype = getArchetypeOption(draft.start.archetypeKey);
  const exact = economy.exactPopulation !== null || economy.exactGdpPerCapita !== null;
  return {
    foundationCountry: null,
    archetypeId: archetype?.key,
    governmentFormId: government.formId,
    // Sent only when the player changed the form's set; the server applies the form's otherwise.
    governmentComponents:
      government.components !== null && government.components.length > 0
        ? activeComponents(government).map((componentType) => ({
            componentType,
            effectivenessScore: 60,
            isActive: true,
          }))
        : undefined,
    populationBand: economy.populationBand ?? archetype?.display.typicalPopulationBand,
    wealthBand: economy.wealthBand ?? archetype?.display.typicalWealthBand,
    // A zero leaves that figure to the band (the server reads the first non-zero source).
    coreIndicators: exact
      ? {
          totalPopulation: economy.exactPopulation ?? 0,
          gdpPerCapita: economy.exactGdpPerCapita ?? 0,
          nominalGDP: 0,
        }
      : undefined,
  };
}

/** The nation card's query: only what moves the figures, so typing a name never refetches. */
export function previewInput(draft: FoundingDraft): PreviewFoundingInput {
  const { coreIndicators, ...fields } = figureFields(draft);
  return { ...fields, economicInputs: coreIndicators ? { coreIndicators } : undefined };
}

/** The founding itself. */
export function createInput(draft: FoundingDraft, realmId: string | undefined): CreateCountryInput {
  const { coreIndicators, ...fields } = figureFields(draft);
  const { identity } = draft;
  const name = identity.name.trim();
  const nationalIdentity: Record<string, string> = { countryName: name };
  for (const key of NATIONAL_IDENTITY_KEYS) {
    const value = identity[key].trim();
    if (value) nationalIdentity[key] = value;
  }
  const renamed = Object.fromEntries(
    Object.entries(draft.government.institutions).filter(([, value]) => value?.trim())
  );
  return {
    ...fields,
    name,
    realmId,
    institutionNames: Object.keys(renamed).length > 0 ? renamed : undefined,
    economicInputs: {
      flagUrl: identity.flagUrl.trim() || undefined,
      nationalIdentity,
      coreIndicators,
    },
  };
}
