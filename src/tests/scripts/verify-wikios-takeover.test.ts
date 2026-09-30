import {
  buildExpectations,
  evaluateExpectation,
  parseArgs,
  planChecks,
  type Expectation,
  type Observation,
} from "../../../scripts/ops/verify-wikios-takeover";

const observed = (partial: Partial<Observation>): Observation => ({
  status: 200,
  location: null,
  body: "",
  ...partial,
});

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
  const rows = buildExpectations({ file: "Example.png", image: null });
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
    expect(byPath("/index.php?title=Foo&action=edit")).toMatchObject({ expectStatus: 200 });
    expect(byPath("/index.php?title=Foo&oldid=1")).toMatchObject({ expectStatus: 301 });
    expect(byPath("/wiki/Special:FilePath/Example.png")).toMatchObject({
      expectStatus: [200, 302],
    });
    expect(byPath("/api.php?action=query&meta=siteinfo&format=json")).toMatchObject({
      expectStatus: 200,
    });
    expect(byPath("/projects/ixstats")).toMatchObject({ expectStatus: { not: 404 } });
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
    expect(rows.some((r) => r.path.startsWith("/images/"))).toBe(false);
    const withImage = buildExpectations({ file: "Example.png", image: "/images/a/ab/Foo.png" });
    expect(withImage.find((r) => r.path === "/images/a/ab/Foo.png")).toMatchObject({
      expectStatus: 200,
      via: "public",
    });
  });

  it("uses the given file name for the Special:FilePath row", () => {
    const custom = buildExpectations({ file: "Flag_of_Ixnay.svg", image: null });
    expect(custom.some((r) => r.path === "/wiki/Special:FilePath/Flag_of_Ixnay.svg")).toBe(true);
  });
});

describe("parseArgs", () => {
  it("defaults to the public site with no internal origin", () => {
    expect(parseArgs([])).toEqual({
      base: "https://ixwiki.com",
      internal: null,
      file: "Example.png",
      image: null,
      standalone: false,
    });
  });

  it("reads the flags and trims trailing slashes", () => {
    expect(
      parseArgs([
        "--base",
        "http://127.0.0.1:3560/",
        "--internal",
        "http://127.0.0.1:8081//",
        "--file",
        "Foo.png",
        "--image",
        "/images/a/ab/Foo.png",
        "--standalone",
      ])
    ).toEqual({
      base: "http://127.0.0.1:3560",
      internal: "http://127.0.0.1:8081",
      file: "Foo.png",
      image: "/images/a/ab/Foo.png",
      standalone: true,
    });
  });

  it("rejects a flag without a value and a relative --image", () => {
    expect(() => parseArgs(["--base"])).toThrow("--base needs a value");
    expect(() => parseArgs(["--base", "--standalone"])).toThrow("--base needs a value");
    expect(() => parseArgs(["--image", "images/a.png"])).toThrow(
      "--image must be an absolute path"
    );
  });
});

describe("planChecks", () => {
  it("routes public rows to --base and internal rows to --internal", () => {
    const plan = planChecks(
      parseArgs(["--base", "https://ixwiki.com", "--internal", "http://127.0.0.1:8081"])
    );
    const internal = plan.filter((p) => p.expectation.via === "internal");
    expect(internal.map((p) => p.origin)).toEqual(["http://127.0.0.1:8081"]);
    expect(
      plan
        .filter((p) => p.expectation.via === "public")
        .every((p) => p.origin === "https://ixwiki.com")
    ).toBe(true);
  });

  it("marks internal rows skipped when --internal is absent", () => {
    const plan = planChecks(parseArgs([]));
    expect(plan.filter((p) => p.origin === null).map((p) => p.expectation.via)).toEqual([
      "internal",
    ]);
  });

  it("keeps only rows a lone WikiOS process satisfies with --standalone", () => {
    const plan = planChecks(parseArgs(["--base", "http://127.0.0.1:3560", "--standalone"]));
    expect(plan.map((p) => p.expectation.path)).toEqual([
      "/",
      "/wiki/Main_Page",
      "/projects/ixstats",
    ]);
    expect(plan.every((p) => p.origin === "http://127.0.0.1:3560")).toBe(true);
  });
});
