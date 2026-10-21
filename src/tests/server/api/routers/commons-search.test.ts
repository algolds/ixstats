/** @jest-environment node */
import { describe, it, expect, afterEach } from "@jest/globals";
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { commonsRouter } from "~/server/api/routers/commons";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCommonsCaller = createCallerFactory(commonsRouter);

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
  it("identifies itself to Commons with a contact User-Agent", async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ query: { pages: [] } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await makeCaller().search({ query: "dogs" });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const headers = calls[0]![1].headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(
      `IxStats-Builder/1.0 (${mediaWikiOrigin()}; image repository)`
    );
    expect(headers["Api-User-Agent"]).toBe(headers["User-Agent"]);
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
    await expect(caller.search({ query: "x", offset: 10_000 })).rejects.toThrow();
  });

  it("accepts a query of up to 1000 characters and rejects a longer one", async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ query: { pages: [] } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const caller = makeCaller();

    await expect(caller.search({ query: "a".repeat(1000) })).resolves.toBeDefined();
    await expect(caller.search({ query: "a".repeat(1001) })).rejects.toThrow();
  });
});
