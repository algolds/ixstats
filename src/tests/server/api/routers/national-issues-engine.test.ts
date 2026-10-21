/** @jest-environment node */
/**
 * nationalIssues engine procedures: configuration, stats, manual evaluation and the world audit
 * list are admin only; the public splash list returns at most `limit` issues, one per nation.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factory below calls jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("~/lib/national-issues", () => ({
  __esModule: true,
  NationalIssuesEngine: {
    forceGenerate: jest.fn().mockResolvedValue(null),
    evaluateCountry: jest.fn().mockResolvedValue({ generated: 1 }),
  },
  getNationalIssuesConfig: jest.fn(() => ({ maxIssuesPerSession: 3, maxIssuesPerWeek: 10 })),
  saveNationalIssuesConfig: jest.fn(),
  completeNationalIssuesConfig: jest.fn((input: object) => ({
    spawnMode: "probability",
    ...input,
  })),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { nationalIssuesEngineRouter } from "~/server/api/routers/national-issues/engine";
import { NationalIssuesEngine, saveNationalIssuesConfig } from "~/lib/national-issues";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(nationalIssuesEngineRouter);

function callerAs(db: MockPrismaProxy, who: "admin" | "player" | null) {
  return createCaller(
    createMockRouterContext({
      db,
      auth: who ? { userId: `clerk_${who}` } : null,
      user: who
        ? {
            id: who,
            clerkUserId: `clerk_${who}`,
            role: who === "admin" ? { name: "admin", level: 10 } : { name: "user", level: 100 },
          }
        : null,
      rateLimitIdentifier: `${who}_${Math.random()}`,
    }) as never
  );
}

let db: MockPrismaProxy;

beforeEach(() => {
  jest.clearAllMocks();
  db = createMockPrisma();
  db.nationalIssue.groupBy.mockResolvedValue([]);
});

describe("admin procedures", () => {
  it("refuse players", async () => {
    const player = callerAs(db, "player");
    await expect(player.getEngineConfig()).rejects.toThrow(/Admin privileges required/);
    await expect(
      player.updateEngineConfig({ maxIssuesPerSession: 2, maxIssuesPerWeek: 5 })
    ).rejects.toThrow(/Admin privileges required/);
    await expect(player.triggerEvaluation({ countryId: "c1" })).rejects.toThrow(
      /Admin privileges required/
    );
    await expect(player.getActiveIssues({})).rejects.toThrow(/Admin privileges required/);
    expect(saveNationalIssuesConfig).not.toHaveBeenCalled();
    expect(NationalIssuesEngine.evaluateCountry).not.toHaveBeenCalled();
  });
  it("rejects limits out of range", async () => {
    await expect(
      callerAs(db, "admin").updateEngineConfig({ maxIssuesPerSession: 11, maxIssuesPerWeek: 5 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("getRecentWorldIssues", () => {
  it("caps the limit", async () => {
    await expect(callerAs(db, null).getRecentWorldIssues({ limit: 37 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
