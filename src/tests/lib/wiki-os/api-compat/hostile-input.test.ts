/** @jest-environment node */
/**
 * Plan 410: nothing a caller sends api.php may take more than linear time. Each hostile text here
 * (an opener that never closes, thousands of spaces, a million brackets) made one of the old
 * regexes backtrack for seconds; every one must now finish well inside a request's budget.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { call, loggedIn, makeWikiDeps, type FakeWikiData } from "./harness";
import { categoryLinks, externalUrls, linkTargets, visibleText } from "~/lib/wiki-os/api-compat/scan";
import { LinkGraphService, wikitextLinks } from "~/lib/wiki-os/core/link-graph-service";
import { computeWikitextDiff, DiffTooLarge } from "~/lib/wiki-os/transformers/wikitext-diff";
import { ProtectedScanner, skipProtectedAt } from "~/lib/wiki-os/wikitext/protected-regions";
import { locateSection, replaceSection, sectionHeadings, sectionText } from "~/lib/wiki-os/wikitext/section-locator";

const N = 200_000;
const BUDGET_MS = 200;

const HOSTILE: Record<string, string> = {
  "category opener and spaces": `[[Category:${" ".repeat(N)}`,
  "category opener, spaces then a key": `[[ ${" ".repeat(N)}Category:a|b`,
  "unclosed link openers": "[[".repeat(N / 2),
  "unclosed link targets": "[[a".repeat(N / 3),
  "unclosed piped links": "[[a|".repeat(N / 4),
  "unclosed section links": "[[a#".repeat(N / 4),
  "unclosed category links": "[[Category:a".repeat(N / 12),
  "unclosed nowiki openers": "<nowiki ".repeat(N / 8),
  "unclosed pre and ref openers": "<pre <ref <gallery ".repeat(N / 18),
  "nowiki openers with attributes": '<nowiki a="'.repeat(N / 11),
  "heading marks": "== ".repeat(N / 3),
  "a line of equals signs": "=".repeat(N),
  "headings with trailing space": "== a ==  \n".repeat(N / 10),
  "bare addresses": "http://".repeat(N / 7),
  "quotes": "'''''".repeat(N / 5),
  "braces": "{{".repeat(N / 2),
  "a long run of closed links": "[[a]]".repeat(N / 5),
  "distinct closed links": Array.from({ length: N / 12 }, (_, i) => `[[Page ${i}]]`).join(""),
};

for (const [name, text] of Object.entries(HOSTILE)) HOSTILE[name] = text.slice(0, N);

const timed = <T>(run: () => T): { value: T; ms: number } => {
  const start = performance.now();
  const value = run();
  return { value, ms: performance.now() - start };
};

describe("the wikitext scanners are linear", () => {
  for (const [name, text] of Object.entries(HOSTILE)) {
    it(`finish ${name} in under ${BUDGET_MS} ms`, () => {
      const { ms } = timed(() => {
        linkTargets(text, 5001);
        categoryLinks(text, 1001);
        externalUrls(text, 500);
        visibleText(text.slice(0, 1000));
        sectionHeadings(text);
        locateSection(text, 1);
        sectionText(text, 0);
        replaceSection(text, 0, "x");
        LinkGraphService.extractLinks(text);
        const scanner = new ProtectedScanner(text);
        for (let i = 0; i < text.length; i += 1) {
          if (text.charCodeAt(i) === 60 /* < */) skipProtectedAt(text, i, true, scanner);
        }
      });
      expect(ms).toBeLessThan(BUDGET_MS * 4); // nine scans of one text
    });
  }

  it("scans a two-megabyte page (the most an edit may send) of unclosed openers in under a second", () => {
    const text = "<nowiki [[a== ".repeat(2_000_000 / 14);
    const { ms } = timed(() => {
      sectionHeadings(text);
      replaceSection(text, 3, "new");
      LinkGraphService.extractLinks(text);
    });
    expect(ms).toBeLessThan(1000);
  });
});

/** The same characters in a new string object (a text read from the database again is one). */
const freshCopy = (text: string) => text.split("").join("");

describe("no scan keeps state keyed on a text's content", () => {
  const hostile = "<nowiki ".repeat(125_000);

  it("scans an equal copy of a hostile text as fast as the first (a content comparison per `<` was quadratic)", () => {
    const first = timed(() => sectionHeadings(hostile));
    const copy = freshCopy(hostile);
    expect(copy).toBe(hostile);
    const second = timed(() => sectionHeadings(copy));
    const third = timed(() => sectionHeadings(freshCopy(hostile)));
    expect(first.ms).toBeLessThan(200);
    expect(second.ms).toBeLessThan(200);
    expect(third.ms).toBeLessThan(200);
  });

  it("does the same for section locating and replacing, and for the tag lookups themselves", () => {
    for (let round = 0; round < 3; round++) {
      const text = freshCopy(hostile);
      const { ms } = timed(() => {
        locateSection(text, 1);
        replaceSection(text, 0, "x");
        const scanner = new ProtectedScanner(text);
        for (let i = text.indexOf("<"); i !== -1; i = text.indexOf("<", i + 1)) skipProtectedAt(text, i, true, scanner);
      });
      expect(ms).toBeLessThan(400);
    }
  });

  it("answers an anonymous parse&page= of a stored hostile page quickly, request after request", async () => {
    const wiki = await makeWikiDeps({ pages: [{ pageId: 1, title: "Hostile", wikitext: hostile }], revisions: [{ revId: 1, page: "Hostile", timestamp: "2026-01-01T00:00:00Z", content: hostile }], html: { Hostile: "<p>stored</p>" } });
    for (let round = 0; round < 3; round++) {
      // each request reads the page's text again: a new string with the same content
      wiki.data.pages![0]!.wikitext = freshCopy(hostile);
      const start = performance.now();
      const body = (await call(wiki.deps, "action=parse&page=Hostile&prop=text|sections|categories|links|displaytitle|properties&formatversion=2")).body as Record<string, any>;
      expect(performance.now() - start).toBeLessThan(400);
      expect(body.parse.title).toBe("Hostile");
    }
  });

  it("does the same for edit&section=N of the stored hostile text", async () => {
    const wiki = await makeWikiDeps({ pages: [{ pageId: 1, title: "Hostile", wikitext: hostile }], revisions: [{ revId: 1, page: "Hostile", timestamp: "2026-01-01T00:00:00Z", user: "Heku", content: hostile }] });
    const token = await loggedIn(wiki.bot);
    for (let round = 0; round < 3; round++) {
      wiki.data.pages![0]!.wikitext = freshCopy(hostile);
      const start = performance.now();
      const body = (await wiki.bot.post({ action: "edit", title: "Hostile", section: "1", text: "== One ==\nx", token, formatversion: "2" })) as Record<string, any>;
      expect(performance.now() - start).toBeLessThan(400);
      expect(body.error.code).toBe("nosuchsection");
    }
  });
});

describe("the link scanner keeps the old regex's answers", () => {
  const OLD = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
  const viaRegex = (text: string) => [...text.matchAll(OLD)].map((m) => ({ target: m[1]!, section: m[2], label: m[3] }));
  const viaScanner = (text: string) => [...wikitextLinks(text)].map(({ target, section, label }) => ({ target, section, label }));

  it("finds the same links, sections and labels over random texts of brackets, bars and hashes", () => {
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    const alphabet = ["[[", "]]", "[", "]", "|", "#", "a", "b c", "\n", "Category:", " "];
    for (let round = 0; round < 5000; round++) {
      const text = Array.from({ length: 1 + (next() % 24) }, () => alphabet[(next() >> 8) % alphabet.length]).join("");
      expect(viaScanner(text)).toEqual(viaRegex(text));
    }
  });

  it("matches the regex on the shapes that matter", () => {
    const cases: Array<[string, Array<[string, string | undefined, string | undefined]>]> = [
      ["[[A]]", [["A", undefined, undefined]]],
      ["[[A|b]]", [["A", undefined, "b"]]],
      ["[[A#S|b]]", [["A", "S", "b"]]],
      ["[[A#S]]", [["A", "S", undefined]]],
      ["[[[A]]", [["[A", undefined, undefined]]],
      ["[[A|]]", []],
      ["[[A#]]", []],
      ["[[A|b]c]]", []],
      ["[[A\nB]]", [["A\nB", undefined, undefined]]],
      ["x [[A]] y [[B|c]] z", [["A", undefined, undefined], ["B", undefined, "c"]]],
    ];
    for (const [text, expected] of cases) {
      expect(viaScanner(text).map((l) => [l.target, l.section, l.label])).toEqual(expected);
      expect(viaRegex(text).map((l) => [l.target, l.section, l.label])).toEqual(expected);
    }
  });

  it("builds the graph's links as before", () => {
    const links = LinkGraphService.extractLinks("[[Beta|b]] [[Beta]] [[Gamma#Part|g]] [[File:X.png]] [[Category:Y]]");
    expect(links.map((l) => [l.targetTitle, l.sectionAnchor, l.anchorText])).toEqual([
      ["Beta", undefined, "b"],
      ["Gamma", "Part", "g"],
    ]);
  });
});

describe("the diff is linear and bounded", () => {
  const lines = (count: number, tag: string) => Array.from({ length: count }, (_, i) => `${tag} line ${i}`).join("\n");

  it("diffs two 100,000-line texts that share nothing in under 500 ms", () => {
    const { ms } = timed(() => computeWikitextDiff(lines(100_000, "old"), lines(100_000, "new")));
    expect(ms).toBeLessThan(500);
  });

  it("diffs two 100,000-line texts that differ in every tenth line in under 500 ms", () => {
    const old = Array.from({ length: 100_000 }, (_, i) => `row ${i}`);
    const changed = old.map((line, i) => (i % 10 === 0 ? `${line} changed` : line));
    const { ms } = timed(() => computeWikitextDiff(old.join("\n"), changed.join("\n")));
    expect(ms).toBeLessThan(500);
  });

  it("diffs identical 100,000-line texts and an empty text against a large one quickly", () => {
    const text = lines(100_000, "same");
    expect(timed(() => computeWikitextDiff(text, text)).ms).toBeLessThan(500);
    expect(timed(() => computeWikitextDiff("", text)).ms).toBeLessThan(500);
  });

  it("stops with DiffTooLarge as soon as the rows pass the limit, without building the rest", () => {
    const { ms } = timed(() => {
      expect(() => computeWikitextDiff(lines(100_000, "old"), lines(100_000, "new"), { maxOutputChars: 2 * 1024 * 1024 })).toThrow(DiffTooLarge);
    });
    expect(ms).toBeLessThan(500);
  });

  it("keeps the format for a small diff", () => {
    const html = computeWikitextDiff("a\nb\nc", "a\nB\nc", { maxOutputChars: 10_000 });
    expect(html).toContain("diff-deletedline");
    expect(html).toContain("diff-addedline");
    expect(computeWikitextDiff("same", "same")).not.toContain("diff-addedline");
  });
});

describe("action=parse and action=compare over hostile text", () => {
  const WIKI = (): FakeWikiData => ({ pages: [{ pageId: 1, title: "Alpha", wikitext: "x" }], revisions: [{ revId: 1, page: "Alpha", timestamp: "2026-01-01T00:00:00Z", content: "x" }] });
  const PARSE_PROPS = "text|links|categories|sections|displaytitle|externallinks|properties|wikitext";

  async function bot() {
    const wiki = await makeWikiDeps(WIKI());
    await loggedIn(wiki.bot);
    return wiki;
  }
  const form = (params: Record<string, string>) => ({ ...params, formatversion: "2" });

  for (const [name, text] of Object.entries(HOSTILE)) {
    it(`parse&text= answers ${name} in under ${BUDGET_MS} ms`, async () => {
      const wiki = await bot();
      const start = performance.now();
      const body = (await wiki.bot.post(form({ action: "parse", text, prop: PARSE_PROPS }))) as Record<string, any>;
      expect(performance.now() - start).toBeLessThan(BUDGET_MS);
      expect(body.error).toBeUndefined();
      expect(body.parse.links.length).toBeLessThanOrEqual(5000);
      expect(body.parse.categories.length).toBeLessThanOrEqual(1000);
      expect(body.parse.sections.length).toBeLessThanOrEqual(5000);
    });
  }

  it("section edits of hostile text are linear too (edit&section=N)", async () => {
    const wiki = await bot();
    const token = ((await wiki.bot.get({ action: "query", meta: "tokens", formatversion: "2" })) as any).query.tokens.csrftoken;
    const start = performance.now();
    const body = (await wiki.bot.post(form({ action: "edit", title: "Alpha", section: "1", text: "<nowiki ".repeat(25_000), token }))) as Record<string, any>;
    expect(performance.now() - start).toBeLessThan(BUDGET_MS * 2);
    expect(body.error?.code).toBe("nosuchsection");
  });

  it("compare of two 100,000-line texts answers in under 500 ms, or says toobig", async () => {
    const wiki = await makeWikiDeps(WIKI(), { services: { diff: computeWikitextDiff } });
    const side = (tag: string) => Array.from({ length: 100_000 }, (_, i) => `${tag}${i}`).join("\n").slice(0, 199_999);
    const start = performance.now();
    const body = (await call(wiki.deps, `action=compare&formatversion=2`, { method: "POST", body: { fromtext: side("a"), totext: side("b") } })).body as Record<string, any>;
    expect(performance.now() - start).toBeLessThan(500);
    expect(body.compare?.body ?? body.error.code).toBeTruthy();
  });
});
