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

describe("offsets stay true around characters outside the BMP", () => {
  const PAGE_WITH_EMOJI = "Lead <!-- note \u{1F600}\u{1F600} -->\n\n== One ==\nbody one\n\n== Two ==\nbody two";

  it("masks a comment with astral characters one space per UTF-16 unit, so headings keep their offsets", () => {
    const headings = sectionHeadings(PAGE_WITH_EMOJI);
    expect(headings.map((h) => PAGE_WITH_EMOJI.slice(h.start, h.start + 3 + h.text.length))).toEqual(["== One", "== Two"]);
  });

  it("replaces section 1 without touching the lead or section 2", () => {
    expect(replaceSection(PAGE_WITH_EMOJI, 1, "== One ==\nREPLACED")).toBe(
      "Lead <!-- note \u{1F600}\u{1F600} -->\n\n== One ==\nREPLACED\n\n== Two ==\nbody two"
    );
    expect(sectionText(PAGE_WITH_EMOJI, 2)).toBe("== Two ==\nbody two");
    expect(replaceSection(PAGE_WITH_EMOJI, 0, "New lead")).toBe("New lead\n\n== One ==\nbody one\n\n== Two ==\nbody two");
  });

  it("holds for astral characters inside <nowiki> and <pre> too", () => {
    const page = "<nowiki>\u{1F600}\n== not a heading ==\n\u{1F600}</nowiki>\n== Real ==\ntext";
    expect(sectionHeadings(page).map((h) => h.text)).toEqual(["Real"]);
    expect(sectionText(page, 1)).toBe("== Real ==\ntext");
  });
});

describe("lines made only of equals signs", () => {
  it("are headings as in MediaWiki: === is level 1 titled =, ===== level 2 titled =", () => {
    const level = (line: string) => sectionHeadings(line).map((h) => [h.level, h.text]);
    expect(level("===")).toEqual([[1, "="]]);
    expect(level("====")).toEqual([[1, "=="]]);
    expect(level("=====")).toEqual([[2, "="]]);
    expect(level("=======")).toEqual([[3, "="]]);
    expect(level("=".repeat(13))).toEqual([[6, "="]]);
    expect(level("=".repeat(20))).toEqual([[6, "=".repeat(8)]]);
  });

  it("are not headings below three signs, and ignore trailing blanks and a masked comment", () => {
    expect(sectionHeadings("=\n==\n").length).toBe(0);
    expect(sectionHeadings("===  \t").map((h) => [h.level, h.text])).toEqual([[1, "="]]);
    expect(sectionHeadings("=== <!-- x -->").map((h) => [h.level, h.text])).toEqual([[1, "="]]);
    expect(sectionHeadings("<!-- a\n=== -->\n").length).toBe(0);
  });

  it("agree with MediaWiki's heading regex on every combination of equals signs and one other character", () => {
    const old = /^(={1,6})(.+?)\1[ \t]*$/u;
    const alphabet = ["=", "=", "=", "a", " "];
    let seed = 7;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    for (let round = 0; round < 20_000; round++) {
      const line = Array.from({ length: 1 + (next() % 16) }, () => alphabet[(next() >> 8) % alphabet.length]).join("");
      const match = old.exec(line);
      const text = match?.[2]?.trim();
      const expected = match && text ? [match[1]!.length, text] : null;
      const found = sectionHeadings(line)[0];
      expect([line, found ? [found.level, found.text] : null]).toEqual([line, expected]);
    }
  });
});
