/**
 * Tests for toTitleCase - Title-case formatting for display values
 */

import { toTitleCase } from "~/lib/utils";

describe("toTitleCase", () => {
  test("converts lowercase to title case", () => {
    expect(toTitleCase("republic")).toBe("Republic");
    expect(toTitleCase("monarchy")).toBe("Monarchy");
  });

  test("converts multi-word lowercase to title case", () => {
    expect(toTitleCase("constitutional monarchy")).toBe("Constitutional Monarchy");
    expect(toTitleCase("federal republic")).toBe("Federal Republic");
    expect(toTitleCase("parliamentary democracy")).toBe("Parliamentary Democracy");
  });

  test("handles snake_case conversion", () => {
    expect(toTitleCase("federal_republic")).toBe("Federal Republic");
    expect(toTitleCase("constitutional_monarchy")).toBe("Constitutional Monarchy");
  });

  test("handles kebab-case conversion", () => {
    expect(toTitleCase("federal-republic")).toBe("Federal Republic");
    expect(toTitleCase("constitutional-monarchy")).toBe("Constitutional Monarchy");
  });

  test("is idempotent with already-cased values", () => {
    expect(toTitleCase("Republic")).toBe("Republic");
    expect(toTitleCase("Constitutional Monarchy")).toBe("Constitutional Monarchy");
    expect(toTitleCase("Federal Republic")).toBe("Federal Republic");
  });

  test("handles mixed case input", () => {
    expect(toTitleCase("REPUBLIC")).toBe("Republic");
    expect(toTitleCase("RePublic")).toBe("Republic");
    expect(toTitleCase("constitutional MONARCHY")).toBe("Constitutional Monarchy");
  });

  test("handles whitespace edge cases", () => {
    expect(toTitleCase("  republic  ")).toBe("Republic");
    expect(toTitleCase("federal  republic")).toBe("Federal Republic");
    expect(toTitleCase("")).toBe("");
  });

  test("handles single character words", () => {
    expect(toTitleCase("a republic")).toBe("A Republic");
  });
});
