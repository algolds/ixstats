/** @jest-environment node */
// `jest` is the ambient global on purpose: the hoisted jest.mock() factories rely on it.
//
// Every writer of a soft score still moves the effective score by its delta now that the stored
// value is a lasting offset over the derived score (owner decision 3, 2026-10-28): issue
// consequences and directives through the event spine, elections, and the component shift
// politics drift applies. The internal stability scores carry their deltas through
// `stabilityRowData` (src/tests/lib/stability-event-deltas.test.ts).
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));
jest.mock("~/lib/diplomacy/news-generator", () => ({ generateDiplomaticNews: jest.fn() }));
jest.mock("~/lib/activity/hooks", () => ({ ActivityHooks: {} }));
jest.mock("~/server/shared/intelligence-alert-thresholds", () => ({
  evaluateCountryThresholds: jest.fn(async () => undefined),
}));

import { describe, expect, it } from "@jest/globals";
import { ComponentType } from "@prisma/client";
import { CountryEventSpine } from "~/lib/activity/event-spine";
import { applyGovernmentComponentEffects } from "~/lib/government/component-effects";
import { updatePoliticalMetrics } from "~/lib/government/election-simulation";
import { syncGovernmentComponents } from "~/server/shared/country-mutation-helpers";
import {
  deriveSoftScores,
  effectiveSoftScores,
  type SoftScoreField,
  type SoftScoreInputs,
  type StoredSoftScores,
} from "~/lib/government/soft-scores";

const NOW = Date.UTC(2042, 0, 1);

const NATION: SoftScoreInputs = {
  gdpPerCapita: 28_000,
  growthPercent: 0.5,
  unemploymentRate: 6,
  inflationRate: 3,
  giniPoints: null,
  publicApproval: 50,
  governmentType: "Federal presidential republic",
  components: [],
  budgetShares: null,
};

type Rows = { country: Record<string, number | null>; structure: Record<string, unknown> | null };

/** A db whose Country and GovernmentStructure rows are real state across calls. */
function fakeDb(rows: Rows) {
  const table = (key: keyof Rows) => ({
    findUnique: jest.fn(async () => (rows[key] ? { ...rows[key] } : null)),
    update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      rows[key] = { ...rows[key], ...data } as never;
      return rows[key];
    }),
  });
  return {
    country: table("country"),
    governmentStructure: table("structure"),
    countryChangeLog: { create: jest.fn(async () => ({})) },
    storytellerEffect: {
      findMany: jest.fn(async () => []),
      createMany: jest.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
  };
}

function storedOf(rows: Rows): StoredSoftScores {
  return { ...(rows.structure as StoredSoftScores), ...rows.country };
}

function effective(rows: Rows, field: SoftScoreField, inputs = NATION) {
  return effectiveSoftScores(inputs, storedOf(rows))[field];
}

async function spine(
  db: ReturnType<typeof fakeDb>,
  sourceType: "issue" | "decision",
  targetModel: string,
  targetField: SoftScoreField,
  operation: "add" | "subtract",
  value: number
) {
  return CountryEventSpine.recordCountryEvent({
    db: db as never,
    countryId: "c1",
    now: NOW,
    sourceType,
    description: "test",
    consequences: [{ targetModel, targetField, operation, value }],
  });
}

describe("writers keep moving the effective soft scores", () => {
  it("an issue consequence on a governance score moves it by its delta", async () => {
    const rows: Rows = {
      country: { infrastructureRating: 50 },
      structure: { corruptionIndex: 50 },
    };
    const before = effective(rows, "corruptionIndex");
    const applied = await spine(
      fakeDb(rows),
      "issue",
      "GovernmentStructure",
      "corruptionIndex",
      "subtract",
      5
    );
    expect(rows.structure?.corruptionIndex).toBe(45);
    expect(effective(rows, "corruptionIndex")).toBeCloseTo(before - 5, 5);
    // The player reads the change, not the stored offset's absolute values
    expect(applied[0]?.description).toBe("Corruption Index decreased by 5.0");
  });

  it("an issue consequence on the infrastructure rating moves it by its delta", async () => {
    const rows: Rows = { country: { infrastructureRating: 57 }, structure: null };
    const before = effective(rows, "infrastructureRating");
    await spine(fakeDb(rows), "issue", "Country", "infrastructureRating", "add", 4);
    expect(effective(rows, "infrastructureRating")).toBeCloseTo(before + 4, 5);
  });

  it("an issue consequence on an unset score starts from its seeded default", async () => {
    const rows: Rows = { country: {}, structure: { politicalPolarization: null } };
    const before = effective(rows, "politicalPolarization");
    await spine(fakeDb(rows), "issue", "GovernmentStructure", "politicalPolarization", "add", 3);
    expect(rows.structure?.politicalPolarization).toBe(53);
    expect(effective(rows, "politicalPolarization")).toBeCloseTo(before + 3, 5);
  });

  it("a directive's consequence moves effectiveness by its delta on a nation with components", async () => {
    const inputs = {
      ...NATION,
      components: [{ componentType: "RULE_OF_LAW", effectivenessScore: 70 }],
    };
    const rows: Rows = { country: {}, structure: { governmentEffectiveness: 64 } };
    const before = effective(rows, "governmentEffectiveness", inputs);
    await spine(
      fakeDb(rows),
      "decision",
      "GovernmentStructure",
      "governmentEffectiveness",
      "add",
      6
    );
    expect(effective(rows, "governmentEffectiveness", inputs)).toBeCloseTo(before + 6, 5);
  });

  it("an election's stability and democracy shifts move the effective scores by the same", async () => {
    const rows: Rows = { country: {}, structure: { politicalStability: 50, democracyIndex: 52 } };
    const stability = effective(rows, "politicalStability");
    const democracy = effective(rows, "democracyIndex");
    // A margin over 15 points: stability +5, democracy +2
    await updatePoliticalMetrics(fakeDb(rows) as never, "c1", 20);
    expect(effective(rows, "politicalStability")).toBeCloseTo(stability + 5, 5);
    expect(effective(rows, "democracyIndex")).toBeCloseTo(democracy + 2, 5);
  });

  it("politics drift's component shift moves the effective scores by the shift", async () => {
    const rows: Rows = {
      country: {},
      structure: {
        politicalStability: 50,
        democracyIndex: 50,
        governmentEffectiveness: 50,
        ruleOfLaw: 50,
        componentMetricsSnapshot: null,
      },
    };
    const before = effective(rows, "ruleOfLaw");
    await applyGovernmentComponentEffects(fakeDb(rows) as never, "c1", {
      activeComponents: [{ componentType: ComponentType.RULE_OF_LAW, effectivenessScore: 70 }],
      allocations: [],
      now: NOW,
    });
    // RULE_OF_LAW in Control Mechanisms: +3 points of rule of law
    expect(rows.structure?.ruleOfLaw).toBe(53);
    expect(effective(rows, "ruleOfLaw")).toBeCloseTo(before + 3, 5);
  });
});

describe("an empty component save", () => {
  it("stores the seeded effectiveness, so the derived score shows with no offset", async () => {
    const update = jest.fn(async () => ({}));
    const tx = {
      governmentComponent: {
        findMany: jest.fn(async () => [{ id: "gc1", componentType: "RULE_OF_LAW" }]),
        create: jest.fn(),
        deleteMany: jest.fn(async () => ({ count: 1 })),
      },
      componentSynergy: { deleteMany: jest.fn(), createMany: jest.fn() },
      governmentStructure: { update },
    };
    await syncGovernmentComponents(tx as never, "c1", []);
    const written = (
      update.mock.calls[0] as unknown as [{ data: { governmentEffectiveness: number } }]
    )[0].data.governmentEffectiveness;
    expect(written).toBe(50);
    expect(
      effectiveSoftScores(NATION, { governmentEffectiveness: written }).governmentEffectiveness
    ).toBe(deriveSoftScores(NATION).governmentEffectiveness);
  });
});
