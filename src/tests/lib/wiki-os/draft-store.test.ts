import {
  saveDraft,
  getDraft,
  clearDraft,
  hasDraft,
  listDrafts,
  type WikiEditorDraft,
} from "../../../lib/wiki-os/draft-store";

describe("draft-store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves and retrieves a visual editor draft in canonical format", () => {
    saveDraft({
      title: "Kingdom of Eldoria",
      source: "ixwiki",
      mode: "visual",
      html: "<p>Eldoria is an ancient realm.</p>",
    });

    const retrieved = getDraft("Kingdom of Eldoria", "ixwiki");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe("Kingdom of Eldoria");
    expect(retrieved?.mode).toBe("visual");
    expect(retrieved?.html).toBe("<p>Eldoria is an ancient realm.</p>");
    expect(hasDraft("Kingdom of Eldoria", "ixwiki")).toBe(true);
  });

  it("saves and retrieves a source editor draft in canonical format", () => {
    saveDraft({
      title: "Republic of Testia",
      source: "ixwiki",
      mode: "source",
      wikitext: "== History ==\nTestia was founded in 1920.",
    });

    const retrieved = getDraft("Republic of Testia", "ixwiki");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe("Republic of Testia");
    expect(retrieved?.mode).toBe("source");
    expect(retrieved?.wikitext).toBe("== History ==\nTestia was founded in 1920.");
    expect(hasDraft("Republic of Testia", "ixwiki")).toBe(true);
  });

  it("clears drafts across both canonical and legacy keys", () => {
    saveDraft({
      title: "Clear Me",
      source: "ixwiki",
      mode: "visual",
      html: "<p>Temporary</p>",
    });

    expect(hasDraft("Clear Me", "ixwiki")).toBe(true);
    clearDraft("Clear Me", "ixwiki");
    expect(hasDraft("Clear Me", "ixwiki")).toBe(false);
    expect(getDraft("Clear Me", "ixwiki")).toBeNull();
  });

  it("reads legacy visual and source storage keys seamlessly", () => {
    window.localStorage.setItem("wikios-draft-html-Old Page", "<h1>Legacy HTML</h1>");
    window.localStorage.setItem("wikios-draft-Legacy Source", "== Legacy Wikitext ==");

    const legacyVisual = getDraft("Old Page", "ixwiki");
    expect(legacyVisual).not.toBeNull();
    expect(legacyVisual?.mode).toBe("visual");
    expect(legacyVisual?.html).toBe("<h1>Legacy HTML</h1>");

    const legacySource = getDraft("Legacy Source", "ixwiki");
    expect(legacySource).not.toBeNull();
    expect(legacySource?.mode).toBe("source");
    expect(legacySource?.wikitext).toBe("== Legacy Wikitext ==");
  });

  it("lists and deduplicates drafts across canonical and legacy keys", () => {
    saveDraft({
      title: "Unified Nation",
      source: "ixwiki",
      mode: "visual",
      html: "<p>Canonical</p>",
    });

    window.localStorage.setItem("wikios-draft-html-Legacy Only", "<p>Old format</p>");

    const allDrafts: WikiEditorDraft[] = listDrafts();
    expect(allDrafts.length).toBe(2);

    const titles = allDrafts.map((d: WikiEditorDraft) => d.title);
    expect(titles).toContain("Unified Nation");
    expect(titles).toContain("Legacy Only");
  });
});
