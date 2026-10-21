/** @jest-environment node */
/**
 * Issue consequences on GDP / population / GDP growth become StorytellerEffects the projection
 * applies (the stored fields they used to write were overwritten on read or read by nothing).
 */
import {
  issueConsequenceToEffect,
  MAX_ISSUE_GDP_LEVEL_SHIFT,
  MAX_ISSUE_POPULATION_LEVEL_SHIFT,
} from "~/lib/national-issues/projection-effects";
import type { ConsequenceDefinition } from "~/lib/national-issues/types";

const c = (
  targetField: string,
  operation: ConsequenceDefinition["operation"],
  value: number,
  extra: Partial<ConsequenceDefinition> = {}
): ConsequenceDefinition => ({ targetModel: "Country", targetField, operation, value, ...extra });

describe("issueConsequenceToEffect", () => {
  it("compounds growth over durationDays (whole IxTime years, at least 1)", () => {
    const spec = issueConsequenceToEffect(
      c("actualGdpGrowth", "add", 1, { durationDays: 730, effectType: "gradual" })
    );
    expect(spec?.duration).toBe(2);
    expect(spec?.value).toBeCloseTo(0.0201, 4);
    expect(
      issueConsequenceToEffect(c("actualGdpGrowth", "add", 1, { durationDays: 30 }))?.duration
    ).toBe(1);
  });

  it("caps a single growth consequence", () => {
    expect(issueConsequenceToEffect(c("actualGdpGrowth", "add", 4))?.value).toBe(
      MAX_ISSUE_GDP_LEVEL_SHIFT
    );
  });
  it("turns a population multiplier into a population level effect", () => {
    expect(issueConsequenceToEffect(c("currentPopulation", "multiply", 1.002))).toMatchObject({
      inputType: "population_level_adjustment",
      value: 0.002,
      duration: null,
    });
    expect(issueConsequenceToEffect(c("currentPopulation", "multiply", 0.5))?.value).toBe(
      -MAX_ISSUE_POPULATION_LEVEL_SHIFT
    );
  });

  it("drops consequences with no faithful mapping", () => {
    expect(issueConsequenceToEffect(c("actualGdpGrowth", "set", 3))).toBeNull();
    expect(issueConsequenceToEffect(c("actualGdpGrowth", "multiply", 1.1))).toBeNull();
    expect(issueConsequenceToEffect(c("currentTotalGdp", "add", 1e9))).toBeNull();
    expect(issueConsequenceToEffect(c("currentTotalGdp", "multiply", 1))).toBeNull();
    expect(issueConsequenceToEffect(c("publicApproval", "add", 3))).toBeNull();
  });
});
