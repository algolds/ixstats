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
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";

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
  it("lists a category's articles, following the continuation in the pace's turns", async () => {
    const requests = wikiAnswers(
      ok({
        query: { categorymembers: [{ title: "Elm" }, { title: "Oak" }] },
        continue: { cmcontinue: "page|ASH" },
      }),
      ok({ query: { categorymembers: [{ title: "Ash" }] } })
    );
    const { reach, paced } = reachOf();
    await expect(loreCardDiscovery.fetchCategoryMembers("Trees", "iiwiki", reach)).resolves.toEqual(
      { titles: ["Elm", "Oak", "Ash"], truncated: false }
    );
    expect(paced.count).toBe(2);
    expect(requests[1]!.url.searchParams.get("cmcontinue")).toBe("page|ASH");
    expect(Object.fromEntries(requests[0]!.url.searchParams)).toMatchObject({
      cmtitle: "Category:Trees",
      cmtype: "page",
      cmnamespace: "0",
      cmlimit: "500",
    });
    expect(requests[0]!.userAgent).toBe("IxStats-Builder");
  });

  it("says a list the limit cut is truncated, the wiki's continue too", async () => {
    wikiAnswers(
      ok({
        query: { allpages: [{ title: "Elm" }, { title: "Oak" }] },
        continue: { apcontinue: "Pine" },
      })
    );
    await expect(
      loreCardDiscovery.fetchAllMainNamespacePages("iiwiki", reachOf({ limit: 2 }).reach)
    ).resolves.toEqual({ titles: ["Elm", "Oak"], truncated: true });
  });

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

  it("answers what it read, truncated, once its time runs out", async () => {
    const requests = wikiAnswers(
      ok({ query: { allpages: [{ title: "Elm" }] }, continue: { apcontinue: "Oak" } })
    );
    let clock = 1_000;
    jest.spyOn(Date, "now").mockImplementation(() => clock);
    const reach: ListReach = {
      limit: 10_000,
      deadline: 60_000,
      pace: async (read) => {
        const answer = await read();
        clock = 61_000;
        return answer;
      },
    };
    await expect(loreCardDiscovery.fetchAllMainNamespacePages("iiwiki", reach)).resolves.toEqual({
      titles: ["Elm"],
      truncated: true,
    });
    expect(requests).toHaveLength(1);
  });

  it.each([
    ["HTTP 403", { status: 403, body: "" }, "IIWiki stopped answering (HTTP 403)."],
    [
      "a challenge page",
      { status: 200, body: "<!DOCTYPE html><title>Just a moment...</title>" },
      "IIWiki answered with a web page instead of data.",
    ],
  ])("stops on a refusal (%s) instead of finding no pages", async (_name, answer, message) => {
    wikiAnswers(answer);
    const listed = loreCardDiscovery.fetchAllMainNamespacePages("iiwiki", reachOf().reach);
    await expect(listed).rejects.toBeInstanceOf(DiscoveryStopped);
    await expect(listed).rejects.toThrow(message);
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

describe("listing a Commons category's files", () => {
  it("asks Commons for the files only, by title, and marks a continued list truncated", async () => {
    const requests = wikiAnswers(
      ok({
        query: { categorymembers: [{ title: "File:Flag of Elm.svg" }, { title: "File:Oak.png" }] },
        continue: { cmcontinue: "file|OAK" },
      })
    );
    await expect(
      loreCardDiscovery.fetchCategoryMembers("Flags", "commons", reachOf({ limit: 2 }).reach)
    ).resolves.toEqual({ titles: ["File:Flag of Elm.svg", "File:Oak.png"], truncated: true });
    expect(requests[0]!.url.origin + requests[0]!.url.pathname).toBe(
      "https://commons.wikimedia.org/w/api.php"
    );
    expect(Object.fromEntries(requests[0]!.url.searchParams)).toMatchObject({
      list: "categorymembers",
      cmtitle: "Category:Flags",
      cmtype: "file",
      cmlimit: "500",
    });
    expect(requests[0]!.url.searchParams.has("cmnamespace")).toBe(false);
    expect(requests[0]!.userAgent).toBe("IxStats-Builder");
  });

  it("reports a refusing Commons, and a failed later page, by name", async () => {
    wikiAnswers({ status: 403, body: "" });
    await expect(
      loreCardDiscovery.fetchCategoryMembers("Flags", "commons", reachOf().reach)
    ).rejects.toThrow("Wikimedia Commons stopped answering (HTTP 403).");

    wikiAnswers(
      ok({ query: { categorymembers: [{ title: "File:A.svg" }] }, continue: { cmcontinue: "x" } }),
      { status: 500, body: "" }
    );
    await expect(
      loreCardDiscovery.fetchCategoryMembers("Flags", "commons", reachOf().reach)
    ).rejects.toThrow("Wikimedia Commons answered HTTP 500.");
  });
});
