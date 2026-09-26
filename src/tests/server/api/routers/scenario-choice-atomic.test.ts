/**
 * Plan 331: recordChoice resolves a scenario with a conditional updateMany, so a
 * scenario can be completed (and paid) only once.
 */

jest.mock("~/lib/vault/vault-service", () => ({
  __esModule: true,
  vaultService: {
    earnCredits: jest.fn().mockResolvedValue({ success: true, newBalance: 10 }),
  },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { diplomaticScenariosChoicesRouter } from "~/server/api/routers/diplomaticScenarios/choices";
import { vaultService } from "~/lib/vault/vault-service";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

const createCaller = createCallerFactory(diplomaticScenariosChoicesRouter);

const COUNTRY_A = "ckcountrya0000000000001";
const COUNTRY_B = "ckcountryb0000000000002";
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
    createdAt: new Date(Date.now() - 86_400_000),
    expiresAt: new Date(Date.now() + 86_400_000),
    responseOptions: JSON.stringify([
      { id: "choice_1", label: "Choice 1", riskLevel: "low", effects: { culturalImpact: 10 } },
    ]),
    tags: JSON.stringify([]),
    culturalImpact: 10,
    diplomaticRisk: 5,
    ...overrides,
  };
}

function makeCaller() {
  const db = createMockDb();
  db.culturalScenario.findUnique = jest.fn().mockResolvedValue(makeScenario() as never);
  db.culturalScenario.findUniqueOrThrow = jest
    .fn()
    .mockResolvedValue(makeScenario({ status: "completed" }) as never);
  db.country.findUnique = jest
    .fn()
    .mockResolvedValue({ id: COUNTRY_A, name: "Country A", flag: null } as never);

  const ctx = createMockRouterContext({
    auth: { userId: "user_owns_a" },
    user: {
      id: "db_user_a",
      clerkUserId: "user_owns_a",
      countryId: COUNTRY_A,
      role: { name: "user", level: 100 },
    },
    db,
  });
  return { db, caller: createCaller(ctx as never) };
}

const input = {
  scenarioId: SCENARIO_ID,
  countryId: COUNTRY_A,
  choiceId: "choice_1",
  choiceLabel: "Choice 1",
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("diplomaticScenarios.recordChoice atomic resolution", () => {
  it("throws CONFLICT when another request resolved the scenario first; nothing else is written", async () => {
    const { db, caller } = makeCaller();
    db.culturalScenario.updateMany = jest.fn().mockResolvedValue({ count: 0 } as never);

    await expect(caller.recordChoice(input)).rejects.toMatchObject({ code: "CONFLICT" });

    expect(db.culturalExchange.create).not.toHaveBeenCalled();
    expect(vaultService.earnCredits).not.toHaveBeenCalled();
  });

  it("resolves through a conditional updateMany (still open, not expired) and awards credits once", async () => {
    const { db, caller } = makeCaller();
    db.culturalScenario.updateMany = jest.fn().mockResolvedValue({ count: 1 } as never);

    const result = await caller.recordChoice(input);

    expect(result.success).toBe(true);
    expect(result.scenario.status).toBe("completed");
    expect(db.culturalScenario.updateMany).toHaveBeenCalledTimes(1);
    expect(db.culturalScenario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: SCENARIO_ID,
          status: { in: ["active", "pending"] },
          expiresAt: { gt: expect.any(Date) },
        },
        data: expect.objectContaining({ status: "completed", chosenOption: "choice_1" }),
      })
    );
    expect(db.culturalScenario.update).not.toHaveBeenCalled();
    expect(db.culturalExchange.create).toHaveBeenCalledTimes(1);
    expect(vaultService.earnCredits).toHaveBeenCalledTimes(1);
  });
});
