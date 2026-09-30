import { renderHook, act } from "@testing-library/react";
import { useBulkFlags, useFlag } from "~/hooks/useUnifiedFlags";
import { api } from "~/trpc/react";

// Mock trpc react
jest.mock("~/trpc/react", () => ({
  api: {
    countries: {
      flags: {
        resolveBatch: {
          useQuery: jest.fn().mockImplementation(({ countryNames }: { countryNames: string[] }) => {
            const data: Record<string, string | null> = {};
            for (const name of countryNames || []) {
              data[name] =
                name === "Unknown" ? null : `https://example.com/flags/${name.toLowerCase()}.svg`;
            }
            return {
              data,
              isLoading: false,
              isError: false,
              error: null,
              refetch: jest.fn().mockResolvedValue({}),
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

describe("useUnifiedFlags hooks (Plan 164)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useFlag", () => {
    test("returns resolved flag for valid country name", () => {
      const { result } = renderHook(() => useFlag("France"));
      expect(result.current.flagUrl).toBe("https://example.com/flags/france.svg");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPlaceholder).toBe(false);
    });

    test("returns null for empty country name", () => {
      const { result } = renderHook(() => useFlag(""));
      expect(result.current.flagUrl).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useBulkFlags & Immutability Contract", () => {
    test("NEVER mutates the caller's countryNames array (Plan 164 Critical Invariant)", () => {
      const original = ["Zambia", "Australia", "Brazil", "Denmark"];
      const frozenInput = Object.freeze([...original]);

      const { result } = renderHook(() => useBulkFlags(frozenInput));

      // 1. Assert input array order and contents did NOT change
      expect(frozenInput[0]).toBe("Zambia");
      expect(frozenInput[1]).toBe("Australia");
      expect(frozenInput[2]).toBe("Brazil");
      expect(frozenInput[3]).toBe("Denmark");
      expect(frozenInput).toEqual(original);

      // 2. Assert result keys exist
      expect(result.current.flagUrls["Zambia"]).toBe("https://example.com/flags/zambia.svg");
      expect(result.current.flagUrls["Australia"]).toBe("https://example.com/flags/australia.svg");
    });

    test("handles refetch action without throwing", async () => {
      const input = ["Germany", "Japan"];
      const { result } = renderHook(() => useBulkFlags(input));

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.flagUrls["Germany"]).toBe("https://example.com/flags/germany.svg");
    });
  });
});
