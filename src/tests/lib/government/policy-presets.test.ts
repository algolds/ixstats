/**
 * Policy presets (spec §4): every one of the 55 templates is offered, named in sentence case,
 * and replaces the selection with its whole set; replacing the player's own choices asks first.
 */
import {
  POLICY_PRESETS,
  getPolicyPreset,
  presetReplacesChoices,
} from "~/lib/government/policy-presets";
import { GOVERNMENT_TEMPLATES, getTemplateSelection } from "~/lib/government/data/templates";

describe("policy presets", () => {
  it("offers every template once, alphabetically, with its full component set", () => {
    expect(POLICY_PRESETS).toHaveLength(Object.keys(GOVERNMENT_TEMPLATES).length);
    expect(POLICY_PRESETS).toHaveLength(55);
    const names = POLICY_PRESETS.map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    for (const preset of POLICY_PRESETS) {
      expect(preset.components).toEqual(getTemplateSelection(preset.id));
      expect(preset.components.length).toBeGreaterThan(0);
    }
  });

  it("names presets in sentence case", () => {
    expect(getPolicyPreset("modern_democracy")?.name).toBe("Modern democracy");
    for (const { name } of POLICY_PRESETS) {
      expect(
        name
          .split(" ")
          .slice(1)
          .filter((word) => /^[A-Z][a-z]/.test(word))
      ).toEqual([]);
    }
  });

  it("asks before replacing the player's own, different choices only", () => {
    const preset = getPolicyPreset("technocracy")!.components;
    expect(presetReplacesChoices([], preset)).toBe(false);
    expect(presetReplacesChoices([...preset].reverse(), preset)).toBe(false);
    expect(presetReplacesChoices(["DEMOCRATIC_PROCESS"], preset)).toBe(true);
  });
});
