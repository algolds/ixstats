/**
 * core-domain.test.ts — Unit tests for WikiOS Core Domain Services
 */

import { describe, expect, it } from "@jest/globals";
import { ParserFunctionEvaluator } from "~/lib/wiki-os/core/parser-functions";
import { toArticleSlug } from "~/lib/wiki-os/core/domain-types";

describe("WikiOS Domain Types & Slugifier", () => {
  it("normalizes article titles into slugs correctly", () => {
    expect(toArticleSlug("Treaty of Oakhaven")).toBe("treaty_of_oakhaven");
    expect(toArticleSlug("Vesper__Republic")).toBe("vesper_republic");
    expect(toArticleSlug("  Capital City  ")).toBe("capital_city");
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
