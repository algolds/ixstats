/**
 * Government effectiveness has one formula: the editor's consequence line, the save
 * (`syncGovernmentComponents`) and founding all compute the same number.
 */
import { foundingGovernmentEffectiveness } from "~/server/shared/founding-snapshot";
import { syncGovernmentComponents } from "~/server/shared/country-mutation-helpers";
import {
  componentInteractions,
  governmentEffectiveness,
  NEW_COMPONENT_EFFECTIVENESS,
  projectComponentRecords,
} from "~/lib/government/effectiveness";
import { GOVERNMENT_FORMS } from "~/lib/government/forms";

describe("government effectiveness", () => {
  /** What `syncGovernmentComponents` writes for `components` on a nation with none yet. */
  async function writtenEffectiveness(
    components: Array<{ componentType: string; effectivenessScore?: number }>
  ) {
    let n = 0;
    const update = jest.fn().mockResolvedValue({});
    const tx = {
      governmentComponent: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(({ data }: { data: object }) =>
          Promise.resolve({ id: `gc${n++}`, ...data })
        ),
        deleteMany: jest.fn(),
      },
      componentSynergy: { deleteMany: jest.fn(), createMany: jest.fn() },
      governmentStructure: { update },
    };
    await syncGovernmentComponents(tx as never, "c1", components);
    return update.mock.calls[0]![0].data.governmentEffectiveness as number;
  }

  it.each(GOVERNMENT_FORMS.map((form) => [form.name, form.components] as const))(
    "founding a %s shows what the save writes",
    async (_name, components) => {
      // A duplicate and a missing score: both paths drop the one and default the other.
      const input = [
        ...components.map((componentType, i) =>
          i === 0 ? { componentType } : { componentType, effectivenessScore: 60 + i }
        ),
        { componentType: components[0]!, effectivenessScore: 99 },
      ];
      const founding = foundingGovernmentEffectiveness(input as never);
      expect(founding).toBe(await writtenEffectiveness(input));
      expect(founding).toBe(
        governmentEffectiveness(
          projectComponentRecords(
            [],
            input.map((c) => c.componentType)
          ).map((r, i) => (i === 0 ? r : { ...r, effectivenessScore: 60 + i }))
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
