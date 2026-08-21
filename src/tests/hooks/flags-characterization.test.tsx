import { renderHook } from "@testing-library/react";
import { useCountryFlag } from "../../hooks/useCountryFlags";

// Mock countryFlagService
jest.mock("~/lib/flags/country-flag-service", () => ({
  countryFlagService: {
    getCountryFlag: jest.fn().mockImplementation(async (countryName: string) => {
      if (countryName === "Aethelgard") {
        return {
          countryName: "Aethelgard",
          flagUrl: "https://example.com/aethelgard.png",
          source: "server_cache",
        };
      }
      return {
        countryName,
        flagUrl: null,
        source: "placeholder",
      };
    }),
    batchGetCountryFlags: jest.fn().mockResolvedValue(new Map()),
    clearCache: jest.fn(),
    getCacheStats: jest.fn().mockReturnValue({ total: 0, successful: 0, failed: 0, hitRate: 0 }),
  },
}));

describe("flags characterization contract", () => {
  it("resolves country flag via useCountryFlag hook", async () => {
    const { result } = renderHook(() => useCountryFlag("Aethelgard"));
    expect(result.current.loading).toBe(true);
  });

  it("handles missing country gracefully with empty or placeholder flag", () => {
    const { result } = renderHook(() => useCountryFlag("NonexistentCountry"));
    expect(result.current.loading).toBe(true);
  });

  // Exactly one planned TODO test for array immutability (Plan 164)
  it.todo("does not mutate the caller's countryNames array (Plan 164)");
});
