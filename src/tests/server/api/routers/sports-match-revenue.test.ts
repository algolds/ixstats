/**
 * Code audit SL-14 (roadmap M0 item 13): club revenue is paid once per completed match,
 * not once per click, and the sponsor win bonus is paid.
 */
import { describe, expect, it } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { sportsRouter } from "~/server/api/routers/sports";
import { computeMatchRevenue } from "~/lib/sports/match-revenue";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(sportsRouter);
const OWNER = "db_owner";

const team = {
  id: "team_1",
  ownerUserId: OWNER,
  budget: 1000,
  stadiumCapacity: 1000,
  ticketPrice: 10,
  popularity: 50, // 1000 * 10 * 0.6 * 0.5 = 3000 per home match
  sponsor: { name: "Apex Energy Drink", baseFee: 10, winBonus: 25 },
};

const homeWin = { id: "m1", homeTeamId: "team_1", awayTeamId: "t2", homeScore: 2, awayScore: 0 };
const homeLoss = { id: "m2", homeTeamId: "team_1", awayTeamId: "t3", homeScore: 0, awayScore: 1 };
const awayWin = { id: "m3", homeTeamId: "t4", awayTeamId: "team_1", homeScore: 1, awayScore: 3 };

describe("computeMatchRevenue", () => {
  it("pays tickets and base fee per home match and the win bonus per win", () => {
    expect(computeMatchRevenue(team, [homeWin, homeLoss, awayWin])).toEqual({
      homeMatches: 2,
      wins: 2,
      ticketRevenue: 6000,
      sponsorFees: 20,
      winBonuses: 50,
      total: 6070,
    });
  });

  it("pays nothing with no matches, and ignores a missing or malformed sponsor", () => {
    expect(computeMatchRevenue(team, []).total).toBe(0);
    expect(computeMatchRevenue({ ...team, sponsor: null }, [homeWin]).total).toBe(3000);
    expect(
      computeMatchRevenue({ ...team, sponsor: { baseFee: "lots", winBonus: -5 } }, [homeWin]).total
    ).toBe(3000);
  });
});

function setup(matches: unknown[], owner = OWNER) {
  const db = createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue([]) });
  db.$transaction = jest.fn((cb: (tx: typeof db) => unknown) => cb(db));
  db.sportTeam.findUnique.mockResolvedValue(team);
  db.sportMatch.findMany.mockResolvedValue(matches);
  db.sportTeam.update.mockImplementation(
    async ({ data }: { data: { budget: { increment: number } } }) => ({
      ...team,
      budget: team.budget + data.budget.increment,
    })
  );
  const caller = createCaller(
    createMockRouterContext({
      auth: { userId: `clerk_${owner}` },
      user: { id: owner, clerkUserId: `clerk_${owner}`, role: { name: "user", level: 100 } },
      db,
    }) as never
  );
  return { db, caller };
}

describe("sports.collectMatchRevenue", () => {
  it("pays only uncollected completed matches and marks each side collected", async () => {
    const { db, caller } = setup([homeWin, homeLoss, awayWin]);

    const result = await caller.collectMatchRevenue({ teamId: "team_1" });

    expect(result).toMatchObject({ total: 6070, matchesCollected: 3, budget: 7070 });
    expect(db.sportMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "completed",
          OR: [
            { homeTeamId: "team_1", homeRevenueCollectedAt: null },
            { awayTeamId: "team_1", awayRevenueCollectedAt: null },
          ],
        },
      })
    );
    expect(db.sportMatch.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["m1", "m2"] } },
      data: { homeRevenueCollectedAt: expect.any(Date) },
    });
    expect(db.sportMatch.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["m3"] } },
      data: { awayRevenueCollectedAt: expect.any(Date) },
    });
    expect(db.sportTeam.update).toHaveBeenCalledWith({
      where: { id: "team_1" },
      data: { budget: { increment: 6070 } },
    });
  });

  it("locks the team row so concurrent clicks can't pay the same matches twice", async () => {
    const { db, caller } = setup([homeWin]);

    await caller.collectMatchRevenue({ teamId: "team_1" });

    const sql = (db.$queryRaw.mock.calls[0]![0] as TemplateStringsArray).join("?");
    expect(sql).toContain('"sport_teams"');
    expect(sql).toContain("FOR UPDATE");
  });

  it("pays nothing when every match has been collected (clicking again does nothing)", async () => {
    const { db, caller } = setup([]);

    const result = await caller.collectMatchRevenue({ teamId: "team_1" });

    expect(result).toMatchObject({ total: 0, matchesCollected: 0, budget: 1000 });
    expect(db.sportTeam.update).not.toHaveBeenCalled();
    expect(db.sportMatch.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a team the caller doesn't own", async () => {
    const { db, caller } = setup([homeWin], "db_other");

    await expect(caller.collectMatchRevenue({ teamId: "team_1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.sportTeam.update).not.toHaveBeenCalled();
  });

  it("previews what's waiting without paying", async () => {
    const { db, caller } = setup([homeWin, awayWin]);

    await expect(caller.previewMatchRevenue({ teamId: "team_1" })).resolves.toMatchObject({
      homeMatches: 1,
      wins: 2,
      total: 3060,
    });
    expect(db.sportTeam.update).not.toHaveBeenCalled();
  });
});
