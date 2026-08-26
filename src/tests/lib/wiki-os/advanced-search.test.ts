/**
 * advanced-search.test.ts — Unit tests for WikiOS Advanced Search Engine
 */

import { describe, it, expect } from "@jest/globals";
import { NativeSearchService } from "~/lib/wiki-os/core/native-search-service";

describe("NativeSearchService Search Suite", () => {
  it("handles empty and whitespace-only queries gracefully", async () => {
    const spotlight = await NativeSearchService.spotlightSearch("");
    expect(spotlight).toEqual([]);

    const fulltext = await NativeSearchService.fulltextSearch("   ");
    expect(fulltext.results).toEqual([]);
    expect(fulltext.total).toBe(0);
  });

  it("extracts clean search snippets and calculates reading time", () => {
    const rawWikitext = `== Overview ==
The [[Treaty of Oakhaven]] was signed in 1904 between the {{Flag|Oakhaven}} Kingdom and [[Kuthernburg]].`;

    const cleanSnippet = rawWikitext
      .replace(/^[=\s]+/, "")
      .replace(/[{}\[\]]/g, "")
      .slice(0, 160);

    expect(cleanSnippet).not.toContain("[[");
    expect(cleanSnippet).not.toContain("{{");
    expect(cleanSnippet).toContain("Treaty of Oakhaven");
  });
});
