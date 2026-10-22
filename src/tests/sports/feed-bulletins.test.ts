/**
 * Sports bulletins on the feed: a stored marker the card would read is refused unless every field it reads is
 * well-formed (untrusted post content), a legacy markdown bulletin still parses, and one encode round trip.
 */
import {
  formatMatchDayBulletin,
  encodeSportsBulletin,
  parseSportsBulletin,
} from "~/lib/sports/feed-bulletins";
describe("encode and parse sports bulletin", () => {
  it("encodes and parses correctly", () => {
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
  it("recovers a legacy markdown bulletin (no marker) into card data", () => {
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
});

describe("parseSportsBulletin — stored JSON marker", () => {
  const marker = (fields: string) =>
    `<!-- sports-bulletin:{"league":{"name":"Premier"},"sportEmoji":"⚽"${fields}} -->`;

  it.each([
    ["no league", '<!-- sports-bulletin:{"results":[]} -->'],
    ["results: null", marker(',"results":null')],
    ["results: [{}]", marker(',"results":[{}]')],
    [
      "a result with a text score",
      marker(
        ',"results":[{"home":{"name":"A"},"away":{"name":"B"},"homeScore":"1","awayScore":0}]'
      ),
    ],
    ["movers: [1]", marker(',"movers":[1]')],
  ])("does not trust a marker with %s (the card reads those fields)", (_name, content) => {
    expect(parseSportsBulletin(content)).toBeNull();
  });

  it("falls through to the markdown under a marker it does not trust", () => {
    const content = `${marker(',"results":[{}]')}\n${formatMatchDayBulletin({
      leagueName: "Premier",
      sportEmoji: "⚽",
      matchDay: 4,
      results: [{ homeName: "Alpha", awayName: "Beta", homeScore: 2, awayScore: 1 }],
    })}`;
    const parsed = parseSportsBulletin(content);
    expect(parsed?.matchDay).toBe(4);
    expect(parsed?.results).toHaveLength(1);
    expect(parsed?.results?.[0]).toMatchObject({
      home: { name: "Alpha" },
      away: { name: "Beta" },
      homeScore: 2,
      awayScore: 1,
    });
  });
});
