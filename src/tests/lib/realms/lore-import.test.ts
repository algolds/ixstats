/** @jest-environment node */
import {
  crawlRealmCategory,
  detectNationTitles,
  indexNations,
  listRosterNations,
  nationMethod,
  prunableTitles,
  rosterTitlesNotCrawled,
  suspectRosterEntries,
  type WikiQuery,
} from "~/lib/realms/lore-import";

type Member = { ns: number; title: string };

const ROOT = "Category:Eurth";
const HISTORY = "Category:History (Eurth)";
const ROSTER = "Category:Countries (Eurth)";

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
  /** The curated roster: one subcategory per active nation, named after it; not reachable from the root crawl. */
  [ROSTER]: [
    { ns: 14, title: "Category:Nanto (Eurth)" },
    { ns: 14, title: "Category:Abantium" },
    { ns: 0, title: "B" },
    { ns: 10, title: "Template:Eurth country" }, // not a nation
    { ns: 14, title: "Category:B" }, // same nation as page B
  ],
};

const CONTENT: Record<string, string> = {
  A: "'''A''' is a region.\n== History ==\n{{Infobox country\n| name = A\n}} (below the lead, so not a nation)",
  B: "{{Infobox country\n| name = B\n}}\n'''B''' is a nation.\n== Geography ==",
  C: "Plain lore.",
  D: "{{ infobox former country | name = D }}\n'''D''' was a nation.",
  E: "{{Infobox country at games\n| country = E\n}}\nE at the games.",
  F: "{{Infobox_country|name=F}}\n'''F''' is a nation.",
  G: "{{Infobox country geography\n| country = G\n}}",
  H: "{{Infobox country demographics | country = H }}",
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

  it("does not match Infobox country sub-templates, but matches Infobox_country", async () => {
    const { query } = fakeWiki();
    await expect(detectNationTitles(query, ["E", "F", "G", "H"])).resolves.toEqual(new Set(["F"]));
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

describe("wiki continuation guard", () => {
  it("throws instead of looping when the wiki repeats the same continuation", async () => {
    const calls: Array<Record<string, string>> = [];
    // A proxy that strips continue params: every answer is the first page again, with the same `continue`.
    const query: WikiQuery = async (params, schema) => {
      calls.push(params);
      return schema.parse({
        continue: { cmcontinue: "page|2", continue: "-||" },
        query: { categorymembers: [{ ns: 0, title: "A" }] },
      });
    };

    await expect(crawlRealmCategory(query, { rootCategory: ROOT, keyword: "Eurth" })).rejects.toThrow(
      /same continuation/
    );
    expect(calls).toHaveLength(2);
  });
});

describe("listRosterNations", () => {
  it("returns roster subcategories without the Category: prefix plus direct ns0 pages, sorted and de-duplicated", async () => {
    const { query, calls } = fakeWiki();

    await expect(listRosterNations(query, ROSTER)).resolves.toEqual(["Abantium", "B", "Nanto (Eurth)"]);

    const rosterCalls = calls.filter((c) => c.cmtitle === ROSTER);
    expect(rosterCalls).toHaveLength(2); // followed the continuation
    expect(rosterCalls[0]).toMatchObject({ list: "categorymembers", cmtype: "page|subcat" });
  });
});

describe("nationMethod (ruling E-d′)", () => {
  it("uses the infobox heuristic without a roster", () => {
    expect(nationMethod(undefined)).toEqual({ kind: "infobox" });
  });

  it("uses a curated roster when given", () => {
    expect(nationMethod(ROSTER)).toEqual({ kind: "roster", roster: ROSTER });
  });

  it.each(["Category:Retired countries (Eurth)", "Category:RETIRED nations"])(
    "refuses the retired roster %p",
    (roster) => {
      expect(() => nationMethod(roster)).toThrow(/retired/i);
    }
  );
});

describe("indexNations", () => {
  it("takes nations from the roster and adds roster titles the crawl missed to the index", async () => {
    const { query, calls } = fakeWiki();

    const result = await indexNations(query, ["A", "B", "C"], { kind: "roster", roster: ROSTER });

    expect(result).toEqual({
      pages: ["A", "Abantium", "B", "C", "Nanto (Eurth)"],
      nations: new Set(["Abantium", "B", "Nanto (Eurth)"]),
    });
    expect(calls.some((c) => c.prop === "revisions")).toBe(false); // no infobox heuristic
  });

  it("falls back to the infobox heuristic over the crawled pages", async () => {
    const { query } = fakeWiki();

    await expect(indexNations(query, ["A", "B", "C"], { kind: "infobox" })).resolves.toEqual({
      pages: ["A", "B", "C"],
      nations: new Set(["B"]),
    });
  });
});

describe("the dry run's roster warnings", () => {
  it("lists the roster titles the crawl did not find", () => {
    expect(
      rosterTitlesNotCrawled(["A", "B", "C"], new Set(["Nanto (Eurth)", "B", "Abantium"]))
    ).toEqual(["Abantium", "Nanto (Eurth)"]);
  });

  it("flags roster entries that look like subcategories of pages, never a plain nation name", () => {
    expect(
      suspectRosterEntries([
        "Nanto (Eurth)",
        "Abantium",
        "Cities of Abantium",
        "Eurth maps",
        "Flags (Eurth)",
        "History of Nanto",
        "Eurth templates",
        "People of Eurth",
      ])
    ).toEqual([
      "Cities of Abantium",
      "Eurth maps",
      "Eurth templates",
      "Flags (Eurth)",
      "History of Nanto",
      "People of Eurth",
    ]);
  });
});

describe("prunableTitles (--prune)", () => {
  it("deletes only indexed titles no longer in the index, keeping the claimed or founded ones", () => {
    expect(
      prunableTitles(
        ["A", "Gone", "Claimed", "B", "Founded"],
        ["A", "B", "New"],
        ["Claimed", "Founded", "A"]
      )
    ).toEqual({ prune: ["Gone"], kept: ["Claimed", "Founded"] });
  });

  it("prunes nothing when every indexed title is still current", () => {
    expect(prunableTitles(["A", "B"], ["A", "B", "C"], [])).toEqual({ prune: [], kept: [] });
  });
});
