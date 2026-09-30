import { describe, it, expect } from "@jest/globals";
import { generateMatchAnalysisFacts } from "./analysis";
import { createRNG } from "./rng";

describe("Deterministic Sports Simulation & Analysis Engine", () => {
  it("generates identical pseudo-random sequences for identical seeds", () => {
    const rng1 = createRNG(1337);
    const rng2 = createRNG(1337);

    const seq1 = [rng1(), rng1(), rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2(), rng2(), rng2()];

    expect(seq1).toEqual(seq2);
  });

  it("computes structured analytical facts from match events and ratings", () => {
    const facts = generateMatchAnalysisFacts({
      homeTeamName: "Victoria FC",
      awayTeamName: "Senate FC",
      homeScore: 3,
      awayScore: 1,
      sportPreset: "soccer",
      homeRatings: { offense: 85, defense: 75, midfield: 82, coaching: 80 },
      awayRatings: { offense: 72, defense: 70, midfield: 70, coaching: 65 },
      homeTactics: "Attacking",
      awayTactics: "Defensive",
      events: [
        { type: "goal", minute: 14, actorName: "Marcellus", teamName: "Victoria FC" },
        { type: "goal", minute: 28, actorName: "Marcellus", teamName: "Victoria FC" },
        { type: "goal", minute: 55, actorName: "Aurelius", teamName: "Senate FC" },
        { type: "goal", minute: 88, actorName: "Lucius", teamName: "Victoria FC" },
      ],
    });

    expect(facts.dominantPhase).toBe("early");
    expect(facts.possessionDeltaPct).toBeGreaterThan(0);
    expect(facts.tacticalAdvantageFactor).toBeGreaterThan(0);
    expect(facts.keyPerformer?.athleteName).toBe("Marcellus");
    expect(facts.keyPerformer?.metric).toContain("2");
    expect(facts.tacticalKeynotes.length).toBeGreaterThan(0);
  });
});
