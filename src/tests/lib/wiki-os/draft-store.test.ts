import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  saveDraft,
  getDraft,
  clearDraft,
  clearEditorBase,
  hasDraft,
  isDraftStale,
  listDrafts,
  setEditorBase,
  type WikiEditorDraft,
} from "~/lib/wiki-os/editor/draft-store";

// Mock localStorage for non-browser test runner
const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => storageMap.set(key, value),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
  get length() {
    return storageMap.size;
  },
};

if (typeof globalThis.window === "undefined") {
  (globalThis as any).window = { localStorage: localStorageMock };
} else if (!globalThis.window.localStorage) {
  (globalThis.window as any).localStorage = localStorageMock;
}

describe("draft-store", () => {
  beforeEach(() => {
    globalThis.window.localStorage.clear();
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

  describe("base revision (WK-2)", () => {
    const draft = { title: "Based", source: "ixwiki", mode: "source", wikitext: "x" } as const;

    it("stores the base revision the caller passes, including null for a new page", () => {
      saveDraft({ ...draft, baseRevisionRef: "rev-4" });
      expect(getDraft("Based")?.baseRevisionRef).toBe("rev-4");
      saveDraft({ ...draft, baseRevisionRef: null });
      expect(getDraft("Based")?.baseRevisionRef).toBeNull();
    });

    it("stamps the revision the editor was loaded from when the caller passes none", () => {
      setEditorBase("Based", "rev-7");
      saveDraft(draft);
      expect(getDraft("Based")?.baseRevisionRef).toBe("rev-7");
      clearEditorBase("Based");
      saveDraft(draft);
      expect(getDraft("Based")?.baseRevisionRef).toBeUndefined();
    });

    it("calls a draft stale when it was started from another revision than the current one", () => {
      const base = { ...draft, savedAt: 1 };
      expect(isDraftStale({ ...base, baseRevisionRef: "rev-1" }, ["rev-1"])).toBe(false);
      expect(isDraftStale({ ...base, baseRevisionRef: "rev-1" }, ["rev-2"])).toBe(true);
      expect(isDraftStale({ ...base, baseRevisionRef: null }, [])).toBe(false);
      expect(isDraftStale({ ...base, baseRevisionRef: null }, ["rev-2"])).toBe(true);
      // a draft from before the base was recorded: stale for any page that has a revision
      expect(isDraftStale(base, ["rev-2"])).toBe(true);
      expect(isDraftStale(base, [])).toBe(false);
    });

    it("recognises either reference of the current revision (the export worker stamps the rev_id)", () => {
      const base = { ...draft, savedAt: 1 };
      // written while the head was known by its row id, read after the worker stamped rev_id 4321
      expect(isDraftStale({ ...base, baseRevisionRef: "cuid-1" }, ["cuid-1", "4321"])).toBe(false);
      // written after the stamp, read by a caller that also knows the row id
      expect(isDraftStale({ ...base, baseRevisionRef: "4321" }, ["cuid-1", "4321"])).toBe(false);
      expect(isDraftStale({ ...base, baseRevisionRef: "4320" }, ["cuid-1", "4321"])).toBe(true);
    });
  });

  describe("drafts written by older code", () => {
    const store = (draft: Record<string, unknown>): void =>
      window.localStorage.setItem("wikios_draft:ixwiki:Old_page", JSON.stringify({ title: "Old page", source: "ixwiki", savedAt: 1, ...draft }));

    it("reads the wikitext the visual editor used to keep in the html field as wikitext", () => {
      store({ mode: "visual", html: "== Heading ==\nSome [[text]]." });
      const draft = getDraft("Old page");
      expect(draft?.wikitext).toBe("== Heading ==\nSome [[text]].");
      expect(draft?.html).toBeUndefined();
      expect(listDrafts()[0]?.wikitext).toBe("== Heading ==\nSome [[text]].");
    });

    it("migrates wikitext that starts with HTML-like tags too: the version decides, not the text", () => {
      for (const text of ["<div class=\"infobox\">x</div>\n== H ==", "<span>a</span> text", "<blockquote>q</blockquote>\nmore", "<p>para</p>"]) {
        store({ mode: "visual", html: text });
        const draft = getDraft("Old page");
        expect(draft?.wikitext).toBe(text);
        expect(draft?.html).toBeUndefined();
      }
    });

    it("leaves a source draft, a draft that has its wikitext, and drafts of the current format alone", () => {
      store({ mode: "source", wikitext: "x" });
      expect(getDraft("Old page")?.wikitext).toBe("x");
      store({ mode: "visual", html: "old html", wikitext: "kept" });
      expect(getDraft("Old page")).toMatchObject({ wikitext: "kept", html: "old html" });
      store({ mode: "visual", html: "plain words", version: 2 });
      expect(getDraft("Old page")?.html).toBe("plain words");
    });

    it("writes the current format", () => {
      saveDraft({ title: "New page", source: "ixwiki", mode: "visual", wikitext: "x" });
      expect(getDraft("New page")?.version).toBe(2);
    });
  });
});
