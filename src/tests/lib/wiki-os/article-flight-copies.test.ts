/** @jest-environment node */
/**
 * Plan 413 (item 8a): the article's HTML travels in the hydration state exactly once. (The page then
 * holds it twice in all: as DOM and in the flight; a lean first response, item 8c, removes the second.)
 */
import { dehydrate } from "@tanstack/react-query";
import SuperJSON from "superjson";
import { createQueryClient } from "~/trpc/query-client";
import { articleHtmlInput } from "~/lib/wiki-os/config";
import { leanMarker } from "~/lib/wiki-os/lean-article";

const BODY = `<p>UNIQUE-BODY-MARKER ${"Pelaxia is a country. ".repeat(50)}</p>`;
const INFOBOX = '<table class="infobox"><tr><td>UNIQUE-INFOBOX-MARKER</td></tr></table>';

const article = (overrides: Record<string, unknown> = {}) => ({
  title: "Pelaxia",
  contentHtml: BODY,
  infoboxHtml: INFOBOX,
  noticesHtml: null,
  toc: [{ id: "History", text: "History", level: 2 }],
  categories: ["Countries"],
  lastModified: null,
  renderQuality: "rendered",
  stale: false,
  ...overrides,
});

/** What `HydrateClient` writes into the page for a request that prefetched this article. */
function hydrationState(data: object): string {
  const queryClient = createQueryClient();
  queryClient.setQueryData(
    [["wikios", "getArticleHtml"], { input: articleHtmlInput("Pelaxia", "ixwiki"), type: "query" }],
    data
  );
  const state = JSON.stringify(dehydrate(queryClient, { serializeData: SuperJSON.serialize }));
  queryClient.clear(); // its garbage-collection timers must not outlive the test
  return state;
}

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("the article in the hydration state", () => {
  it("is in it once, as one query: no second copy in props or in a second query", () => {
    const state = hydrationState(article());

    expect(occurrences(state, "UNIQUE-BODY-MARKER")).toBe(1);
    expect(occurrences(state, "UNIQUE-INFOBOX-MARKER")).toBe(1);
    expect(JSON.parse(state).queries).toHaveLength(1);
  });

  it("carries only markers, a few hundred bytes, in a lean first response", () => {
    const token = "123e4567-e89b-42d3-a456-426614174000";
    const state = hydrationState(
      article({
        contentHtml: leanMarker(token, "body"),
        infoboxHtml: leanMarker(token, "infobox"),
      })
    );

    expect(state).not.toContain("UNIQUE-BODY-MARKER");
    expect(state).not.toContain("UNIQUE-INFOBOX-MARKER");
    expect(state.length).toBeLessThan(900);
  });
});
