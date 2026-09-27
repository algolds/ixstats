import { recalculateStandings } from "~/server/api/routers/sports/leagues/helpers";

type Upsert = {
  where: { seasonId_teamId: { seasonId: string; teamId: string } };
  create: Record<string, number | string>;
  update: Record<string, number>;
};

function fakeDb(sport: string, matches: Array<Record<string, unknown>>) {
  const upserts: Upsert[] = [];
  const db = {
    sportSeason: { findUnique: jest.fn().mockResolvedValue({ league: { sportPreset: sport } }) },
    sportTeamSeason: {
      findMany: jest.fn().mockResolvedValue([{ teamId: "a" }, { teamId: "b" }, { teamId: "c" }]),
    },
    sportMatch: { findMany: jest.fn().mockResolvedValue(matches) },
    sportStanding: {
      upsert: jest.fn((args: Upsert) => {
        upserts.push(args);
        return Promise.resolve(args.create);
      }),
    },
  };
  return { db, upserts };
}

const row = (upserts: Upsert[], teamId: string) =>
  upserts.find((u) => u.where.seasonId_teamId.teamId === teamId)?.update;

describe("recalculateStandings (manual result override path)", () => {
  it("uses hockey's 2/1 rule: regulation win 2, overtime loser 1, regulation loser 0", async () => {
    const { db, upserts } = fakeDb("hockey", [
      { homeTeamId: "a", awayTeamId: "b", homeScore: 3, awayScore: 1, matchStats: { trace: [] } },
      {
        homeTeamId: "b",
        awayTeamId: "c",
        homeScore: 2,
        awayScore: 1,
        matchStats: { trace: [{ t: 62, type: "goal" }] },
      },
    ]);
    await recalculateStandings(db as never, "s1");

    expect(row(upserts, "a")).toMatchObject({ wins: 1, points: 2, rank: 1 });
    expect(row(upserts, "b")).toMatchObject({ wins: 1, losses: 1, points: 2 });
    expect(row(upserts, "c")).toMatchObject({ losses: 1, points: 1 });
  });

  it("uses 3/1 for other sports and writes rank (not a non-existent position column)", async () => {
    const { db, upserts } = fakeDb("soccer", [
      { homeTeamId: "a", awayTeamId: "b", homeScore: 2, awayScore: 0, matchStats: null },
      { homeTeamId: "b", awayTeamId: "c", homeScore: 1, awayScore: 1, matchStats: null },
    ]);
    await recalculateStandings(db as never, "s1");

    expect(row(upserts, "a")).toMatchObject({ points: 3, rank: 1 });
    expect(row(upserts, "b")).toMatchObject({ points: 1, draws: 1 });
    expect(row(upserts, "c")).toMatchObject({ points: 1, draws: 1 });
    for (const u of upserts) expect(u.update).not.toHaveProperty("position");
  });
});
