/** @jest-environment node */
import { describe, it, expect, afterEach } from "@jest/globals";

jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { commonsRouter } from "~/server/api/routers/commons";
import { Cache } from "~/lib/cache/cache";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCommonsCaller = createCallerFactory(commonsRouter);

describe("commons image-info cache", () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("misses are cached", async () => {
    const fetchMock = jest.fn(
      async () =>
        new Response(JSON.stringify({ query: { pages: [] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    );
    globalThis.fetch = fetchMock as typeof fetch;
    const caller = createCommonsCaller(createMockRouterContext({ db: {}, auth: null }) as never);

    const first = await caller.getImageInfoByTitles({ titles: ["File:X.png"] });
    const second = await caller.getImageInfoByTitles({ titles: ["File:X.png"] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual([]);
    expect(second).toEqual([]);
  });

  it("cache is bounded", () => {
    const c = new Cache<number>({ maxSize: 3 });
    ["a", "b", "c", "d"].forEach((k, i) => c.set(k, i));

    expect(c.size).toBe(3);
    expect(c.get("a")).toBeUndefined();
  });
});
