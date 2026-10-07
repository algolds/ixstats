/**
 * Recorded IIWiki api.php answers for world discovery tests (hand-written in MediaWiki's formatversion=2 shape:
 * a two-page roster with continuation, nation pages with infoboxes, a redirect and a missing page, the root's
 * subcategories, a map category, the portal's images and page image, and imageinfo with extmetadata), and a fake
 * `fetch` that answers from them by query parameters. IIWiki itself refuses requests from outside production.
 */
import fs from "node:fs";
import path from "node:path";
import type { RealmWikiSettings } from "~/lib/realms/realm-wiki-settings";

const DIR = path.resolve(__dirname, "../fixtures/iiwiki-discovery");
const load = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), "utf8"));

export const IIWIKI_FIXTURES = {
  roster1: load("roster-1"),
  roster2: load("roster-2"),
  nations: load("nation-revisions"),
  rootSubcats: load("root-subcats"),
  mapFiles: load("map-category-files"),
  portal: load("portal-images"),
  imageinfo: load("imageinfo"),
};

export const EURTH_WIKI: RealmWikiSettings = {
  source: "iiwiki",
  rootCategory: "Category:Eurth",
  keyword: "Eurth",
  rosterCategory: "Category:Countries (Eurth)",
  portalTitle: "Portal:Eurth",
  mapCategories: [],
};

const EMPTY_MEMBERS = { batchcomplete: true, query: { categorymembers: [] } };

export const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers ?? {}) },
  });

/** The recorded answer for one api.php request, by its parameters. */
export function iiwikiAnswer(url: URL): unknown {
  const p = url.searchParams;
  if (p.get("list") === "categorymembers") {
    const title = p.get("cmtitle");
    if (title === "Category:Countries (Eurth)")
      return p.get("cmcontinue") ? IIWIKI_FIXTURES.roster2 : IIWIKI_FIXTURES.roster1;
    if (title === "Category:Eurth" && p.get("cmtype") === "subcat") return IIWIKI_FIXTURES.rootSubcats;
    if (title === "Category:Eurth maps" && p.get("cmtype") === "file") return IIWIKI_FIXTURES.mapFiles;
    return EMPTY_MEMBERS;
  }
  const prop = p.get("prop") ?? "";
  if (prop === "revisions") return IIWIKI_FIXTURES.nations;
  if (prop.includes("images")) return IIWIKI_FIXTURES.portal;
  if (prop === "imageinfo") return IIWIKI_FIXTURES.imageinfo;
  throw new Error(`no recorded answer for ${url.search}`);
}

export interface FakeWiki {
  fetch: typeof fetch;
  calls: URL[];
}

/**
 * A fetch over the recorded answers. `respond` may answer a request itself (by its 0-based index), for a 403, a
 * 429 or a challenge page; returning undefined falls back to the recording.
 */
export function fakeIiwiki(respond?: (url: URL, index: number) => Response | undefined): FakeWiki {
  const calls: URL[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const index = calls.length;
    calls.push(url);
    return respond?.(url, index) ?? json(iiwikiAnswer(url));
  }) as typeof fetch;
  return { fetch: fetchImpl, calls };
}
