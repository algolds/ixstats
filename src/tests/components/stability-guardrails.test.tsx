import { nsApiClient } from "~/lib/nationstates/api-client";
import { useToastQueueStore } from "~/stores/toastQueueStore";
describe("Stability Guardrails", () => {
  let warnSpy: any;
  let errorSpy: any;
  let logSpy: any;

  beforeEach(() => {
    jest.clearAllMocks();
    useToastQueueStore.setState({ queue: [] });
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy?.mockRestore();
    errorSpy?.mockRestore();
    logSpy?.mockRestore();
  });

  // ─── WebGL / Graphics Error Safety ───
  // ─── AI Personality Resilience ───
  // ─── Cards & Sync Fallbacks ───
  describe("NationStates API Client Error Propagation", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("should propagate RATE_LIMIT errors when API returns HTTP 429", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      await expect(nsApiClient.fetchDeck("testnation")).rejects.toThrow("RATE_LIMIT");
    });

    it("should propagate SERVER_ERROR errors when API returns HTTP 503", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      });

      await expect(nsApiClient.fetchDeck("testnation")).rejects.toThrow("SERVER_ERROR");
    });

    it("should return null for expected HTTP 404 nation not found errors", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const deck = await nsApiClient.fetchDeck("unknown_nation_xyz");
      expect(deck).toBeNull();
    });
  });
});
