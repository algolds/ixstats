/**
 * Policy presets (spec §4): replacing the player's own, different choices asks first.
 */
import {
  getPolicyPreset,
  presetReplacesChoices,
} from "~/lib/government/policy-presets";
describe("policy presets", () => {
  it("asks before replacing the player's own, different choices only", () => {
    const preset = getPolicyPreset("technocracy")!.components;
    expect(presetReplacesChoices([], preset)).toBe(false);
    expect(presetReplacesChoices([...preset].reverse(), preset)).toBe(false);
    expect(presetReplacesChoices(["DEMOCRATIC_PROCESS"], preset)).toBe(true);
  });
});
