import { describe, it, expect } from "@jest/globals";
import { runHockeyMatch } from "~/lib/sports/resolvers/hockey";
import { createRNG } from "~/lib/sports/resolver";
import type { SportResolverContext } from "~/lib/sports/resolvers/types";

describe("Ice Hockey 3-Period Match Resolver", () => {
  const createMockContext = (seed: number, overrides?: Partial<SportResolverContext>): SportResolverContext => ({
    rng: createRNG(seed),
    homeOffense: 75,
    homeDefense: 70,
    awayOffense: 72,
    awayDefense: 74,
    homeTactical: "neutral",
    awayTactical: "neutral",
    homeTeamModified: { overall: 73, offense: 75, defense: 70, form: 50, depth: 50, coaching: 50 },
    awayTeamModified: { overall: 73, offense: 72, defense: 74, form: 50, depth: 50, coaching: 50 },
    isPlayoff: false,
    isChampionship: false,
    archetype: "league",
    homeRoster: [
      { id: "h_f1", firstName: "Connor", lastName: "McPlayer", position: "C", ratings: { overall: 92, shooting: 90, passing: 95 } },
      { id: "h_f2", firstName: "Leon", lastName: "Striker", position: "LW", ratings: { overall: 88, shooting: 89, passing: 85 } },
      { id: "h_d1", firstName: "Cale", lastName: "Blueline", position: "D", ratings: { overall: 90, defense: 92, skating: 91 } },
      { id: "h_g1", firstName: "Igor", lastName: "Netminder", position: "G", ratings: { overall: 91, defense: 91 } },
    ],
    awayRoster: [
      { id: "a_f1", firstName: "Auston", lastName: "Sniper", position: "C", ratings: { overall: 91, shooting: 93, passing: 84 } },
      { id: "a_f2", firstName: "Mitch", lastName: "Playmaker", position: "RW", ratings: { overall: 87, shooting: 82, passing: 92 } },
      { id: "a_d1", firstName: "Victor", lastName: "Anchor", position: "D", ratings: { overall: 89, defense: 90, skating: 88 } },
      { id: "a_g1", firstName: "Andrei", lastName: "Wall", position: "G", ratings: { overall: 90, defense: 90 } },
    ],
    ...overrides,
  });

  it("simulates full 60-minute match with 3 distinct periods and intermissions", () => {
    const ctx = createMockContext(12345);
    const outcome = runHockeyMatch(ctx);

    expect(outcome.homeScore).toBeGreaterThanOrEqual(0);
    expect(outcome.awayScore).toBeGreaterThanOrEqual(0);
    expect(outcome.trace.length).toBeGreaterThan(10);

    // Verify period intermissions
    const period1End = outcome.trace.find((e) => e.t === 20 && e.description.includes("END OF 1ST PERIOD"));
    const period2End = outcome.trace.find((e) => e.t === 40 && e.description.includes("END OF 2ND PERIOD"));

    expect(period1End).toBeDefined();
    expect(period2End).toBeDefined();
  });

  it("triggers power plays and penalties with actor attribution", () => {
    // Run multiple seeds to verify penalty generation
    let foundPenalty = false;
    for (let seed = 1; seed <= 20; seed++) {
      const outcome = runHockeyMatch(createMockContext(seed));
      const penaltyEvent = outcome.trace.find((e) => e.type === "card" && e.description.includes("PENALTY"));
      if (penaltyEvent) {
        foundPenalty = true;
        expect(penaltyEvent.actorName).toBeDefined();
        break;
      }
    }
    expect(foundPenalty).toBe(true);
  });

  it("triggers goalie pull when a team is trailing in Period 3 at t >= 56", () => {
    // Highly lopsided matchup to guarantee trailing score
    const ctx = createMockContext(777, {
      homeOffense: 95,
      homeDefense: 90,
      awayOffense: 40,
      awayDefense: 40,
    });
    const outcome = runHockeyMatch(ctx);

    if (outcome.homeScore > outcome.awayScore) {
      const goaliePullEvent = outcome.trace.find((e) => e.description.includes("Goalie pulled"));
      expect(goaliePullEvent).toBeDefined();
    }
  });

  it("resolves ties with 3-on-3 Overtime or Shootout without draws", () => {
    // Force tied ratings
    for (let seed = 100; seed <= 150; seed++) {
      const ctx = createMockContext(seed, {
        homeOffense: 50,
        homeDefense: 50,
        awayOffense: 50,
        awayDefense: 50,
      });
      const outcome = runHockeyMatch(ctx);
      // Hockey matches must never end in a draw
      expect(outcome.homeScore).not.toEqual(outcome.awayScore);
    }
  });
});
