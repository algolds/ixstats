/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see cards-archetypes-admin-auth.test.ts):
// the hoisted jest.mock() factories rely on the ambient global.
//
// Directives (intent.commit) must take effect: the spine write is linked to the Intent row,
// growth directives add a growth_rate_modifier StorytellerEffect (what the GDP projection
// reads), and zero-value levers are not applied.
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

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { intentRouter } from "~/server/api/routers/intent";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { CountryEventSpine } from "~/lib/activity";
import { assemblePackages } from "~/lib/intent/assemble";

const recordCountryEvent = CountryEventSpine.recordCountryEvent as unknown as jest.Mock;

function makeDb() {
  return {
    intent: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "intent_1",
        ...args.data,
      })),
      update: jest.fn(),
    },
    country: { findUnique: jest.fn(async () => ({ name: "Testland" })) },
    storytellerEffect: { create: jest.fn(async () => ({})) },
    budgetAllocation: { findFirst: jest.fn(async () => null), update: jest.fn() },
  };
}

const ctxFor = (db: ReturnType<typeof makeDb>) =>
  createMockRouterContext({
    db,
    auth: { userId: "user_1" },
    user: { id: "db1", clerkUserId: "user_1", countryId: "c1", role: { name: "user", level: 100 } },
  }) as never;

describe("intent.commit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recordCountryEvent.mockResolvedValue([]);
  });

  it("links the spine event to the new Intent and applies only non-zero levers", async () => {
    const db = makeDb();
    const caller = createCallerFactory(intentRouter)(ctxFor(db));
    await caller.commit({
      countryId: "c1",
      goal: "Create industrial manufacturing jobs",
      tier: "moderate",
    });

    expect(db.intent.create).toHaveBeenCalledTimes(1);
    expect(recordCountryEvent).toHaveBeenCalledTimes(1);
    const params = recordCountryEvent.mock.calls[0]![0] as {
      sourceId: string;
      consequences: Array<{ targetField: string; value: number }>;
    };
    expect(params.sourceId).toBe("intent_1");
    expect(params.consequences.length).toBeGreaterThan(0);
    expect(params.consequences.every((c) => c.value !== 0)).toBe(true);
  });

  it("adds a growth_rate_modifier StorytellerEffect for an economy directive", async () => {
    const db = makeDb();
    const caller = createCallerFactory(intentRouter)(ctxFor(db));
    await caller.commit({
      countryId: "c1",
      goal: "Create industrial manufacturing jobs",
      tier: "moderate",
    });

    expect(db.storytellerEffect.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        countryId: "c1",
        inputType: "growth_rate_modifier",
        value: 0.02,
        duration: 1,
        isActive: true,
        createdBy: "intent:intent_1",
      }),
    });
  });

  it("adds no growth effect for a security directive", async () => {
    const db = makeDb();
    const caller = createCallerFactory(intentRouter)(ctxFor(db));
    await caller.commit({ countryId: "c1", goal: "Crack down on urban crime", tier: "measured" });

    expect(db.storytellerEffect.create).not.toHaveBeenCalled();
  });
});

describe("assemblePackages", () => {
  it("never offers a zero-value lever and moves the stability score for defense", () => {
    for (const goal of [
      "Create industrial jobs",
      "Boost military defense readiness",
      "Build rail",
    ]) {
      for (const pkg of assemblePackages(goal).packages) {
        expect(pkg.consequences.every((c) => c.value !== 0)).toBe(true);
      }
    }
    const defense = assemblePackages("Boost military defense readiness").packages[1]!;
    expect(defense.consequences.map((c) => c.targetField)).toContain("stabilityScore");
    expect(defense.gdpGrowthModifier).toBe(0);
  });
});
