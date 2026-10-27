import type { z } from "zod";
import type { countryEconomicInputsSchema } from "~/server/shared/country-payload-builder";

export type EconInputs = NonNullable<z.infer<typeof countryEconomicInputsSchema>>;
