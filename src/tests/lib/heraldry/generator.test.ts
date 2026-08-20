import { describe, it, expect } from "@jest/globals";
import { generateRandomComposition } from "~/lib/heraldry/generator";
import { validateComposition } from "~/lib/heraldry/validation";
import { compositionSchema } from "~/lib/heraldry/composition-schema";

describe("generateRandomComposition", () => {
  it("returns a valid composition parsing the Zod schema", () => {
    const comp = generateRandomComposition();
    const result = compositionSchema.safeParse(comp);
    expect(result.success).toBe(true);
  });

  it("always contains at least one tincture on the field", () => {
    const comp = generateRandomComposition();
    expect(comp.shield.field.tinctures.length).toBeGreaterThanOrEqual(1);
    expect(comp.shield.field.tinctures[0]).toBeDefined();
  });

  it("applies government type and culture biases properly", () => {
    // Republic bias -> round shield
    const republicComp = generateRandomComposition({ governmentType: "republic" });
    expect(republicComp.shield.shape).toBe("round");

    // Germanic bias -> eagle charge
    let hasEagle = false;
    for (let i = 0; i < 20; i++) {
      const germanicComp = generateRandomComposition({ cultureGroup: "germanic" });
      if (germanicComp.shield.charges?.[0]?.chargeId === "eagle") {
        hasEagle = true;
        break;
      }
    }
    expect(hasEagle).toBe(true);
  });

  it("passes Rule of Tincture audit with zero caution-level warnings", () => {
    // Generate 20 random compositions and ensure none have caution warnings (Rule of Tincture errors)
    for (let i = 0; i < 20; i++) {
      const comp = generateRandomComposition();
      const warnings = validateComposition(comp);
      const cautions = warnings.filter((w) => w.severity === "caution");
      expect(cautions).toEqual([]);
    }
  });
});
