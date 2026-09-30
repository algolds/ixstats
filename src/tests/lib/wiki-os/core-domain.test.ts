/**
 * core-domain.test.ts — Unit tests for WikiOS Core Domain Services
 */

import { describe, expect, it } from "@jest/globals";
import { ParserFunctionEvaluator } from "~/lib/wiki-os/core/parser-functions";
import { LinkGraphService } from "~/lib/wiki-os/core/link-graph-service";
import { toArticleSlug } from "~/lib/wiki-os/core/domain-types";

describe("WikiOS Domain Types & Slugifier", () => {
  it("normalizes article titles into slugs correctly", () => {
    expect(toArticleSlug("Treaty of Oakhaven")).toBe("treaty_of_oakhaven");
    expect(toArticleSlug("Vesper__Republic")).toBe("vesper_republic");
    expect(toArticleSlug("  Capital City  ")).toBe("capital_city");
  });
});

describe("WikiOS LinkGraphService", () => {
  it("extracts internal wikitext links with labels and section anchors", () => {
    const wikitext =
      "The [[Treaty of Oakhaven|peace treaty]] was signed in [[Vesper#Constitution|the capital]].";
    const links = LinkGraphService.extractLinks(wikitext);

    expect(links).toHaveLength(2);
    expect(links[0]!.targetSlug).toBe("treaty_of_oakhaven");
    expect(links[0]!.anchorText).toBe("peace treaty");
    expect(links[1]!.targetSlug).toBe("vesper");
    expect(links[1]!.sectionAnchor).toBe("Constitution");
  });

  it("filters out File: and Category: links from internal article link graph", () => {
    const wikitext = "[[File:Banner.png|thumb]] [[Category:Treaties]] See [[Vesper]].";
    const links = LinkGraphService.extractLinks(wikitext);

    expect(links).toHaveLength(1);
    expect(links[0]!.targetSlug).toBe("vesper");
  });
});

describe("WikiOS ParserFunctionEvaluator", () => {
  it("evaluates #if expressions correctly", () => {
    expect(ParserFunctionEvaluator.evalIf("some text", "TRUE_VAL", "FALSE_VAL")).toBe("TRUE_VAL");
    expect(ParserFunctionEvaluator.evalIf("", "TRUE_VAL", "FALSE_VAL")).toBe("FALSE_VAL");
    expect(ParserFunctionEvaluator.evalIf("   ", "TRUE_VAL", "FALSE_VAL")).toBe("FALSE_VAL");
  });

  it("evaluates #ifeq expressions correctly", () => {
    expect(ParserFunctionEvaluator.evalIfEq("apple", "apple", "EQUAL", "DIFF")).toBe("EQUAL");
    expect(ParserFunctionEvaluator.evalIfEq("apple", "orange", "EQUAL", "DIFF")).toBe("DIFF");
  });

  it("evaluates #switch expressions correctly", () => {
    const cases = {
      monarchy: "Kingdom",
      republic: "Democratic Republic",
      "#default": "Independent State",
    };

    expect(ParserFunctionEvaluator.evalSwitch("monarchy", cases)).toBe("Kingdom");
    expect(ParserFunctionEvaluator.evalSwitch("republic", cases)).toBe("Democratic Republic");
    expect(ParserFunctionEvaluator.evalSwitch("unknown", cases)).toBe("Independent State");
  });

  it("evaluates #expr safe arithmetic expressions", () => {
    expect(ParserFunctionEvaluator.evalExpr("2 + 2")).toBe("4");
    expect(ParserFunctionEvaluator.evalExpr("10 * (5 - 2)")).toBe("30");
    expect(ParserFunctionEvaluator.evalExpr("2 ^ 3")).toBe("8");
  });
});
