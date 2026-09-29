/** @jest-environment node */
import { crawlRealmCategory, detectNationTitles, type WikiQuery } from "~/lib/realms/lore-import";

type Member = { ns: number; title: string };

const ROOT = "Category:Eurth";
const HISTORY = "Category:History (Eurth)";

/** Category:Eurth contains itself (a cycle), a keyword subcategory, a skipped "redirects" one and an unrelated one. */
const TREE: Record<string, Member[]> = {
  [ROOT]: [
    { ns: 0, title: "B" },
    { ns: 0, title: "A" },
    { ns: 14, title: ROOT },
    { ns: 14, title: HISTORY },
    { ns: 14, title: "Category:Eurth redirects" },
    { ns: 14, title: "Category:Unrelated" },
  ],
  [HISTORY]: [
    { ns: 0, title: "C" },
    { ns: 0, title: "A" }, // also listed under the root — one page, counted once
  ],
};

const CONTENT: Record<string, string> = {
  A: "'''A''' is a region.\n== History ==\n{{Infobox country\n| name = A\n}} (below the lead, so not a nation)",
  B: "{{Infobox country\n| name = B\n}}\n'''B''' is a nation.\n== Geography ==",
  C: "Plain lore.",
  D: "{{ infobox former country | name = D }}\n'''D''' was a nation.",
};

const PAGE_SIZE = 3;

/** MediaWiki (formatversion 2) answers; the root's members come back in two continued pages. */
function respond(params: Record<string, string>): object {
  if (params.list === "categorymembers") {
    const all = TREE[params.cmtitle ?? ""] ?? [];
    if (params.cmcontinue) return { query: { categorymembers: all.slice(PAGE_SIZE) } };
    if (all.length <= PAGE_SIZE) return { query: { categorymembers: all } };
    return {
      continue: { cmcontinue: "page|2", continue: "-||" },
      query: { categorymembers: all.slice(0, PAGE_SIZE) },
    };
  }
  if (params.prop === "revisions") {
    const pages = (params.titles ?? "")
      .split("|")
      .map((title) => ({ title, revisions: [{ slots: { main: { content: CONTENT[title] ?? "" } } }] }));
    return { query: { pages } };
  }
  throw new Error(`unexpected query ${JSON.stringify(params)}`);
}

function fakeWiki() {
  const calls: Array<Record<string, string>> = [];
  const query: WikiQuery = async (params, schema) => {
    calls.push(params);
    return schema.parse(respond(params));
  };
  return { query, calls };
}

const requestedCategories = (calls: Array<Record<string, string>>) =>
  new Set(calls.filter((c) => c.list === "categorymembers").map((c) => c.cmtitle));

describe("crawlRealmCategory", () => {
  it("indexes the keyword subtree, survives the self-cycle and never reads skipped or unrelated categories", async () => {
    const { query, calls } = fakeWiki();

    const result = await crawlRealmCategory(query, { rootCategory: ROOT, keyword: "Eurth" });

    expect(result).toEqual({ pages: ["A", "B", "C"], categoriesVisited: [ROOT, HISTORY], truncated: false });
    expect(requestedCategories(calls)).toEqual(new Set([ROOT, HISTORY]));
    expect(requestedCategories(calls)).not.toContain("Category:Eurth redirects");
    expect(requestedCategories(calls)).not.toContain("Category:Unrelated");
  });

  it("follows categorymembers continuation, passing the whole continue object back", async () => {
    const { query, calls } = fakeWiki();

    await crawlRealmCategory(query, { rootCategory: ROOT, keyword: "Eurth" });

    const rootCalls = calls.filter((c) => c.cmtitle === ROOT);
    expect(rootCalls).toHaveLength(2);
    expect(rootCalls[1]).toMatchObject({ cmcontinue: "page|2", continue: "-||" });
  });

  it("stops at maxPages and reports truncation", async () => {
    const { query } = fakeWiki();

    const result = await crawlRealmCategory(query, { rootCategory: ROOT, keyword: "Eurth", maxPages: 2 });

    expect(result.pages).toEqual(["A", "B"]);
    expect(result.truncated).toBe(true);
  });

  it("does not count a page listed in two categories twice against the cap", async () => {
    const { query } = fakeWiki();

    const result = await crawlRealmCategory(query, { rootCategory: ROOT, keyword: "Eurth", maxPages: 3 });

    expect(result).toMatchObject({ pages: ["A", "B", "C"], truncated: false });
  });

  it("stops at maxDepth and reports the unread subcategories as truncation", async () => {
    const { query, calls } = fakeWiki();

    const result = await crawlRealmCategory(query, { rootCategory: ROOT, keyword: "Eurth", maxDepth: 0 });

    expect(result).toEqual({ pages: ["A", "B"], categoriesVisited: [ROOT], truncated: true });
    expect(requestedCategories(calls)).toEqual(new Set([ROOT]));
  });
});

describe("detectNationTitles", () => {
  it("marks only pages whose lead uses Infobox country", async () => {
    const { query } = fakeWiki();
    await expect(detectNationTitles(query, ["A", "B", "C"])).resolves.toEqual(new Set(["B"]));
  });

  it("also matches a spaced, lower-case Infobox former country", async () => {
    const { query } = fakeWiki();
    await expect(detectNationTitles(query, ["C", "D"])).resolves.toEqual(new Set(["D"]));
  });

  it("fetches content in batches of 50 titles", async () => {
    const { query, calls } = fakeWiki();
    const titles = Array.from({ length: 120 }, (_, i) => `P${i}`);

    await detectNationTitles(query, titles);

    expect(calls.map((c) => (c.titles ?? "").split("|").length)).toEqual([50, 50, 20]);
    expect(calls[0]).toMatchObject({ prop: "revisions", rvprop: "content", rvslots: "main" });
  });

  it("follows rvcontinue when the wiki splits a batch's content across responses", async () => {
    const rev = (content: string) => [{ slots: { main: { content } } }];
    const calls: Array<Record<string, string>> = [];
    const query: WikiQuery = async (params, schema) => {
      calls.push(params);
      return schema.parse(
        params.rvcontinue
          ? { query: { pages: [{ title: "A" }, { title: "B", revisions: rev("{{Infobox country}}") }] } }
          : {
              continue: { rvcontinue: "12|34", continue: "||" },
              query: { pages: [{ title: "A", revisions: rev("lore") }, { title: "B" }] },
            }
      );
    };

    await expect(detectNationTitles(query, ["A", "B"])).resolves.toEqual(new Set(["B"]));
    expect(calls[1]).toMatchObject({ titles: "A|B", rvcontinue: "12|34", continue: "||" });
  });
});
