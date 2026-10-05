import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { sportsAlmanacRouter } from "~/server/api/routers/sports/almanac";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(sportsAlmanacRouter);

function callerWith(db: Record<string, Record<string, jest.Mock>>) {
  return createCaller(createMockCallerContext({ db, auth: null }));
}

const team = (id: string, name: string) => ({ id, name, logo: null, color: "#000000" });

describe("sports almanac router", () => {
  it("getAllTimeRecords ranks champions, finds the highest-scoring match and sums standings", async () => {
    const victoria = team("t1", "Victoria FC");
    const senate = team("t2", "Senate FC");
    const standing = (t: typeof victoria, wins: number, points: number) => ({
      teamId: t.id,
      team: t,
      wins,
      losses: 1,
      draws: 0,
      points,
      pointsFor: wins * 2,
    });
    const match = (id: string, homeScore: number, awayScore: number) => ({
      id,
      homeScore,
      awayScore,
      homeTeam: victoria,
      awayTeam: senate,
    });
    const findMany = jest.fn().mockResolvedValue([
      {
        seasonNumber: 1,
        champion: victoria,
        standings: [standing(victoria, 3, 9), standing(senate, 1, 3)],
        matches: [match("m1", 2, 1)],
      },
      {
        seasonNumber: 2,
        champion: senate,
        standings: [standing(senate, 2, 6), standing(victoria, 2, 6)],
        matches: [match("m2", 5, 4), match("m3", 0, 0)],
      },
      {
        seasonNumber: 3,
        champion: victoria,
        standings: [standing(victoria, 4, 12)],
        matches: [],
      },
    ]);

    const records = await callerWith({ sportSeason: { findMany } }).getAllTimeRecords({
      leagueId: "l1",
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leagueId: "l1", status: "completed" } })
    );
    expect(records.totalCompletedSeasons).toBe(3);
    expect(records.topChampions.map((c) => [c.teamName, c.titles])).toEqual([
      ["Victoria FC", 2],
      ["Senate FC", 1],
    ]);
    expect(records.highestScoringMatch).toMatchObject({
      matchId: "m2",
      totalGoals: 9,
      seasonNumber: 2,
    });
    expect(records.teamLeaderboard[0]).toMatchObject({
      teamName: "Victoria FC",
      played: 12,
      wins: 9,
      points: 27,
      goalsFor: 18,
    });
  });

  it("getLeagueArchive reports runner-up, positions and season goal totals", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "s1",
        seasonNumber: 1,
        status: "completed",
        startIxTime: 0,
        endIxTime: 10,
        champion: { ...team("t1", "Victoria FC"), shortName: "VIC", wikiSlug: null },
        standings: [
          {
            teamId: "t1",
            team: { ...team("t1", "Victoria FC"), shortName: "VIC" },
            wins: 2,
            losses: 0,
            draws: 1,
            points: 7,
            pointsFor: 5,
            pointsAgainst: 1,
          },
          {
            teamId: "t2",
            team: { ...team("t2", "Senate FC"), shortName: "SEN" },
            wins: 0,
            losses: 2,
            draws: 1,
            points: 1,
            pointsFor: 1,
            pointsAgainst: 5,
          },
        ],
        matches: [
          { id: "m1", homeScore: 3, awayScore: 1, homeTeamId: "t1", awayTeamId: "t2" },
          { id: "m2", homeScore: null, awayScore: 2, homeTeamId: "t2", awayTeamId: "t1" },
        ],
      },
    ]);

    const [season] = await callerWith({ sportSeason: { findMany } }).getLeagueArchive({
      leagueId: "l1",
    });

    expect(season).toMatchObject({
      seasonNumber: 1,
      totalMatches: 2,
      totalGoals: 6,
      champion: { teamName: "Victoria FC" },
      runnerUp: { teamId: "t2", points: 1 },
    });
    expect(season?.standings.map((s) => [s.position, s.teamId, s.played])).toEqual([
      [1, "t1", 3],
      [2, "t2", 3],
    ]);
  });

  it("getAthleteCareerHistory groups stat lines by season and attaches awards", async () => {
    const statLine = (seasonId: string, seasonNumber: number, stats: object | null) => ({
      stats,
      match: { seasonId, season: { seasonNumber } },
    });
    const statsFindMany = jest
      .fn()
      .mockResolvedValue([
        statLine("s1", 1, { goals: 1, assists: 0 }),
        statLine("s2", 2, { goals: 2, assists: 1 }),
        statLine("s1", 1, { goals: 0, assists: 2 }),
        statLine("s2", 2, { goals: "3" }),
        statLine("s2", 2, null),
      ]);
    const recordsFindMany = jest.fn().mockResolvedValue([
      { seasonId: "s2", recordType: "top_scorer" },
      { seasonId: "s2", recordType: "mvp" },
    ]);

    const career = await callerWith({
      sportMatchStat: { findMany: statsFindMany },
      sportSeasonRecord: { findMany: recordsFindMany },
    }).getAthleteCareerHistory({ athleteId: "p1" });

    expect(statsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { playerId: "p1" } })
    );
    expect(recordsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { holderId: "p1", recordType: { in: ["top_scorer", "most_assists", "mvp"] } },
      })
    );
    expect(career.seasons).toEqual([
      {
        seasonId: "s2",
        seasonNumber: 2,
        matches: 3,
        goals: 2,
        assists: 1,
        awards: ["Top Scorer", "MVP"],
      },
      { seasonId: "s1", seasonNumber: 1, matches: 2, goals: 1, assists: 2, awards: [] },
    ]);
    expect(career.totals).toEqual({ matches: 5, goals: 3, assists: 3 });
  });

  it("getAthleteCareerHistory returns an empty log for an athlete without stats", async () => {
    const career = await callerWith({
      sportMatchStat: { findMany: jest.fn().mockResolvedValue([]) },
      sportSeasonRecord: { findMany: jest.fn().mockResolvedValue([]) },
    }).getAthleteCareerHistory({ athleteId: "p2" });

    expect(career).toEqual({ seasons: [], totals: { matches: 0, goals: 0, assists: 0 } });
  });
});
