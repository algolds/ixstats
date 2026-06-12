import { describe, it, expect, jest } from "@jest/globals";
import { resolveMatch } from "../../lib/sports/resolver";

describe("MyLeague Tactics & ELO+ Resolution Engine", () => {
  const defaultRoster = [
    {
      id: "p1",
      firstName: "Striker",
      lastName: "One",
      position: "ST",
      ratings: { shooting: 80, form: 70 },
    },
    {
      id: "p2",
      firstName: "Midfielder",
      lastName: "One",
      position: "CM",
      ratings: { passing: 75, form: 70 },
    },
    {
      id: "p3",
      firstName: "Defender",
      lastName: "One",
      position: "CB",
      ratings: { defending: 75, form: 70 },
    },
    {
      id: "p4",
      firstName: "Goalie",
      lastName: "One",
      position: "GK",
      ratings: { composure: 80, form: 70 },
    },
  ];

  const defaultHomeTeam = {
    overall: 75,
    offense: 78,
    defense: 72,
    form: 70,
    depth: 65,
    coaching: 60,
  };

  const defaultAwayTeam = {
    overall: 73,
    offense: 74,
    defense: 72,
    form: 68,
    depth: 63,
    coaching: 58,
  };

  it("applies tactical intents correctly to strengths", () => {
    // Normal / Neutral resolving
    const resultNeutral = resolveMatch({
      sport: "soccer",
      homeTeam: defaultHomeTeam,
      awayTeam: defaultAwayTeam,
      archetype: "league",
      seed: 12345,
      homeTacticalIntent: "neutral",
      awayTacticalIntent: "neutral",
      homeRoster: defaultRoster,
      awayRoster: defaultRoster,
    });

    // All-Out Attack resolving
    const resultAttack = resolveMatch({
      sport: "soccer",
      homeTeam: defaultHomeTeam,
      awayTeam: defaultAwayTeam,
      archetype: "league",
      seed: 12345,
      homeTacticalIntent: "all_out_attack",
      awayTacticalIntent: "neutral",
      homeRoster: defaultRoster,
      awayRoster: defaultRoster,
    });

    // Park the Bus resolving
    const resultDefend = resolveMatch({
      sport: "soccer",
      homeTeam: defaultHomeTeam,
      awayTeam: defaultAwayTeam,
      archetype: "league",
      seed: 12345,
      homeTacticalIntent: "park_the_bus",
      awayTacticalIntent: "neutral",
      homeRoster: defaultRoster,
      awayRoster: defaultRoster,
    });

    // Strengths adjust accordingly
    expect(resultAttack.keyStats.homeStrength).toBeGreaterThan(resultDefend.keyStats.homeStrength);
    expect(resultAttack.evaluation.tempo).toBeGreaterThan(resultDefend.evaluation.tempo);
  });

  it("applies Rock-Paper-Scissors counter-attack bonuses vs All-Out Attack", () => {
    const resultRPS = resolveMatch({
      sport: "soccer",
      homeTeam: defaultHomeTeam,
      awayTeam: defaultAwayTeam,
      archetype: "league",
      seed: 12345,
      homeTacticalIntent: "counter_attack",
      awayTacticalIntent: "all_out_attack",
      homeRoster: defaultRoster,
      awayRoster: defaultRoster,
    });

    // Home gets the +8 tactical counter-attack bonus, boosting their adjusted strength
    expect(resultRPS.keyStats.homeStrength).toBeGreaterThan(defaultHomeTeam.overall);
  });

  it("scales ELO delta by dominance", () => {
    // Expected wins with high dominance get 100% ELO
    const normalResult = resolveMatch({
      sport: "soccer",
      homeTeam: { ...defaultHomeTeam, overall: 90, offense: 90, defense: 90 },
      awayTeam: { ...defaultAwayTeam, overall: 50, offense: 50, defense: 50 },
      archetype: "league",
      seed: 9999,
      homeTacticalIntent: "neutral",
      awayTacticalIntent: "neutral",
      homeRoster: defaultRoster,
      awayRoster: defaultRoster,
    });

    expect(normalResult.evaluation.dominance).toBeGreaterThan(0.5);
  });

  it("generates event trace steps chronologically", () => {
    const result = resolveMatch({
      sport: "soccer",
      homeTeam: defaultHomeTeam,
      awayTeam: defaultAwayTeam,
      archetype: "league",
      seed: 54321,
      homeTacticalIntent: "neutral",
      awayTacticalIntent: "neutral",
      homeRoster: defaultRoster,
      awayRoster: defaultRoster,
    });

    expect(result.trace.length).toBeGreaterThan(0);
    expect(result.trace[0].t).toBe(0);
    expect(result.trace[0].type).toBe("tactic_shift");

    // All subsequent events have t > 0
    for (let i = 1; i < result.trace.length; i++) {
      expect(result.trace[i].t).toBeGreaterThanOrEqual(result.trace[i - 1].t);
      expect(["goal", "card", "injury", "tactic_shift"]).toContain(result.trace[i].type);
    }
  });
});
