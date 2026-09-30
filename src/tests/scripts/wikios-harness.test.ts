/**
 * @jest-environment node
 */
import {
  METRIC_ORDER,
  renderTable,
  summarize,
  verdict,
  withDerivedSamples,
  type MetricSample,
  type Stats,
  type SummaryRow,
} from "../../../scripts/lib/wikios-bench-summary";
import {
  canonicalLinkTitle,
  classifyLine,
  encodeWikiTitle,
  extractAssetRefs,
  imageFileName,
  isLocalDatabaseUrl,
  lineDiff,
  mean,
  missingFrom,
  normalizeHtml,
  parseHttpUrl,
  parsePageList,
  parseTrpcData,
  percentile,
  samplePages,
  similarity,
  throttledFetch,
  trpcQueryUrl,
  type NormalizedDoc,
} from "../../../scripts/lib/wikios-harness";
import { z } from "zod";

const ARTICLE = `
<div class="mw-parser-output">
  <!-- NewPP limit report: hidden-comment-token -->
  <script>window.hiddenScriptToken = 1;</script>
  <style>.hiddenStyleToken { color: red }</style>
  <table class="infobox vcard"><tr><td>Capital <a href="/wiki/Kagazi_City">Kagazi City</a></td></tr></table>
  <div class="toc" id="toc"><h2>Contents</h2><ul><li>hiddenTocToken</li></ul></div>
  <div class="mw-heading mw-heading2"><h2 id="History">History<span class="mw-editsection">[edit]</span></h2></div>
  <p>Founded in <a href="/projects/ixstats/wiki/Some%20Page#Early" class="mw-redirect">1798</a> and
     <a href="/index.php?title=Missing_Page&amp;action=edit&amp;redlink=1">missing</a>.<sup class="reference"><a href="#cite_note-1">[1]</a></sup></p>
  <a href="/wiki/File:Flag.png"><img src="/images/thumb/a/ab/Flag.png/250px-Flag.png" class="thumbimage"></a>
  <img src="/images/c/cd/Map_of_Kagazi.svg" data-mw="x">
  <table class="wikitable"><tr><td>1</td></tr></table>
</div>`;

describe("normalizeHtml", () => {
  const doc = normalizeHtml(ARTICLE);

  it("drops scripts, styles, comments, section-edit links and the TOC from the text", () => {
    expect(doc.text).not.toMatch(/hiddenScriptToken|hiddenStyleToken|hidden-comment-token|hiddenTocToken|\[edit\]/);
    expect(doc.text).toContain("Founded in 1798 and missing.");
  });

  it("extracts headings, link titles and image file names", () => {
    expect(doc.headings).toEqual(["History"]);
    expect(doc.links).toEqual(["Kagazi City", "Some Page", "Missing Page"]);
    expect(doc.images).toEqual(["Flag.png", "Map of Kagazi.svg"]);
  });

  it("counts tables and references and detects the infobox from the original class", () => {
    expect(doc.tables).toBe(2);
    expect(doc.refs).toBe(1);
    expect(doc.infobox).toBe(true);
    expect(normalizeHtml("<p>plain</p>").infobox).toBe(false);
  });
});

describe("link and image reduction", () => {
  it("reduces a link to its page title", () => {
    expect(canonicalLinkTitle("https://ixwiki.com/wiki/Foo_bar#Section")).toBe("Foo bar");
    expect(canonicalLinkTitle("/wiki/Caf%C3%A9")).toBe("Café");
    expect(canonicalLinkTitle("#cite_note-1")).toBeNull();
    expect(canonicalLinkTitle("mailto:a@b.c")).toBeNull();
  });

  it("keeps the full path after /wiki/ so subpages stay distinct", () => {
    expect(canonicalLinkTitle("/wiki/Foo_Bar/Sub_Page")).toBe("Foo Bar/Sub Page");
    expect(canonicalLinkTitle("/projects/ixstats/wiki/Foo/Bar#Frag")).toBe("Foo/Bar");
    expect(canonicalLinkTitle("/wiki/Foo%2FBar")).toBe("Foo/Bar");
    expect(canonicalLinkTitle("https://ixwiki.com/wiki/History_of_Urcea_(1798-1902)/Early_years/")).toBe(
      "History of Urcea (1798-1902)/Early years"
    );
    expect(canonicalLinkTitle("/index.php?title=Foo/Bar&action=edit&redlink=1")).toBe("Foo/Bar");
  });

  it("reduces an image src to the original file name", () => {
    expect(imageFileName("/images/thumb/a/ab/Foo_Bar.svg/250px-Foo_Bar.svg.png")).toBe("Foo Bar.svg");
    expect(imageFileName("/images/a/ab/Foo.png")).toBe("Foo.png");
    expect(imageFileName("https://cdn.example/300px-Foo.png")).toBe("Foo.png");
  });
});

describe("similarity", () => {
  const a = normalizeHtml(ARTICLE);

  it("scores identical documents 100", () => {
    const scores = similarity(a, normalizeHtml(ARTICLE));
    expect(scores.overall).toBe(100);
    expect(scores.text).toBe(100);
  });

  it("scores disjoint documents below 10", () => {
    const b = normalizeHtml(
      `<h3>Geography</h3><p>Mountains and rivers <a href="/wiki/Other">x</a></p><img src="/images/a/ab/Other.png">`
    );
    expect(similarity(a, b).overall).toBeLessThan(10);
  });

  const doc = (overrides: Partial<NormalizedDoc>): NormalizedDoc => ({
    text: "",
    headings: [],
    links: [],
    images: [],
    tables: 0,
    infobox: false,
    refs: 0,
    ...overrides,
  });

  it("weights text 50, links 20, images 15, headings 10 and structure 5", () => {
    const base = { links: ["A"], images: ["a.png"], headings: ["H"], tables: 1 };
    const scores = similarity(doc({ ...base, text: "same words here" }), doc({ ...base, text: "entirely other tokens" }));
    expect(scores.text).toBe(0);
    expect(scores.overall).toBeCloseTo(50, 5);
    const noLinks = similarity(doc({ ...base, text: "same" }), doc({ ...base, text: "same", links: ["B"] }));
    expect(noLinks.links).toBe(0);
    expect(noLinks.overall).toBeCloseTo(80, 5);
  });

  it("excludes a field that is empty on both sides and re-normalises the weights", () => {
    const scores = similarity(doc({ text: "alpha beta gamma delta" }), doc({ text: "alpha beta" }));
    expect(scores).toMatchObject({ links: null, images: null, headings: null, structure: null });
    expect(scores.text).toBeCloseTo(50, 5);
    expect(scores.overall).toBeCloseTo(50, 5);

    const withLinks = similarity(
      doc({ text: "alpha beta", links: ["A", "B"] }),
      doc({ text: "alpha beta", links: ["A"] })
    );
    // text 100 (weight 50) and links 50 (weight 20) only: (5000 + 1000) / 70
    expect(withLinks.overall).toBeCloseTo(6000 / 70, 5);
  });

  it("still scores a field that is empty on one side only", () => {
    const scores = similarity(doc({ text: "same", images: ["a.png"] }), doc({ text: "same" }));
    expect(scores.images).toBe(0);
    expect(scores.overall).toBeCloseTo((100 * 50) / 65, 5);
  });

  it("scores two empty documents 100", () => {
    expect(similarity(doc({}), doc({})).overall).toBe(100);
  });

  it("reports the first items one side lacks", () => {
    expect(missingFrom(["a", "b", "c", "d"], ["b"], 2)).toEqual(["a", "c"]);
  });
});

describe("statistics", () => {
  it("uses nearest-rank percentiles", () => {
    const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(hundred, 75)).toBe(75);
    expect(percentile(hundred, 50)).toBe(50);
    expect(percentile(hundred, 100)).toBe(100);
    expect(percentile([4, 1, 3, 2], 50)).toBe(2);
    expect(percentile([7], 75)).toBe(7);
    expect(percentile([], 50)).toBeNaN();
  });

  it("averages", () => {
    expect(mean([1, 2, 3, 6])).toBe(3);
    expect(mean([])).toBeNaN();
  });
});

describe("throttledFetch", () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let starts: Array<{ url: string; at: number; init: RequestInit | undefined }>;

  beforeEach(() => {
    jest.useFakeTimers();
    starts = [];
    fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      starts.push({ url: String(input), at: Date.now(), init });
      return new Response("ok", { status: 200 });
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.useRealTimers();
  });

  it("spaces two calls to the same host by at least 1000 ms", async () => {
    const first = throttledFetch("https://spacing.example.test/a", {}, { minIntervalMs: 1000 });
    const second = throttledFetch("https://spacing.example.test/b", {}, { minIntervalMs: 1000 });
    await jest.advanceTimersByTimeAsync(5000);
    const [one, two] = await Promise.all([first, second]);
    expect(one.status).toBe(200);
    expect(two.body).toBe("ok");
    expect(starts).toHaveLength(2);
    expect(starts[1].at - starts[0].at).toBeGreaterThanOrEqual(1000);
  });

  it("does not hold back calls to different hosts", async () => {
    const first = throttledFetch("https://one.example.test/a");
    const second = throttledFetch("https://two.example.test/a");
    await jest.advanceTimersByTimeAsync(10);
    await Promise.all([first, second]);
    expect(starts[1].at - starts[0].at).toBeLessThan(1000);
  });

  it("never goes below one second for ixwiki.com hosts and sends the allowlisted User-Agent", async () => {
    const first = throttledFetch("https://ixwiki.com/api.php", {}, { minIntervalMs: 0 });
    const second = throttledFetch("https://ixwiki.com/wiki/Main_Page", {}, { minIntervalMs: 0 });
    await jest.advanceTimersByTimeAsync(5000);
    await Promise.all([first, second]);
    expect(starts[1].at - starts[0].at).toBeGreaterThanOrEqual(1000);
    expect(new Headers(starts[0].init?.headers).get("user-agent")).toBe("IxStats-Builder");
  });

  it("leaves other hosts' User-Agent alone and honours a shorter interval there", async () => {
    const first = throttledFetch("http://localhost:3000/a", {}, { minIntervalMs: 0 });
    const second = throttledFetch("http://localhost:3000/b", {}, { minIntervalMs: 0 });
    await jest.advanceTimersByTimeAsync(10);
    await Promise.all([first, second]);
    expect(new Headers(starts[0].init?.headers).get("user-agent")).toBeNull();
    expect(starts[1].at - starts[0].at).toBeLessThan(1000);
  });

  it("resolves with status 0 instead of throwing on an invalid or non-http URL", async () => {
    await expect(throttledFetch("not a url")).resolves.toMatchObject({ status: 0, bytes: 0, error: "invalid URL: not a url" });
    await expect(throttledFetch("file:///etc/passwd")).resolves.toMatchObject({ status: 0 });
    await expect(throttledFetch("ftp://example.test/x")).resolves.toMatchObject({ status: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports the body size and times, and resolves with status 0 instead of throwing", async () => {
    const ok = await throttledFetch("https://sizes.example.test/ok", {}, { minIntervalMs: 0 });
    expect(ok.bytes).toBe(2);
    expect(ok.totalMs).toBeGreaterThanOrEqual(ok.ttfbMs);
    fetchSpy.mockRejectedValueOnce(new Error("connection refused"));
    const failed = await throttledFetch("https://sizes.example.test/fail", {}, { minIntervalMs: 0 });
    expect(failed).toMatchObject({ status: 0, bytes: 0, error: "connection refused" });
  });
});

describe("page lists and URLs", () => {
  it("parses a list of titles and rejects anything else", () => {
    expect(parsePageList('["A", "B c"]')).toEqual(["A", "B c"]);
    expect(() => parsePageList("[]")).toThrow();
    expect(() => parsePageList('[1, 2]')).toThrow();
  });

  it("samples evenly and returns everything when the list is short", () => {
    const titles = Array.from({ length: 10 }, (_, i) => `T${i}`);
    expect(samplePages(titles, 5)).toEqual(["T0", "T2", "T4", "T6", "T8"]);
    expect(samplePages(titles, 50)).toEqual(titles);
  });

  it("encodes wiki titles with underscores and readable colons and slashes", () => {
    expect(encodeWikiTitle("Category:Foo Bar/Sub & more")).toBe("Category:Foo_Bar/Sub_%26_more");
  });

  it("builds a non-batched superjson tRPC query URL", () => {
    const url = trpcQueryUrl("http://localhost:3000/", "wikios.getArticleHtml", { title: "A B" });
    expect(url).toBe(
      `http://localhost:3000/api/trpc/wikios.getArticleHtml?input=${encodeURIComponent('{"json":{"title":"A B"}}')}`
    );
  });

  it("reads the tRPC result and error envelopes", () => {
    const schema = z.object({ title: z.string() });
    expect(parseTrpcData('{"result":{"data":{"json":{"title":"X"}}}}', schema)).toEqual({
      ok: true,
      data: { title: "X" },
    });
    expect(parseTrpcData('{"error":{"json":{"message":"NOT_FOUND"}}}', schema)).toEqual({
      ok: false,
      error: "NOT_FOUND",
    });
    expect(parseTrpcData("<html>", schema).ok).toBe(false);
    expect(parseTrpcData('{"result":{"data":{"json":{"nope":1}}}}', schema).ok).toBe(false);
  });

  it("validates URL options and strips trailing slashes", () => {
    expect(parseHttpUrl("https://ixwiki.com/", "--mw")).toBe("https://ixwiki.com");
    expect(parseHttpUrl("http://localhost:3000/projects/ixstats//", "--wikios")).toBe("http://localhost:3000/projects/ixstats");
    expect(parseHttpUrl("https://ixwiki.com/api.php", "--mw-api")).toBe("https://ixwiki.com/api.php");
    expect(() => parseHttpUrl(undefined, "--mw")).toThrow("--mw is required");
    expect(() => parseHttpUrl("", "--mw")).toThrow("--mw is required");
    expect(() => parseHttpUrl("ixwiki.com", "--mw")).toThrow('--mw must be an absolute http(s) URL, got "ixwiki.com"');
    expect(() => parseHttpUrl("ftp://ixwiki.com", "--mw")).toThrow("--mw must be an http(s) URL");
  });

  it("only treats a localhost DATABASE_URL as readable", () => {
    expect(isLocalDatabaseUrl("postgresql://u:p@localhost:5433/ixstats")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u:p@127.0.0.1:5433/ixstats")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u:p@db.example.com:5432/ixstats")).toBe(false);
    expect(isLocalDatabaseUrl("")).toBe(false);
  });

  it("lists script, stylesheet and image references of a page", () => {
    const refs = extractAssetRefs(
      `<link rel="stylesheet" href="/a.css"><script src="b.js"></script><script>inline()</script><img src="x.png"><img src="y.png">`,
      "http://host/wiki/X"
    );
    expect(refs).toEqual({ scripts: ["http://host/wiki/b.js"], stylesheets: ["http://host/a.css"], images: 2 });
  });
});

describe("lineDiff and classifyLine", () => {
  it("returns only the changed lines, numbered in their own text", () => {
    expect(lineDiff("a\nb\nc\nd", "a\nB\nc\nd\ne")).toEqual({
      changes: [
        { kind: "-", lineNo: 2, line: "b" },
        { kind: "+", lineNo: 2, line: "B" },
        { kind: "+", lineNo: 5, line: "e" },
      ],
      truncated: false,
    });
    expect(lineDiff("same\ntext", "same\ntext")).toEqual({ changes: [], truncated: false });
  });

  it("marks a diff truncated when the changed middle exceeds the LCS cap", () => {
    const lines = (prefix: string): string => Array.from({ length: 2100 }, (_, i) => `${prefix}${i}`).join("\n");
    const result = lineDiff(lines("a"), lines("b"));
    expect(result.truncated).toBe(true);
    expect(result.changes).toHaveLength(4200);
    expect(result.changes[0]).toEqual({ kind: "-", lineNo: 1, line: "a0" });
  });

  it("classifies changed lines by construct", () => {
    const cases: Array<[string, string]> = [
      ["{{Infobox country", "template"],
      ["|capital = [[Kagazi City]]", "template"],
      ["}}", "template"],
      ["[[File:Flag.png|thumb|A flag]]", "file"],
      ["See [[Kagazi]] for more", "link"],
      ["{|class=\"wikitable\"", "table"],
      ["|-", "table"],
      ["| style=\"width:5em\" |cell", "table"],
      ["* item", "list"],
      ["== History ==", "heading"],
      ["A claim.<ref>Source</ref>", "ref"],
      ["some ''italic'' text", "bold-italic"],
      ["<div class=\"x\">", "html"],
      ["", "blank"],
      ["just words", "other"],
    ];
    for (const [line, construct] of cases) expect([line, classifyLine(line)]).toEqual([line, construct]);
  });
});

describe("bench summary", () => {
  const sample = (
    system: MetricSample["system"],
    metric: string,
    page: string,
    value: number,
    run = 2
  ): MetricSample => ({ system, metric, phase: run === 1 ? "cold" : "warm", page, run, value });

  const row = (rows: SummaryRow[], metric: string, phase: "warm" | "cold" = "warm"): SummaryRow => {
    const found = rows.find((r) => r.metric === metric && r.phase === phase);
    if (!found) throw new Error(`no row for ${metric}`);
    return found;
  };

  const stats = (p50: number, p75 = p50): Stats => ({ n: 3, p50, p75 });

  it("derives page+data rows: MediaWiki's page against the WikiOS shell plus the data call", () => {
    const samples = [
      sample("mediawiki", "page.ttfbMs", "A", 200),
      sample("mediawiki", "page.totalMs", "A", 300),
      sample("wikios", "page.ttfbMs", "A", 20),
      sample("wikios", "page.totalMs", "A", 50),
      sample("wikios", "data.totalMs", "A", 400),
    ];
    const derived = withDerivedSamples(samples).filter((s) => s.metric.startsWith("page+data."));
    expect(derived.map((s) => [s.system, s.metric, s.value])).toEqual([
      ["mediawiki", "page+data.ttfbMs", 200],
      ["mediawiki", "page+data.totalMs", 300],
      ["wikios", "page+data.ttfbMs", 20],
      ["wikios", "page+data.totalMs", 450],
    ]);
    const rows = summarize(samples);
    expect(row(rows, "page.totalMs").result).toBe("WINS");
    expect(row(rows, "page+data.ttfbMs").result).toBe("WINS");
    expect(row(rows, "page+data.totalMs")).toMatchObject({
      result: "LOSES",
      mediawiki: { p50: 300 },
      wikios: { p50: 450 },
    });
  });

  it("derives no WikiOS page+data sample when the data call did not succeed", () => {
    const derived = withDerivedSamples([
      sample("wikios", "page.ttfbMs", "A", 20),
      sample("wikios", "page.totalMs", "A", 50),
    ]).filter((s) => s.metric.startsWith("page+data."));
    expect(derived).toEqual([]);
  });

  it("gives no verdict for counts and weights", () => {
    const samples = ["page.images", "page.scripts", "page.stylesheets", "page.bytes", "page.assetBytes", "page.weightBytes"].flatMap(
      (metric) => [sample("mediawiki", metric, "A", 100), sample("wikios", metric, "A", 1)]
    );
    const rows = summarize(samples);
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.result === "n/a")).toBe(true);
    expect(verdict("page.images", stats(100), stats(1))).toBe("n/a");
  });

  it("ties within max(5 ms, 5%) for times and 2% for payload bytes", () => {
    expect(verdict("search.totalMs", stats(10), stats(14))).toBe("TIE");
    expect(verdict("search.totalMs", stats(10), stats(16))).toBe("LOSES");
    expect(verdict("page.totalMs", stats(1000), stats(1045))).toBe("TIE");
    expect(verdict("page.totalMs", stats(1000), stats(1100))).toBe("LOSES");
    expect(verdict("page.totalMs", stats(1000), stats(900))).toBe("WINS");
    expect(verdict("search.bytes", stats(1000), stats(1015))).toBe("TIE");
    expect(verdict("search.bytes", stats(1000), stats(1030))).toBe("LOSES");
  });

  it("is MIXED when one percentile wins and the other loses, WINS when the other only ties", () => {
    expect(verdict("history.totalMs", stats(1000, 1000), { n: 3, p50: 800, p75: 1200 })).toBe("MIXED");
    expect(verdict("history.totalMs", stats(1000, 1000), { n: 3, p50: 800, p75: 1000 })).toBe("WINS");
  });

  it("has no verdict for a metric only one system measured", () => {
    expect(verdict("data.totalMs", null, stats(10))).toBe("n/a");
    expect(verdict("data.totalMs", stats(10), null)).toBe("n/a");
  });

  it("compares only the (page, run) pairs that succeeded on both systems and reports n per system", () => {
    const samples = [
      sample("mediawiki", "search.totalMs", "A", 100),
      sample("mediawiki", "search.totalMs", "B", 100),
      sample("mediawiki", "search.totalMs", "C", 1000),
      sample("wikios", "search.totalMs", "A", 10),
      sample("wikios", "search.totalMs", "B", 10),
      sample("wikios", "data.totalMs", "C", 5),
    ];
    const rows = summarize(samples);
    const search = row(rows, "search.totalMs");
    expect(search.mediawiki?.n).toBe(2);
    expect(search.wikios?.n).toBe(2);
    expect(search.mediawiki?.p75).toBe(100);
    expect(row(rows, "data.totalMs")).toMatchObject({ mediawiki: null, wikios: { n: 1 }, result: "n/a" });
    const table = renderTable(rows);
    expect(table).toContain("| Metric | Phase | n (MW/WikiOS) |");
    expect(table).toContain("| search.totalMs | warm | 2/2 |");
    expect(table).toContain("| data.totalMs | warm | -/1 |");
  });

  it("labels run 1 cold and later runs warm, and lists every metric in a fixed order", () => {
    const rows = summarize([
      sample("mediawiki", "search.totalMs", "A", 100, 1),
      sample("wikios", "search.totalMs", "A", 10, 1),
      sample("mediawiki", "search.totalMs", "A", 100, 2),
      sample("wikios", "search.totalMs", "A", 10, 2),
    ]);
    expect(rows.map((r) => r.phase)).toEqual(["warm", "cold"]);
    expect(METRIC_ORDER).toContain("page+data.totalMs");
  });
});
