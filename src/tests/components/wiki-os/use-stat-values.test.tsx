/**
 * Plan 404 review: `wikios.resolveWikiPlaceholders` takes at most 200 keys, and the reader asked for
 * every key of the page in one call, so a page with more failed the whole query. Keys are deduped
 * and asked in chunks of 200, one query each.
 */
import { renderHook } from "@testing-library/react";
import {
  chunkStatKeys,
  STAT_CHUNK_SIZE,
  useStatValues,
} from "~/components/wiki-os/reader/useStatValues";

const mockUseQueries = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: { useQueries: (...args: unknown[]) => mockUseQueries(...args) },
}));

const keys = (n: number, prefix = "MyCountry:k") =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe("chunkStatKeys", () => {
  it("is empty for no keys", () => {
    expect(chunkStatKeys([])).toEqual([]);
  });

  it("keeps up to 200 keys in one chunk", () => {
    expect(chunkStatKeys(keys(200))).toEqual([keys(200)]);
    expect(STAT_CHUNK_SIZE).toBe(200);
  });

  it("splits 201 keys into 200 and 1, and 450 into 200, 200 and 50, in order", () => {
    expect(chunkStatKeys(keys(201)).map((chunk) => chunk.length)).toEqual([200, 1]);
    const chunks = chunkStatKeys(keys(450));
    expect(chunks.map((chunk) => chunk.length)).toEqual([200, 200, 50]);
    expect(chunks.flat()).toEqual(keys(450));
  });

  it("drops repeats before it counts, so 400 asks that name 150 keys are one chunk", () => {
    const repeated = [...keys(150), ...keys(150), ...keys(100)];

    expect(chunkStatKeys(repeated)).toEqual([keys(150)]);
  });
});

describe("useStatValues", () => {
  /** What `api.useQueries` does with the callback: the queries it would run, and `combine` over results. */
  function runQueries(results: Array<{ data?: Record<string, { value: string }> }>) {
    mockUseQueries.mockImplementation(
      (build: (t: unknown) => unknown[], options: { combine: (r: typeof results) => unknown }) => {
        const t = {
          wikios: {
            resolveWikiPlaceholders: (input: unknown, opts: unknown) => ({ input, opts }),
          },
        };
        const queries = build(t);
        mockUseQueries.queries = queries;
        return options.combine(results);
      }
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("asks once per chunk of at most 200 distinct keys", () => {
    runQueries([]);

    renderHook(() => useStatValues([...keys(450), ...keys(10)]));

    const queries = (
      mockUseQueries as unknown as {
        queries: Array<{ input: { placeholders: string[] }; opts: unknown }>;
      }
    ).queries;
    expect(queries.map((q) => q.input.placeholders.length)).toEqual([200, 200, 50]);
    expect(
      queries.every((q) => JSON.stringify(q.opts) === JSON.stringify({ staleTime: 300000 }))
    ).toBe(true);
  });

  it("asks nothing for a page with no stats", () => {
    runQueries([]);

    renderHook(() => useStatValues([]));

    expect((mockUseQueries as unknown as { queries: unknown[] }).queries).toEqual([]);
  });

  it("merges the chunks' values, and a chunk that failed or has not arrived adds nothing", () => {
    runQueries([
      { data: { "MyCountry:a": { value: "1" } } },
      { data: undefined },
      { data: { "MyCountry:b": { value: "2" } } },
    ]);

    const { result } = renderHook(() => useStatValues(keys(450)));

    expect(result.current).toEqual({
      "MyCountry:a": { value: "1" },
      "MyCountry:b": { value: "2" },
    });
  });

  it("is an empty record while nothing has arrived", () => {
    runQueries([{ data: undefined }]);

    expect(renderHook(() => useStatValues(["MyCountry:a"])).result.current).toEqual({});
  });
});
