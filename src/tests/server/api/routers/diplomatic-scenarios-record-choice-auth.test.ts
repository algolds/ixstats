// `jest` is deliberately NOT imported from "@jest/globals" here — see the note in
// trpc-impersonation.test.ts: the jest.mock() factory below calls jest.fn() inline, and
// jest.mock() calls are hoisted above imports, so importing `jest` under that same name would
// shadow the ambient global that hoisted factory relies on.
jest.mock("~/lib/vault/vault-service", () => ({
  __esModule: true,
  vaultService: {
    earnCredits: jest.fn().mockResolvedValue({ success: true }),
  },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { diplomaticScenariosChoicesRouter } from "~/server/api/routers/diplomaticScenarios/choices";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

const createCaller = createCallerFactory(diplomaticScenariosChoicesRouter);

const COUNTRY_A = "ckcountrya0000000000001";
const COUNTRY_B = "ckcountryb0000000000002";
const COUNTRY_C = "ckcountryc0000000000003";
const SCENARIO_ID = "ckscenario00000000000004";

function makeScenario(overrides: Record<string, unknown> = {}) {
  return {
    id: SCENARIO_ID,
    type: "cultural_exchange",
    title: "Test Scenario",
    narrative: "Narrative",
    country1Id: COUNTRY_A,
    country2Id: COUNTRY_B,
    status: "active",
    expiresAt: new Date(Date.now() + 86_400_000),
    responseOptions: JSON.stringify([
      { id: "choice_1", label: "Choice 1", effects: { culturalImpact: 10 } },
    ]),
    tags: JSON.stringify([]),
    culturalImpact: 10,
    diplomaticRisk: 5,
    ...overrides,
  };
}

const ownerOfCountryACtx = (db: ReturnType<typeof createMockDb>) =>
  createMockRouterContext({
    auth: { userId: "user_owns_a" },
    user: {
      id: "db_user_a",
      clerkUserId: "user_owns_a",
      countryId: COUNTRY_A,
      role: { name: "user", level: 100 },
    },
    db,
  });

const anonymousCtx = () => createMockRouterContext({ auth: null, user: null });

describe("diplomaticScenarios.recordChoice auth (Finding 5)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects an anonymous caller", async () => {
    const db = createMockDb();
    const caller = createCaller(anonymousCtx() as never);

    await expect(
      caller.recordChoice({
        scenarioId: SCENARIO_ID,
        countryId: COUNTRY_A,
        choiceId: "choice_1",
        choiceLabel: "Choice 1",
      })
    ).rejects.toThrow();
  });

  it("rejects a user recording a choice for a country they don't own, without updating the scenario", async () => {
    const db = createMockDb();
    // Fresh-lookup fallback inside assertCountryWriteAccess must agree the user only owns A.
    db.user.findUnique = jest
      .fn()
      .mockResolvedValue({ countryId: COUNTRY_A, role: { name: "user" } } as never);
    // Target country C exists, so assertCountryWriteAccess reports FORBIDDEN (not NOT_FOUND).
    db.country.findUnique = jest.fn().mockResolvedValue({ id: COUNTRY_C } as never);
    db.culturalScenario.findUnique = jest.fn().mockResolvedValue(makeScenario() as never);

    const caller = createCaller(ownerOfCountryACtx(db) as never);

    await expect(
      caller.recordChoice({
        scenarioId: SCENARIO_ID,
        countryId: COUNTRY_C,
        choiceId: "choice_1",
        choiceLabel: "Choice 1",
      })
    ).rejects.toThrow();
    expect(db.culturalScenario.update).not.toHaveBeenCalled();
  });

  it("resolves for the owner of country1Id recording a choice for their own country", async () => {
    const db = createMockDb();
    db.culturalScenario.findUnique = jest.fn().mockResolvedValue(makeScenario() as never);
    db.culturalScenario.update = jest.fn().mockResolvedValue(makeScenario({ status: "completed" }) as never);
    db.country.findUnique = jest
      .fn()
      .mockResolvedValue({ id: COUNTRY_A, name: "Country A", flag: null } as never);

    const caller = createCaller(ownerOfCountryACtx(db) as never);

    const result = await caller.recordChoice({
      scenarioId: SCENARIO_ID,
      countryId: COUNTRY_A,
      choiceId: "choice_1",
      choiceLabel: "Choice 1",
    });

    expect(result.success).toBe(true);
    expect(db.culturalScenario.update).toHaveBeenCalledTimes(1);
  });

  it("forbids the owner of country1Id from recording a choice for a scenario that doesn't involve them", async () => {
    const db = createMockDb();
    // The scenario is between B and C — country A (the caller's own country) isn't a party to it.
    db.culturalScenario.findUnique = jest
      .fn()
      .mockResolvedValue(makeScenario({ country1Id: COUNTRY_B, country2Id: COUNTRY_C }) as never);

    const caller = createCaller(ownerOfCountryACtx(db) as never);

    await expect(
      caller.recordChoice({
        scenarioId: SCENARIO_ID,
        countryId: COUNTRY_A,
        choiceId: "choice_1",
        choiceLabel: "Choice 1",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.culturalScenario.update).not.toHaveBeenCalled();
  });
});
