/**
 * Policy presets (spec §4): every one of the 55 templates is offered, named in sentence case,
 * and replaces the selection with its whole set; replacing the player's own choices asks first.
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
