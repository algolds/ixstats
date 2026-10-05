/**
 * SL-15: placing match predictions (settlement is covered in tests/sports/predictions.test.ts).
 */
jest.mock("~/lib/vault/exchange-service", () => ({
  __esModule: true,
  exchangeService: { spend: jest.fn(), earn: jest.fn() },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { sportsPredictionsRouter } from "~/server/api/routers/sports/predictions";
import { exchangeService } from "~/lib/vault/exchange-service";
import { IxTime } from "~/lib/ixtime";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(sportsPredictionsRouter);
type Db = ReturnType<typeof createMockPrisma>;

const spend = exchangeService.spend as jest.Mock;

function makeDb(matchOverrides: Record<string, unknown> = {}): Db {
  const db = createMockPrisma();
  db.$transaction = jest.fn((cb: (tx: Db) => unknown) => cb(db)) as never;
  // The per-user lock must go through $executeRaw: pg_advisory_xact_lock returns void, which
  // $queryRaw cannot deserialize (every placement failed in production).
  db.$executeRaw = jest.fn().mockResolvedValue(1) as never;
  db.$queryRaw = jest.fn(() => {
    throw new Error("$queryRaw cannot deserialize the void advisory-lock result");
  }) as never;
  db.sportMatch.findUnique.mockResolvedValue({
    id: "m1",
    seasonId: "s1",
    status: "scheduled",
    scheduledIxTime: IxTime.getCurrentIxTime() + 3_600_000,
    ...matchOverrides,
  });
  db.sportPrediction.findFirst.mockResolvedValue(null);
  db.sportPrediction.create.mockImplementation(async (args: any) => ({
    id: "p1",
    outcome: args.data.outcome,
    stake: args.data.stake,
    status: "open",
  }));
  return db;
}

function callerAs(userId: string | null, db: Db) {
  return createCaller(
    createMockRouterContext({
      auth: userId ? { userId } : null,
      user: userId ? { id: `db_${userId}`, clerkUserId: userId, isActive: true } : null,
      db,
    }) as never
  );
}

beforeEach(() => {
  spend.mockReset();
  spend.mockResolvedValue({ success: true, newBalance: 900 });
});

describe("placePrediction", () => {
  it("requires a signed-in user", async () => {
    const db = makeDb();
    await expect(
      callerAs(null, db).placePrediction({ matchId: "m1", outcome: "home", stake: 100 })
    ).rejects.toThrow();
    expect(spend).not.toHaveBeenCalled();
  });

  it("debits the stake and records the prediction for the caller", async () => {
    const db = makeDb();
    const result = await callerAs("user_a", db).placePrediction({
      matchId: "m1",
      outcome: "away",
      stake: 100,
    });

    expect(spend).toHaveBeenCalledWith(
      "user_a",
      100,
      "PREDICTION_STAKE",
      "PREDICTION_STAKE:m1",
      db,
      expect.objectContaining({ matchId: "m1" })
    );
    expect(db.sportPrediction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          matchId: "m1",
          seasonId: "s1",
          userId: "user_a",
          outcome: "away",
          stake: 100,
        }),
      })
    );
    expect(result.newBalance).toBe(900);
  });

  it("rejects a second prediction on the same match", async () => {
    const db = makeDb();
    db.sportPrediction.findFirst.mockResolvedValue({ id: "existing" });
    await expect(
      callerAs("user_a", db).placePrediction({ matchId: "m1", outcome: "home", stake: 10 })
    ).rejects.toThrow(/already placed/);
    expect(spend).not.toHaveBeenCalled();
    expect(db.sportPrediction.create).not.toHaveBeenCalled();
  });

  it.each([
    ["completed", 3_600_000],
    ["in_progress", 3_600_000],
    ["scheduled", -1000],
  ])("rejects a %s match past kickoff (offset %d)", async (status, offset) => {
    const db = makeDb({ status, scheduledIxTime: IxTime.getCurrentIxTime() + offset });
    await expect(
      callerAs("user_a", db).placePrediction({ matchId: "m1", outcome: "home", stake: 10 })
    ).rejects.toThrow(/closed/);
    expect(spend).not.toHaveBeenCalled();
    expect(db.sportPrediction.create).not.toHaveBeenCalled();
  });

  it("does not record a prediction when the stake can't be paid", async () => {
    spend.mockResolvedValue({ success: false, newBalance: 5, message: "Insufficient Sovereigns" });
    const db = makeDb();
    await expect(
      callerAs("user_a", db).placePrediction({ matchId: "m1", outcome: "home", stake: 100 })
    ).rejects.toThrow(/Insufficient Sovereigns/);
    expect(db.sportPrediction.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown match and out-of-range stakes", async () => {
    const db = makeDb();
    db.sportMatch.findUnique.mockResolvedValue(null);
    await expect(
      callerAs("user_a", db).placePrediction({ matchId: "nope", outcome: "home", stake: 10 })
    ).rejects.toThrow(/not found/i);

    const db2 = makeDb();
    await expect(
      callerAs("user_a", db2).placePrediction({ matchId: "m1", outcome: "home", stake: 0 })
    ).rejects.toThrow();
    await expect(
      callerAs("user_a", db2).placePrediction({ matchId: "m1", outcome: "home", stake: 1e9 })
    ).rejects.toThrow();
    await expect(
      callerAs("user_a", db2).placePrediction({ matchId: "m1", outcome: "home", stake: 1.5 })
    ).rejects.toThrow();
  });
});

describe("getMatchPredictions", () => {
  it("returns pool totals and only the caller's own prediction", async () => {
    const db = makeDb();
    db.sportPrediction.findMany.mockResolvedValue([
      { userId: "user_a", outcome: "home", stake: 100, status: "open", payout: null },
      { userId: "user_b", outcome: "home", stake: 50, status: "open", payout: null },
      { userId: "user_c", outcome: "draw", stake: 25, status: "open", payout: null },
    ]);

    const result = await callerAs("user_b", db).getMatchPredictions({ matchId: "m1" });

    expect(result.pool).toEqual({ home: 150, away: 0, draw: 25 });
    expect(result.totalPool).toBe(175);
    expect(result.entries).toBe(3);
    expect(result.mine).toEqual({ outcome: "home", stake: 50, status: "open", payout: null });
    expect(JSON.stringify(result)).not.toContain("user_a");
  });
});
