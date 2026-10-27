/** @jest-environment node */
/**
 * The platform loaders read the account's wiki names through its APPROVED name claims (hidden ones too: an
 * achievement count names no one), read once per evaluation; the wiki and Renaissance queries bind the claimed names
 * as one array. The Lorewards loader's names are in lorewards-loader.test.ts.
 */
import { describe, expect, it } from "@jest/globals";
import {
  lorewardsLoader,
  renaissanceLoader,
  wikiLoader,
} from "~/lib/achievements/metrics/platform";
import type { MetricContext } from "~/lib/achievements/metrics/registry";

function fakeDb(names: string[]) {
  return {
    wikiNameClaim: {
      findMany: jest.fn(
        async (_query: { where: { source: string; userId: { in: string[] }; status: string } }) =>
          names.map((name) => ({ userId: "u1", name }))
      ),
    },
    lorewardUserStats: {
      findMany: jest.fn(async () => []),
    },
    $queryRaw: jest.fn(
      async (_strings: TemplateStringsArray, ..._values: Array<string | string[] | Date>) => []
    ),
  };
}

const contextOf = (db: ReturnType<typeof fakeDb>): MetricContext => ({
  db: db as never,
  clerkUserId: "clerk_1",
  userId: "u1",
  countryId: null,
  now: new Date("2026-10-23T12:00:00.000Z"),
});

describe("the wiki and Renaissance loaders on claimed names", () => {
  it("binds the account id and every claimed name, reading the claims once per evaluation", async () => {
    const db = fakeDb(["Old name", "New name"]);
    const ctx = contextOf(db);
    await wikiLoader.load(ctx);
    await renaissanceLoader.load(ctx);
    await lorewardsLoader.load(ctx);

    expect(db.wikiNameClaim.findMany).toHaveBeenCalledTimes(1);
    // the third raw query is the Lorewards loader's own WikiOS names
    expect(db.$queryRaw).toHaveBeenCalledTimes(3);
    for (const [strings, ...values] of db.$queryRaw.mock.calls.slice(0, 2)) {
      expect(strings.join("?")).toContain(`r.author = ANY(?::text[])`);
      expect(values).toContain("u1");
      expect(values).toContainEqual(["Old name", "New name"]);
    }
  });

  it("binds an empty array with no claimed name, which matches no unattributed revision", async () => {
    const db = fakeDb([]);
    await wikiLoader.load(contextOf(db));
    const [, ...values] = db.$queryRaw.mock.calls[0]!;
    expect(values).toContainEqual([]);
  });
});
