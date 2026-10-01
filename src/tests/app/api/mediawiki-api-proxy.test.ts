/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 418: the public read-only api.php proxy no longer forwards anything to IxWiki's MediaWiki (WikiOS serves
// /w/api.php itself, and the proxy could return a page WikiOS has deleted). A sister wiki's still works.
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { check: jest.fn().mockResolvedValue({ success: true, resetAt: new Date() }) },
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "~/app/api/mediawiki/[wiki]/api.php/route";
import { WIKIS, getWiki } from "~/app/api/mediawiki/_config";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const get = (wiki: string, query: string) =>
  GET(new NextRequest(`http://localhost:3000/api/mediawiki/${wiki}/api.php?${query}`), {
    params: Promise.resolve({ wiki }),
  });

let guard: FetchGuard;
beforeEach(() => {
  guard = installFetchGuard();
});
afterEach(() => guard.restore());

describe("the api.php proxy", () => {
  it("allows IxWiki no action", () => {
    expect(WIKIS.ixwiki.allowedActions).toEqual([]);
    expect(getWiki("ixwiki")?.allowedActions).toEqual([]);
  });

  it.each(["action=query&list=allpages", "action=opensearch&search=caph", "action=parse&page=Main_Page", "action=query&titles=Deleted_page&prop=revisions&rvprop=content"])(
    "answers 410 to IxWiki's %s, asking no wiki",
    async (query) => {
      const res = await get("ixwiki", query);

      expect(res.status).toBe(410);
      expect(await res.json()).toEqual({ error: "IxWiki's api.php is not proxied here" });
      expect(guard.calls()).toEqual([]);
    }
  );

  it("still forwards a read-only query to iiwiki, a sister wiki", async () => {
    guard.restore();
    guard = installFetchGuard((url) => {
      expect(url.hostname).toBe("iiwiki.com");
      return { query: { pages: [] } };
    });

    const res = await get("iiwiki", "action=query&titles=Elmeria&prop=info");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ query: { pages: [] } });
    expect(guard.calls()).toHaveLength(1);
  });

  it("still refuses an action iiwiki's list does not allow, and an unknown wiki", async () => {
    expect((await get("iiwiki", "action=edit")).status).toBe(400);
    expect((await get("nowhere", "action=query")).status).toBe(404);
    expect(guard.calls()).toEqual([]);
  });
});
