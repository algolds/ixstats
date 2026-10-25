/**
 * The sports router's gates: every season and simulation procedure needs the league's manager, a forced commentary
 * regenerate too, and the admin endpoints an admin. Placing a prediction (SL-15) needs a session, one per match, a
 * match not yet kicked off, a stake within bounds and a wallet that pays it; the pool shows totals and only the
 * caller's own entry. Settlement, fees and the stake debit itself run in tests/scenarios/engines/sports-season.test.ts.
 *
 * Folds sports-predictions.
 */
jest.mock("~/lib/vault/exchange-service", () => ({
  __esModule: true,
  exchangeService: { spend: jest.fn(), earn: jest.fn() },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { sportsRouter } from "~/server/api/routers/sports";
import { sportsPredictionsRouter } from "~/server/api/routers/sports/predictions";
import { exchangeService } from "~/lib/vault/exchange-service";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(sportsRouter);
const predictionsCaller = createCallerFactory(sportsPredictionsRouter);
const spend = exchangeService.spend as jest.Mock;

const OWNER_DB_ID = "db_owner";
const OTHER_DB_ID = "db_other";

type Db = ReturnType<typeof createMockPrisma>;

function contextAs(dbUserId: string | null, db: Db) {
  return createMockRouterContext({
    auth: dbUserId ? { userId: `clerk_${dbUserId}` } : null,
    user: dbUserId
      ? { id: dbUserId, clerkUserId: `clerk_${dbUserId}`, role: { name: "user", level: 100 } }
      : null,
    db,
  }) as never;
}
const callerAs = (dbUserId: string, db: Db) => createCaller(contextAs(dbUserId, db));

const league = { id: "league_1", createdByUserId: OWNER_DB_ID, archetype: "league", teams: [] };
const season = { id: "season_1", leagueId: "league_1", activeStage: 1, league };

function mockDb() {
  const db = createMockPrisma();
  db.sportLeague.findUnique.mockResolvedValue(league);
  db.sportSeason.findUnique.mockResolvedValue(season);
  db.sportMatch.findUnique.mockResolvedValue({
    id: "match_1",
    status: "scheduled",
    season: { ...season, league },
  });
  return db;
}

describe("sports season & simulation procedures require the league's manager", () => {
  const cases: [string, (c: ReturnType<typeof callerAs>) => Promise<unknown>][] = [
    ["startSeason", (c) => c.startSeason({ leagueId: "league_1" })],
    ["simulateMatchDay", (c) => c.simulateMatchDay({ seasonId: "season_1", matchDay: 1 })],
    ["simulateSingleMatch", (c) => c.simulateSingleMatch({ matchId: "match_1" })],
    ["simulateFullSeason", (c) => c.simulateFullSeason({ seasonId: "season_1" })],
    ["transitionToNextSeason", (c) => c.transitionToNextSeason({ seasonId: "season_1" })],
  ];

  it.each(cases)(
    "%s rejects a user who does not manage the league and writes nothing",
    async (_name, run) => {
      const db = mockDb();

      await expect(run(callerAs(OTHER_DB_ID, db))).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(db.sportSeason.create).not.toHaveBeenCalled();
      expect(db.sportMatch.findMany).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();
    }
  );

  it("lets the league's creator through the ownership check", async () => {
    const db = mockDb();

    // The league has no teams, so the creator gets past authorization and stops at validation.
    await expect(
      callerAs(OWNER_DB_ID, db).startSeason({ leagueId: "league_1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses a forced commentary regenerate from a user who does not manage the league", async () => {
    const db = mockDb();
    db.sportMatch.findUnique.mockResolvedValue({
      id: "match_1",
      status: "completed",
      matchStats: {
        trace: [{ t: 1, type: "tactical", description: "Kick-off" }],
        commentary: ["Kick-off!"],
      },
      season: { ...season, league: { ...league, sportPreset: "soccer" } },
    });
    await expect(
      callerAs(OTHER_DB_ID, db).generateMatchCommentary({
        matchId: "match_1",
        force: true,
        config: { apiUrl: "https://attacker.example/collect" },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.sportMatch.update).not.toHaveBeenCalled();
  });

  it.each([
    ["getAdminGlobalStats", (c: ReturnType<typeof callerAs>) => c.getAdminGlobalStats()],
    [
      "testLLMNarrator",
      (c: ReturnType<typeof callerAs>) =>
        c.testLLMNarrator({
          sport: "soccer",
          events: ["Goal"],
          config: { apiUrl: "https://attacker.example/collect" },
        }),
    ],
  ])("%s rejects an ordinary user", async (_name, run) => {
    await expect(run(callerAs(OTHER_DB_ID, mockDb()))).rejects.toThrow(
      /Admin privileges required/
    );
  });
});

describe("placePrediction", () => {
  function predictionDb(matchOverrides: Record<string, unknown> = {}): Db {
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
      scheduledIxTime: Date.now() + 3_600_000,
      ...matchOverrides,
    });
    db.sportPrediction.findFirst.mockResolvedValue(null);
    db.sportPrediction.create.mockImplementation(
      async (args: { data: { outcome: string; stake: number } }) => ({
        id: "p1",
        outcome: args.data.outcome,
        stake: args.data.stake,
        status: "open",
      })
    );
    return db;
  }
  const place = (who: string | null, db: Db, input: { matchId?: string; stake: number }) =>
    predictionsCaller(contextAs(who, db)).placePrediction({
      matchId: input.matchId ?? "m1",
      outcome: "home",
      stake: input.stake,
    });

  beforeEach(() => {
    spend.mockReset();
    spend.mockResolvedValue({ success: true, newBalance: 900 });
  });

  it("requires a signed-in user", async () => {
    await expect(place(null, predictionDb(), { stake: 100 })).rejects.toThrow();
    expect(spend).not.toHaveBeenCalled();
  });

  it("rejects a second prediction on the same match", async () => {
    const db = predictionDb();
    db.sportPrediction.findFirst.mockResolvedValue({ id: "existing" });
    await expect(place("user_a", db, { stake: 10 })).rejects.toThrow(/already placed/);
    expect(spend).not.toHaveBeenCalled();
    expect(db.sportPrediction.create).not.toHaveBeenCalled();
  });

  it.each([
    ["a completed match", { status: "completed" }],
    ["a scheduled match past kickoff", { scheduledIxTime: Date.now() - 1000 }],
  ])("rejects %s", async (_name, overrides) => {
    const db = predictionDb(overrides);
    await expect(place("user_a", db, { stake: 10 })).rejects.toThrow(/closed/);
    expect(spend).not.toHaveBeenCalled();
    expect(db.sportPrediction.create).not.toHaveBeenCalled();
  });

  it("does not record a prediction when the stake can't be paid", async () => {
    spend.mockResolvedValue({ success: false, newBalance: 5, message: "Insufficient Sovereigns" });
    const db = predictionDb();
    await expect(place("user_a", db, { stake: 100 })).rejects.toThrow(/Insufficient Sovereigns/);
    expect(db.sportPrediction.create).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown match", { matchId: "nope", stake: 10 }, /not found/i],
    ["a zero stake", { stake: 0 }, /./],
    ["a stake above the cap", { stake: 1e9 }, /./],
    ["a fractional stake", { stake: 1.5 }, /./],
  ])("rejects %s", async (_name, input, message) => {
    const db = predictionDb();
    if ("matchId" in input) db.sportMatch.findUnique.mockResolvedValue(null);
    await expect(place("user_a", db, input)).rejects.toThrow(message);
    expect(spend).not.toHaveBeenCalled();
  });
});

describe("getMatchPredictions", () => {
  it("returns pool totals and only the caller's own prediction", async () => {
    const db = createMockPrisma();
    db.sportPrediction.findMany.mockResolvedValue([
      { userId: "user_a", outcome: "home", stake: 100, status: "open", payout: null },
      { userId: "user_b", outcome: "home", stake: 50, status: "open", payout: null },
      { userId: "user_c", outcome: "draw", stake: 25, status: "open", payout: null },
    ]);
    const ctx = createMockRouterContext({
      auth: { userId: "user_b" },
      user: { id: "db_user_b", clerkUserId: "user_b", isActive: true },
      db,
    }) as never;

    const result = await predictionsCaller(ctx).getMatchPredictions({ matchId: "m1" });

    expect(result.pool).toEqual({ home: 150, away: 0, draw: 25 });
    expect(result.totalPool).toBe(175);
    expect(result.entries).toBe(3);
    expect(result.mine).toEqual({ outcome: "home", stake: 50, status: "open", payout: null });
    expect(JSON.stringify(result)).not.toContain("user_a");
  });
});
