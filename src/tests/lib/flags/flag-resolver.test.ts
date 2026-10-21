jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  fetchMediaWikiImageBatch: jest.fn(),
}));

import { ServerFlagResolver } from "~/lib/flags/flag-resolver.server";
import * as wikiBridge from "~/lib/wiki-os/adapters/mediawiki/bridge";

describe("Flag Resolver & Normalization (Plan 164)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe("ServerFlagResolver Core", () => {
    test("5. Ignores placeholder provided URL and resolves through pipeline", async () => {
      const resolver = new ServerFlagResolver();
      jest.spyOn(wikiBridge, "fetchMediaWikiImageBatch").mockResolvedValue(new Map());

      const result = await resolver.resolve("Valora", {
        providedUrl: "/images/flags/placeholder.svg",
      });

      expect(result.source).toBe("placeholder");
      expect(result.isPlaceholder).toBe(true);
    });
    test("9. Does NOT query Fictional Wiki when policy is commons-only", async () => {
      const fetchSpy = jest
        .spyOn(wikiBridge, "fetchMediaWikiImageBatch")
        .mockResolvedValue(new Map());

      const resolver = new ServerFlagResolver();
      const result = await resolver.resolve("Tretrid", { fallbackPolicy: "commons-only" });

      expect(result.source).toBe("placeholder");
      expect(result.isPlaceholder).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Only Commons called
    });
    test("12. Coalesces concurrent in-flight requests for the same country and policy", async () => {
      const mockMap = new Map<string, string>();
      mockMap.set("Flag_of_Germany.svg", "https://upload.wikimedia.org/germany.svg");
      const fetchSpy = jest
        .spyOn(wikiBridge, "fetchMediaWikiImageBatch")
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(mockMap), 50)));

      const resolver = new ServerFlagResolver();
      const [res1, res2, res3] = await Promise.all([
        resolver.resolve("Germany"),
        resolver.resolve("Germany"),
        resolver.resolve("Germany"),
      ]);

      expect(res1.flagUrl).toBe("https://upload.wikimedia.org/germany.svg");
      expect(res2.flagUrl).toBe("https://upload.wikimedia.org/germany.svg");
      expect(res3.flagUrl).toBe("https://upload.wikimedia.org/germany.svg");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
