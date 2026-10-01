/** @jest-environment node */
/** Plan 410: numbered sections the way MediaWiki counts and replaces them (action=edit&section=N). */
import {
  locateSection,
  replaceSection,
  sectionHeadings,
  sectionText,
} from "~/lib/wiki-os/wikitext/section-locator";

const PAGE = [
  "Lead text.",
  "",
  "== One ==",
  "one body",
  "",
  "=== One A ===",
  "a body",
  "",
  "== Two ==",
  "two body",
].join("\n");

describe("sectionHeadings", () => {
  it("lists headings with level and text, in order", () => {
    expect(sectionHeadings(PAGE).map(({ level, text }) => [level, text])).toEqual([
      [2, "One"],
      [3, "One A"],
      [2, "Two"],
    ]);
  });

  it("counts a level-1 heading and takes the smaller side of unbalanced equals signs", () => {
    expect(sectionHeadings("= Top =\n=== Odd ==\n").map(({ level, text }) => [level, text])).toEqual([
      [1, "Top"],
      [2, "= Odd"],
    ]);
  });

  it("ignores heading-looking lines inside comments, nowiki and pre", () => {
    const text = "<!--\n== hidden ==\n-->\n<nowiki>\n== also hidden ==\n</nowiki>\n<pre>\n== no ==\n</pre>\n== Real ==\nbody";
    expect(sectionHeadings(text).map((h) => h.text)).toEqual(["Real"]);
  });

  it("accepts a trailing comment after the closing equals signs, and rejects empty headings", () => {
    expect(sectionHeadings("== Title == <!-- note -->\n== ==\n").map((h) => h.text)).toEqual(["Title"]);
  });
});

describe("locateSection and sectionText", () => {
  it("section 0 is the lead", () => {
    expect(sectionText(PAGE, 0)).toBe("Lead text.\n\n");
  });

  it("a section runs to the next heading of the same or higher rank, subsections included", () => {
    expect(sectionText(PAGE, 1)).toBe("== One ==\none body\n\n=== One A ===\na body\n\n");
    expect(sectionText(PAGE, 2)).toBe("=== One A ===\na body\n\n");
    expect(sectionText(PAGE, 3)).toBe("== Two ==\ntwo body");
  });

  it("has no section beyond the last heading", () => {
    expect(locateSection(PAGE, 4)).toBeNull();
    expect(locateSection("no headings", 1)).toBeNull();
    expect(sectionText("no headings", 0)).toBe("no headings");
  });
});

describe("replaceSection", () => {
  it("replaces a section, keeping what follows after a blank line", () => {
    expect(replaceSection(PAGE, 1, "== One ==\nnew body")).toBe(
      "Lead text.\n\n== One ==\nnew body\n\n== Two ==\ntwo body"
    );
  });

  it("replaces a subsection and the last section (the page end is trimmed)", () => {
    expect(replaceSection(PAGE, 2, "=== One A ===\nchanged")).toContain("=== One A ===\nchanged\n\n== Two ==");
    expect(replaceSection(PAGE, 3, "== Two ==\nbye\n\n")).toBe(
      "Lead text.\n\n== One ==\none body\n\n=== One A ===\na body\n\n== Two ==\nbye"
    );
  });

  it("replaces the lead", () => {
    expect(replaceSection(PAGE, 0, "New lead.")).toBe(
      "New lead.\n\n== One ==\none body\n\n=== One A ===\na body\n\n== Two ==\ntwo body"
    );
  });

  it("removes a section when the new text is empty, and answers null for a missing one", () => {
    expect(replaceSection(PAGE, 3, "")).toBe("Lead text.\n\n== One ==\none body\n\n=== One A ===\na body");
    expect(replaceSection(PAGE, 9, "x")).toBeNull();
  });
});
