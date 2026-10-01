import { appendNewSection, NEW_SECTION_HEADING } from "~/lib/wiki-os/wikitext/new-section";
import { findSectionLine } from "~/lib/wiki-os/wikitext/section-locator";

describe("appendNewSection (plan 412: Add topic)", () => {
  it("appends an empty level-2 section after a blank line", () => {
    expect(appendNewSection("Hello.\n")).toBe("Hello.\n\n== New topic ==\n\n");
    expect(appendNewSection("Hello.\n\n\n")).toBe("Hello.\n\n== New topic ==\n\n");
  });

  it("starts the page with the section when there is no text", () => {
    expect(appendNewSection("")).toBe("== New topic ==\n\n");
    expect(appendNewSection("  \n")).toBe("== New topic ==\n\n");
  });

  it("puts the editor's cursor target, the heading, where the section locator finds it", () => {
    const text = appendNewSection("== Earlier ==\nOld topic.");
    expect(findSectionLine(text, NEW_SECTION_HEADING)).toBe(4);
  });
});
