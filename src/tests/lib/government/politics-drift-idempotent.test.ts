/** @jest-environment node */
/**
 * politics-drift runs applyGovernmentComponentEffects every tick (MyCountry audit P0-16). It must
 * be idempotent: political metrics are base + the component shift (never compounding), event
 * deltas in between are carried, component economic effects are GDP level effects upserted in
 * place (no rows when nothing changed), and Social Policy no longer adds population growth.
 */
import { ComponentType } from "@prisma/client";
import { applyGovernmentComponentEffects } from "~/lib/government/component-effects";
import { evaluateTriggerCondition } from "~/lib/national-issues/evaluators/condition-evaluator";
import { buildRankTable } from "~/lib/national-issues/evaluators/realm-rank";
import { NATIONAL_ISSUE_TEMPLATES } from "../../../../prisma/seeds/national-issue-templates";

interface Row {
  countryId: string;
  inputType: string;
  value: number;
  duration: number | null;
  description: string | null;
  createdBy: string | null;
  worldEventId: string | null;
  isActive: boolean;
  ixTimeTimestamp: Date;
}

interface Structure {
  politicalStability: number | null;
  democracyIndex: number | null;
  governmentEffectiveness: number | null;
  ruleOfLaw: number | null;
  componentMetricsSnapshot: string | null;
}

function fakeDb(structure: Structure) {
  const effects: Row[] = [];
  const db = {
    storytellerEffect: {
      findMany: jest.fn(() => Promise.resolve(effects.filter((e) => e.isActive))),
      createMany: jest.fn(({ data }: { data: Row[] }) => {
        effects.push(...data);
        return Promise.resolve({ count: data.length });
      }),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
    governmentStructure: {
      findUnique: jest.fn(() => Promise.resolve({ ...structure })),
      update: jest.fn(({ data }: { data: Partial<Structure> }) => {
        Object.assign(structure, data);
        return Promise.resolve(structure);
      }),
    },
  };
  return { db, effects, structure };
}

const components = [
  { componentType: ComponentType.CENTRALIZED_POWER, effectivenessScore: 70 },
  { componentType: ComponentType.FEDERAL_SYSTEM, effectivenessScore: 70 },
  { componentType: ComponentType.DEMOCRATIC_PROCESS, effectivenessScore: 70 },
  { componentType: ComponentType.ELECTORAL_LEGITIMACY, effectivenessScore: 70 },
  { componentType: ComponentType.PROFESSIONAL_BUREAUCRACY, effectivenessScore: 70 },
  { componentType: ComponentType.WELFARE_STATE, effectivenessScore: 70 },
];

/** The nation's clock time the drift tick passes (politics-drift reads it from the realm's clock). */
const NOW = Date.UTC(2042, 0, 1);

const run = (db: ReturnType<typeof fakeDb>["db"]) =>
  applyGovernmentComponentEffects(db as never, "c1", {
    activeComponents: components,
    allocations: [],
    now: NOW,
  });

describe("politics-drift component effects", () => {
  it("recomputes political metrics from base + components instead of compounding", async () => {
    const { db, structure } = fakeDb({
      politicalStability: 50,
      democracyIndex: 50,
      governmentEffectiveness: 50,
      ruleOfLaw: 50,
      componentMetricsSnapshot: null,
    });

    await run(db);
    const afterFirst = { ...structure };
    // 0-100 scale: 2 Power Distribution (+3 each) and 1 Legitimacy (+2.5) component.
    expect(afterFirst.politicalStability).toBeCloseTo(58.5, 9);
    expect(afterFirst.democracyIndex).toBeGreaterThan(50);

    await run(db);
    await run(db);
    expect(structure.politicalStability).toBeCloseTo(afterFirst.politicalStability!, 9);
    expect(structure.democracyIndex).toBeCloseTo(afterFirst.democracyIndex!, 9);
    expect(structure.governmentEffectiveness).toBeCloseTo(afterFirst.governmentEffectiveness!, 9);
  });

  it("carries an event delta applied between runs", async () => {
    const { db, structure } = fakeDb({
      politicalStability: 50,
      democracyIndex: 50,
      governmentEffectiveness: 50,
      ruleOfLaw: 50,
      componentMetricsSnapshot: null,
    });
    await run(db);
    const afterFirst = structure.democracyIndex!;
    structure.democracyIndex = afterFirst - 5; // e.g. an issue consequence

    await run(db);
    expect(structure.democracyIndex).toBeCloseTo(afterFirst - 5, 9);
  });

  it("writes GDP level effects once, keyed per category, and nothing on the next runs", async () => {
    const { db, effects } = fakeDb({
      politicalStability: 50,
      democracyIndex: 50,
      governmentEffectiveness: 50,
      ruleOfLaw: 50,
      componentMetricsSnapshot: null,
    });

    const first = await run(db);
    expect(first.effectsCreated).toBeGreaterThan(0);
    expect(new Set(effects.map((e) => e.inputType))).toEqual(new Set(["gdp_level_adjustment"]));
    expect(effects.every((e) => e.createdBy?.startsWith("component:"))).toBe(true);
    expect(effects.some((e) => e.description?.includes("Social Policy"))).toBe(false);

    const second = await run(db);
    expect(second.effectsCreated).toBe(0);
    expect(effects).toHaveLength(first.effectsCreated);
  });

  it("keeps stability on the 0-100 scale the issue templates trigger on", async () => {
    const { db, structure } = fakeDb({
      politicalStability: null, // a fresh structure: the 0-100 fallback (50) applies
      democracyIndex: 50,
      governmentEffectiveness: 50,
      ruleOfLaw: 50,
      componentMetricsSnapshot: null,
    });
    await run(db);

    // Templates rank politicalStability against the realm; their absolute part is the crisis floor, on the 0-100
    // scale. The realm's least stable nation at a fresh structure's ~50 is no crisis; on a 0-1 scale it would be.
    const territorial = NATIONAL_ISSUE_TEMPLATES.find((t) => t.slug === "territorial_dispute")!;
    expect(territorial.triggerConditions).toContain("politicalStability");
    const stability = structure.politicalStability!;
    expect(stability).toBeGreaterThan(30);
    const realm = (own: number) =>
      buildRankTable([
        { id: "c1", values: { politicalStability: own } },
        ...Array.from({ length: 11 }, (_, i) => ({ id: `n${i}`, values: { politicalStability: 60 + i } })),
      ]);
    const fires = (own: number) =>
      evaluateTriggerCondition(
        JSON.parse(territorial.triggerConditions),
        { id: "c1", politicalStability: own, activeAllianceCount: 0 } as never,
        { ranks: realm(own), severity: territorial.baseSeverity }
      );
    expect(fires(stability)).toBe(false);
    expect(fires(stability / 100)).toBe(true);
  });
});
