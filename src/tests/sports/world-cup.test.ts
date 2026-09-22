import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { initializeWorldCupTournament, advanceWorldCupToKnockoutStage } from "~/lib/sports/world-cup";

describe("WAFF World Cup State Machine", () => {
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      sportSeason: {
        create: jest.fn<any>().mockResolvedValue({ id: "wc_season_2026", activeStage: 1 }),
        update: jest.fn<any>().mockResolvedValue({ id: "wc_season_2026", activeStage: 2 }),
        findUnique: jest.fn<any>(),
      },
      sportStanding: {
        createMany: jest.fn<any>().mockResolvedValue({ count: 16 }),
        findMany: jest.fn<any>(),
        updateMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
      },
      sportTeamSeason: {
        createMany: jest.fn<any>().mockResolvedValue({ count: 16 }),
      },
      sportMatch: {
        createMany: jest.fn<any>().mockResolvedValue({ count: 24 }),
        findMany: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      sportBracket: {
        create: jest.fn<any>().mockResolvedValue({ id: "b1" }),
        findMany: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      sportTeam: {
        findMany: jest.fn<any>(),
      },
      sportSeasonRecord: {
        create: jest.fn<any>(),
      },
    };
  });

  it("initializes a 16-team tournament into 4 balanced groups with round-robin schedules", async () => {
    const teamIds = Array.from({ length: 16 }, (_, i) => `team_nation_${i + 1}`);

    const result = await initializeWorldCupTournament(mockPrisma, {
      leagueId: "waff_league_1",
      seasonNumber: 1,
      teamIds,
      seed: 42,
    });

    expect(result.seasonId).toBe("wc_season_2026");
    expect(result.groupCount).toBe(4);
    expect(Object.keys(result.groups)).toHaveLength(4);
    expect(result.groups["Group A"]).toHaveLength(4);
    expect(result.groups["Group B"]).toHaveLength(4);
    expect(result.groups["Group C"]).toHaveLength(4);
    expect(result.groups["Group D"]).toHaveLength(4);

    expect(mockPrisma.sportStanding.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ division: "Group A", seasonId: "wc_season_2026" }),
        ]),
      })
    );

    // 4 groups * 6 matches per group = 24 total group stage matches
    expect(mockPrisma.sportMatch.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ stage: 1, matchDay: 1 }),
          expect.objectContaining({ stage: 1, matchDay: 2 }),
          expect.objectContaining({ stage: 1, matchDay: 3 }),
        ]),
      })
    );
  });

  it("advances top 2 teams from each group to the knockout bracket stage", async () => {
    mockPrisma.sportStanding.findMany.mockResolvedValue([
      // Group A
      { teamId: "team_A1", division: "Group A", points: 9, pointsFor: 7, pointsAgainst: 1, team: { id: "team_A1", name: "Nation A1" } },
      { teamId: "team_A2", division: "Group A", points: 6, pointsFor: 4, pointsAgainst: 3, team: { id: "team_A2", name: "Nation A2" } },
      { teamId: "team_A3", division: "Group A", points: 3, pointsFor: 2, pointsAgainst: 5, team: { id: "team_A3", name: "Nation A3" } },
      { teamId: "team_A4", division: "Group A", points: 0, pointsFor: 1, pointsAgainst: 5, team: { id: "team_A4", name: "Nation A4" } },
      // Group B
      { teamId: "team_B1", division: "Group B", points: 7, pointsFor: 5, pointsAgainst: 2, team: { id: "team_B1", name: "Nation B1" } },
      { teamId: "team_B2", division: "Group B", points: 5, pointsFor: 3, pointsAgainst: 2, team: { id: "team_B2", name: "Nation B2" } },
      { teamId: "team_B3", division: "Group B", points: 2, pointsFor: 2, pointsAgainst: 4, team: { id: "team_B3", name: "Nation B3" } },
      { teamId: "team_B4", division: "Group B", points: 1, pointsFor: 1, pointsAgainst: 3, team: { id: "team_B4", name: "Nation B4" } },
      // Group C
      { teamId: "team_C1", division: "Group C", points: 9, pointsFor: 8, pointsAgainst: 0, team: { id: "team_C1", name: "Nation C1" } },
      { teamId: "team_C2", division: "Group C", points: 4, pointsFor: 3, pointsAgainst: 4, team: { id: "team_C2", name: "Nation C2" } },
      { teamId: "team_C3", division: "Group C", points: 3, pointsFor: 2, pointsAgainst: 5, team: { id: "team_C3", name: "Nation C3" } },
      { teamId: "team_C4", division: "Group C", points: 1, pointsFor: 1, pointsAgainst: 5, team: { id: "team_C4", name: "Nation C4" } },
      // Group D
      { teamId: "team_D1", division: "Group D", points: 7, pointsFor: 6, pointsAgainst: 2, team: { id: "team_D1", name: "Nation D1" } },
      { teamId: "team_D2", division: "Group D", points: 6, pointsFor: 5, pointsAgainst: 3, team: { id: "team_D2", name: "Nation D2" } },
      { teamId: "team_D3", division: "Group D", points: 4, pointsFor: 3, pointsAgainst: 4, team: { id: "team_D3", name: "Nation D3" } },
      { teamId: "team_D4", division: "Group D", points: 0, pointsFor: 1, pointsAgainst: 6, team: { id: "team_D4", name: "Nation D4" } },
    ]);

    const result = await advanceWorldCupToKnockoutStage(mockPrisma, "wc_season_2026");

    expect(result.qualifiedTeams).toHaveLength(8);
    expect(result.qualifiedTeams).toEqual(
      expect.arrayContaining([
        { group: "Group A", rank: 1, teamId: "team_A1" },
        { group: "Group A", rank: 2, teamId: "team_A2" },
        { group: "Group B", rank: 1, teamId: "team_B1" },
        { group: "Group B", rank: 2, teamId: "team_B2" },
        { group: "Group C", rank: 1, teamId: "team_C1" },
        { group: "Group C", rank: 2, teamId: "team_C2" },
        { group: "Group D", rank: 1, teamId: "team_D1" },
        { group: "Group D", rank: 2, teamId: "team_D2" },
      ])
    );

    // Cross-group Quarterfinal matches created in sportBracket
    expect(mockPrisma.sportBracket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stage: 2,
          fighter1Id: "team_A1",
          fighter2Id: "team_B2",
        }),
      })
    );

    expect(mockPrisma.sportSeason.update).toHaveBeenCalledWith({
      where: { id: "wc_season_2026" },
      data: { activeStage: 2 },
    });
  });
});
