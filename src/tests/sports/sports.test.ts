import { describe, it, expect } from "@jest/globals";
import { generateSchedule } from "../../lib/sports/scheduler";
import { resolveMatch, resolveRace } from "../../lib/sports/resolver";
import type { TeamRatingVector } from "../../lib/sports/resolver";

describe("MyLeague Sports Engine", () => {
  describe("generateSchedule fallback for division_conference", () => {
    it("automatically generates divisions when none are provided", () => {
      const schedule = generateSchedule({
        archetype: "division_conference",
        teamCount: 8,
      });

      expect(schedule.length).toBeGreaterThan(0);
      // Scheduled matches should have homeTeamIndex and awayTeamIndex
      expect(schedule[0]).toHaveProperty("homeTeamIndex");
      expect(schedule[0]).toHaveProperty("awayTeamIndex");
    });
  });

  describe("resolveMatch ELO deltas", () => {
    it("correctly calculates rating changes", () => {
      const homeTeam: TeamRatingVector = {
        overall: 80,
        offense: 80,
        defense: 80,
        form: 80,
        depth: 80,
        coaching: 80,
      };

      const awayTeam: TeamRatingVector = {
        overall: 50,
        offense: 50,
        defense: 50,
        form: 50,
        depth: 50,
        coaching: 50,
      };

      const result = resolveMatch({
        sport: "soccer",
        homeTeam,
        awayTeam,
        archetype: "league",
        seed: 12345,
      });

      expect(result).toHaveProperty("homeScore");
      expect(result).toHaveProperty("awayScore");
      expect(result).toHaveProperty("homeRatingDelta");
      expect(result).toHaveProperty("awayRatingDelta");
      expect(typeof result.homeRatingDelta).toBe("number");
      expect(typeof result.awayRatingDelta).toBe("number");
    });
  });

  describe("resolveRace simulation", () => {
    it("simulates motorist races with drivers", () => {
      const drivers = [
        {
          driverId: "d1",
          teamId: "t1",
          pace: 95,
          consistency: 90,
          wetSkill: 85,
          overtaking: 88,
          tyreManagement: 92,
          starts: 90,
        },
        {
          driverId: "d2",
          teamId: "t2",
          pace: 60,
          consistency: 70,
          wetSkill: 65,
          overtaking: 68,
          tyreManagement: 72,
          starts: 70,
        },
      ];

      const result = resolveRace({
        drivers,
        seed: 9999,
        isWet: false,
      });

      expect(result.positions).toHaveLength(2);
      expect(result.positions[0]).toHaveProperty("driverId");
      expect(result.positions[0]).toHaveProperty("finishPosition");
      expect(result.positions[0]).toHaveProperty("points");
    });
  });
});
