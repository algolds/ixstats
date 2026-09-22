import { describe, it, expect } from "@jest/globals";

describe("Historical Almanac & Archival Calculations", () => {
  it("calculates team championship leaderboard ranking accurately", () => {
    const historicalChampions = [
      { id: "team-1", name: "Victoria FC", season: 1 },
      { id: "team-2", name: "Senate FC", season: 2 },
      { id: "team-1", name: "Victoria FC", season: 3 },
      { id: "team-1", name: "Victoria FC", season: 4 },
      { id: "team-3", name: "Corinthians", season: 5 },
    ];

    const titleCounts = new Map<string, { teamId: string; teamName: string; titles: number }>();

    for (const c of historicalChampions) {
      const existing = titleCounts.get(c.id) ?? {
        teamId: c.id,
        teamName: c.name,
        titles: 0,
      };
      existing.titles++;
      titleCounts.set(c.id, existing);
    }

    const leaderboard = Array.from(titleCounts.values()).sort((a, b) => b.titles - a.titles);

    expect(leaderboard[0].teamName).toBe("Victoria FC");
    expect(leaderboard[0].titles).toBe(3);
    expect(leaderboard[1].titles).toBe(1);
  });

  it("computes all-time match scoring records across multi-season archives", () => {
    const pastMatches = [
      { id: "m1", homeScore: 2, awayScore: 1, season: 1 },
      { id: "m2", homeScore: 5, awayScore: 4, season: 2 },
      { id: "m3", homeScore: 0, awayScore: 0, season: 3 },
    ];

    let highestScoringMatch: { id: string; total: number } | null = null;
    for (const m of pastMatches) {
      const total = m.homeScore + m.awayScore;
      if (!highestScoringMatch || total > highestScoringMatch.total) {
        highestScoringMatch = { id: m.id, total };
      }
    }

    expect(highestScoringMatch?.id).toBe("m2");
    expect(highestScoringMatch?.total).toBe(9);
  });
});
