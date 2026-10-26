/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
//
// `wikios.sisterEmbed`'s own limit on the embeds that cost a sister wiki a call (routers/wikios/sister.ts): every
// reader shares a per-host budget of 240 calls a minute, so a caller asking for title after new title is held to
// `EMBED_READS_PER_MINUTE` of them (20 for a visitor, 60 signed in) on top of the `sisterwiki` bucket, while an embed
// already cached (or being read for someone else) costs nothing against it. Real in-memory RateLimiter, Redis off.
jest.mock("~/env", () => ({
  env: { ...jest.requireActual("~/env").env, RATE_LIMIT_ENABLED: "true", REDIS_ENABLED: "false" },
}));
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge/dispatchers", () => ({
  __esModule: true,
  getArticleWikitext: jest.fn(),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { getArticleWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge/dispatchers";
import { createCallerFactory } from "~/server/api/trpc";
import { EMBED_READS_PER_MINUTE, wikiosSisterRouter } from "~/server/api/routers/wikios/sister";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const read = jest.mocked(getArticleWikitext);
let run = 0;

/** A caller with a bucket of its own: a visitor, or a signed-in reader. */
const callerAs = (signedIn: boolean) =>
  createCallerFactory(wikiosSisterRouter)(
    createMockRouterContext({
      ...(signedIn ? {} : { auth: null, user: null }),
      rateLimitIdentifier: `reader-${++run}`,
    }) as never
  );

/** A title nobody asked for before in this file, so it is never cached. */
let fresh = 0;
const newTitle = () => `Random ${++fresh}`;

async function codeOf(work: Promise<object>): Promise<string | null> {
  try {
    await work;
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
}

beforeEach(() => {
  read.mockReset().mockResolvedValue(null);
});

describe("wikios.sisterEmbed: reads of a sister wiki per caller", () => {
  it.each([
    ["a visitor", false, EMBED_READS_PER_MINUTE.visitor],
    ["a signed-in reader", true, EMBED_READS_PER_MINUTE.signedIn],
  ] as const)(
    "lets %s read its limit of new embeds a minute, then refuses",
    async (_who, signedIn, max) => {
      const caller = callerAs(signedIn);
      for (let i = 0; i < max; i++) {
        expect(await caller.sisterEmbed({ wiki: "iiwiki", title: newTitle() })).toEqual({
          status: "missing",
        });
      }

      expect(await codeOf(caller.sisterEmbed({ wiki: "iiwiki", title: newTitle() }))).toBe(
        "TOO_MANY_REQUESTS"
      );
      expect(read).toHaveBeenCalledTimes(max);
    }
  );

  it("serves cached embeds past that limit, without asking the wiki", async () => {
    const caller = callerAs(false);
    const cached = newTitle();
    await caller.sisterEmbed({ wiki: "althistory", title: cached });
    for (let i = 1; i < EMBED_READS_PER_MINUTE.visitor; i++) {
      await caller.sisterEmbed({ wiki: "althistory", title: newTitle() });
    }
    expect(await codeOf(caller.sisterEmbed({ wiki: "althistory", title: newTitle() }))).toBe(
      "TOO_MANY_REQUESTS"
    );

    for (let i = 0; i < 10; i++) {
      expect(await caller.sisterEmbed({ wiki: "althistory", title: cached })).toEqual({
        status: "missing",
      });
    }
    expect(read).toHaveBeenCalledTimes(EMBED_READS_PER_MINUTE.visitor);
  });

  it("keeps one caller's reads off another's bucket", async () => {
    const greedy = callerAs(false);
    for (let i = 0; i <= EMBED_READS_PER_MINUTE.visitor; i++) {
      await codeOf(greedy.sisterEmbed({ wiki: "iiwiki", title: newTitle() }));
    }

    expect(await callerAs(false).sisterEmbed({ wiki: "iiwiki", title: newTitle() })).toEqual({
      status: "missing",
    });
  });
});
