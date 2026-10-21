import {
  buildExpectations,
  evaluateExpectation,
  parseArgs,
  planChecks,
  type ChecklistOptions,
  type Expectation,
  type Observation,
} from "../../../scripts/ops/verify-wikios-takeover";

const IXSTATES = "https://ixwiki.com/projects/ixstates";

const observed = (partial: Partial<Observation>): Observation => ({
  status: 200,
  location: null,
  contentType: null,
  body: "",
  ...partial,
});

const checklist = (partial: Partial<ChecklistOptions> = {}): ChecklistOptions => ({
  file: "Example.png",
  image: null,
  ixstates: IXSTATES,
  page: "Main_Page",
  revid: "1",
  subpage: "Template:Infobox_country/doc",
  category: "Category:Countries",
  ...partial,
});

/** parseArgs with the IxStates URL supplied and no environment to fall back on. */
const parse = (argv: string[] = []) => parseArgs(["--ixstates", IXSTATES, ...argv], {});

const row = (partial: Partial<Expectation>): Expectation => ({
  name: "row",
  path: "/x",
  via: "public",
  expectStatus: 200,
  ...partial,
});

describe("evaluateExpectation", () => {
  it("fails on a different status and names both", () => {
    const result = evaluateExpectation(row({}), observed({ status: 404 }));
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(["status 404, expected 200"]);
  });
  it("supports 'anything but' statuses", () => {
    const expectation = row({ expectStatus: { not: 404 } });
    expect(evaluateExpectation(expectation, observed({ status: 307 })).ok).toBe(true);
    const failed = evaluateExpectation(expectation, observed({ status: 404 }));
    expect(failed.failures).toEqual(["status 404, expected anything but 404"]);
  });

  it("compares a redirect Location as path+query, absolute or relative", () => {
    const expectation = row({ expectStatus: 301, expectLocation: "/wiki/Foo" });
    expect(
      evaluateExpectation(expectation, observed({ status: 301, location: "/wiki/Foo" })).ok
    ).toBe(true);
    expect(
      evaluateExpectation(
        expectation,
        observed({ status: 301, location: "https://ixwiki.com/wiki/Foo" })
      ).ok
    ).toBe(true);
    const wrong = evaluateExpectation(
      expectation,
      observed({ status: 301, location: "https://ixwiki.com/wiki/Foo?oldid=1" })
    );
    expect(wrong.failures).toEqual([
      "Location https://ixwiki.com/wiki/Foo?oldid=1, expected /wiki/Foo",
    ]);
  });
  it("reports a missing Location on a redirect", () => {
    const expectation = row({ expectStatus: 302, expectLocation: "/wiki/Main_Page" });
    const result = evaluateExpectation(expectation, observed({ status: 302, location: null }));
    expect(result.failures).toEqual(["Location (none), expected /wiki/Main_Page"]);
  });
  it("checks that the body includes the expected text", () => {
    const expectation = row({ expectBodyIncludes: "__next" });
    expect(
      evaluateExpectation(expectation, observed({ body: "<script>self.__next_f</script>" })).ok
    ).toBe(true);
    const result = evaluateExpectation(expectation, observed({ body: "<div class='mw-body'>" }));
    expect(result.failures).toEqual(['body does not include "__next"']);
  });
  it("collects every failure of one row", () => {
    const expectation = row({ expectStatus: 301, expectLocation: "/a", expectBodyIncludes: "x" });
    const result = evaluateExpectation(
      expectation,
      observed({ status: 302, location: "/b", body: "" })
    );
    expect(result.failures).toHaveLength(3);
  });
});

describe("buildExpectations", () => {
  const rows = buildExpectations(checklist());
  const byPath = (path: string) => rows.find((r) => r.path === path);

  it("covers the takeover paths from plan 417", () => {
    expect(byPath("/")).toMatchObject({ expectStatus: 302, expectLocation: "/wiki/Main_Page" });
    expect(byPath("/wiki/Main_Page")).toMatchObject({
      expectStatus: 200,
      expectBodyIncludes: "__next",
    });
    expect(byPath("/classic/Main_Page")).toMatchObject({
      expectStatus: 200,
      expectBodyIncludes: "mw-",
    });
    expect(byPath("/index.php?title=Foo")).toMatchObject({
      expectStatus: 301,
      expectLocation: "/wiki/Foo",
    });
    expect(byPath("/index.php?title=Foo&oldid=1")).toMatchObject({ expectStatus: 301 });
    expect(byPath("/api.php?action=query&meta=siteinfo&format=json")).toMatchObject({
      expectStatus: 200,
    });
  });
  it("gates the routes WikiOS must answer itself", () => {
    expect(byPath("/robots.txt")).toMatchObject({ expectStatus: 200, standalone: true });
    expect(byPath("/wiki-sitemap")).toMatchObject({ expectStatus: 200, standalone: true });
    expect(byPath("/wiki/Template:Infobox_country/doc")).toMatchObject({
      expectStatus: 200,
      standalone: true,
    });
    expect(byPath("/wiki/Category:Countries")).toMatchObject({
      expectStatus: 200,
      standalone: true,
    });
    expect(byPath("/wiki/Special:Search?search=x")).toMatchObject({
      expectStatus: 200,
      standalone: true,
    });
    expect(byPath("/wiki/Main_Page?action=raw")).toMatchObject({
      expectStatus: 200,
      expectContentType: "text/x-wiki",
      standalone: true,
    });
    expect(byPath("/wiki/Main_Page?oldid=1")).toMatchObject({
      expectStatus: 200,
      standalone: true,
    });
  });
});

describe("the anonymous article body row (F20: WIKIOS_LEAN_FLIGHT=1 is verified by it)", () => {
  const BODY_ROW = /article body text/;
  const bodyRow = (partial: Partial<ChecklistOptions> = {}) =>
    buildExpectations(checklist(partial)).find((expectation) => BODY_ROW.test(expectation.name));
  const ARTICLE = '<div class="wikios-article-body wikios-article-content"><div id="wikios-lean-x-body">';
  const LEAD = "Pelaxia is a country in Eurth.";
  const DEEP = "Its ports handle most of the continent's grain";

  it("fails when the page comes back without the article body, as an SSR stash miss does", () => {
    const expectation = bodyRow({ articleText: DEEP })!;
    const miss = evaluateExpectation(
      expectation,
      observed({ body: `<main><h1>Pelaxia</h1>${ARTICLE}</div></div></main>` })
    );
    expect(miss.ok).toBe(false);
    expect(miss.failures[0]).toContain(`the article element does not include ${JSON.stringify(DEEP)}`);
    expect(
      evaluateExpectation(
        expectation,
        observed({ body: `<main>${ARTICLE}<p>${DEEP}, and its mines the metals.</p></div></div></main>` })
      ).ok
    ).toBe(true);
  });

  it("does not pass on text that is only in the meta tags: a lead sentence is the description, og and twitter text", () => {
    const expectation = bodyRow({ articleText: LEAD })!;
    const head =
      `<head><title>Pelaxia — IxWiki</title><meta name="description" content="${LEAD}"/>` +
      `<meta property="og:description" content="${LEAD}"/><meta name="twitter:description" content="${LEAD}"/></head>`;
    // the page with no article body: the lead is in <head> and, once the metadata streams in, in a hidden div
    const body =
      `<body><main><h1>Pelaxia</h1>${ARTICLE}</div></div></main>` +
      `<div hidden><meta name="description" content="${LEAD}"/></div></body>`;
    const result = evaluateExpectation(expectation, observed({ body: `<html>${head}${body}</html>` }));
    expect(result.ok).toBe(false);
  });

  it("does not pass on text that is only in the page data (the flight carries the metadata and, without lean mode, the article)", () => {
    const expectation = bodyRow({ articleText: LEAD })!;
    const flight = `<script>self.__next_f.push([1,"{\\"description\\":\\"${LEAD}\\"}"])</script>`;
    const result = evaluateExpectation(
      expectation,
      observed({ body: `<body><main>${ARTICLE}</div></div></main>${flight}</body>` })
    );
    expect(result.ok).toBe(false);
  });

  it("passes on a sentence in the article element even when the same words are in the meta tags too", () => {
    const expectation = bodyRow({ articleText: LEAD })!;
    const html = `<head><meta name="description" content="${LEAD}"/></head><body>${ARTICLE}<p>${LEAD}</p></div></div></body>`;
    expect(evaluateExpectation(expectation, observed({ body: html })).ok).toBe(true);
  });

  it("fails a page with no article element at all (an error page, a soft 404)", () => {
    const expectation = bodyRow({ articleText: LEAD })!;
    expect(evaluateExpectation(expectation, observed({ body: `<body><p>${LEAD}</p></body>` })).ok).toBe(false);
  });
});
describe("parseArgs", () => {
  it("requires the IxStates URL: there is no default", () => {
    expect(() => parseArgs([], {})).toThrow(/--ixstates is required/);
    expect(() => parseArgs([], { NEXT_PUBLIC_IXSTATES_URL: "  " })).toThrow(
      /--ixstates is required/
    );
  });
});

describe("planChecks", () => {
  it("marks internal rows skipped when --internal is absent", () => {
    const plan = planChecks(parse());
    expect(plan.filter((p) => p.url === null).map((p) => p.expectation.via)).toEqual(["internal"]);
  });
});
