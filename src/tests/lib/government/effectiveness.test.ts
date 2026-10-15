/**
 * Government effectiveness has one formula: the editor's consequence line, the save
 * (`syncGovernmentComponents`) and founding all compute the same number.
 */
import { foundingGovernmentEffectiveness } from "~/server/shared/founding-snapshot";
import {
  componentInteractions,
  governmentEffectiveness,
  NEW_COMPONENT_EFFECTIVENESS,
  projectComponentRecords,
} from "~/lib/government/effectiveness";
import { GOVERNMENT_FORMS } from "~/lib/government/forms";

describe("government effectiveness", () => {
  it.each(GOVERNMENT_FORMS.map((form) => [form.name, form.components] as const))(
    "matches founding for a %s",
    (_name, components) => {
      const records = components.map((componentType) => ({
        componentType,
        effectivenessScore: 60,
      }));
      expect(governmentEffectiveness(records)).toBe(
        foundingGovernmentEffectiveness(
          components.map((componentType) => ({ componentType, effectivenessScore: 60 }))
        )
      );
    }
  );

  it("adds conflicts as penalties and clamps to 0 to 100", () => {
    const conflict = componentInteractions(["DEMOCRATIC_PROCESS", "AUTOCRATIC_PROCESS"]);
    expect(conflict.map((c) => c.type)).toContain("CONFLICTING");
    expect(
      governmentEffectiveness([
        { componentType: "DEMOCRATIC_PROCESS", effectivenessScore: 5 },
        { componentType: "AUTOCRATIC_PROCESS", effectivenessScore: 5 },
      ])
    ).toBe(0);
    expect(governmentEffectiveness([])).toBe(0);
  });

  it("keeps the score of components the nation has and starts new ones at the default", () => {
    const existing = [
      { componentType: "RULE_OF_LAW", effectivenessScore: 80 },
      { componentType: "DEMOCRATIC_PROCESS", effectivenessScore: 70 },
    ];
    expect(
      projectComponentRecords(existing, ["RULE_OF_LAW", "INDEPENDENT_JUDICIARY", "RULE_OF_LAW"])
    ).toEqual([
      { componentType: "RULE_OF_LAW", effectivenessScore: 80 },
      { componentType: "INDEPENDENT_JUDICIARY", effectivenessScore: NEW_COMPONENT_EFFECTIVENESS },
    ]);
  });
});
