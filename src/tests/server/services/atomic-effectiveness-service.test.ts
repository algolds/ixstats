/** @jest-environment node */
/**
 * AtomicEffectivenessService reads its synergies and conflicts from the shared synergy table
 * (`~/lib/government/synergy-table`), the same pairs the picker, founding and the save use, and
 * scores them the same way.
 */
import { describe, it, expect, jest } from "@jest/globals";
import type { ComponentType } from "@prisma/client";
import { getAtomicEffectivenessService } from "~/server/services/AtomicEffectivenessService";
import {
  CONFLICT_PENALTY,
  findSynergyPair,
  GOVERNMENT_SYNERGY_TABLE,
  SYNERGY_BONUS,
} from "~/lib/government/synergy-table";
import { GOVERNMENT_FORMS } from "~/lib/government/forms";

const upsert = jest.fn(({ create }: { create: object }) => Promise.resolve(create));
let rows: Array<{ id: string; componentType: ComponentType }> = [];
const db = {
  governmentComponent: {
    findMany: jest.fn(() => Promise.resolve(rows)),
    findFirst: jest.fn(({ where }: { where: { componentType: ComponentType } }) =>
      Promise.resolve(rows.find((r) => r.componentType === where.componentType) ?? null)
    ),
  },
  atomicEffectiveness: { upsert },
  componentSynergy: {
    findFirst: jest.fn(() => Promise.resolve({ id: "exists" })),
    create: jest.fn(),
  },
};
const service = getAtomicEffectivenessService(db as never);

const synergyPair = GOVERNMENT_SYNERGY_TABLE.find((pair) => pair.type !== "CONFLICTING")!;
const conflictPair = GOVERNMENT_SYNERGY_TABLE.find((pair) => pair.type === "CONFLICTING")!;

describe("AtomicEffectivenessService and the synergy table", () => {
  it("finds exactly the table's pairs among a nation's components", () => {
    for (const form of GOVERNMENT_FORMS) {
      const types = form.components as ComponentType[];
      const found = [
        ...service.detectPotentialSynergies(types),
        ...service.detectConflicts(types),
      ].map((rule) => rule.components.join("+"));
      const expected = types.flatMap((a, i) =>
        types.slice(i + 1).flatMap((b) => (findSynergyPair(a, b) ? [`${a}+${b}`] : []))
      );
      expect(found.sort()).toEqual(expected.sort());
    }
  });

  it("splits helping pairs from conflicts, with the table's descriptions", () => {
    const types = [synergyPair.a, synergyPair.b, conflictPair.a, conflictPair.b];
    const synergies = service.detectPotentialSynergies(types);
    const conflicts = service.detectConflicts(types);
    expect(synergies.map((s) => s.description)).toContain(synergyPair.description);
    expect(conflicts.map((c) => c.description)).toContain(conflictPair.description);
    expect(synergies.every((s) => s.synergyType !== "CONFLICTING")).toBe(true);
    expect(conflicts.every((c) => c.synergyType === "CONFLICTING")).toBe(true);
  });

  it("scores a synergy and a conflict with the table's points", async () => {
    rows = [synergyPair.a, synergyPair.b].map((componentType, i) => ({
      id: `s${i}`,
      componentType,
    }));
    const helped = await service.calculateEffectiveness("c_synergy");
    expect(helped.synergyBonus).toBe(SYNERGY_BONUS);
    expect(helped.conflictPenalty).toBe(0);

    rows = [conflictPair.a, conflictPair.b].map((componentType, i) => ({
      id: `c${i}`,
      componentType,
    }));
    const hurt = await service.calculateEffectiveness("c_conflict");
    expect(hurt.synergyBonus).toBe(0);
    expect(hurt.conflictPenalty).toBe(CONFLICT_PENALTY);
  });
});
