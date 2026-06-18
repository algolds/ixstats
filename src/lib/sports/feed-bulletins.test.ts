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
