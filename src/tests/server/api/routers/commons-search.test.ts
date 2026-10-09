/** @jest-environment node */
import { describe, it, expect, afterEach } from "@jest/globals";
import { TRPCError } from "@trpc/server";

jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { commonsRouter } from "~/server/api/routers/commons";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCommonsCaller = createCallerFactory(commonsRouter);

function page(pageid: number, title: string, index?: number) {
  return {
    pageid,
    title,
    ...(index === undefined ? {} : { index }),
    imageinfo: [
      { url: `https://img.test/${pageid}.png`, width: 10, height: 10, mime: "image/png" },
    ],
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("commons search", () => {
  const realFetch = globalThis.fetch;
  const makeCaller = () =>
    createCommonsCaller(createMockRouterContext({ db: {}, auth: null }) as never);

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("returns files in search-rank order, unranked pages last in their original order", async () => {
    globalThis.fetch = jest.fn(async () =>
      jsonResponse({
        query: {
          pages: [
            page(1, "File:C.png", 3),
            page(2, "File:Unranked1.png"),
            page(3, "File:A.png", 1),
            page(4, "File:Unranked2.png"),
            page(5, "File:B.png", 2),
          ],
          searchinfo: { totalhits: 5 },
        },
      })
    ) as unknown as typeof fetch;

    const result = await makeCaller().search({ query: "cats" });

    expect(result.images.map((i) => i.title)).toEqual([
      "File:A.png",
      "File:B.png",
      "File:C.png",
      "File:Unranked1.png",
      "File:Unranked2.png",
    ]);
    expect(result.totalHits).toBe(5);
  });

  it("rejects with a TRPCError when Commons answers 200 with an API error", async () => {
    globalThis.fetch = jest.fn(async () =>
      jsonResponse({ error: { code: "x", info: "boom" } })
    ) as unknown as typeof fetch;

    const failure = makeCaller().search({ query: "cats" });

    await expect(failure).rejects.toBeInstanceOf(TRPCError);
  });

  it("requests a filtered extmetadata set and no origin parameter", async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ query: { pages: [] } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await makeCaller().search({ query: "dogs" });

    const calls = fetchMock.mock.calls as unknown as Array<[string]>;
    const url = new URL(calls[0]![0]);
    expect(url.searchParams.get("iiextmetadatafilter")).toBe(
      "ImageDescription|Artist|LicenseShortName"
    );
    expect(url.searchParams.get("iiextmetadatalanguage")).toBe("en");
    expect(url.searchParams.has("origin")).toBe(false);
  });

  it("strips quotes from a category name placed in deepcat", async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ query: { pages: [] } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await makeCaller().getCategoryFiles({ category: 'Cats "and" dogs' });

    const calls = fetchMock.mock.calls as unknown as Array<[string]>;
    const url = new URL(calls[0]![0]);
    expect(url.searchParams.get("gsrsearch")).toBe('deepcat:"Cats and dogs"');
  });

  it("rejects fractional or out-of-range paging inputs", async () => {
    const caller = makeCaller();
    await expect(caller.search({ query: "x", limit: 2.5 })).rejects.toThrow();
    await expect(caller.search({ query: "x", offset: 9_951 })).rejects.toThrow();
  });
});
