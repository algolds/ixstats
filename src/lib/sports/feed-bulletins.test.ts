import { formatMatchDayBulletin } from "./feed-bulletins";

describe("formatMatchDayBulletin", () => {
  test("returns header only when results are empty", () => {
    const content = formatMatchDayBulletin({
      leagueName: "Premier League",
      sportEmoji: "⚽",
      matchDay: 1,
      results: [],
    });
    expect(content).toBe("⚽ [Premier League] Match Day 1 results\n\n");
  });

  test("formats single result correctly", () => {
    const content = formatMatchDayBulletin({
      leagueName: "Championship",
      sportEmoji: "⚽",
      matchDay: 5,
      results: [
        {
          homeName: "United",
          awayName: "City",
          homeScore: 2,
          awayScore: 1,
        },
      ],
    });
    expect(content).toBe("⚽ [Championship] Match Day 5 results\n\nUnited 2–1 City");
  });

  test("formats multiple results preserving order and format", () => {
    const content = formatMatchDayBulletin({
      leagueName: "Slam Dunk League",
      sportEmoji: "🏀",
      matchDay: 12,
      results: [
        {
          homeName: "Lakers",
          awayName: "Celtics",
          homeScore: 102,
          awayScore: 99,
        },
        {
          homeName: "Warriors",
          awayName: "Bulls",
          homeScore: 88,
          awayScore: 92,
        },
      ],
    });
    expect(content).toBe(
      "🏀 [Slam Dunk League] Match Day 12 results\n\nLakers 102–99 Celtics\nWarriors 88–92 Bulls"
    );
  });
});
