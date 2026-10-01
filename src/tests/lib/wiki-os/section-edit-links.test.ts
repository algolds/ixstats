import { addSectionEditLinks } from "~/lib/wiki-os/transformers/html-transformer";
import { findSectionLine } from "~/lib/wiki-os/wikitext/section-locator";

describe("addSectionEditLinks", () => {
  test("adds an edit link to h2/h3 headings carrying the heading text", () => {
    const html =
      '<div class="mw-heading mw-heading2"><h2 id="History">History &amp; Origins</h2></div>' +
      '<h3 id="Early"><span>Early</span> years</h3><h4 id="Deep">Deep</h4>';

    const out = addSectionEditLinks(html, "Foo_Bar");

    expect(out).toContain(
      '<h2 id="History">History &amp; Origins<a class="wikios-section-edit-link" href="'
    );
    expect(out).toContain(`/wiki/Foo_Bar?action=edit&amp;section=${encodeURIComponent("History & Origins")}`);
    expect(out).toContain('aria-label="Edit section: History &amp; Origins"');
    expect(out).toContain(`action=edit&amp;section=${encodeURIComponent("Early years")}`);
    expect(out).toContain('<h4 id="Deep">Deep</h4>');
  });

  test("leaves empty headings alone", () => {
    expect(addSectionEditLinks("<h2></h2>", "Foo")).toBe("<h2></h2>");
  });
});

describe("findSectionLine", () => {
  const wikitext = [
    "Intro text",
    "== History ==",
    "Body",
    "=== [[Treaty of Oakhaven|The Treaty]] ===",
    "More",
    "== '''Legacy''' ==",
  ].join("\n");

  test("matches heading text as the reader shows it", () => {
    expect(findSectionLine(wikitext, "History")).toBe(2);
    expect(findSectionLine(wikitext, "The Treaty")).toBe(4);
    expect(findSectionLine(wikitext, "legacy")).toBe(6);
  });

  test("returns null for unknown or empty sections", () => {
    expect(findSectionLine(wikitext, "Nope")).toBeNull();
    expect(findSectionLine(wikitext, "  ")).toBeNull();
  });
});
