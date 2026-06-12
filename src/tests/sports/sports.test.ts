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
      expect(result.homeRatingDelta).toBeDefined();
      expect(result.awayRatingDelta).toBeDefined();
    });
  });

  describe("resolveMatch granular simulators play-by-play", () => {
    const homeTeam: TeamRatingVector = {
      overall: 75,
      offense: 75,
      defense: 75,
      form: 75,
      depth: 75,
      coaching: 75,
    };
    const awayTeam: TeamRatingVector = {
      overall: 75,
      offense: 75,
      defense: 75,
      form: 75,
      depth: 75,
      coaching: 75,
    };
    const mockRoster = (prefix: string) => [
      {
        id: `${prefix}_qb_pg_sp`,
        firstName: prefix,
        lastName: "Star",
        position: "QB",
        ratings: { overall: 80 },
      },
      {
        id: `${prefix}_rb_sg_rp`,
        firstName: prefix,
        lastName: "Runner",
        position: "RB",
        ratings: { overall: 75 },
      },
      {
        id: `${prefix}_wr_sf_cp`,
        firstName: prefix,
        lastName: "Catcher",
        position: "WR",
        ratings: { overall: 75 },
      },
      {
        id: `${prefix}_te_pf_c`,
        firstName: prefix,
        lastName: "TightEnd",
        position: "TE",
        ratings: { overall: 75 },
      },
      {
        id: `${prefix}_k_c_1b`,
        firstName: prefix,
        lastName: "Kicker",
        position: "K",
        ratings: { overall: 75 },
      },
      {
        id: `${prefix}_p_sg_2b`,
        firstName: prefix,
        lastName: "Punter",
        position: "P",
        ratings: { overall: 75 },
      },
      {
        id: `${prefix}_pg_3b`,
        firstName: prefix,
        lastName: "Guard",
        position: "PG",
        ratings: { overall: 75 },
      },
      {
        id: `${prefix}_sf_ss`,
        firstName: prefix,
        lastName: "Forward",
        position: "SF",
        ratings: { overall: 75 },
      },
      {
        id: `${prefix}_c_lf`,
        firstName: prefix,
        lastName: "Center",
        position: "C",
        ratings: { overall: 75 },
      },
      {
        id: `${prefix}_sp_cf`,
        firstName: prefix,
        lastName: "Pitcher",
        position: "SP",
        ratings: { overall: 75 },
      },
      {
        id: `${prefix}_rp_rf`,
        firstName: prefix,
        lastName: "Reliever",
        position: "RP",
        ratings: { overall: 75 },
      },
      {
        id: `${prefix}_cp_dh`,
        firstName: prefix,
        lastName: "Closer",
        position: "CP",
        ratings: { overall: 75 },
      },
    ];

    it("simulates basketball with fouls and free throws", () => {
      const result = resolveMatch({
        sport: "basketball",
        homeTeam,
        awayTeam,
        archetype: "league",
        seed: 45,
        homeRoster: mockRoster("Home"),
        awayRoster: mockRoster("Away"),
      });

      expect(result.trace.length).toBeGreaterThan(0);
      const hasFreeThrows = result.trace.some(
        (t) =>
          t.description.toLowerCase().includes("free throw") ||
          t.description.toLowerCase().includes("ft:")
      );
      expect(hasFreeThrows).toBe(true);
    });

    it("simulates baseball with pitcher fatigue and RP substitutions", () => {
      const result = resolveMatch({
        sport: "baseball",
        homeTeam,
        awayTeam,
        archetype: "league",
        seed: 102,
        homeRoster: mockRoster("Home"),
        awayRoster: mockRoster("Away"),
      });

      expect(result.trace.length).toBeGreaterThan(0);
      const hasPitchingChange = result.trace.some((t) =>
        t.description.toLowerCase().includes("pitching change")
      );
      expect(hasPitchingChange).toBe(true);
    });

    it("simulates soccer extra time in bracket archetype", () => {
      // Loop to find a seed that results in a regulation draw
      let result: any = null;
      let hasExtraTime = false;
      for (let seed = 1; seed <= 500; seed++) {
        result = resolveMatch({
          sport: "soccer",
          homeTeam,
          awayTeam,
          archetype: "bracket",
          seed,
          homeRoster: mockRoster("Home"),
          awayRoster: mockRoster("Away"),
        });
        hasExtraTime = result.trace.some((t: any) =>
          t.description.toLowerCase().includes("extra time")
        );
        if (hasExtraTime) break;
      }
      expect(hasExtraTime).toBe(true);
      expect(result.trace.length).toBeGreaterThan(0);
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
