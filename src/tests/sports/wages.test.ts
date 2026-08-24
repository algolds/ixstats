import { describe, it, expect } from "@jest/globals";
import { playerWage, teamWageBill } from "~/lib/sports/team-rating";

describe("MyClub wages", () => {
  it("scales wage with overall rating (monotonic)", () => {
    expect(playerWage({ overall: 99 })).toBeGreaterThan(playerWage({ overall: 50 }));
    expect(playerWage({ overall: 50 })).toBeGreaterThan(0);
  });

  it("falls back to averaging attributes when no overall present", () => {
    expect(playerWage({ pace: 60, shooting: 60 })).toBe(playerWage({ overall: 60 }));
  });

  it("sums only active players in the wage bill", () => {
    const players = [
      { isActive: true, ratings: { overall: 80 } },
      { isActive: false, ratings: { overall: 80 } },
      { isActive: true, ratings: { overall: 80 } },
    ];
    expect(teamWageBill(players)).toBe(playerWage({ overall: 80 }) * 2);
  });
});
