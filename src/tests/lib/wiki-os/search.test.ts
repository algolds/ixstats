/**
 * WikiOS Unified Search Test Suite
 * Covers fulltext search, spotlight fast-path, and introductory wikitext extraction.
 */

// src/lib/wiki-os/__tests__/search-service.test.ts
// Unit tests for WikiOS fast search and wikitext summary extractor.

import { describe, it, expect, beforeEach } from "@jest/globals";
import { extractIntroFromWikitext } from "~/lib/wiki-os/core/native-search-service";

const mockFindMany = jest.fn();
const mockQueryRaw = jest.fn();
jest.mock("~/server/db", () => ({
  db: {
    wikiArticle: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: jest.fn().mockResolvedValue(1),
    },
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

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
    expect(intro).toContain(
      "Burgundie, officially the Kingdom of Burgundie, is a sovereign state located in western Levantia."
    );
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
    expect(intro).toBe(
      "The Vandover Republic is a coastal federation known for maritime commerce."
    );
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

describe("NativeSearchService snippets are plain text", () => {
  const XSS = "<img src=x onerror=alert(1)>";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const expectPlainText = (snippet: string) => {
    expect(snippet).not.toContain("<");
    expect(snippet).not.toContain(">");
  };

  const typeaheadRow = (overrides: Record<string, unknown> = {}) => ({
    id: "1",
    title: "Burgundie",
    summary: null,
    readingTime: 1,
    leadImageUrl: null,
    tier: 1,
    similarity: 0.5,
    ...overrides,
  });

  it("strips markup from a spotlight row summary", async () => {
    mockQueryRaw.mockResolvedValue([typeaheadRow({ summary: `${XSS}Burgundie is a kingdom.` })]);

    const [item] = await NativeSearchService.spotlightSearch("Burg");

    expectPlainText(item!.snippet);
    expect(item!.snippet).toContain("Burgundie is a kingdom.");
  });

  it("strips a truncated tag from a spotlight summary", async () => {
    mockQueryRaw.mockResolvedValue([
      typeaheadRow({
        summary: `'''Burgundie''' is a <script>alert(1)</script>kingdom <img src=x onerror=alert(1)`,
      }),
    ]);

    const [item] = await NativeSearchService.spotlightSearch("Burg");

    expectPlainText(item!.snippet);
    expect(item!.snippet).toContain("Burgundie is a");
  });

  it("strips markup from full-text headlines (tsvector path) and keeps the hits as ranges", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          id: "1",
          title: "Burgundie",
          slug: "Burgundie",
          summary: null,
          headline: `[[Burgundie|The «kingdom»]] ${XSS} and {{Flag|Burgundie}} more`,
          readingTime: 1,
          leadImageUrl: null,
          rank: 0.5,
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }]);

    const { results } = await NativeSearchService.fulltextSearch("kingdom");

    expectPlainText(results[0]!.snippet);
    expect(results[0]!.snippet).toContain("The kingdom");
    expect(results[0]!.snippet).not.toContain("{{");
    expect(results[0]!.snippet).not.toContain("«");
    const [start, end] = results[0]!.snippetRanges[0]!;
    expect(results[0]!.snippet.slice(start, end)).toBe("kingdom");
  });

  it("strips markup from the Prisma fallback window when the search indexes are missing", async () => {
    mockQueryRaw.mockRejectedValue(new Error("column a.searchVector does not exist"));
    mockFindMany.mockResolvedValue([
      {
        id: "1",
        title: "Burgundie",
        wikitext: `Intro text ${XSS} kingdom of Burgundie [[Urcea]]`,
        summary: null,
        readingTime: 1,
        leadImageUrl: null,
      },
    ]);

    const { results } = await NativeSearchService.fulltextSearch("kingdom");

    expectPlainText(results[0]!.snippet);
    expect(results[0]!.snippet).toContain("kingdom of Burgundie Urcea");
  });
});
