/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factory relies on the ambient global.
//
// A sister wiki's category members and every page, as the Imports tab crawls them: every page of the list is read
// through mwJson, so a wiki that refuses (spike-sources.md, rule 5) or fails part-way throws, rather than answering
// "no pages" or a silently shorter list.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { wikiArticle: { findMany: async () => [] } },
  isDatabaseReadOnly: true,
}));

import { afterEach, describe, expect, it } from "@jest/globals";
import { loreCardDiscovery } from "~/lib/cards/lore-card-discovery";
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** IIWiki answering each request with the next answer; the requests are recorded. */
function iiwikiAnswers(...answers: Array<{ status: number; body: string }>) {
  const requests: URL[] = [];
  globalThis.fetch = (async (input: string) => {
    requests.push(new URL(input));
    const answer = answers[Math.min(requests.length, answers.length) - 1]!;
    return new Response(answer.body, {
      status: answer.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return requests;
}

const ok = (body: object) => ({ status: 200, body: JSON.stringify(body) });

describe("listing a sister wiki's pages", () => {
  it("follows the continuation until the list ends", async () => {
    const requests = iiwikiAnswers(
      ok({
        query: { categorymembers: [{ title: "Elm" }, { title: "Oak" }] },
        continue: { cmcontinue: "page|ASH" },
      }),
      ok({ query: { categorymembers: [{ title: "Ash" }] } })
    );
    await expect(loreCardDiscovery.fetchCategoryMembers("Trees", "iiwiki")).resolves.toEqual([
      "Elm",
      "Oak",
      "Ash",
    ]);
    expect(requests).toHaveLength(2);
    expect(requests[1]!.searchParams.get("cmcontinue")).toBe("page|ASH");
    expect(requests[0]!.searchParams.get("cmtitle")).toBe("Category:Trees");
  });

  it.each([
    ["HTTP 403", { status: 403, body: "" }, "IIWiki stopped answering (HTTP 403)."],
    [
      "a challenge page",
      { status: 200, body: "<!DOCTYPE html><title>Just a moment...</title>" },
      "IIWiki answered with a web page instead of data.",
    ],
  ])("stops on a refusal (%s) instead of finding no pages", async (_name, answer, message) => {
    iiwikiAnswers(answer);
    const listed = loreCardDiscovery.fetchAllMainNamespacePages("iiwiki");
    await expect(listed).rejects.toBeInstanceOf(DiscoveryStopped);
    await expect(listed).rejects.toThrow(message);
  });

  it("fails when a later page of the list fails, rather than answering part of it", async () => {
    iiwikiAnswers(
      ok({ query: { allpages: [{ title: "Elm" }] }, continue: { apcontinue: "Oak" } }),
      { status: 502, body: "" }
    );
    await expect(loreCardDiscovery.fetchAllMainNamespacePages("iiwiki")).rejects.toThrow(
      "IIWiki answered HTTP 502."
    );
  });
});
