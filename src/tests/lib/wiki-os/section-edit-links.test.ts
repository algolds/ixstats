import { appendSectionEditLinks, removeSectionEditLinks } from "~/lib/wiki-os/transformers/html-transformer";
import { findSectionLine } from "~/lib/wiki-os/wikitext/section-locator";

/** The HTML of `html` after the links are appended to its live tree. */
function addSectionEditLinks(html: string, slug: string): string {
  const root = document.createElement("div");
  root.innerHTML = html;
  appendSectionEditLinks(root, slug);
  return root.innerHTML;
}

describe("appendSectionEditLinks", () => {
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

  test("adds a link in place, once: the heading element itself is the one that keeps it", () => {
    const root = document.createElement("div");
    root.innerHTML = '<h2 id="A">Alpha</h2><p>text</p>';
    const heading = root.querySelector("h2");

    appendSectionEditLinks(root, "Foo");
    appendSectionEditLinks(root, "Foo");

    expect(root.querySelector("h2")).toBe(heading);
    expect(root.querySelectorAll(".wikios-section-edit-link")).toHaveLength(1);
    expect(root.querySelector("p")?.textContent).toBe("text");
  });
});

describe("removeSectionEditLinks", () => {
  test("takes the appended links out again and leaves the headings and the rest alone", () => {
    const root = document.createElement("div");
    root.innerHTML = '<h2 id="A">Alpha</h2><h3 id="B">Beta</h3><p>text</p>';
    const heading = root.querySelector("h2");
    appendSectionEditLinks(root, "Foo");
    expect(root.querySelectorAll(".wikios-section-edit-link")).toHaveLength(2);

    removeSectionEditLinks(root);

    expect(root.innerHTML).toBe('<h2 id="A">Alpha</h2><h3 id="B">Beta</h3><p>text</p>');
    expect(root.querySelector("h2")).toBe(heading);
    removeSectionEditLinks(root); // none left: nothing to do
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
