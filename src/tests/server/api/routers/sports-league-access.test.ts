import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { sportsRouter } from "~/server/api/routers/sports";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { viewerCanManageLeague } from "~/server/api/routers/sports/league-access";

const createCaller = createCallerFactory(sportsRouter);

const OWNER_DB_ID = "db_owner";
const OTHER_DB_ID = "db_other";

function callerAs(dbUserId: string, db: ReturnType<typeof createMockPrisma>) {
  return createCaller(
    createMockRouterContext({
      auth: { userId: `clerk_${dbUserId}` },
      user: { id: dbUserId, clerkUserId: `clerk_${dbUserId}`, role: { name: "user", level: 100 } },
      db,
    }) as never
  );
}

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
});

describe("viewerCanManage on public league/match queries", () => {
  it("is true only for the league's creator", () => {
    const owned = { createdByUserId: OWNER_DB_ID };
    const as = (id: string) => ({ user: { id }, auth: { userId: `clerk_${id}` } });

    expect(viewerCanManageLeague(as(OWNER_DB_ID), owned)).toBe(true);
    expect(viewerCanManageLeague(as(OTHER_DB_ID), owned)).toBe(false);
    expect(viewerCanManageLeague({ user: null, auth: { userId: null } }, owned)).toBe(false);
  });

  it("getLeague reports it for the signed-in creator", async () => {
    const db = mockDb();

    const result = await callerAs(OWNER_DB_ID, db).getLeague({ id: "league_1" });

    expect(result.viewerCanManage).toBe(true);
  });
});

describe("match commentary regeneration", () => {
  function dbWithCommentary() {
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
    return db;
  }

  it("serves cached commentary to anyone without regenerating", async () => {
    const db = dbWithCommentary();
    await expect(
      callerAs(OTHER_DB_ID, db).generateMatchCommentary({ matchId: "match_1" })
    ).resolves.toEqual({ commentary: ["Kick-off!"] });
    expect(db.sportMatch.update).not.toHaveBeenCalled();
  });

  it("refuses a forced regenerate from a user who does not manage the league", async () => {
    const db = dbWithCommentary();
    await expect(
      callerAs(OTHER_DB_ID, db).generateMatchCommentary({
        matchId: "match_1",
        force: true,
        config: { apiUrl: "https://attacker.example/collect" },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.sportMatch.update).not.toHaveBeenCalled();
  });
});

describe("sports admin endpoints require an admin", () => {
  it("getAdminGlobalStats rejects an ordinary user", async () => {
    await expect(callerAs(OTHER_DB_ID, mockDb()).getAdminGlobalStats()).rejects.toThrow(
      /Admin privileges required/
    );
  });

  it("testLLMNarrator rejects an ordinary user", async () => {
    await expect(
      callerAs(OTHER_DB_ID, mockDb()).testLLMNarrator({
        sport: "soccer",
        events: ["Goal"],
        config: { apiUrl: "https://attacker.example/collect" },
      })
    ).rejects.toThrow(/Admin privileges required/);
  });
});
