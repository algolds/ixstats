/** @jest-environment node */
/**
 * wikitext-performance.test.ts — the parser stays linear on input made of openers that never close,
 * and the one-pass match index agrees with the forward scan it replaces.
 */

import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findMatchingClosingBraces, findMatchingClosingBrackets } from "~/lib/wiki-os/wikitext/link-parser";
import { matchBraces, matchBrackets } from "~/lib/wiki-os/wikitext/match-index";
import { parse } from "~/lib/wiki-os/wikitext/parser";

const BUDGET_MS = 200 * TIMING_BUDGET_SCALE;

function parseMs(input: string): number {
  const started = performance.now();
  parse(input);
  return performance.now() - started;
}

describe("parser time on adversarial input", () => {
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
