import {
  formatMatchDayBulletin,
  formatSeasonChampionBulletin,
  formatPlayoffBulletin,
} from "./feed-bulletins";

describe("formatMatchDayBulletin", () => {
  test("returns header only when results are empty", () => {
    const content = formatMatchDayBulletin({
      leagueName: "Premier League",
      sportEmoji: "⚽",
      matchDay: 1,
      results: [],
    });
    expect(content).toBe("⚽ **Premier League** — Matchday 1\n══════════════════════════════\n");
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
    expect(content).toBe(
      "⚽ **Championship** — Matchday 5\n══════════════════════════════\n🏆 **United** 2 – 1 City"
    );
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
      "🏀 **Slam Dunk League** — Matchday 12\n══════════════════════════════\n🏆 **Lakers** 102 – 99 Celtics\nWarriors 88 – 92 🏆 **Bulls**"
    );
  });
});

describe("formatMatchDayBulletin — table movers", () => {
  test("renders up/down arrows with ordinal ranks", () => {
    const content = formatMatchDayBulletin({
      leagueName: "Imperial League",
      sportEmoji: "⚽",
      matchDay: 12,
      results: [{ homeName: "Riverton", awayName: "Oakdale", homeScore: 2, awayScore: 0 }],
      movers: [
        { name: "Riverton", oldRank: 4, newRank: 2 },
        { name: "Oakdale", oldRank: 1, newRank: 3 },
      ],
    });
    expect(content).toContain("📈 **Table Movers**");
    expect(content).toContain("• Riverton ▲2 (4th → 2nd)");
    expect(content).toContain("• Oakdale ▼2 (1st → 3rd)");
  });

  test("no movers section when none provided (back-compat)", () => {
    const content = formatMatchDayBulletin({
      leagueName: "X",
      sportEmoji: "⚽",
      matchDay: 1,
      results: [{ homeName: "A", awayName: "B", homeScore: 1, awayScore: 0 }],
    });
    expect(content).not.toContain("Table Movers");
  });
});

describe("formatSeasonChampionBulletin", () => {
  test("formats champion bulletin correctly", () => {
    const content = formatSeasonChampionBulletin({
      leagueName: "La Liga",
      sportEmoji: "⚽",
      championName: "Real Madrid",
      llmSummary: "A glorious finish to a legendary season.",
    });
    expect(content).toBe(
      "⚽ 🏆 **La Liga CHAMPION CROWNED!**\n══════════════════════════════\nCongratulations to **Real Madrid** for winning the championship!\n\n📝 **Season Summary**\nA glorious finish to a legendary season."
    );
  });
});

describe("formatPlayoffBulletin", () => {
  test("formats playoff bulletin correctly", () => {
    const content = formatPlayoffBulletin({
      leagueName: "Stanley Cup Playoffs",
      sportEmoji: "🏒",
      roundName: "Semifinals",
      results: [
        {
          homeName: "Rangers",
          awayName: "Devils",
          homeScore: 4,
          awayScore: 3,
        },
      ],
    });
    expect(content).toBe(
      "🏒 **Stanley Cup Playoffs Playoff Semifinals Results**\n══════════════════════════════\n🏆 **Rangers** 4 – 3 Devils"
    );
  });
});
