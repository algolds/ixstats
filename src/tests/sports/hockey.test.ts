import { describe, it, expect } from "@jest/globals";
import { runHockeyMatch } from "~/lib/sports/resolvers/hockey";
import { createRNG } from "~/lib/sports/resolver";
import { decidedAfterRegulation } from "~/lib/sports/match-outcome";
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

  it("reads an overtime / shootout decision from the trace (tied after 60 minutes)", () => {
    let overtimeGames = 0;
    let regulationGames = 0;
    for (let seed = 100; seed <= 150; seed++) {
      const outcome = runHockeyMatch(
        createMockContext(seed, {
          homeOffense: 50,
          homeDefense: 50,
          awayOffense: 50,
          awayDefense: 50,
        })
      );
      const tiedAfterRegulation = outcome.trace.some((e) =>
        e.description.startsWith("END OF REGULATION")
      );
      expect(decidedAfterRegulation("hockey", outcome.trace)).toBe(tiedAfterRegulation);
      // Only hockey awards an overtime-loss point.
      expect(decidedAfterRegulation("soccer", outcome.trace)).toBe(false);
      if (tiedAfterRegulation) overtimeGames++;
      else regulationGames++;
    }
    expect(overtimeGames).toBeGreaterThan(0);
    expect(regulationGames).toBeGreaterThan(0);
  });
});
