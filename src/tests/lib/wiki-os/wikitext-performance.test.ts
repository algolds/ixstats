/** @jest-environment node */
/**
 * wikitext-performance.test.ts — the parser stays linear on input made of openers that never close,
 * and the one-pass match index agrees with the forward scan it replaces.
 */

import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findMatchingClosingBraces, findMatchingClosingBrackets } from "~/lib/wiki-os/wikitext/link-parser";
import { UNINDEXED, matchBraces, matchBrackets } from "~/lib/wiki-os/wikitext/match-index";
import { parse } from "~/lib/wiki-os/wikitext/parser";

const BUDGET_MS = 200 * TIMING_BUDGET_SCALE;

function parseMs(input: string): number {
  const started = performance.now();
  parse(input);
  return performance.now() - started;
}

describe("parser time on adversarial input", () => {
  it("parses 5,000 unmatched [[a lines in under 200 ms", () => {
    // One real "]]" at the very end defeats any "no closer left" shortcut.
    const input = "[[a\n".repeat(5000) + "b]]";
    expect(parseMs(input)).toBeLessThan(BUDGET_MS);
    expect(parseMs("[[a\n".repeat(5000))).toBeLessThan(BUDGET_MS);
    expect(parseMs("[[a ".repeat(5000) + "]]")).toBeLessThan(BUDGET_MS);
  });

  it("parses 5,000 paragraphs with an unclosed {{ in under 200 ms", () => {
    const input = "Text {{ open\n\n".repeat(5000) + "}}";
    expect(parseMs(input)).toBeLessThan(BUDGET_MS);
    expect(parseMs("Text {{ open ".repeat(5000) + "}}")).toBeLessThan(BUDGET_MS);
  });

  it("parses 5,000 unclosed {{ at line starts, inside a table, and inside a list in under 200 ms", () => {
    expect(parseMs("{{ open\n\n".repeat(5000) + "}}")).toBeLessThan(BUDGET_MS);
    expect(parseMs("{|\n" + "| {{ open\n".repeat(5000) + "|}\n}}")).toBeLessThan(BUDGET_MS);
    expect(parseMs("* {{ open\n".repeat(5000) + "}}")).toBeLessThan(BUDGET_MS);
  });

  it("still parses a large ordinary page quickly", () => {
    const dir = join(__dirname, "../../fixtures/wikitext");
    const page = readFileSync(join(dir, "real-solcordia.wiki"), "utf8").repeat(20);
    expect(parseMs(page)).toBeLessThan(BUDGET_MS * 2);
  });
});

describe("parser time with unclosed tags (re-verification item 9)", () => {
  /** About 2 MB: 10,000 repetitions of a ~200 character chunk holding one tag that is never closed. */
  const FILLER = "Some ordinary sentence of running text that goes on for a while. ".repeat(3);
  const big = (chunk: (filler: string) => string): string => chunk(FILLER).repeat(10_000);

  it.each(["nowiki", "ref", "pre", "math", "gallery", "poem", "syntaxhighlight"])(
    "parses 2 MB with 10,000 unclosed <%s> tags in under 300 ms",
    (tag) => {
      const inline = big((filler) => `${filler}<${tag}> x\n`);
      const blocks = big((filler) => `<${tag}>\n${filler}\n\n`);
      expect(inline.length).toBeGreaterThan(1_900_000);
      expect(parseMs(inline)).toBeLessThan(300 * TIMING_BUDGET_SCALE);
      expect(parseMs(blocks)).toBeLessThan(300 * TIMING_BUDGET_SCALE);
      // a single closing tag at the very end must not make every earlier tag scan to it
      expect(parseMs(`${inline}</${tag}>`)).toBeLessThan(300 * TIMING_BUDGET_SCALE);
    }
  );

  it("still pairs each opening tag with the next closing tag", () => {
    const { ast } = parse("<nowiki>{{a}}</nowiki>\n\n<nowiki>open\n\n<nowiki>{{b}}</nowiki>");
    // the second <nowiki> runs to the only closing tag after it, as it always did (they do not nest)
    expect(ast.nodes.map((n) => n.raw)).toEqual([
      "<nowiki>{{a}}</nowiki>",
      "<nowiki>open\n\n<nowiki>{{b}}</nowiki>",
    ]);
  });
});

describe("match index", () => {
  const PIECES = ["{{", "}}", "[[", "]]", "{", "}", "[", "]", "<!--", "-->", "a", " ", "\n", "|", "{{{", "}}}", "<nowiki>"];

  function randomText(seed: number): string {
    let state = seed;
    let out = "";
    for (let n = 0; n < 40; n++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      out += PIECES[state % PIECES.length];
    }
    return out;
  }

  it("answers exactly like the forward scan wherever it has an answer", () => {
    let indexed = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const text = randomText(seed);
      const braces = matchBraces(text);
      const brackets = matchBrackets(text);
      for (let i = 0; i < text.length; i++) {
        if (text.startsWith("{{", i) && braces[i] !== UNINDEXED) {
          expect(braces[i]).toBe(findMatchingClosingBraces(text, i));
          indexed++;
        }
        if (text.startsWith("[[", i) && brackets[i] !== UNINDEXED) {
          expect(brackets[i]).toBe(findMatchingClosingBrackets(text, i));
          indexed++;
        }
      }
    }
    expect(indexed).toBeGreaterThan(5000);
  });

  it("gives the same answer through the public functions with or without the index", () => {
    const fixtures = readdirSync(join(__dirname, "../../fixtures/wikitext")).filter((n) => n.endsWith(".wiki"));
    for (const name of fixtures) {
      const text = readFileSync(join(__dirname, "../../fixtures/wikitext", name), "utf8");
      const braces = matchBraces(text);
      const brackets = matchBrackets(text);
      for (let i = 0; i < text.length; i++) {
        if (text.startsWith("{{", i)) expect(findMatchingClosingBraces(text, i, braces)).toBe(findMatchingClosingBraces(text, i));
        if (text.startsWith("[[", i)) expect(findMatchingClosingBrackets(text, i, brackets)).toBe(findMatchingClosingBrackets(text, i));
      }
    }
  });
});
