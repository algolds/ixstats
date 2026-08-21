import { renderHook } from "@testing-library/react";
import { useFlag, useBulkFlags } from "../../hooks/useUnifiedFlags";

// Mock tRPC
jest.mock("~/trpc/react", () => ({
  api: {
    countries: {
      flags: {
        resolveBatch: {
          useQuery: jest.fn().mockImplementation(({ countryNames }: { countryNames: string[] }) => {
            const data: Record<string, string | null> = {};
            for (const name of countryNames || []) {
              data[name] = name === "Aethelgard" ? "https://example.com/aethelgard.png" : null;
            }
            return {
              data,
              isLoading: false,
              isError: false,
            };
          }),
        },
      },
    },
    useUtils: jest.fn().mockReturnValue({
      countries: {
        flags: {
          resolveBatch: {
            fetch: jest.fn().mockResolvedValue({}),
            prefetch: jest.fn().mockResolvedValue({}),
          },
        },
      },
    }),
  },
}));

describe("flags characterization contract", () => {
  it("resolves country flag via useFlag hook", () => {
    const { result } = renderHook(() => useFlag("Aethelgard"));
    expect(result.current.flagUrl).toBe("https://example.com/aethelgard.png");
    expect(result.current.isPlaceholder).toBe(false);
  });

  it("handles missing country gracefully with placeholder flag", () => {
    const { result } = renderHook(() => useFlag("NonexistentCountry"));
    expect(result.current.isPlaceholder).toBe(true);
  });

  it("does not mutate the caller's countryNames array (Plan 164)", () => {
    const original = ["Eldoria", "Valora", "Krynn"];
    const frozen = Object.freeze([...original]);
    const { result } = renderHook(() => useBulkFlags(frozen));

    expect(frozen).toEqual(original);
    expect(result.current.flagUrls).toBeDefined();
  });
});
