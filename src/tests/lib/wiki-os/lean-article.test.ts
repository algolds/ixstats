/** @jest-environment node */
/**
 * Plan 413 (item 8c): the lean first response. The server swaps an article's HTML in the hydration
 * state for markers, keeps the HTML for its own SSR render, and the browser reads it back from the DOM.
 */
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

const mockHeaders = jest.fn();
const mockCookies = jest.fn();
const mockReplacePrefetched = jest.fn();
jest.mock("next/headers", () => ({
  headers: () => mockHeaders(),
  cookies: () => mockCookies(),
}));
jest.mock("~/trpc/server", () => ({
  replacePrefetched: (...args: unknown[]) => mockReplacePrefetched(...args),
}));

import {
  isLeanResolvable,
  leanElementId,
  leanFlightEnabled,
  leanMarker,
  parseLeanMarker,
  resolveLeanHtml,
  stashLeanArticle,
} from "~/lib/wiki-os/lean-article";
import { leanTheFlight } from "~/app/(wiki-os)/wiki/[...slug]/_lib/lean-flight";

const BODY = "<p>" + "Pelaxia is a country. ".repeat(1500) + "</p>";

describe("markers", () => {
  const token = "123e4567-e89b-42d3-a456-426614174000";

  it("round-trip, and nothing else is one", () => {
    expect(parseLeanMarker(leanMarker(token, "body"))).toEqual({ token, part: "body" });
    expect(parseLeanMarker(leanMarker(token, "infobox"))?.part).toBe("infobox");
    expect(parseLeanMarker("<p>Real article</p>")).toBeNull();
    expect(parseLeanMarker(`wikios-lean:${token}:other`)).toBeNull();
    expect(parseLeanMarker(`x wikios-lean:${token}:body`)).toBeNull();
    expect(parseLeanMarker(null)).toBeNull();
    expect(leanElementId(token, "body")).toBe(`wikios-lean-${token}-body`);
  });
});

describe("the server's stash", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("hands the SSR render the real HTML of a marker, and passes real HTML through", () => {
    const token = stashLeanArticle({ body: BODY, infobox: "<table></table>", notices: null });

    expect(isLeanResolvable(leanMarker(token, "body"))).toBe(true); // looking does not use it up
    expect(isLeanResolvable(leanMarker(token, "body"))).toBe(true);
    expect(resolveLeanHtml(leanMarker(token, "body"))).toBe(BODY);
    expect(resolveLeanHtml(leanMarker(token, "infobox"))).toBe("<table></table>");
    expect(resolveLeanHtml(leanMarker(token, "notices"))).toBeNull();
    // not a marker: the HTML itself
    expect(resolveLeanHtml("<p>x</p>")).toBe("<p>x</p>");
    expect(resolveLeanHtml(null)).toBeNull();
    expect(isLeanResolvable("<p>x</p>")).toBe(true);
  });

  it("lets a part be read again: a retried SSR render finds the HTML it already read", () => {
    const token = stashLeanArticle({ body: BODY, infobox: "<table></table>", notices: null });

    // the render reads each part, and a retry of it reads them all again
    for (let render = 0; render < 3; render++) {
      expect(resolveLeanHtml(leanMarker(token, "body"))).toBe(BODY);
      expect(resolveLeanHtml(leanMarker(token, "infobox"))).toBe("<table></table>");
      expect(isLeanResolvable(leanMarker(token, "body"))).toBe(true);
    }
    // memory is bounded by the TTL and the cap instead
    jest.advanceTimersByTime(5_001);
    expect(resolveLeanHtml(leanMarker(token, "body"))).toBeNull();
    expect(
      (globalThis as { __wikiosLeanStash?: Map<string, unknown> }).__wikiosLeanStash?.has(token)
    ).toBe(false);
  });

  it("forgets an article a few seconds after it was kept, and a marker nobody stashed finds nothing", () => {
    const token = stashLeanArticle({ body: BODY, infobox: null, notices: null });
    jest.advanceTimersByTime(4_999);
    expect(isLeanResolvable(leanMarker(token, "body"))).toBe(true);

    jest.advanceTimersByTime(2);

    expect(isLeanResolvable(leanMarker(token, "body"))).toBe(false);
    expect(resolveLeanHtml(leanMarker(token, "body"))).toBeNull();
    expect(resolveLeanHtml(leanMarker("123e4567-e89b-42d3-a456-426614174999", "body"))).toBeNull();
  });

  it("keeps at most 200 articles: the oldest goes first", () => {
    const tokens = Array.from({ length: 250 }, (_, i) =>
      stashLeanArticle({ body: `<p>${i}</p>`, infobox: null, notices: null })
    );

    const stash = (globalThis as { __wikiosLeanStash?: Map<string, unknown> }).__wikiosLeanStash!;
    expect(stash.size).toBeLessThanOrEqual(200);
    expect(isLeanResolvable(leanMarker(tokens[0]!, "body"))).toBe(false);
    expect(isLeanResolvable(leanMarker(tokens[49]!, "body"))).toBe(false);
    expect(isLeanResolvable(leanMarker(tokens[249]!, "body"))).toBe(true);
    expect(isLeanResolvable(leanMarker(tokens[50]!, "body"))).toBe(true);
  });
});

describe("leanTheFlight", () => {
  const data = (overrides: Record<string, unknown> = {}) =>
    ({
      title: "Pelaxia",
      contentHtml: BODY,
      infoboxHtml: "<table>" + "x".repeat(100) + "</table>",
      noticesHtml: null,
      toc: [],
      categories: [],
      lastModified: null,
      stale: false,
      ...overrides,
    }) as never;

  const request = (
    headers: Record<string, string>,
    cookies: Array<{ name: string; value: string }> = []
  ) => {
    mockHeaders.mockResolvedValue(
      new Headers({ accept: "text/html,application/xhtml+xml", ...headers })
    );
    mockCookies.mockResolvedValue({ getAll: () => cookies });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WIKIOS_LEAN_FLIGHT = "1";
    request({});
  });
  afterEach(() => {
    delete process.env.WIKIOS_LEAN_FLIGHT;
  });

  it("is off unless WIKIOS_LEAN_FLIGHT=1: the flag is checked first, no request is looked at", async () => {
    delete process.env.WIKIOS_LEAN_FLIGHT;
    expect(leanFlightEnabled()).toBe(false);

    await leanTheFlight("Pelaxia", true, data());

    expect(mockReplacePrefetched).not.toHaveBeenCalled();
    expect(mockHeaders).not.toHaveBeenCalled();
  });

  it("swaps the HTML of an anonymous page load for markers, and stashes the real HTML for the SSR render", async () => {
    const full = data({ noticesHtml: "<div>notice</div>" });

    await leanTheFlight("Pelaxia", true, full);

    expect(mockReplacePrefetched).toHaveBeenCalledTimes(1);
    const [path, input, replace] = mockReplacePrefetched.mock.calls[0]! as [
      string[],
      object,
      (current: Record<string, unknown>) => Record<string, unknown>,
    ];
    expect(path).toEqual(["wikios", "getArticleHtml"]);
    expect(input).toEqual({ title: "Pelaxia" });

    const lean = replace(full as unknown as Record<string, unknown>);
    expect(lean.title).toBe("Pelaxia");
    const body = parseLeanMarker(lean.contentHtml as string)!;
    expect(body.part).toBe("body");
    expect(parseLeanMarker(lean.infoboxHtml as string)?.token).toBe(body.token);
    expect(parseLeanMarker(lean.noticesHtml as string)?.part).toBe("notices");
    expect(resolveLeanHtml(lean.contentHtml as string)).toBe(BODY);
    // a lean flight is a few hundred bytes of this part, not the article
    expect(JSON.stringify(lean).length).toBeLessThan(600);

    // a part the article has not stays null
    expect(replace(data() as never).noticesHtml).toBeNull();
  });

  it("keeps the redirect=no input of a redirect page's own view", async () => {
    await leanTheFlight("Old name", false, data());
    expect(mockReplacePrefetched.mock.calls[0]![1]).toEqual({ title: "Old name", redirect: "no" });
  });

  it.each<[string, Record<string, string>, Array<{ name: string; value: string }>]>([
    ["a client navigation (it asks for the flight and has no DOM to read back)", { rsc: "1" }, []],
    ["a prefetch", { "next-router-prefetch": "1" }, []],
    ["a request that does not ask for HTML", { accept: "application/json" }, []],
    ["a reader with a Clerk session", {}, [{ name: "__session", value: "jwt" }]],
  ])("stays full for %s", async (_label, headers, cookies) => {
    request(headers, cookies);

    await leanTheFlight("Pelaxia", true, data());

    expect(mockReplacePrefetched).not.toHaveBeenCalled();
  });

  it("stays full for an article still being rendered, and for a small one", async () => {
    await leanTheFlight("Pelaxia", true, data({ stale: true }));
    await leanTheFlight("Stub", true, data({ contentHtml: "<p>Small.</p>", infoboxHtml: null }));

    expect(mockReplacePrefetched).not.toHaveBeenCalled();
  });
});
