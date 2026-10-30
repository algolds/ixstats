/**
 * `updateTeams` (the Teams tab's one Save): the league's creator edits any of its teams in a single transaction; a
 * team of another league fails the whole batch before anything is written; a caller who does not manage the league
 * is refused.
 */
jest.mock("~/lib/vault/exchange-service", () => ({
  __esModule: true,
  exchangeService: { spend: jest.fn(), earn: jest.fn() },
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { sportsRouter } from "~/server/api/routers/sports";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(sportsRouter);

const CREATOR_ID = "db_creator";
const OTHER_ID = "db_other";

type Db = ReturnType<typeof createMockPrisma>;

function callerAs(dbUserId: string, db: Db) {
  return createCaller(
    createMockRouterContext({
      auth: { userId: `clerk_${dbUserId}` },
      user: { id: dbUserId, clerkUserId: `clerk_${dbUserId}`, role: { name: "user", level: 100 } },
      db,
    }) as never
  );
}

function mockDb(leagueTeamIds: string[]) {
  const db = createMockPrisma();
  db.sportLeague.findUnique.mockResolvedValue({ id: "league_1", createdByUserId: CREATOR_ID });
  db.sportTeam.findMany.mockResolvedValue(leagueTeamIds.map((id) => ({ id })));
  db.sportTeam.update.mockResolvedValue({});
  return db;
}

const patches = [
  { id: "t1", name: "North FC", color: "#112233" },
  { id: "t2", shortName: "SOU", nationId: "nation_1" },
  { id: "t3", wikiSlug: null, nationId: null },
];

describe("updateTeams", () => {
  it("lets the league's creator update three teams in one transaction", async () => {
    const db = mockDb(["t1", "t2", "t3"]);

    const result = await callerAs(CREATOR_ID, db).updateTeams({
      leagueId: "league_1",
      teams: patches,
    });

    expect(result).toEqual({ updated: 3 });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.sportTeam.update).toHaveBeenCalledTimes(3);
    expect(db.sportTeam.update).toHaveBeenCalledWith({
      where: { id: "t2" },
      data: { shortName: "SOU", nationId: "nation_1" },
    });
    expect(db.sportTeam.update).toHaveBeenCalledWith({
      where: { id: "t3" },
      data: { wikiSlug: null, nationId: null },
    });
  });

  it("refuses a batch holding a team of another league and writes nothing", async () => {
    const db = mockDb(["t1", "t2"]);

    await expect(
      callerAs(CREATOR_ID, db).updateTeams({ leagueId: "league_1", teams: patches })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(db.sportTeam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["t1", "t2", "t3"] }, leagueId: "league_1" } })
    );
    expect(db.sportTeam.update).not.toHaveBeenCalled();
  });

  it("refuses the same team twice in one batch", async () => {
    const db = mockDb(["t1"]);

    await expect(
      callerAs(CREATOR_ID, db).updateTeams({
        leagueId: "league_1",
        teams: [
          { id: "t1", name: "One" },
          { id: "t1", name: "Two" },
        ],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(db.sportTeam.update).not.toHaveBeenCalled();
  });

  it("refuses a caller who neither created the league nor owns the system", async () => {
    const db = mockDb(["t1", "t2", "t3"]);

    await expect(
      callerAs(OTHER_ID, db).updateTeams({ leagueId: "league_1", teams: patches })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.sportTeam.update).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND for a league that does not exist", async () => {
    const db = mockDb([]);
    db.sportLeague.findUnique.mockResolvedValue(null);

    await expect(
      callerAs(CREATOR_ID, db).updateTeams({ leagueId: "gone", teams: patches })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
