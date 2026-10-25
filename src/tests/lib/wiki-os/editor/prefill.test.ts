/** @jest-environment node */
/**
 * Native lore plan Task 3: the text a new page's editor may open on (`?prefill=`, or a host's `prefillWikitext`).
 * It is plain text, bounded, and it is used only for a page the load reports as missing: never over a page's text,
 * and never when the load failed.
 */
import { PREFILL_MAX_LENGTH, openingPrefill, readPrefillParam } from "~/lib/wiki-os/editor/prefill";
import { pageEditHref } from "~/lib/wiki-os/page-tools";

/**
 * `wikios.getWikitext` for ixwiki: `revid` is always null there, and `timestamp` is set only for a stored row that has
 * text. A missing page is all empty; an existing page always has text, even when its head ref could not be read.
 */
const missing = { wikitext: "", revid: null, timestamp: null, revisionRef: null, revisionRefs: [] };
const STORED = "2026-10-25T00:00:00.000Z";

describe("readPrefillParam", () => {
  it("is null when the parameter is absent or empty", () => {
    expect(readPrefillParam(null)).toBeNull();
    expect(readPrefillParam("")).toBeNull();
  });

  it("round-trips wikitext through pageEditHref: braces, pipes, plus, ampersand, hash, newlines, accents", () => {
    const text = "{{Infobox settlement\n| name = Venceia & Co #1 + 2 = 3\n}}\n\n== Café ==\n";
    const href = pageEditHref("Venceia", null, { mode: "visual", prefill: text });
    const query = new URLSearchParams(href.slice(href.indexOf("?") + 1));

    expect(readPrefillParam(query.get("prefill"))).toBe(text);
  });

  it("normalises Windows and old Mac line endings to newlines", () => {
    expect(readPrefillParam("a\r\nb\rc")).toBe("a\nb\nc");
  });

  it("drops control characters other than newline and tab", () => {
    expect(readPrefillParam("a\u0000b\u0007c\u001bd\u007fe\tf")).toBe("abcde\tf");
  });

  it("keeps markup as plain text (the editor decides what it means, as for any page's text)", () => {
    expect(readPrefillParam("<script>alert(1)</script>")).toBe("<script>alert(1)</script>");
  });

  it("refuses a text over the limit whole rather than cutting it mid-markup", () => {
    expect(readPrefillParam("x".repeat(PREFILL_MAX_LENGTH))).toHaveLength(PREFILL_MAX_LENGTH);
    expect(readPrefillParam("x".repeat(PREFILL_MAX_LENGTH + 1))).toBeNull();
  });

  it("is null when nothing but control characters remains", () => {
    expect(readPrefillParam("\u0000\u0001")).toBeNull();
  });
});

describe("openingPrefill", () => {
  it("is the prefill for a page that does not exist (no revision, no text)", () => {
    expect(openingPrefill("{{Infobox person}}", missing, false)).toBe("{{Infobox person}}");
  });

  it("is null without a prefill", () => {
    expect(openingPrefill(undefined, missing, false)).toBeNull();
    expect(openingPrefill("", missing, false)).toBeNull();
  });

  it("is null when the load failed or gave no answer: a failed load is not a missing page", () => {
    expect(openingPrefill("{{Infobox person}}", missing, true)).toBeNull();
    expect(openingPrefill("{{Infobox person}}", undefined, false)).toBeNull();
  });

  it.each([
    [
      "the page exists with its head revision",
      {
        wikitext: "Existing",
        revid: null,
        timestamp: STORED,
        revisionRef: "rev-1",
        revisionRefs: ["rev-1", "1"],
      },
    ],
    [
      "the page exists but its head ref could not be read (the server answers revisionRef null)",
      { wikitext: "Existing", revid: null, timestamp: STORED, revisionRef: null, revisionRefs: [] },
    ],
    ["the load names a revision ref", { ...missing, revisionRef: "rev-1" }],
    ["the load names revision refs", { ...missing, revisionRefs: ["rev-1"] }],
    // Another wiki's shape (getWikitext's sister-wiki branch): its page id as `revid`, never a revision ref.
    ["the load names a page id as revid", { ...missing, revid: 42 }],
  ])("is null when %s", (_label, page) => {
    expect(openingPrefill("{{Infobox person}}", page, false)).toBeNull();
  });

  it("treats an absent revid or revisionRefs as none", () => {
    expect(openingPrefill("P", { wikitext: "", revisionRef: null }, false)).toBe("P");
  });
});
