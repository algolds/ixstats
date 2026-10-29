/** @jest-environment node */
/**
 * The government corpus. Every government form starts with no conflicting pair, and founding it shows the
 * effectiveness the save (`syncGovernmentComponents`) writes: one formula across the editor, the save and founding.
 * Real infobox government strings map to forms. One synergy table feeds the picker, the per-component arrays
 * and the server save, so they can never disagree. The picker's rules: a template sets its
 * whole component set, only defined components count toward the cap, a preset asks before replacing the player's own
 * choices. Component effects are dated in the nation's clock milliseconds (plan 329).
 *
 * Folds forms, synergy-table, templates, validate-selection, policy-presets and component-effects-timestamp.
 */
import { ComponentType } from "@prisma/client";
import { foundingGovernmentEffectiveness } from "~/server/shared/founding-snapshot";
import { syncGovernmentComponents } from "~/server/shared/country-mutation-helpers";
import {
  componentInteractions,
  governmentEffectiveness,
  NEW_COMPONENT_EFFECTIVENESS,
  projectComponentRecords,
  projectEffectiveness,
} from "~/lib/government/effectiveness";
import {
  GOVERNMENT_FORMS,
  matchGovernmentForm,
  type GovernmentFormId,
} from "~/lib/government/forms";
import {
  ATOMIC_COMPONENTS,
  GOVERNMENT_TEMPLATES,
  getTemplateSelection,
} from "~/lib/government/atomic-data";
import {
  calculateGovernmentEffectiveness,
  checkGovernmentConflict,
  checkGovernmentSynergy,
  countDefinedComponents,
  detectConflicts,
  detectSynergies,
  validateSelection,
} from "~/lib/government/atomic-utils";
import {
  GOVERNMENT_SYNERGY_TABLE,
  checkComponentSynergy,
  findSynergyPair,
  synergyScoreDelta,
} from "~/lib/government/synergy-table";
import { getPolicyPreset, presetReplacesChoices } from "~/lib/government/policy-presets";
import { applyGovernmentComponentEffects } from "~/lib/government/component-effects";

const DEFINED = Object.keys(ATOMIC_COMPONENTS) as ComponentType[];

/** What `syncGovernmentComponents` writes for `components` on a nation with none yet. */
async function writtenEffectiveness(
  components: Array<{ componentType: string; effectivenessScore?: number }>
) {
  let n = 0;
  const update = jest.fn().mockResolvedValue({});
  const tx = {
    governmentComponent: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(({ data }: { data: object }) => Promise.resolve({ id: `gc${n++}`, ...data })),
      deleteMany: jest.fn(),
    },
    componentSynergy: { deleteMany: jest.fn(), createMany: jest.fn() },
    governmentStructure: { update },
  };
  await syncGovernmentComponents(tx as never, "c1", components);
  return update.mock.calls[0]![0].data.governmentEffectiveness as number;
}

describe("the server's component cap", () => {
  it("refuses a save of more than 15 defined components (every component scored 100% effective)", async () => {
    await expect(
      writtenEffectiveness(DEFINED.slice(0, 16).map((componentType) => ({ componentType })))
    ).rejects.toThrow(/15/);
    await expect(
      writtenEffectiveness(DEFINED.slice(0, 15).map((componentType) => ({ componentType })))
    ).resolves.toEqual(expect.any(Number));
  });
});

describe("government forms", () => {
  it.each(GOVERNMENT_FORMS.map((form) => [form.id, form] as const))(
    "%s starts with no conflicting pair, and founding it shows what the save writes",
    async (_id, form) => {
      const conflicts = form.components.flatMap((a, i) =>
        form.components
          .slice(i + 1)
          .filter((b) => findSynergyPair(a, b)?.type === "CONFLICTING")
          .map((b) => `${a}+${b}`)
      );
      expect(conflicts).toEqual([]);

      // A duplicate and a missing score: both paths drop the one and default the other.
      const input = [
        ...form.components.map((componentType, i) =>
          i === 0 ? { componentType } : { componentType, effectivenessScore: 60 + i }
        ),
        { componentType: form.components[0]!, effectivenessScore: 99 },
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

  it.each<[string, GovernmentFormId]>([
    ["Federal presidential republic", "federal-republic"],
    ["Federal parliamentary constitutional monarchy", "constitutional-monarchy"],
    ["One-party socialist state", "one-party-state"],
    ["Military junta", "military-government"],
    ["Merchant republic ruled by an oligarchy", "merchant-oligarchy"],
    ["Unitary absolute sultanate", "absolute-monarchy"],
  ])("maps the infobox government %p to %p", (text, expected) => {
    expect(matchGovernmentForm(text)).toBe(expected);
  });
});

describe("one effectiveness formula", () => {
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

describe("one synergy table", () => {
  it("derives each component's synergies and conflicts arrays from the table, symmetrically", () => {
    for (const type of DEFINED) {
      const component = ATOMIC_COMPONENTS[type]!;
      const partners = (conflicting: boolean) =>
        GOVERNMENT_SYNERGY_TABLE.filter(
          (p) => (p.type === "CONFLICTING") === conflicting && (p.a === type || p.b === type)
        )
          .map((p) => (p.a === type ? p.b : p.a))
          .sort();
      expect({ type, synergies: [...component.synergies].sort() }).toEqual({
        type,
        synergies: partners(false),
      });
      expect({ type, conflicts: [...component.conflicts].sort() }).toEqual({
        type,
        conflicts: partners(true),
      });
      for (const other of component.synergies) {
        expect(ATOMIC_COMPONENTS[other]!.synergies).toContain(type);
      }
      for (const other of component.conflicts) {
        expect(ATOMIC_COMPONENTS[other]!.conflicts).toContain(type);
      }
    }
  });

  it("client detection agrees with the server checker for every pair of defined components", () => {
    const disagreements: string[] = [];
    for (const a of DEFINED) {
      for (const b of DEFINED) {
        if (a === b) continue;
        const server = checkComponentSynergy(a, b);
        const expected = {
          synergy:
            server && server.type !== "CONFLICTING"
              ? synergyScoreDelta(server.type, server.multiplier)
              : 0,
          conflict: server?.type === "CONFLICTING",
        };
        const client = {
          synergy: checkGovernmentSynergy(a, b),
          conflict: checkGovernmentConflict(a, b),
        };
        if (client.synergy !== expected.synergy || client.conflict !== expected.conflict) {
          disagreements.push(`${a}+${b}`);
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  it("scores a selection the same way the server save does", () => {
    const selection: ComponentType[] = [
      "DEMOCRATIC_PROCESS",
      "ELECTORAL_LEGITIMACY",
      "RULE_OF_LAW",
      "AUTOCRATIC_PROCESS",
    ];
    const metrics = calculateGovernmentEffectiveness(selection);
    let serverDelta = 0;
    for (let i = 0; i < selection.length; i++) {
      for (let j = i + 1; j < selection.length; j++) {
        const synergy = checkComponentSynergy(selection[i]!, selection[j]!);
        if (synergy) serverDelta += synergyScoreDelta(synergy.type, synergy.multiplier);
      }
    }
    expect(metrics.synergyBonus - metrics.conflictPenalty).toBe(serverDelta);
    expect(detectSynergies(selection).length).toBe(metrics.synergyCount);
    expect(detectConflicts(selection).length).toBe(metrics.conflictCount);
  });
});

describe("the picker's rules", () => {
  it("applies a template's whole component set (the old loop kept only the last pick)", () => {
    for (const id of Object.keys(GOVERNMENT_TEMPLATES)) {
      expect({ id, selection: getTemplateSelection(id) }).toEqual({
        id,
        selection: [...new Set(GOVERNMENT_TEMPLATES[id]!.components)],
      });
    }
    expect(getTemplateSelection("not-a-template")).toEqual([]);
  });

  it("counts only defined components toward the 15 cap (D7)", () => {
    expect(validateSelection(DEFINED.slice(0, 15), 15).isValid).toBe(true);
    expect(validateSelection(DEFINED.slice(0, 16), 15).errors).toEqual([
      "Maximum 15 components allowed",
    ]);
    const withGhost = [...DEFINED.slice(0, 15), "NOT_A_COMPONENT" as ComponentType];
    expect(countDefinedComponents(withGhost)).toBe(15);
    expect(validateSelection(withGhost, 15).isValid).toBe(true);
  });

  it("asks before a preset replaces the player's own, different choices only", () => {
    const preset = getPolicyPreset("technocracy")!.components;
    expect(presetReplacesChoices([], preset)).toBe(false);
    expect(presetReplacesChoices([...preset].reverse(), preset)).toBe(false);
    expect(presetReplacesChoices(["DEMOCRATIC_PROCESS"], preset)).toBe(true);
  });
});

describe("component effects", () => {
  afterEach(() => jest.restoreAllMocks());

  it("dates every effect at the nation's clock time in milliseconds, not ×1000 (plan 329)", async () => {
    const fixed = Date.UTC(2042, 0, 1);
    const createMany = jest.fn(({ data }: { data: object[] }) =>
      Promise.resolve({ count: data.length })
    );
    const db = {
      storytellerEffect: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany,
      },
      governmentStructure: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
      },
    };

    const result = await applyGovernmentComponentEffects(db as never, "country_1", {
      activeComponents: [
        { componentType: ComponentType.PROFESSIONAL_BUREAUCRACY, effectivenessScore: 70 },
        { componentType: ComponentType.DEMOCRATIC_PROCESS, effectivenessScore: 60 },
      ],
      allocations: [],
      now: fixed,
    });

    expect(result.effectsCreated).toBeGreaterThan(0);
    const data = (
      createMany.mock.calls as Array<[{ data: Array<{ ixTimeTimestamp: Date }> }]>
    )[0]![0].data;
    expect(data).toHaveLength(result.effectsCreated);
    expect(new Set(data.map((effect) => effect.ixTimeTimestamp.getTime()))).toEqual(
      new Set([fixed])
    );
  });
});

describe("projectEffectiveness", () => {
  it("follows the economy's score when no institutions are kept, not the components formula's 0", () => {
    expect(projectEffectiveness([], 58.4)).toBe(58);
  });

  it("uses the components formula when institutions are kept", () => {
    const records = [{ componentType: ComponentType.RULE_OF_LAW, effectivenessScore: 80 }];
    expect(projectEffectiveness(records, 58)).toBe(Math.round(governmentEffectiveness(records)));
  });
});
