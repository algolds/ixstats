import {
  formatMatchDayBulletin,
  formatSeasonChampionBulletin,
  formatPlayoffBulletin,
  encodeSportsBulletin,
  parseSportsBulletin,
} from "./feed-bulletins";

describe("formatMatchDayBulletin", () => {
  test("returns header only when results are empty", () => {
    const content = formatMatchDayBulletin({
      leagueName: "Premier League",
      sportEmoji: "⚽",
      matchDay: 1,
      results: [],
    });
    expect(content).toBe("**Premier League** — Matchday 1\n\n");
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
    expect(content).toBe("**Championship** — Matchday 5\n\n🏆 **United** 2 – 1 City");
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
      "**Slam Dunk League** — Matchday 12\n\n🏆 **Lakers** 102 – 99 Celtics\nWarriors 88 – 92 🏆 **Bulls**"
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
      leagueId: "la-liga-id",
      sportEmoji: "⚽",
      championName: "Real Madrid",
      championId: "real-madrid-id",
      llmSummary: "A glorious finish to a legendary season.",
    });
    expect(content).toBe(
      "🏆 **[La Liga](/myleague/la-liga-id) CHAMPION CROWNED!**\n\nCongratulations to [Real Madrid](/myclub/real-madrid-id) for winning the championship!\n\n📝 **Season Summary**\nA glorious finish to a legendary season."
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
      "**Stanley Cup Playoffs Playoff Semifinals Results**\n\n🏆 **Rangers** 4 – 3 Devils"
    );
  });
});

describe("encode and parse sports bulletin", () => {
  test("encodes and parses correctly", () => {
    const data = {
      league: { id: "league-123", name: "La Liga" },
      sportEmoji: "⚽",
      matchDay: 5,
      results: [
        {
          home: { name: "United", id: "team-home" },
          away: { name: "City", id: "team-away" },
          homeScore: 2,
          awayScore: 1,
          isUpset: true,
        },
      ],
      movers: [{ name: "United", id: "team-home", oldRank: 5, newRank: 3 }],
      llmSummary: "An unexpected turn of events.",
    };
    const markdown = "**La Liga** — Matchday 5\n\n🏆 **United** 2 – 1 City";
    const encoded = encodeSportsBulletin(data, markdown);
    expect(encoded).toContain("<!-- sports-bulletin:");
    expect(encoded).toContain(markdown);

    const parsed = parseSportsBulletin(encoded);
    expect(parsed).toEqual(data);
  });

  test("returns null for content without sports bulletin comments", () => {
    expect(parseSportsBulletin("some other content")).toBeNull();
  });

  test("recovers a legacy markdown bulletin (no marker) into card data", () => {
    // Exactly what the pre-encode cron posted — names with trailing digits + movers.
    const markdown = formatMatchDayBulletin({
      leagueName: "Imperial League",
      sportEmoji: "⚽",
      matchDay: 18,
      results: [
        {
          homeName: "Imperial League Team 1",
          awayName: "Imperial League Team 3",
          homeScore: 2,
          awayScore: 0,
        },
        { homeName: "Imperial League Team 5", awayName: "Venatores", homeScore: 0, awayScore: 0 },
      ],
      movers: [{ name: "Venatores", oldRank: 6, newRank: 8 }],
    });
    const parsed = parseSportsBulletin(markdown);
    expect(parsed).not.toBeNull();
    expect(parsed!.matchDay).toBe(18);
    expect(parsed!.league.name).toBe("Imperial League");
    expect(parsed!.results![0]!).toMatchObject({
      home: { name: "Imperial League Team 1" },
      away: { name: "Imperial League Team 3" },
      homeScore: 2,
      awayScore: 0,
    });
    expect(parsed!.results![1]!.away.name).toBe("Venatores");
    expect(parsed!.movers).toEqual([{ name: "Venatores", oldRank: 6, newRank: 8 }]);
  });

  test("recovers a bulletin with optional asterisks, standard hyphens, and digits in team names", () => {
    const rawMarkdown = `⚽ Ligue Yonderre — Matchday 21
══════════════════════════════
🏆 Sainte-Jule-du-Mont AS 3 - 0 1. FC Donnebourg
Lance FC 1 - 1 SC Sainte-Cataline
Gabion Giants 1 - 2 🏆 Toubourg FC
Collinebourg Chevaliers 2 - 0 Famichez 16

📈 Table Movers
• Vallonbourg AS ▲4 (13th → 9th)
• Artillerie FC ▲2 (5th → 3rd)
• Lance FC ▼2 (2nd → 4th)`;

    const parsed = parseSportsBulletin(rawMarkdown);
    expect(parsed).not.toBeNull();
    expect(parsed!.league.name).toBe("Ligue Yonderre");
    expect(parsed!.matchDay).toBe(21);
    expect(parsed!.results!.length).toBe(4);
    expect(parsed!.results![0]!).toMatchObject({
      home: { name: "Sainte-Jule-du-Mont AS" },
      away: { name: "1. FC Donnebourg" },
      homeScore: 3,
      awayScore: 0,
    });
    expect(parsed!.results![3]!).toMatchObject({

      home: { name: "Collinebourg Chevaliers" },
      away: { name: "Famichez 16" },
      homeScore: 2,
      awayScore: 0,
    });
    expect(parsed!.movers).toEqual([
      { name: "Vallonbourg AS", oldRank: 13, newRank: 9 },
      { name: "Artillerie FC", oldRank: 5, newRank: 3 },
      { name: "Lance FC", oldRank: 2, newRank: 4 },
    ]);
  });

  test("recovers a champion bulletin from raw text", () => {
    const rawMarkdown = `🏒 🏆 Orixtal Hockey League CHAMPION CROWNED!
══════════════════════════════
Congratulations to Porto Alegre Tubarões for winning the championship!`;
    const parsed = parseSportsBulletin(rawMarkdown);
    expect(parsed).not.toBeNull();
    expect(parsed!.league.name).toBe("Orixtal Hockey League");
    expect(parsed!.isChampionBulletin).toBe(true);
    expect(parsed!.championName).toBe("Porto Alegre Tubarões");
  });

  test("recovers a playoff results bulletin from raw text", () => {
    const rawMarkdown = `🏒 **Stanley Cup Playoffs Playoff Semifinals Results**
---
🏆 Rangers 4 – 3 Devils
Devils 2 – 5 Rangers`;
    const parsed = parseSportsBulletin(rawMarkdown);
    expect(parsed).not.toBeNull();
    expect(parsed!.league.name).toBe("Stanley Cup Playoffs");
    expect(parsed!.isPlayoffBulletin).toBe(true);
    expect(parsed!.roundName).toBe("Semifinals");
    expect(parsed!.results!.length).toBe(2);
    expect(parsed!.results![0]).toMatchObject({
      home: { name: "Rangers" },
      away: { name: "Devils" },
      homeScore: 4,
      awayScore: 3,
    });
  });

  test("parses a champion bulletin from a comment", () => {
    const rawContent = `<!-- sports-bulletin:{"league":{"name":"Orixtal Hockey League"},"sportEmoji":"🏒","isChampionBulletin":true,"championName":"Porto Alegre Tubarões"} -->
🏒 🏆 **Orixtal Hockey League CHAMPION CROWNED!**
══════════════════════════════
Congratulations to **Porto Alegre Tubarões** for winning the championship!`;
    const parsed = parseSportsBulletin(rawContent);
    expect(parsed).not.toBeNull();
    expect(parsed!.league.name).toBe("Orixtal Hockey League");
    expect(parsed!.isChampionBulletin).toBe(true);
    expect(parsed!.championName).toBe("Porto Alegre Tubarões");
  });
});
