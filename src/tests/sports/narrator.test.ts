import {
  narrateEvents,
  narrateBulletin,
  generateMatchReport,
  generateMatchPreview,
  generateSeasonSummary,
} from "~/lib/sports/commentary/narrator";

describe("narrator tests", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.SPORTS_LLM_COMMENTARY = "true";
    process.env.SPORTS_LLM_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.SPORTS_LLM_COMMENTARY;
    delete process.env.SPORTS_LLM_API_KEY;
    global.fetch = originalFetch;
  });

  test("narrateEvents fallback when disabled", async () => {
    process.env.SPORTS_LLM_COMMENTARY = "false";
    const events = [{ t: 1, type: "tactical", description: "Match starts" }];
    const result = await narrateEvents(events, { sport: "soccer" });
    expect(result).toEqual(["Match starts"]);
  });

  test("narrateEvents calls fetch and handles JSON structure", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ commentary: ["The whistle blows!"] }),
            },
          },
        ],
      }),
    });
    global.fetch = mockFetch;

    const events = [{ t: 1, type: "tactical", description: "Match starts" }];
    const result = await narrateEvents(events, { sport: "soccer" });
    expect(result).toEqual(["The whistle blows!"]);
    expect(mockFetch).toHaveBeenCalled();
  });

  test("narrateBulletin calls fetch and returns summary string", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "A thrilling matchday with many goals!",
            },
          },
        ],
      }),
    });
    global.fetch = mockFetch;

    const matches = [{ homeName: "United", awayName: "City", homeScore: 2, awayScore: 1 }];
    const result = await narrateBulletin(matches, {
      sport: "soccer",
      leagueName: "Premier League",
      matchDay: 1,
    });
    expect(result).toBe("A thrilling matchday with many goals!");
  });

  test("generateMatchReport calls fetch and returns report markdown", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "# Match Report\n\nUnited wins!",
            },
          },
        ],
      }),
    });
    global.fetch = mockFetch;

    const matchData = {
      homeTeamName: "United",
      awayTeamName: "City",
      homeScore: 2,
      awayScore: 1,
      sport: "soccer",
      events: [{ t: 1, type: "tactical", description: "Match starts" }],
      playerStats: [],
    };
    const result = await generateMatchReport(matchData);
    expect(result).toBe("# Match Report\n\nUnited wins!");
  });

  test("generateMatchPreview calls fetch and returns preview text", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "A tight clash is expected.",
            },
          },
        ],
      }),
    });
    global.fetch = mockFetch;

    const result = await generateMatchPreview(
      { name: "United", position: 1 },
      { name: "City", position: 2 },
      "soccer"
    );
    expect(result).toBe("A tight clash is expected.");
  });

  test("generateSeasonSummary calls fetch and returns summary text", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Season summary details.",
            },
          },
        ],
      }),
    });
    global.fetch = mockFetch;

    const result = await generateSeasonSummary(
      "Premier League",
      "United",
      [{ teamName: "United", points: 80, wins: 25, losses: 5 }],
      "soccer"
    );
    expect(result).toBe("Season summary details.");
  });
});
