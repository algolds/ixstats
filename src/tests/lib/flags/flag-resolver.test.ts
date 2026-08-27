jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  fetchMediaWikiImageBatch: jest.fn(),
}));

import { ServerFlagResolver } from "~/lib/flags/flag-resolver.server";
import { normalizeCountryName, normalizeFlagUrl, getFlagCandidateFileTitles } from "~/lib/flags/normalization";
import * as wikiBridge from "~/lib/wiki-os/adapters/mediawiki/bridge";

describe("Flag Resolver & Normalization (Plan 164)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Normalization", () => {
    test("1. normalizeCountryName trims, lowercases, and collapses whitespace", () => {
      expect(normalizeCountryName("  United   Kingdom  ")).toBe("united kingdom");
      expect(normalizeCountryName("FRANCE")).toBe("france");
      expect(normalizeCountryName("")).toBe("");
      expect(normalizeCountryName(null as any)).toBe("");
    });

    test("2. normalizeFlagUrl trims and returns null for empty/invalid URLs", () => {
      expect(normalizeFlagUrl("  https://example.com/flag.svg  ")).toBe("https://example.com/flag.svg");
      expect(normalizeFlagUrl("")).toBeNull();
      expect(normalizeFlagUrl("   ")).toBeNull();
      expect(normalizeFlagUrl(null)).toBeNull();
      expect(normalizeFlagUrl(undefined)).toBeNull();
    });

    test("3. getFlagCandidateFileTitles generates expected candidate titles", () => {
      const candidates = getFlagCandidateFileTitles("United States");
      expect(candidates).toContain("Flag_of_United_States.svg");
      expect(candidates).toContain("Flag_of_the_United_States.svg");
      expect(candidates).toContain("United_States_flag.svg");
      expect(candidates).toContain("Flag_United_States.svg");
    });
  });

  describe("ServerFlagResolver Core", () => {
    test("4. Returns provided URL when provided and valid", async () => {
      const resolver = new ServerFlagResolver();
      const result = await resolver.resolve("Valora", {
        providedUrl: "https://custom.org/valora.svg",
      });

      expect(result.source).toBe("provided");
      expect(result.flagUrl).toBe("https://custom.org/valora.svg");
      expect(result.cached).toBe(false);
      expect(result.isPlaceholder).toBe(false);
      expect(result.countryName).toBe("Valora");
      expect(result.normalizedName).toBe("valora");
    });

    test("5. Ignores placeholder provided URL and resolves through pipeline", async () => {
      const resolver = new ServerFlagResolver();
      jest.spyOn(wikiBridge, "fetchMediaWikiImageBatch").mockResolvedValue(new Map());

      const result = await resolver.resolve("Valora", {
        providedUrl: "/images/flags/placeholder.svg",
      });

      expect(result.source).toBe("placeholder");
      expect(result.isPlaceholder).toBe(true);
    });

    test("6. Hits persistent cache before Commons if present", async () => {
      const mockPersistentCache = {
        get: jest.fn().mockResolvedValue("https://cached.org/eldoria.svg"),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const resolver = new ServerFlagResolver(mockPersistentCache);
      const commonsSpy = jest.spyOn(wikiBridge, "fetchMediaWikiImageBatch");

      const result = await resolver.resolve("Eldoria");
      expect(result.source).toBe("persistent-cache");
      expect(result.flagUrl).toBe("https://cached.org/eldoria.svg");
      expect(result.cached).toBe(true);
      expect(commonsSpy).not.toHaveBeenCalled();
    });

    test("7. Queries Wikimedia Commons on persistent cache miss", async () => {
      const mockMap = new Map<string, string>();
      mockMap.set("Flag_of_Krynn.svg", "https://upload.wikimedia.org/flag_krynn.svg");

      jest.spyOn(wikiBridge, "fetchMediaWikiImageBatch").mockResolvedValue(mockMap);

      const resolver = new ServerFlagResolver();
      const result = await resolver.resolve("Krynn");

      expect(result.source).toBe("commons");
      expect(result.flagUrl).toBe("https://upload.wikimedia.org/flag_krynn.svg");
      expect(result.cached).toBe(false);
      expect(result.isPlaceholder).toBe(false);
    });

    test("8. Queries Fictional Wiki when policy is fictional-wiki and Commons misses", async () => {
      const iiwikiMap = new Map<string, string>();
      iiwikiMap.set("Flag_of_Tretrid.svg", "https://iiwiki.com/flag_tretrid.svg");

      jest.spyOn(wikiBridge, "fetchMediaWikiImageBatch").mockImplementation((_, endpoint) => {
        if (endpoint && endpoint.includes("iiwiki")) {
          return Promise.resolve(iiwikiMap);
        }
        return Promise.resolve(new Map());
      });

      const resolver = new ServerFlagResolver();
      const result = await resolver.resolve("Tretrid", { fallbackPolicy: "fictional-wiki" });

      expect(result.source).toBe("fictional-wiki");
      expect(result.flagUrl).toBe("https://iiwiki.com/flag_tretrid.svg");
      expect(result.cached).toBe(false);
      expect(result.isPlaceholder).toBe(false);
    });

    test("9. Does NOT query Fictional Wiki when policy is commons-only", async () => {
      const fetchSpy = jest.spyOn(wikiBridge, "fetchMediaWikiImageBatch").mockResolvedValue(new Map());

      const resolver = new ServerFlagResolver();
      const result = await resolver.resolve("Tretrid", { fallbackPolicy: "commons-only" });

      expect(result.source).toBe("placeholder");
      expect(result.isPlaceholder).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Only Commons called
    });

    test("10. Defaults to base-path aware placeholder on total miss", async () => {
      jest.spyOn(wikiBridge, "fetchMediaWikiImageBatch").mockResolvedValue(new Map());

      const resolver = new ServerFlagResolver();
      const result = await resolver.resolve("Atlantis");

      expect(result.source).toBe("placeholder");
      expect(result.flagUrl).toContain("/images/flags/placeholder.svg");
      expect(result.isPlaceholder).toBe(true);
    });

    test("11. Memory cache caches positive resolutions", async () => {
      const mockMap = new Map<string, string>();
      mockMap.set("Flag_of_France.svg", "https://upload.wikimedia.org/france.svg");
      const fetchSpy = jest.spyOn(wikiBridge, "fetchMediaWikiImageBatch").mockResolvedValue(mockMap);

      const resolver = new ServerFlagResolver();
      const first = await resolver.resolve("France");
      expect(first.cached).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const second = await resolver.resolve("France");
      expect(second.cached).toBe(true);
      expect(second.flagUrl).toBe("https://upload.wikimedia.org/france.svg");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    test("12. Coalesces concurrent in-flight requests for the same country and policy", async () => {
      const mockMap = new Map<string, string>();
      mockMap.set("Flag_of_Germany.svg", "https://upload.wikimedia.org/germany.svg");
      const fetchSpy = jest.spyOn(wikiBridge, "fetchMediaWikiImageBatch").mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockMap), 50))
      );

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

    test("13. resolveBatch resolves multiple countries concurrently without mutating input", async () => {
      const input = Object.freeze(["Canada", "Japan", "Mexico"]);
      const mockMap = new Map<string, string>();
      mockMap.set("Flag_of_Canada.svg", "https://upload.wikimedia.org/canada.svg");
      mockMap.set("Flag_of_Japan.svg", "https://upload.wikimedia.org/japan.svg");

      jest.spyOn(wikiBridge, "fetchMediaWikiImageBatch").mockResolvedValue(mockMap);

      const resolver = new ServerFlagResolver();
      const batchResult = await resolver.resolveBatch(input);

      expect(batchResult.size).toBe(3);
      expect(batchResult.get("Canada")?.flagUrl).toBe("https://upload.wikimedia.org/canada.svg");
      expect(batchResult.get("Japan")?.flagUrl).toBe("https://upload.wikimedia.org/japan.svg");
      expect(batchResult.get("Mexico")?.isPlaceholder).toBe(true);
    });

    test("14. resolveBatch handles empty input array cleanly", async () => {
      const resolver = new ServerFlagResolver();
      const result = await resolver.resolveBatch([]);
      expect(result.size).toBe(0);
    });

    test("15. peek returns cached entry if present without triggering fetch", async () => {
      const mockMap = new Map<string, string>();
      mockMap.set("Flag_of_Italy.svg", "https://upload.wikimedia.org/italy.svg");
      jest.spyOn(wikiBridge, "fetchMediaWikiImageBatch").mockResolvedValue(mockMap);

      const resolver = new ServerFlagResolver();
      expect(resolver.peek("Italy")).toBeNull();

      await resolver.resolve("Italy");
      const peeked = resolver.peek("Italy");
      expect(peeked).not.toBeNull();
      expect(peeked?.flagUrl).toBe("https://upload.wikimedia.org/italy.svg");
    });

    test("16. prefetch runs resolution in background without blocking", () => {
      const resolver = new ServerFlagResolver();
      const spy = jest.spyOn(resolver, "resolveBatch").mockResolvedValue(new Map());

      resolver.prefetch(["Spain", "Norway"]);
      expect(spy).toHaveBeenCalledWith(["Spain", "Norway"], undefined);
    });

    test("17. stats tracks hits, misses, placeholders, and cache size accurately", async () => {
      jest.spyOn(wikiBridge, "fetchMediaWikiImageBatch").mockResolvedValue(new Map());

      const resolver = new ServerFlagResolver();
      await resolver.resolve("Unknown1");
      await resolver.resolve("Unknown1"); // Cache hit

      const stats = resolver.stats();
      expect(stats.memoryCacheSize).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.placeholders).toBe(1);
    });

    test("18. clear resets memory cache, in-flight state, and stats", async () => {
      jest.spyOn(wikiBridge, "fetchMediaWikiImageBatch").mockResolvedValue(new Map());

      const resolver = new ServerFlagResolver();
      await resolver.resolve("CountryA");
      expect(resolver.stats().memoryCacheSize).toBe(1);

      await resolver.clear();
      expect(resolver.stats().memoryCacheSize).toBe(0);
      expect(resolver.stats().hits).toBe(0);
      expect(resolver.peek("CountryA")).toBeNull();
    });
  });
});
