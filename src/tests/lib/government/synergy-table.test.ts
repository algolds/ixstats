/**
 * One synergy table (spec D13, §5): the picker, the per-component arrays and the server
 * save all read `GOVERNMENT_SYNERGY_TABLE`, so they can never disagree.
 */

import type { ComponentType } from "@prisma/client";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import {
  calculateGovernmentEffectiveness,
  checkGovernmentConflict,
  checkGovernmentSynergy,
  detectConflicts,
  detectSynergies,
} from "~/lib/government/atomic-utils";
import {
  GOVERNMENT_SYNERGY_TABLE,
  checkComponentSynergy,
  synergyScoreDelta,
} from "~/lib/government/synergy-table";

const DEFINED = Object.keys(ATOMIC_COMPONENTS) as ComponentType[];
describe("government synergy table", () => {
  it("derives each component's synergies and conflicts arrays from the table, symmetrically", () => {
    for (const type of DEFINED) {
      const component = ATOMIC_COMPONENTS[type]!;
      const expectedSynergies = GOVERNMENT_SYNERGY_TABLE.filter(
        (p) => p.type !== "CONFLICTING" && (p.a === type || p.b === type)
      ).map((p) => (p.a === type ? p.b : p.a));
      const expectedConflicts = GOVERNMENT_SYNERGY_TABLE.filter(
        (p) => p.type === "CONFLICTING" && (p.a === type || p.b === type)
      ).map((p) => (p.a === type ? p.b : p.a));

      expect([...component.synergies].sort()).toEqual(expectedSynergies.sort());
      expect([...component.conflicts].sort()).toEqual(expectedConflicts.sort());
      for (const other of component.synergies) {
        expect(ATOMIC_COMPONENTS[other]!.synergies).toContain(type);
      }
      for (const other of component.conflicts) {
        expect(ATOMIC_COMPONENTS[other]!.conflicts).toContain(type);
      }
    }
  });

  it("client detection agrees with the server checker for every pair of defined components", () => {
    for (const a of DEFINED) {
      for (const b of DEFINED) {
        if (a === b) continue;
        const server = checkComponentSynergy(a, b);
        const clientSynergy = checkGovernmentSynergy(a, b);
        const clientConflict = checkGovernmentConflict(a, b);

        if (!server) {
          expect(clientSynergy).toBe(0);
          expect(clientConflict).toBe(false);
        } else if (server.type === "CONFLICTING") {
          expect(clientConflict).toBe(true);
          expect(clientSynergy).toBe(0);
        } else {
          expect(clientConflict).toBe(false);
          expect(clientSynergy).toBe(synergyScoreDelta(server.type, server.multiplier));
          expect(clientSynergy).toBeGreaterThan(0);
        }
      }
    }
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
