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

  it("saves a completed engine config", async () => {
    await callerAs(db, "admin").updateEngineConfig({ maxIssuesPerSession: 2, maxIssuesPerWeek: 5 });
    expect(saveNationalIssuesConfig).toHaveBeenCalledWith({
      spawnMode: "probability",
      maxIssuesPerSession: 2,
      maxIssuesPerWeek: 5,
    });
  });

  it("rejects limits out of range", async () => {
    await expect(
      callerAs(db, "admin").updateEngineConfig({ maxIssuesPerSession: 11, maxIssuesPerWeek: 5 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("evaluates a country with the admin's options", async () => {
    await callerAs(db, "admin").triggerEvaluation({
      countryId: "c1",
      maxIssues: 2,
      domain: "economy",
      bypassLimits: true,
    });
    expect(NationalIssuesEngine.evaluateCountry).toHaveBeenCalledWith("c1", db as never, {
      maxIssues: 2,
      forceDomain: "economy",
      bypassLimits: true,
    });
  });

  it("pages the world audit list with a cursor", async () => {
    db.nationalIssue.findMany.mockResolvedValue([{ id: "i3" }, { id: "i2" }, { id: "i1" }]);

    const page = await callerAs(db, "admin").getActiveIssues({
      status: "pending",
      countryId: "all",
      limit: 2,
      cursor: "i4",
    });

    expect(db.nationalIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "pending", id: { lt: "i4" } }, take: 3 })
    );
    expect(page).toEqual({ issues: [{ id: "i3" }, { id: "i2" }], nextCursor: "i1" });
  });

  it("summarises recent generation logs", async () => {
    db.issueGenerationLog.findMany.mockResolvedValue([
      { issuesGenerated: 2, executionTimeMs: 100 },
      { issuesGenerated: 1, executionTimeMs: 300 },
    ]);

    const stats = await callerAs(db, "admin").getGenerationStats({ days: 3 });

    expect(stats).toMatchObject({
      period: "3 days",
      totalEvaluations: 2,
      totalIssuesGenerated: 3,
      avgExecutionTime: 200,
    });
  });
});

describe("getRecentWorldIssues", () => {
  const issue = (id: string, countryId: string) => ({
    id,
    title: id,
    country: { id: countryId, name: countryId, flag: null },
  });

  it("is public and returns nothing when no nation has recent issues", async () => {
    await expect(callerAs(db, null).getRecentWorldIssues({})).resolves.toEqual({ issues: [] });
  });

  it("returns at most one issue per nation, up to the limit", async () => {
    // First groupBy is the showcase-seed check (already seeded); the second lists active nations.
    db.nationalIssue.groupBy
      .mockResolvedValueOnce(Array.from({ length: 18 }, (_, i) => ({ countryId: `s${i}` })))
      .mockResolvedValueOnce([{ countryId: "a" }, { countryId: "b" }, { countryId: "c" }]);
    db.nationalIssue.findMany.mockImplementation(async ({ where }: any) =>
      where.countryId ? [issue(`${where.countryId}1`, where.countryId)] : []
    );

    const { issues } = await callerAs(db, null).getRecentWorldIssues({ limit: 2 });

    expect(issues).toHaveLength(2);
    expect(new Set(issues.map((i) => i.country.id)).size).toBe(2);
    expect(NationalIssuesEngine.forceGenerate).not.toHaveBeenCalled();
  });

  it("caps the limit", async () => {
    await expect(callerAs(db, null).getRecentWorldIssues({ limit: 37 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
