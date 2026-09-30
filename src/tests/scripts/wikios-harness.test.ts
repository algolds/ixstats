/**
 * @jest-environment node
 */
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
  parsePageList,
  parseTrpcData,
  percentile,
  samplePages,
  similarity,
  throttledFetch,
  trpcQueryUrl,
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

  it("weights text 50, links 20, images 15, headings 10 and structure 5", () => {
    const base = normalizeHtml("<p>same words here</p>");
    const textOnly = normalizeHtml("<p>entirely other tokens</p>");
    expect(similarity(base, textOnly).overall).toBeCloseTo(50, 5);
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
    expect(lineDiff("a\nb\nc\nd", "a\nB\nc\nd\ne")).toEqual([
      { kind: "-", lineNo: 2, line: "b" },
      { kind: "+", lineNo: 2, line: "B" },
      { kind: "+", lineNo: 5, line: "e" },
    ]);
    expect(lineDiff("same\ntext", "same\ntext")).toEqual([]);
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
