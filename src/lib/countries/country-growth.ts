/**
 * The growth fields an admin edits on one country (/admin/countries inspector), with their allowed ranges.
 * Rates are decimals (0.01 = 1% a year); localGrowthFactor multiplies GDP per capita growth.
 */
import { z } from "zod";
import {
  ADJUSTED_GDP_GROWTH_RANGE,
  nationGrowthSchema,
  POPULATION_GROWTH_RANGE,
} from "~/lib/realms/nation-growth-defaults";

/** The engine clamps a stored rate to ±50%; no tier caps above 10%. */
export const MAX_GDP_GROWTH_RANGE = { min: 0, max: 0.5 } as const;
/** Matches the inspector's sandbox slider and the tier modifiers' bounds. Never 0: the projection reads 0 as 1. */
export const LOCAL_GROWTH_FACTOR_RANGE = { min: 0.5, max: 2 } as const;

export const COUNTRY_GROWTH_RANGES = {
  populationGrowthRate: POPULATION_GROWTH_RANGE,
  adjustedGdpGrowth: ADJUSTED_GDP_GROWTH_RANGE,
  maxGdpGrowthRate: MAX_GDP_GROWTH_RANGE,
  localGrowthFactor: LOCAL_GROWTH_FACTOR_RANGE,
} as const;

export type CountryGrowthField = keyof typeof COUNTRY_GROWTH_RANGES;
export const COUNTRY_GROWTH_FIELDS = Object.keys(COUNTRY_GROWTH_RANGES) as CountryGrowthField[];

export const countryGrowthSchema = nationGrowthSchema
  .extend({
    maxGdpGrowthRate: z
      .number()
      .finite()
      .min(MAX_GDP_GROWTH_RANGE.min)
      .max(MAX_GDP_GROWTH_RANGE.max),
    localGrowthFactor: z
      .number()
      .finite()
      .min(LOCAL_GROWTH_FACTOR_RANGE.min)
      .max(LOCAL_GROWTH_FACTOR_RANGE.max),
  })
  .partial();

export type CountryGrowth = z.infer<typeof countryGrowthSchema>;
