import {
  narrateEvents,
  narrateBulletin,
  generateMatchReport,
  generateMatchPreview,
  generateSeasonSummary,
  generateAudioBroadcast,
} from "~/lib/sports/commentary/narrator";
import type { EventTraceStep } from "~/lib/sports/types";

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
    const events: EventTraceStep[] = [
      { t: 1, type: "tactic_shift", description: "Match starts", team: "home" },
    ];
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

    const events: EventTraceStep[] = [
      { t: 1, type: "tactic_shift", description: "Match starts", team: "home" },
    ];
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

  describe("caller-supplied endpoints never receive the server key", () => {
    const okReply = (content: string) =>
      jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content } }] }),
      });
    const events: EventTraceStep[] = [
      { t: 1, type: "tactic_shift", description: "Match starts", team: "home" },
    ];

    test("narrateEvents ignores a custom URL that comes without its own key", async () => {
      const mockFetch = okReply(JSON.stringify({ commentary: ["Kick-off!"] }));
      global.fetch = mockFetch;

      await narrateEvents(events, {
        sport: "soccer",
        config: { apiUrl: "https://attacker.example/collect" },
      });

      const [url, init] = mockFetch.mock.calls[0];
      expect(String(url)).not.toContain("attacker.example");
      expect(init.headers.Authorization).toBe("Bearer test-key");
    });

    test("narrateEvents drops a keyed config whose host is not allowlisted", async () => {
      const mockFetch = okReply(JSON.stringify({ commentary: ["Kick-off!"] }));
      global.fetch = mockFetch;

      await narrateEvents(events, {
        sport: "soccer",
        config: { apiKey: "user-key", apiUrl: "http://169.254.169.254/latest" },
      });

      const [url, init] = mockFetch.mock.calls[0];
      expect(String(url)).not.toContain("169.254.169.254");
      expect(init.headers.Authorization).toBe("Bearer test-key");
    });

    test("narrateEvents uses the caller's own key on an allowlisted host", async () => {
      const mockFetch = okReply(JSON.stringify({ commentary: ["Kick-off!"] }));
      global.fetch = mockFetch;

      await narrateEvents(events, {
        sport: "soccer",
        config: { apiKey: "user-key", apiUrl: "https://openrouter.ai/api/v1" },
      });

      const [url, init] = mockFetch.mock.calls[0];
      expect(String(url)).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(init.headers.Authorization).toBe("Bearer user-key");
    });

    test("generateAudioBroadcast only posts to the configured TTS endpoint", async () => {
      process.env.SPORTS_TTS_ENABLED = "true";
      process.env.SPORTS_TTS_API_URL = "https://tts.example.hf.space/synthesize";
      process.env.SPORTS_TTS_API_KEY = "tts-key";
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(4),
      });
      global.fetch = mockFetch;

      try {
        // Extra arguments from an old caller must not redirect the request.
        await (generateAudioBroadcast as (...args: unknown[]) => Promise<string | null>)(
          ["Goal!"],
          { apiUrl: "https://attacker.example/collect" }
        );
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toBe("https://tts.example.hf.space/synthesize");
        expect(init.headers.Authorization).toBe("Bearer tts-key");
      } finally {
        delete process.env.SPORTS_TTS_ENABLED;
        delete process.env.SPORTS_TTS_API_URL;
        delete process.env.SPORTS_TTS_API_KEY;
      }
    });
  });
});
