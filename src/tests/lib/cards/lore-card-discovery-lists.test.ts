/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factory relies on the ambient global.
//
// A wiki's category members and every page, as the Imports tab crawls them: every request in the pace's turn and read
// through mwJson, so a wiki that refuses (spike-sources.md, rule 5) or fails part-way throws, rather than answering
// "no pages" or a silently shorter list. A Commons category lists its files only. `truncated` says when the wiki holds
// more than was read: the limit, the wiki's own `continue`, or the time budget.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { wikiArticle: { findMany: jest.fn(async () => []) } },
  isDatabaseReadOnly: true,
}));

import { afterEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { loreCardDiscovery, type ListReach } from "~/lib/cards/lore-card-discovery";
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  jest.restoreAllMocks();
});

interface Request {
  url: URL;
  userAgent: string | null;
}

/** A wiki answering each request with the next answer; the requests are recorded. */
function wikiAnswers(...answers: Array<{ status: number; body: string }>) {
  const requests: Request[] = [];
  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    requests.push({
      url: new URL(input),
      userAgent: new Headers(init?.headers).get("User-Agent"),
    });
    const answer = answers[Math.min(requests.length, answers.length) - 1]!;
    return new Response(answer.body, {
      status: answer.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return requests;
}

const ok = (body: object) => ({ status: 200, body: JSON.stringify(body) });

/** A reach that counts the requests it paces. */
function reachOf(over: Partial<ListReach> = {}) {
  const paced = { count: 0 };
  const reach: ListReach = {
    limit: 10_000,
    deadline: Date.now() + 60_000,
    pace: (read) => {
      paced.count++;
      return read();
    },
    ...over,
  };
  return { reach, paced };
}

describe("listing a sister wiki's pages", () => {
  it("leaves out the pages WikiOS deleted before it cuts the list, so truncated holds", async () => {
    const answer = ok({
      query: { allpages: [{ title: "Elm" }, { title: "Oak" }, { title: "Ash" }] },
    });
    wikiAnswers(answer);
    jest.mocked(db.wikiArticle.findMany).mockResolvedValueOnce([{ title: "Oak" }] as never);
    await expect(
      loreCardDiscovery.fetchAllMainNamespacePages("iiwiki", reachOf({ limit: 2 }).reach)
    ).resolves.toEqual({ titles: ["Elm", "Ash"], truncated: false });

    wikiAnswers(answer);
    await expect(
      loreCardDiscovery.fetchAllMainNamespacePages("iiwiki", reachOf({ limit: 2 }).reach)
    ).resolves.toEqual({ titles: ["Elm", "Oak"], truncated: true });
  });
  it("fails when a later page of the list fails, rather than answering part of it", async () => {
    wikiAnswers(ok({ query: { allpages: [{ title: "Elm" }] }, continue: { apcontinue: "Oak" } }), {
      status: 502,
      body: "",
    });
    await expect(
      loreCardDiscovery.fetchAllMainNamespacePages("iiwiki", reachOf().reach)
    ).rejects.toThrow("IIWiki answered HTTP 502.");
  });
});
