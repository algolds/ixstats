/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
//
// commons.getCategoryTotalCounts fetches the counts it lacks one at a time and stops at the first refusal: a 429 from
// Commons or our own limiter (WikiUnavailableError, busy) or an outage (WikiUnavailableError) ends the loop, as does an
// API `ratelimited` in a 200, so a run of refusals never opens the Commons circuit for everyone. A count it could not
// fetch is left out, never reported as 0.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { commonsRouter } from "~/server/api/routers/commons";
import { createMockRouterContext } from "~/tests/helpers/router-context";

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let errorSpy: jest.SpyInstance;
/** A unique category prefix per test: the router caches counts for six hours. */
let run = 0;

const commons = () =>
  createCallerFactory(commonsRouter)(
    createMockRouterContext({ auth: null, user: null, db: {} }) as never
  );
const hits = (totalhits: number) => Response.json({ query: { searchinfo: { totalhits } } });
const categories = (n: number) => Array.from({ length: n }, (_, i) => `Counts ${run} ${i}`);

beforeEach(() => {
  run += 1;
  fetchSpy = jest.spyOn(global, "fetch");
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  fetchSpy.mockRestore();
  errorSpy.mockRestore();
});

describe("commons.getCategoryTotalCounts", () => {
  it("counts each category it lacks", async () => {
    fetchSpy.mockImplementation(async () => hits(12));
    const [a, b] = categories(2);

    await expect(commons().getCategoryTotalCounts({ categories: [a!, b!] })).resolves.toEqual({
      [a!]: 12,
      [b!]: 12,
    });
  });

  it.each([
    [
      "a 429 from Commons",
      () => new Response("{}", { status: 429, headers: { "content-type": "application/json" } }),
    ],
    ["Commons unreachable", () => new Response("down", { status: 503 })],
    ["an API ratelimited in a 200", () => Response.json({ error: { code: "ratelimited" } })],
  ])("stops at the first refusal: %s", async (_case, refusal) => {
    const [a, b, c, d] = categories(4);
    fetchSpy
      .mockImplementationOnce(async () => hits(7))
      .mockImplementationOnce(async () => refusal())
      .mockImplementation(async () => hits(9));

    const counts = await commons().getCategoryTotalCounts({ categories: [a!, b!, c!, d!] });

    expect(counts).toEqual({ [a!]: 7 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
