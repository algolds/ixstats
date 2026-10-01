import {
  articleElementHtml,
  buildExpectations,
  evaluateExpectation,
  ixstatesPath,
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
  it("passes when status matches exactly", () => {
    expect(evaluateExpectation(row({}), observed({ status: 200 }))).toEqual({
      ok: true,
      failures: [],
    });
  });

  it("fails on a different status and names both", () => {
    const result = evaluateExpectation(row({}), observed({ status: 404 }));
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(["status 404, expected 200"]);
  });

  it("accepts any status from a list", () => {
    const expectation = row({ expectStatus: [200, 302] });
    expect(evaluateExpectation(expectation, observed({ status: 302 })).ok).toBe(true);
    expect(evaluateExpectation(expectation, observed({ status: 404 })).ok).toBe(false);
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

  it("treats a trailing * in expectLocation as a prefix", () => {
    const expectation = row({ expectStatus: 301, expectLocation: "/wiki/Foo?oldid=1*" });
    expect(
      evaluateExpectation(
        expectation,
        observed({ status: 301, location: "/wiki/Foo?oldid=1&diff=2" })
      ).ok
    ).toBe(true);
    expect(
      evaluateExpectation(expectation, observed({ status: 301, location: "/wiki/Foo?oldid=2" })).ok
    ).toBe(false);
  });

  it("reports a missing Location on a redirect", () => {
    const expectation = row({ expectStatus: 302, expectLocation: "/wiki/Main_Page" });
    const result = evaluateExpectation(expectation, observed({ status: 302, location: null }));
    expect(result.failures).toEqual(["Location (none), expected /wiki/Main_Page"]);
  });

  it("only checks the Location on 3xx responses", () => {
    const expectation = row({ expectStatus: [200, 302], expectLocation: "/images/*" });
    expect(evaluateExpectation(expectation, observed({ status: 200 })).ok).toBe(true);
    expect(
      evaluateExpectation(
        expectation,
        observed({ status: 302, location: "https://x.test/images/a.png" })
      ).ok
    ).toBe(true);
    expect(
      evaluateExpectation(expectation, observed({ status: 302, location: "/elsewhere" })).ok
    ).toBe(false);
  });

  it("checks that the body includes the expected text", () => {
    const expectation = row({ expectBodyIncludes: "__next" });
    expect(
      evaluateExpectation(expectation, observed({ body: "<script>self.__next_f</script>" })).ok
    ).toBe(true);
    const result = evaluateExpectation(expectation, observed({ body: "<div class='mw-body'>" }));
    expect(result.failures).toEqual(['body does not include "__next"']);
  });

  it("checks that the body is JSON when asked", () => {
    const expectation = row({ expectJson: true });
    expect(evaluateExpectation(expectation, observed({ body: '{"parse":{"text":"x"}}' })).ok).toBe(
      true
    );
    expect(evaluateExpectation(expectation, observed({ body: "<html>" })).failures).toEqual([
      "body is not JSON",
    ]);
  });

  it("checks the Content-Type case-insensitively", () => {
    const expectation = row({ expectContentType: "text/x-wiki" });
    expect(
      evaluateExpectation(expectation, observed({ contentType: "Text/X-Wiki; charset=UTF-8" })).ok
    ).toBe(true);
    expect(
      evaluateExpectation(expectation, observed({ contentType: "text/html" })).failures
    ).toEqual(["Content-Type text/html, expected text/x-wiki"]);
    expect(evaluateExpectation(expectation, observed({ contentType: null })).failures).toEqual([
      "Content-Type (none), expected text/x-wiki",
    ]);
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

  it("expects WikiOS's own api.php at /w/api.php, JSON with the site name, and a login token", () => {
    expect(byPath("/w/api.php?action=query&meta=siteinfo&siprop=general&format=json")).toMatchObject({
      via: "public",
      expectStatus: 200,
      expectContentType: "application/json",
      expectBodyIncludes: '"sitename"',
      expectJson: true,
      standalone: true,
    });
    expect(byPath("/w/api.php?action=query&meta=tokens&type=login&format=json")).toMatchObject({
      expectStatus: 200,
      expectBodyIncludes: '"logintoken"',
      expectJson: true,
      standalone: true,
    });
  });

  it("accepts 200 or 403 for the classic edit form", () => {
    expect(byPath("/index.php?title=Foo&action=edit")).toMatchObject({ expectStatus: [200, 403] });
  });

  it("requires Special:FilePath to answer 302 to an upload path", () => {
    expect(byPath("/wiki/Special:FilePath/Example.png")).toMatchObject({
      expectStatus: 302,
      expectLocation: "/images/*",
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

  it("uses the given page, revision, subpage and category", () => {
    const custom = buildExpectations(
      checklist({ page: "Ixnay", revid: "77", subpage: "Template:Foo/doc", category: "Category:X" })
    );
    const paths = custom.map((r) => r.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/wiki/Ixnay?action=raw",
        "/wiki/Ixnay?oldid=77",
        "/wiki/Template:Foo/doc",
        "/wiki/Category:X",
      ])
    );
  });

  it("covers the runtime requests of WikiOS pages that are not routes", () => {
    expect(byPath("/api/ixtime/current")).toMatchObject({ expectStatus: 200, expectJson: true });
    for (const path of [
      "/maplibre/maplibre-gl-worker.mjs",
      "/flags/metadata.json",
      "/images/flags/placeholder.svg",
      "/fonts/National-Book.otf",
    ]) {
      expect(byPath(path)).toMatchObject({ expectStatus: 200, standalone: true });
    }
  });

  it("takes the IxStates rows from the configured URL", () => {
    expect(byPath("/maps?embed=true")).toMatchObject({
      expectStatus: 302,
      expectLocation: "/projects/ixstates/maps?embed=true",
    });
    const reachable = rows.find((r) => r.name.startsWith("IxStates still reachable"));
    expect(reachable).toMatchObject({
      url: IXSTATES,
      path: "/projects/ixstates",
      expectStatus: { not: 404 },
    });
    const other = buildExpectations(checklist({ ixstates: "https://ixstates.example" }));
    expect(other.find((r) => r.path === "/maps?embed=true")?.expectLocation).toBe(
      "/maps?embed=true"
    );
    expect(other.find((r) => r.name.startsWith("IxStates still reachable"))?.path).toBe("/");
    expect(JSON.stringify(rows)).not.toContain("/projects/ixstats/");
  });

  it("checks the render engine on the internal origin only", () => {
    const internal = rows.filter((r) => r.via === "internal");
    expect(internal).toHaveLength(1);
    expect(internal[0]).toMatchObject({
      path: "/api.php?action=parse&text=x&contentmodel=wikitext&format=json",
      expectStatus: 200,
      expectJson: true,
    });
    expect(rows.filter((r) => r.via === "public").length).toBe(rows.length - 1);
  });

  it("adds the /images/ row only when an upload path is given", () => {
    expect(rows.some((r) => r.name === "upload served from /images/")).toBe(false);
    const withImage = buildExpectations(checklist({ image: "/images/a/ab/Foo.png" }));
    expect(withImage.find((r) => r.path === "/images/a/ab/Foo.png")).toMatchObject({
      expectStatus: 200,
      via: "public",
    });
  });

  it("adds the IxStates upload row only when an upload is given, and WikiOS must serve it", () => {
    expect(rows.some((r) => r.name.includes("IxStates upload"))).toBe(false);
    const upload = "/images/uploads/uploaded_1_abc_Flag.png";
    const withUpload = buildExpectations(checklist({ upload }));
    expect(withUpload.find((r) => r.path === upload)).toMatchObject({
      via: "public",
      expectStatus: 200,
      expectContentType: "image/",
      standalone: true,
    });
  });

  it("uses the given file name for the Special:FilePath row", () => {
    const custom = buildExpectations(checklist({ file: "Flag_of_Ixnay.svg" }));
    expect(custom.some((r) => r.path === "/wiki/Special:FilePath/Flag_of_Ixnay.svg")).toBe(true);
  });
});

describe("the anonymous article body row (F20: WIKIOS_LEAN_FLIGHT=1 is verified by it)", () => {
  const BODY_ROW = /article body text/;
  const bodyRow = (partial: Partial<ChecklistOptions> = {}) =>
    buildExpectations(checklist(partial)).find((expectation) => BODY_ROW.test(expectation.name));

  it("is left out without a sentence to look for", () => {
    expect(bodyRow()).toBeUndefined();
    expect(bodyRow({ articleText: null })).toBeUndefined();
  });

  it("asks for the article as an anonymous page load and wants the sentence in the HTML", () => {
    const expectation = bodyRow({ article: "Pelaxia", articleText: "Pelaxia is a country" });
    expect(expectation).toMatchObject({
      path: "/wiki/Pelaxia",
      via: "public",
      expectStatus: 200,
      expectArticleText: "Pelaxia is a country",
      headers: { accept: "text/html" },
      standalone: true,
    });
  });

  it("falls back to the page, and holds on a lone WikiOS process (--standalone)", () => {
    const options = { ...parse(["--standalone", "--article-text", "words"]) };
    const rows = planChecks(options).map((check) => check.expectation);
    expect(rows.find((expectation) => BODY_ROW.test(expectation.name))?.path).toBe("/wiki/Main_Page");
  });

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

describe("articleElementHtml", () => {
  it("starts at the article element (its class attribute) and drops scripts, meta, link and title tags", () => {
    const html =
      '<head><meta name="description" content="lead"/></head><body><title>T</title>' +
      '<div class="wikios-article-body wikios-article-content"><p>deep</p><link rel="x" href="lead"/>' +
      "<script>lead</script></div></body>";
    expect(articleElementHtml(html)).toBe(
      'class="wikios-article-body wikios-article-content"><p>deep</p></div></body>'
    );
  });

  it("is empty for a page with no article element", () => {
    expect(articleElementHtml("<body><p>x</p></body>")).toBe("");
  });
});

describe("ixstatesPath", () => {
  it("returns the path without a trailing slash, empty for a bare host", () => {
    expect(ixstatesPath("https://ixwiki.com/projects/ixstates")).toBe("/projects/ixstates");
    expect(ixstatesPath("https://ixwiki.com/projects/ixstats/")).toBe("/projects/ixstats");
    expect(ixstatesPath("https://ixstates.example")).toBe("");
  });
});

describe("parseArgs", () => {
  it("defaults to the public site with no internal origin", () => {
    expect(parse()).toEqual({
      base: "https://ixwiki.com",
      ixstates: IXSTATES,
      internal: null,
      file: "Example.png",
      image: null,
      upload: null,
      page: "Main_Page",
      revid: "1",
      subpage: "Template:Infobox_country/doc",
      category: "Category:Countries",
      article: "Main_Page",
      articleText: null,
      standalone: false,
    });
  });

  it("reads the flags and trims trailing slashes", () => {
    expect(
      parseArgs(
        [
          "--base",
          "http://127.0.0.1:3560/",
          "--ixstates",
          "https://ixwiki.com/projects/ixstats/",
          "--internal",
          "http://127.0.0.1:8081//",
          "--file",
          "Foo.png",
          "--image",
          "/images/a/ab/Foo.png",
          "--upload",
          "/images/uploads/uploaded_1_abc_Flag.png",
          "--page",
          "Ixnay",
          "--revid",
          "77",
          "--subpage",
          "Template:Foo/doc",
          "--category",
          "Category:X",
          "--article",
          "Long_article",
          "--article-text",
          "A sentence from the body",
          "--standalone",
        ],
        {}
      )
    ).toEqual({
      base: "http://127.0.0.1:3560",
      ixstates: "https://ixwiki.com/projects/ixstats",
      internal: "http://127.0.0.1:8081",
      file: "Foo.png",
      image: "/images/a/ab/Foo.png",
      upload: "/images/uploads/uploaded_1_abc_Flag.png",
      page: "Ixnay",
      revid: "77",
      subpage: "Template:Foo/doc",
      category: "Category:X",
      article: "Long_article",
      articleText: "A sentence from the body",
      standalone: true,
    });
  });

  it("checks the article body text of --page unless --article names another one", () => {
    expect(parse(["--page", "Ixnay", "--article-text", "Some words"])).toMatchObject({
      article: "Ixnay",
      articleText: "Some words",
    });
  });

  it("requires the IxStates URL: there is no default", () => {
    expect(() => parseArgs([], {})).toThrow(/--ixstates is required/);
    expect(() => parseArgs([], { NEXT_PUBLIC_IXSTATES_URL: "  " })).toThrow(
      /--ixstates is required/
    );
  });

  it("reads the IxStates URL from the build environment variable, the flag winning", () => {
    const env = { NEXT_PUBLIC_IXSTATES_URL: "https://ixwiki.com/projects/ixstats" };
    expect(parseArgs([], env).ixstates).toBe("https://ixwiki.com/projects/ixstats");
    expect(parseArgs(["--ixstates", IXSTATES], env).ixstates).toBe(IXSTATES);
  });

  it("rejects a flag without a value, a relative --image and a relative --ixstates", () => {
    expect(() => parseArgs(["--base"], {})).toThrow("--base needs a value");
    expect(() => parse(["--base", "--standalone"])).toThrow("--base needs a value");
    expect(() => parse(["--image", "images/a.png"])).toThrow("--image must be an absolute path");
    expect(() => parse(["--upload", "/images/a/ab/Foo.png"])).toThrow(
      "--upload must be a path under /images/uploads/"
    );
    expect(() => parseArgs(["--ixstates", "/projects/ixstates"], {})).toThrow(
      /--ixstates must be an absolute URL/
    );
  });
});

describe("planChecks", () => {
  it("routes public rows to --base and internal rows to --internal", () => {
    const plan = planChecks(
      parse(["--base", "https://ixwiki.com", "--internal", "http://127.0.0.1:8081"])
    );
    const internal = plan.filter((p) => p.expectation.via === "internal");
    expect(internal.map((p) => p.url)).toEqual([
      "http://127.0.0.1:8081/api.php?action=parse&text=x&contentmodel=wikitext&format=json",
    ]);
    const publicRows = plan.filter((p) => p.expectation.via === "public" && !p.expectation.url);
    expect(publicRows.every((p) => p.url === `https://ixwiki.com${p.expectation.path}`)).toBe(true);
  });

  it("fetches the IxStates row from the configured URL, not from --base", () => {
    const plan = planChecks(parse(["--base", "http://127.0.0.1:3560"]));
    const row = plan.find((p) => p.expectation.name.startsWith("IxStates still reachable"));
    expect(row?.url).toBe(IXSTATES);
  });

  it("marks internal rows skipped when --internal is absent", () => {
    const plan = planChecks(parse());
    expect(plan.filter((p) => p.url === null).map((p) => p.expectation.via)).toEqual(["internal"]);
  });

  it("keeps only the pre-takeover rows with --standalone, render engine included when --internal is given", () => {
    const withoutInternal = planChecks(parse(["--base", "http://127.0.0.1:3560", "--standalone"]));
    expect(withoutInternal.map((p) => p.expectation.path)).toEqual([
      "/",
      "/wiki/Main_Page",
      "/robots.txt",
      "/wiki-sitemap",
      "/wiki/Template:Infobox_country/doc",
      "/wiki/Category:Countries",
      "/wiki/Special:Search?search=x",
      "/wiki/Main_Page?action=raw",
      "/wiki/Main_Page?oldid=1",
      "/w/api.php?action=query&meta=siteinfo&siprop=general&format=json",
      "/w/api.php?action=query&meta=tokens&type=login&format=json",
      "/api/ixtime/current",
      "/maps?embed=true",
      "/maplibre/maplibre-gl-worker.mjs",
      "/flags/metadata.json",
      "/images/flags/placeholder.svg",
      "/fonts/National-Book.otf",
      "/projects/ixstates",
      "/api.php?action=parse&text=x&contentmodel=wikitext&format=json",
    ]);
    expect(withoutInternal.filter((p) => p.url === null)).toHaveLength(1);

    const withInternal = planChecks(
      parse([
        "--base",
        "http://127.0.0.1:3560",
        "--internal",
        "http://127.0.0.1:8081",
        "--standalone",
      ])
    );
    expect(withInternal.filter((p) => p.url === null)).toHaveLength(0);
    expect(withInternal.at(-1)?.url).toMatch(/^http:\/\/127\.0\.0\.1:8081\/api\.php/);
  });
});
