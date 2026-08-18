// src/lib/wiki-os/__tests__/search-service.test.ts
// Unit tests for WikiOS fast search and wikitext summary extractor.

import { describe, it, expect } from "@jest/globals";
import { extractIntroFromWikitext } from "../search-service";

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
