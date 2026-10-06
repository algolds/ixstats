/** @jest-environment node */
/**
 * Plan 410: nothing a caller sends api.php may take more than linear time. Each hostile text here
 * (an opener that never closes, thousands of spaces, a million brackets) made one of the old
 * regexes backtrack for seconds; every one must now finish well inside a request's budget.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";
import { call, loggedIn, makeWikiDeps, type FakeWikiData } from "./harness";
import { categoryLinks, externalUrls, linkTargets, visibleText } from "~/lib/wiki-os/api-compat/scan";
import { diffTableHtml } from "~/lib/wiki-os/api-compat/diff-table";
import { DiffTooLargeError, diffWikitext } from "~/lib/wiki-os/transformers/wikitext-diff";
import { ProtectedScanner, skipProtectedAt } from "~/lib/wiki-os/wikitext/protected-regions";
import { locateSection, replaceSection, sectionHeadings, sectionText } from "~/lib/wiki-os/wikitext/section-locator";

const N = 200_000;
const BUDGET_MS = 200 * TIMING_BUDGET_SCALE;

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
    });
    expect(ms).toBeLessThan(1000 * TIMING_BUDGET_SCALE);
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
    expect(first.ms).toBeLessThan(200 * TIMING_BUDGET_SCALE);
    expect(second.ms).toBeLessThan(200 * TIMING_BUDGET_SCALE);
    expect(third.ms).toBeLessThan(200 * TIMING_BUDGET_SCALE);
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
      expect(ms).toBeLessThan(400 * TIMING_BUDGET_SCALE);
    }
  });

  it("answers an anonymous parse&page= of a stored hostile page quickly, request after request", async () => {
    const wiki = await makeWikiDeps({ pages: [{ pageId: 1, title: "Hostile", wikitext: hostile }], revisions: [{ revId: 1, page: "Hostile", timestamp: "2026-01-01T00:00:00Z", content: hostile }], html: { Hostile: "<p>stored</p>" } });
    for (let round = 0; round < 3; round++) {
      // each request reads the page's text again: a new string with the same content
      wiki.data.pages![0]!.wikitext = freshCopy(hostile);
      const start = performance.now();
      const body = (await call(wiki.deps, "action=parse&page=Hostile&prop=text|sections|categories|links|displaytitle|properties&formatversion=2")).body as Record<string, any>;
      expect(performance.now() - start).toBeLessThan(400 * TIMING_BUDGET_SCALE);
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
      expect(performance.now() - start).toBeLessThan(400 * TIMING_BUDGET_SCALE);
      expect(body.error.code).toBe("nosuchsection");
    }
  });
});

describe("the compare table over plan 413's diff engine is bounded", () => {
  const lines = (count: number, tag: string) => Array.from({ length: count }, (_, i) => `${tag} line ${i}`).join("\n");
  const table = (oldText: string, newText: string) => diffTableHtml(diffWikitext(oldText, newText, { context: 2 }), 2 * 1024 * 1024);
  const toobig = (run: () => unknown) => {
    try {
      run();
    } catch (error) {
      return (error as { code?: string }).code;
    }
    return undefined;
  };

  it("refuses two 100,000-line texts as toobig in under 500 ms, whether they share nothing or every tenth line differs", () => {
    const old = Array.from({ length: 100_000 }, (_, i) => `row ${i}`);
    const changed = old.map((line, i) => (i % 10 === 0 ? `${line} changed` : line));
    for (const [from, to] of [[lines(100_000, "old"), lines(100_000, "new")], [old.join("\n"), changed.join("\n")]] as const) {
      const { ms, value } = timed(() => toobig(() => table(from, to)));
      expect(ms).toBeLessThan(500 * TIMING_BUDGET_SCALE);
      expect(value).toBe("toobig");
    }
  });

  it("refuses a diff the engine had to cut (more rows than one answer carries) rather than show a smaller change", () => {
    const old = Array.from({ length: 19_000 }, (_, i) => `row ${i}`);
    const changed = old.map((line, i) => (i % 3 === 0 ? `${line} changed` : line));
    const { ms, value } = timed(() => toobig(() => table(old.join("\n"), changed.join("\n"))));
    expect(value).toBe("toobig");
    expect(ms).toBeLessThan(1000 * TIMING_BUDGET_SCALE);
  });

  it("shows at most two unchanged lines on each side of a change (MediaWiki's context), even in a 19,000-line page", () => {
    const old = Array.from({ length: 19_000 }, (_, i) => `row ${i}`);
    const changed = [...old];
    changed[9_500] = "row 9500 changed";
    const { ms, value } = timed(() => table(old.join("\n"), changed.join("\n")));
    expect(ms).toBeLessThan(500 * TIMING_BUDGET_SCALE);
    const rows = value.split("\n");
    // 2 before, the removed line, the added line, 2 after
    expect(rows).toHaveLength(6);
    for (const line of ["row 9498", "row 9499", "row 9501", "row 9502"]) expect(value).toContain(`>${line}<`);
    expect(value).not.toContain(">row 9497<");
    expect(value).not.toContain(">row 9503<");
  });

  it("keeps both ends of a long unchanged block between two changes, and all of a short one", () => {
    const text = (middle: number) => ["start", ...Array.from({ length: middle }, (_, i) => `m${i}`), "end"];
    const diff = (middle: number) => {
      const a = text(middle);
      const b = [...a];
      b[0] = "START";
      b[b.length - 1] = "END";
      return table(a.join("\n"), b.join("\n"));
    };
    expect(diff(4).match(/diff-context/g)!.length / 2).toBe(4);
    const long = diff(10);
    expect(long.match(/diff-context/g)!.length / 2).toBe(4);
    for (const kept of ["m0", "m1", "m8", "m9"]) expect(long).toContain(`>${kept}<`);
    expect(long).not.toContain(">m5<");
  });

  it("answers identical texts, however long, with the no-changes row", () => {
    const text = lines(19_000, "row");
    expect(timed(() => table(text, text)).value).toContain("No changes");
    expect(table("", "")).toContain("No changes");
  });

  it("refuses a text over 2 MB (DiffTooLargeError is the engine's) and a table past 2 MB", () => {
    expect(() => diffWikitext("a".repeat(2 * 1024 * 1024 + 1), "b")).toThrow(DiffTooLargeError);
    const diff = diffWikitext("x", "y", { context: 2 });
    expect(toobig(() => diffTableHtml(diff, 100))).toBe("toobig");
    expect(diffTableHtml(diff, 10_000)).toContain("diff-addedline");
  });

  it("lays a changed line out as MediaWiki does: the differing words inside ins and del, everything escaped", () => {
    const html = table("a\nthe <b>old</b> text\nz", "a\nthe <i>new</i> text\nz");
    expect(html).toContain('<td class="diff-deletedline">');
    expect(html).toContain('<td class="diff-addedline">');
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<i>");
    expect(html).toMatch(/<del class="diffchange diffchange-inline">[^<]*b[^<]*<\/del>/);
    expect(html).toMatch(/<ins class="diffchange diffchange-inline">[^<]*i[^<]*<\/ins>/);
    // a pure addition or removal carries its whole line
    expect(table("a", "a\nnew")).toContain('<td class="diff-addedline"><ins class="diffchange diffchange-inline">new</ins></td>');
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

  it("compare of two near-identical big revisions answers with its context, not toobig", async () => {
    const lines = Array.from({ length: 19_000 }, (_, i) => `line ${i}`);
    const edited = [...lines];
    edited[9_500] = "line 9500 edited";
    const wiki = await makeWikiDeps(
      { pages: [{ pageId: 1, title: "Big" }], revisions: [
        { revId: 1, page: "Big", timestamp: "2026-01-01T00:00:00Z", content: lines.join("\n") },
        { revId: 2, page: "Big", timestamp: "2026-01-02T00:00:00Z", content: edited.join("\n") },
      ] },
    );
    const start = performance.now();
    const body = (await call(wiki.deps, "action=compare&fromrev=1&torev=2&formatversion=2")).body as Record<string, any>;
    expect(performance.now() - start).toBeLessThan(2000 * TIMING_BUDGET_SCALE);
    expect(body.error).toBeUndefined();
    expect(body.compare.body.split("\n")).toHaveLength(6);
  }, 30_000);

  it("compare of two 100,000-line texts answers in under 500 ms, or says toobig", async () => {
    const wiki = await makeWikiDeps(WIKI());
    const side = (tag: string) => Array.from({ length: 100_000 }, (_, i) => `${tag}${i}`).join("\n").slice(0, 199_999);
    const start = performance.now();
    const body = (await call(wiki.deps, `action=compare&formatversion=2`, { method: "POST", body: { fromtext: side("a"), totext: side("b") } })).body as Record<string, any>;
    expect(performance.now() - start).toBeLessThan(500 * TIMING_BUDGET_SCALE);
    expect(body.compare?.body ?? body.error.code).toBeTruthy();
  });
});
