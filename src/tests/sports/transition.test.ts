import { describe, it, expect, jest } from "@jest/globals";
import { processAging } from "~/lib/sports/aging";
import { transitionSeasonAction } from "~/lib/sports/transition";

describe("MyLeague Off-Season & Transition Logic", () => {
  describe("processAging logic", () => {
    it("advances player ages and shifts ratings", () => {
      const players = [
        {
          id: "p1",
          age: 20,
          careerStage: "rookie" as const,
          ratings: { pace: 70, shooting: 65 },
        },
        {
          id: "p2",
          age: 32,
          careerStage: "prime" as const,
          ratings: { pace: 85, shooting: 80 },
        },
      ];

      const coaches = [
        {
          id: "c1",
          age: 45,
          careerStage: "prime" as const,
          ratings: { strategy: 70, development: 75, motivation: 72, adaptability: 68 },
          teamId: "t1",
        },
      ];

      const coachMap = new Map<string, number>();
      coachMap.set("p1", 75); // Coach development is 75 for p1
      coachMap.set("p2", 75);

      const result = processAging({
        players,
        coaches,
        coachMap,
        seed: 42,
      });

      expect(result.playerResults).toHaveLength(2);
      expect(result.coachResults).toHaveLength(1);

      // Verify player 1 aged and progressed
      const p1Res = result.playerResults.find((p: any) => p.playerId === "p1")!;
      expect(p1Res.ageDelta).toBe(1);
      expect(p1Res.oldStage).toBe("rookie");
      // Rookies either stay rookies or progress to developing
      expect(["rookie", "developing"]).toContain(p1Res.newStage);
      expect(Object.keys(p1Res.ratingChanges)).toContain("pace");
      expect(Object.keys(p1Res.ratingChanges)).toContain("shooting");

      // Verify coach aged and changed
      const c1Res = result.coachResults.find((c: any) => c.playerId === "c1")!;
      expect(c1Res.ageDelta).toBe(1);
      expect(c1Res.oldStage).toBe("prime");
    });
  });

  describe("transitionSeasonAction mocks", () => {
    it("successfully runs off-season loop", async () => {
      const mockSeason = {
        id: "s1",
        seasonNumber: 1,
        status: "completed",
        leagueId: "l1",
        league: {
          sportPreset: "soccer",
          archetype: "league",
          settings: {},
          teams: [
            {
              id: "t1",
              name: "Team A",
              color: "#ff0000",
              players: [
                {
                  id: "p1",
                  firstName: "Alex",
                  lastName: "Mwangi",
                  position: "ST",
                  age: 22,
                  careerStage: "developing",
                  ratings: {
                    pace: 70,
                    shooting: 65,
                    passing: 60,
                    defending: 30,
                    physical: 50,
                    stamina: 55,
                    composure: 60,
                  },
                  isActive: true,
                },
              ],
              coaches: [
                {
                  id: "c1",
                  firstName: "Sven",
                  lastName: "Kozlov",
                  role: "Head Coach",
                  age: 48,
                  careerStage: "prime",
                  ratings: { strategy: 60, development: 70, motivation: 65, adaptability: 68 },
                  isActive: true,
                },
              ],
            },
            {
              id: "t2",
              name: "Team B",
              color: "#0000ff",
              players: [
                {
                  id: "p2",
                  firstName: "Marco",
                  lastName: "Silva",
                  position: "ST",
                  age: 23,
                  careerStage: "developing",
                  ratings: {
                    pace: 70,
                    shooting: 65,
                    passing: 60,
                    defending: 30,
                    physical: 50,
                    stamina: 55,
                    composure: 60,
                  },
                  isActive: true,
                },
              ],
              coaches: [
                {
                  id: "c2",
                  firstName: "Jean",
                  lastName: "Morales",
                  role: "Head Coach",
                  age: 42,
                  careerStage: "prime",
                  ratings: { strategy: 60, development: 70, motivation: 65, adaptability: 68 },
                  isActive: true,
                },
              ],
            },
          ],
        },
      };

      const mockPrisma: any = {
        sportSeason: {
          findUnique: jest.fn<any>().mockResolvedValue(mockSeason),
          create: jest.fn<any>().mockResolvedValue({ id: "s2", seasonNumber: 2 }),
          update: jest.fn<any>().mockResolvedValue({}),
        },
        sportPlayer: {
          update: jest.fn<any>().mockResolvedValue({}),
          create: jest.fn<any>().mockResolvedValue({ id: "new_p" }),
        },
        sportCoach: {
          update: jest.fn<any>().mockResolvedValue({}),
          create: jest.fn<any>().mockResolvedValue({}),
        },
        sportTeam: {
          findMany: jest.fn<any>().mockResolvedValue(mockSeason.league.teams),
          update: jest.fn<any>().mockResolvedValue({}),
        },
        sportMatchStat: {
          findMany: jest.fn<any>().mockResolvedValue([]),
        },
        sportSeasonRecord: {
          deleteMany: jest.fn<any>().mockResolvedValue({}),
          createMany: jest.fn<any>().mockResolvedValue({}),
        },
        sportStanding: {
          findMany: jest.fn<any>().mockResolvedValue([]),
          createMany: jest.fn<any>().mockResolvedValue({}),
        },
        sportTeamSeason: {
          createMany: jest.fn<any>().mockResolvedValue({}),
        },
        sportRookieClass: {
          create: jest.fn<any>().mockResolvedValue({}),
        },
        sportDraftPick: {
          createMany: jest.fn<any>().mockResolvedValue({}),
        },
        sportMatch: {
          create: jest.fn<any>().mockResolvedValue({}),
        },
      };

      const result = await transitionSeasonAction(mockPrisma, "s1");

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("newSeasonId", "s2");
      expect(result).toHaveProperty("newSeasonNumber", 2);

      // Verify that database calls were made for aging, standings, draft, and matches
      expect(mockPrisma.sportSeason.findUnique).toHaveBeenCalledWith({
        where: { id: "s1" },
        include: expect.any(Object),
      });
      expect(mockPrisma.sportPlayer.update).toHaveBeenCalled();
      expect(mockPrisma.sportSeason.create).toHaveBeenCalled();
      expect(mockPrisma.sportStanding.createMany).toHaveBeenCalled();
      expect(mockPrisma.sportRookieClass.create).toHaveBeenCalled();
      expect(mockPrisma.sportDraftPick.createMany).toHaveBeenCalled();
      expect(mockPrisma.sportMatch.create).toHaveBeenCalled();
    });
  });
});
