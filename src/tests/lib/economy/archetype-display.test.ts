import { describe, it, expect } from "@jest/globals";
import {
  ARCHETYPE_DISPLAY,
  GOVERNMENT_FORM_IDS,
  POPULATION_BANDS,
  WEALTH_BANDS
} from "~/lib/economy/archetypes/display";
describe("archetype display copy", () => {
  it("uses valid band and government form ids", () => {
    for (const [id, display] of Object.entries(ARCHETYPE_DISPLAY)) {
      expect({ id, band: display.typicalPopulationBand, valid: true }).toEqual({
        id,
        band: display.typicalPopulationBand,
        valid: POPULATION_BANDS.includes(display.typicalPopulationBand),
      });
      expect({ id, band: display.typicalWealthBand, valid: true }).toEqual({
        id,
        band: display.typicalWealthBand,
        valid: WEALTH_BANDS.includes(display.typicalWealthBand),
      });
      expect({ id, form: display.startingGovernmentForm, valid: true }).toEqual({
        id,
        form: display.startingGovernmentForm,
        valid: (GOVERNMENT_FORM_IDS as readonly string[]).includes(display.startingGovernmentForm),
      });
    }
  });
});
