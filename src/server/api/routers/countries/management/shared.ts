import type { Country } from "@prisma/client";
import type { z } from "zod";
import type { countryEconomicInputsSchema } from "~/server/shared/country-payload-builder";

export type EconInputs = NonNullable<z.infer<typeof countryEconomicInputsSchema>>;
export type NumberKey = {
  [K in keyof Country]: Country[K] extends number | null ? K : never;
}[keyof Country];

/** A percent input as a fraction; absent stays absent. */
export const pct = (value: number | undefined) => (value === undefined ? undefined : value / 100);
