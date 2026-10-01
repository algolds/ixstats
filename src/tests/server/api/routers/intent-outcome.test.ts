/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see intent-commit-effects.test.ts):
// the hoisted jest.mock() factories rely on the ambient global.
//
// The Directives page reads a directive's recorded outcome (intent.getOutcome) and the GDP
// level shift a package would record (intent.suggest → gdpLevelShift).
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { user: { findUnique: jest.fn() }, auditLog: { create: jest.fn() } },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: () => false,
}));
jest.mock("~/lib/activity", () => ({
  __esModule: true,
  CountryEventSpine: { recordCountryEvent: jest.fn() },
}));
jest.mock("~/lib/intent/resistance", () => ({
  __esModule: true,
  spawnIntentResistance: jest.fn(),
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { intentRouter } from "~/server/api/routers/intent";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { growthModifierToLevelShift } from "~/lib/economy/calculations";
import { GROWTH_EFFECT_YEARS } from "~/lib/intent/assemble";

type IntentFixture = { id: string; countryId: string; status: string; tier: string };

function makeDb(intent: IntentFixture | null) {
  return {
    intent: {
      findUnique: jest.fn(async () => intent),
      findMany: jest.fn(async () => []),
    },
    countryChangeLog: {
      findMany: jest.fn(async () => [
        {
          id: "log_1",
          targetField: "unemploymentRate",
          previousValue: "6.5",
          newValue: "6.2",
          deltaValue: -0.3,
          appliedIxTime: 1000,
        },
        {
          id: "log_2",
          targetField: "publicApproval",
          previousValue: '"n/a"',
          newValue: null,
          deltaValue: 1,
          appliedIxTime: 1000,
        },
      ]),
    },
    storytellerEffect: {
      findMany: jest.fn(async () => [{ id: "fx_1", value: 0.000583, duration: 1, isActive: true }]),
    },
    governmentComponent: { findMany: jest.fn(async () => []) },
    budgetAllocation: { findMany: jest.fn(async () => []) },
    governmentStructure: { findUnique: jest.fn(async () => null) },
  };
}

// A signed-out visitor: getOutcome serves enacted directives to anyone.
const ctxFor = (db: ReturnType<typeof makeDb>) =>
  createMockRouterContext({ db, auth: { userId: null }, user: null }) as never;
// suggest is the owner's (it reads the nation's weekly slots and broker standing).
const ownerCtxFor = (db: ReturnType<typeof makeDb>) =>
  createMockRouterContext({
    db,
    auth: { userId: "owner_clerk" },
    user: { id: "owner_db", clerkUserId: "owner_clerk", countryId: "c1", role: { name: "member" } },
  }) as never;

describe("intent.getOutcome", () => {
  it("returns the directive's ledger rows (numeric before/after) and its GDP effect", async () => {
    const db = makeDb({ id: "intent_1", countryId: "c1", status: "active", tier: "measured" });
    const caller = createCallerFactory(intentRouter)(ctxFor(db));
    const out = await caller.getOutcome({ intentId: "intent_1" });

    expect(db.countryChangeLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: "c1", sourceId: "intent_1" } })
    );
    expect(db.storytellerEffect.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: "c1", createdBy: "intent:intent_1" } })
    );
    expect(out.ledger[0]).toEqual({
      id: "log_1",
      targetField: "unemploymentRate",
      deltaValue: -0.3,
      previousValue: 6.5,
      newValue: 6.2,
      appliedIxTime: 1000,
    });
    // Non-numeric stored values degrade to null instead of throwing.
    expect(out.ledger[1]).toMatchObject({ previousValue: null, newValue: null, deltaValue: 1 });
    expect(out.gdpEffects).toEqual([{ id: "fx_1", value: 0.000583, duration: 1, isActive: true }]);
  });

  it("is NOT_FOUND for an unknown directive", async () => {
    const db = makeDb(null);
    const caller = createCallerFactory(intentRouter)(ctxFor(db));
    await expect(caller.getOutcome({ intentId: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("intent.suggest", () => {
  it("adds the GDP level shift commit() would record to each package", async () => {
    const db = makeDb(null);
    const caller = createCallerFactory(intentRouter)(ownerCtxFor(db));
    const res = await caller.suggest({ countryId: "c1", goal: "Create industrial jobs" });

    for (const p of res.packages) {
      const expected =
        p.gdpGrowthModifier > 0
          ? growthModifierToLevelShift(p.gdpGrowthModifier, GROWTH_EFFECT_YEARS)
          : 0;
      expect(p.gdpLevelShift).toBe(expected);
      expect(p.gdpEffectYears).toBe(GROWTH_EFFECT_YEARS);
    }
    expect(res.packages.some((p) => p.gdpLevelShift > 0)).toBe(true);
  });
});
