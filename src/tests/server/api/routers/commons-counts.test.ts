/** @jest-environment node */
import { describe, it, expect, afterEach } from "@jest/globals";

jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { commonsRouter } from "~/server/api/routers/commons";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCommonsCaller = createCallerFactory(commonsRouter);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function srsearchOf(call: unknown): string {
  return new URL((call as [string])[0]).searchParams.get("srsearch") ?? "";
}

describe("commons category counts and image-info failures", () => {
  const realFetch = globalThis.fetch;
  const makeCaller = () =>
    createCommonsCaller(createMockRouterContext({ db: {}, auth: null }) as never);

  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  it("never has more than 1 count query in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    globalThis.fetch = jest.fn(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return jsonResponse({ query: { searchinfo: { totalhits: 1 } } });
    }) as unknown as typeof fetch;

    const categories = Array.from({ length: 10 }, (_, i) => `Concurrent${i}`);
    const result = await makeCaller().getCategoryTotalCounts({ categories });

    expect(Object.keys(result)).toHaveLength(10);
    expect(peak).toBe(1);
  });

  it("stops fetching the remaining categories once Commons rate limits, and leaves them out", async () => {
    const fetchMock = jest.fn(async (input: unknown) => {
      if (srsearchOf([input]).includes("RateB")) return jsonResponse({}, 429);
      return jsonResponse({ query: { searchinfo: { totalhits: 3 } } });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await makeCaller().getCategoryTotalCounts({
      categories: ["RateA", "RateB", "RateC", "RateD"],
    });

    expect(result).toEqual({ RateA: 3 });
    // RateA, then RateB (429); RateC and RateD are never requested.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
