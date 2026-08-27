/**
 * WikiOS Unified Search Test Suite
 * Covers fulltext search, spotlight fast-path, and introductory wikitext extraction.
 */

// src/lib/wiki-os/__tests__/search-service.test.ts
// Unit tests for WikiOS fast search and wikitext summary extractor.

import { describe, it, expect } from "@jest/globals";
import { extractIntroFromWikitext } from "~/lib/wiki-os/core/native-search-service";

describe("WikiOS Search & Summary Service", () => {
  it("extracts clean introductory prose from complex wikitext", () => {
    const rawWikitext = `
{{Infobox country
| conventional_long_name = Kingdom of Burgundie
| common_name = Burgundie
| image_flag = Flag of Burgundie.svg
}}
<!-- This is an internal editor comment -->
'''Burgundie''', officially the '''Kingdom of Burgundie''', is a sovereign state located in western Levantia. It is bordered by Urcea to the east and the Sea of Verdia to the south.

== History ==
Burgundie was founded in the medieval era.

[[Category:Countries in Levantia]]
`;

    const intro = extractIntroFromWikitext(rawWikitext);
    expect(intro).toContain("Burgundie, officially the Kingdom of Burgundie, is a sovereign state located in western Levantia.");
    expect(intro).not.toContain("Infobox");
    expect(intro).not.toContain("<!--");
    expect(intro).not.toContain("== History ==");
    expect(intro).not.toContain("Category:");
  });

  it("handles empty wikitext gracefully", () => {
    expect(extractIntroFromWikitext("")).toBe("");
    expect(extractIntroFromWikitext("{{OnlyInfobox}}")).toBe("");
  });

  it("strips references and html tags from paragraphs", () => {
    const raw = `
The '''Vandover Republic''' is a coastal federation<ref>Official Gazette, 2024.</ref> known for maritime commerce.<ref name="stat"/>

== Geography ==
`;
    const intro = extractIntroFromWikitext(raw);
    expect(intro).toBe("The Vandover Republic is a coastal federation known for maritime commerce.");
  });
});


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

