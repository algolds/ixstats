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
const mockStore = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => mockStore.get(key) ?? null,
  setItem: (key: string, value: string) => mockStore.set(key, value),
  removeItem: (key: string) => mockStore.delete(key),
  clear: () => mockStore.clear(),
  key: (index: number) => Array.from(mockStore.keys())[index] ?? null,
  get length() {
    return mockStore.size;
  },
};

if (typeof globalThis.window === "undefined") {
  (globalThis as any).window = { localStorage: localStorageMock };
} else if (!globalThis.window.localStorage) {
  (globalThis.window as any).localStorage = localStorageMock;
}

/** What is in localStorage right now (jsdom's, or the mock above where there is no window). */
const storageMap = {
  set: (key: string, value: string) => window.localStorage.setItem(key, value),
  get: (key: string) => window.localStorage.getItem(key),
  has: (key: string) => window.localStorage.getItem(key) !== null,
  keys: () => Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i)!),
  get size() {
    return window.localStorage.length;
  },
};

const OWNER = "user_alice";
const OTHER = "user_bob";

describe("draft-store", () => {
  beforeEach(() => {
    globalThis.window.localStorage.clear();
  });

  it("saves and retrieves a visual editor draft in canonical format", () => {
    saveDraft(OWNER, {
      title: "Kingdom of Eldoria",
      source: "ixwiki",
      mode: "visual",
      html: "<p>Eldoria is an ancient realm.</p>",
    });

    const retrieved = getDraft(OWNER, "Kingdom of Eldoria", "ixwiki");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe("Kingdom of Eldoria");
    expect(retrieved?.mode).toBe("visual");
    expect(retrieved?.html).toBe("<p>Eldoria is an ancient realm.</p>");
    expect(hasDraft(OWNER, "Kingdom of Eldoria", "ixwiki")).toBe(true);
  });

  it("saves and retrieves a source editor draft in canonical format", () => {
    saveDraft(OWNER, {
      title: "Republic of Testia",
      source: "ixwiki",
      mode: "source",
      wikitext: "== History ==\nTestia was founded in 1920.",
    });

    const retrieved = getDraft(OWNER, "Republic of Testia", "ixwiki");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe("Republic of Testia");
    expect(retrieved?.mode).toBe("source");
    expect(retrieved?.wikitext).toBe("== History ==\nTestia was founded in 1920.");
    expect(hasDraft(OWNER, "Republic of Testia", "ixwiki")).toBe(true);
  });

  it("clears a draft", () => {
    saveDraft(OWNER, {
      title: "Clear Me",
      source: "ixwiki",
      mode: "visual",
      html: "<p>Temporary</p>",
    });

    expect(hasDraft(OWNER, "Clear Me", "ixwiki")).toBe(true);
    clearDraft(OWNER, "Clear Me", "ixwiki");
    expect(hasDraft(OWNER, "Clear Me", "ixwiki")).toBe(false);
    expect(getDraft(OWNER, "Clear Me", "ixwiki")).toBeNull();
  });

  it("reads the legacy visual and source storage keys for the signed-in user", () => {
    window.localStorage.setItem("wikios-draft-html-Old Page", "<h1>Legacy HTML</h1>");
    window.localStorage.setItem("wikios-draft-Legacy Source", "== Legacy Wikitext ==");

    const legacyVisual = getDraft(OWNER, "Old Page", "ixwiki");
    expect(legacyVisual).not.toBeNull();
    expect(legacyVisual?.mode).toBe("visual");
    expect(legacyVisual?.html).toBe("<h1>Legacy HTML</h1>");

    const legacySource = getDraft(OWNER, "Legacy Source", "ixwiki");
    expect(legacySource).not.toBeNull();
    expect(legacySource?.mode).toBe("source");
    expect(legacySource?.wikitext).toBe("== Legacy Wikitext ==");
  });

  it("lists the user's drafts together with the legacy ones it takes over", () => {
    saveDraft(OWNER, {
      title: "Unified Nation",
      source: "ixwiki",
      mode: "visual",
      html: "<p>Canonical</p>",
    });

    window.localStorage.setItem("wikios-draft-html-Legacy Only", "<p>Old format</p>");

    const allDrafts: WikiEditorDraft[] = listDrafts(OWNER);
    expect(allDrafts.length).toBe(2);

    const titles = allDrafts.map((d: WikiEditorDraft) => d.title);
    expect(titles).toContain("Unified Nation");
    expect(titles).toContain("Legacy Only");
  });

  describe("base revision (WK-2)", () => {
    const draft = { title: "Based", source: "ixwiki", mode: "source", wikitext: "x" } as const;

    it("stores the base revision the caller passes, including null for a new page", () => {
      saveDraft(OWNER, { ...draft, baseRevisionRef: "rev-4" });
      expect(getDraft(OWNER, "Based")?.baseRevisionRef).toBe("rev-4");
      saveDraft(OWNER, { ...draft, baseRevisionRef: null });
      expect(getDraft(OWNER, "Based")?.baseRevisionRef).toBeNull();
    });

    it("stamps the revision the editor was loaded from when the caller passes none", () => {
      setEditorBase(OWNER, "Based", "rev-7");
      saveDraft(OWNER, draft);
      expect(getDraft(OWNER, "Based")?.baseRevisionRef).toBe("rev-7");
      clearEditorBase(OWNER, "Based");
      saveDraft(OWNER, draft);
      expect(getDraft(OWNER, "Based")?.baseRevisionRef).toBeUndefined();
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
      window.localStorage.setItem("wikios_draft:user_alice:ixwiki:Old_page", JSON.stringify({ title: "Old page", source: "ixwiki", savedAt: 1, ...draft }));

    it("reads the wikitext the visual editor used to keep in the html field as wikitext", () => {
      store({ mode: "visual", html: "== Heading ==\nSome [[text]]." });
      const draft = getDraft(OWNER, "Old page");
      expect(draft?.wikitext).toBe("== Heading ==\nSome [[text]].");
      expect(draft?.html).toBeUndefined();
      expect(listDrafts(OWNER)[0]?.wikitext).toBe("== Heading ==\nSome [[text]].");
    });

    it("migrates wikitext that starts with HTML-like tags too: the version decides, not the text", () => {
      for (const text of ["<div class=\"infobox\">x</div>\n== H ==", "<span>a</span> text", "<blockquote>q</blockquote>\nmore", "<p>para</p>"]) {
        store({ mode: "visual", html: text });
        const draft = getDraft(OWNER, "Old page");
        expect(draft?.wikitext).toBe(text);
        expect(draft?.html).toBeUndefined();
      }
    });

    it("leaves a source draft, a draft that has its wikitext, and drafts of the current format alone", () => {
      store({ mode: "source", wikitext: "x" });
      expect(getDraft(OWNER, "Old page")?.wikitext).toBe("x");
      store({ mode: "visual", html: "old html", wikitext: "kept" });
      expect(getDraft(OWNER, "Old page")).toMatchObject({ wikitext: "kept", html: "old html" });
      store({ mode: "visual", html: "plain words", version: 2 });
      expect(getDraft(OWNER, "Old page")?.html).toBe("plain words");
    });

    it("writes the current format", () => {
      saveDraft(OWNER, { title: "New page", source: "ixwiki", mode: "visual", wikitext: "x" });
      expect(getDraft(OWNER, "New page")?.version).toBe(2);
    });
  });

  describe("drafts belong to one user (plan 416)", () => {
    const draft = { title: "Shared Page", source: "ixwiki", mode: "source", wikitext: "Alice's text" } as const;

    it("keys the draft by user, source and title", () => {
      saveDraft(OWNER, draft);

      expect(storageMap.keys()).toEqual(["wikios_draft:user_alice:ixwiki:Shared_Page"]);
    });

    it("keeps two users' drafts of the same page apart", () => {
      saveDraft(OWNER, draft);
      saveDraft(OTHER, { ...draft, wikitext: "Bob's text" });

      expect(getDraft(OWNER, "Shared Page")?.wikitext).toBe("Alice's text");
      expect(getDraft(OTHER, "Shared Page")?.wikitext).toBe("Bob's text");
      expect(listDrafts(OWNER).map((d) => d.wikitext)).toEqual(["Alice's text"]);
      expect(listDrafts(OTHER).map((d) => d.wikitext)).toEqual(["Bob's text"]);
      clearDraft(OWNER, "Shared Page");
      expect(getDraft(OWNER, "Shared Page")).toBeNull();
      expect(getDraft(OTHER, "Shared Page")?.wikitext).toBe("Bob's text");
    });

    it("keeps no draft for a signed-out editor: nothing stored, nothing read", () => {
      for (const nobody of [null, undefined, ""]) {
        expect(saveDraft(nobody, draft)).toBe(false);
        expect(getDraft(nobody, "Shared Page")).toBeNull();
        expect(hasDraft(nobody, "Shared Page")).toBe(false);
        expect(listDrafts(nobody)).toEqual([]);
      }
      expect(storageMap.size).toBe(0);
    });

    it("does not hand a signed-out reader a signed-in user's draft", () => {
      saveDraft(OWNER, draft);

      expect(getDraft(null, "Shared Page")).toBeNull();
      expect(listDrafts(undefined)).toEqual([]);
      expect(storageMap.size).toBe(1);
    });

    it("reports whether the draft was stored", () => {
      expect(saveDraft(OWNER, draft)).toBe(true);
      const quota = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

      expect(saveDraft(OWNER, draft)).toBe(false);

      quota.mockRestore();
      warn.mockRestore();
    });

    it("writes no unowned mirror: the legacy keys would show one user's text to the next", () => {
      saveDraft(OWNER, { title: "Mirror", source: "ixwiki", mode: "visual", html: "<p>secret</p>" });
      saveDraft(OWNER, { title: "Mirror", source: "ixwiki", mode: "source", wikitext: "secret" });

      expect(storageMap.keys().filter((key) => key.startsWith("wikios-draft-"))).toEqual([]);
    });

    it("treats a title with a colon as a title, not as part of the key's owner", () => {
      saveDraft(OWNER, { title: "Talk:Foo", source: "ixwiki", mode: "source", wikitext: "x" });

      expect(getDraft(OWNER, "Talk:Foo")?.wikitext).toBe("x");
      expect(getDraft(OTHER, "Talk:Foo")).toBeNull();
      expect(listDrafts(OTHER)).toEqual([]);
    });

    it("keeps the base revision stamp per user", () => {
      setEditorBase(OWNER, "Shared Page", "rev-9");
      saveDraft(OTHER, draft);
      saveDraft(OWNER, draft);

      expect(getDraft(OTHER, "Shared Page")?.baseRevisionRef).toBeUndefined();
      expect(getDraft(OWNER, "Shared Page")?.baseRevisionRef).toBe("rev-9");
      clearEditorBase(OWNER, "Shared Page");
    });
  });

  describe("drafts from before they were per user move to the first user who reads them, once", () => {
    const OLD_KEY = "wikios_draft:ixwiki:Old_page";
    const oldDraft = JSON.stringify({
      title: "Old page",
      source: "ixwiki",
      mode: "source",
      wikitext: "Written before 416",
      baseRevisionRef: "rev-3",
      version: 2,
      savedAt: 5,
    });

    it("moves the old-format key to the signed-in user on read, keeping the draft as it was", () => {
      storageMap.set(OLD_KEY, oldDraft);

      const draft = getDraft(OWNER, "Old page");

      expect(draft).toMatchObject({ wikitext: "Written before 416", baseRevisionRef: "rev-3", savedAt: 5 });
      expect(storageMap.has(OLD_KEY)).toBe(false);
      expect(storageMap.get("wikios_draft:user_alice:ixwiki:Old_page")).toBe(oldDraft);
    });

    it("moves it only once: a second user finds nothing", () => {
      storageMap.set(OLD_KEY, oldDraft);

      getDraft(OWNER, "Old page");

      expect(getDraft(OTHER, "Old page")).toBeNull();
    });

    it("is not claimed by a signed-out reader", () => {
      storageMap.set(OLD_KEY, oldDraft);

      expect(getDraft(null, "Old page")).toBeNull();
      expect(listDrafts(null)).toEqual([]);
      expect(storageMap.has(OLD_KEY)).toBe(true);
    });

    it("never overwrites a draft the user already has: theirs wins, the old one stays unclaimed", () => {
      storageMap.set(OLD_KEY, oldDraft);
      saveDraft(OWNER, { title: "Old page", source: "ixwiki", mode: "source", wikitext: "Newer, per user" });

      expect(getDraft(OWNER, "Old page")?.wikitext).toBe("Newer, per user");
      expect(storageMap.has(OLD_KEY)).toBe(true);
    });

    it("moves the older legacy keys the same way, as a draft in the current format", () => {
      storageMap.set("wikios-draft-Legacy Source", "== Legacy ==");

      const draft = getDraft(OWNER, "Legacy Source");

      expect(draft).toMatchObject({ mode: "source", wikitext: "== Legacy ==", version: 2 });
      expect(storageMap.has("wikios-draft-Legacy Source")).toBe(false);
      expect(getDraft(OTHER, "Legacy Source")).toBeNull();
    });

    it("moves every one of them when the user lists their drafts", () => {
      storageMap.set(OLD_KEY, oldDraft);
      storageMap.set("wikios-draft-html-Legacy Html", "<p>old</p>");
      storageMap.set("wikios_draft:user_bob:ixwiki:Bobs_page", JSON.stringify({ title: "Bobs page", source: "ixwiki", mode: "source", wikitext: "b", version: 2, savedAt: 1 }));

      expect(listDrafts(OWNER).map((d) => d.title).sort()).toEqual(["Legacy Html", "Old page"]);
      expect(listDrafts(OTHER).map((d) => d.title)).toEqual(["Bobs page"]);
      expect(storageMap.has(OLD_KEY)).toBe(false);
    });

    it("does not take another wiki's old-format draft for a user's key", () => {
      storageMap.set(
        "wikios_draft:iiwiki:Elsewhere",
        JSON.stringify({ title: "Elsewhere", source: "iiwiki", mode: "source", wikitext: "x", version: 2, savedAt: 1 })
      );

      expect(getDraft(OWNER, "Elsewhere", "iiwiki")?.wikitext).toBe("x");
      expect(storageMap.has("wikios_draft:user_alice:iiwiki:Elsewhere")).toBe(true);
    });

    it("clearing a draft also clears the unowned one the user would otherwise inherit", () => {
      storageMap.set(OLD_KEY, oldDraft);
      storageMap.set("wikios-draft-Old page", "legacy text");

      clearDraft(OWNER, "Old page");

      expect(storageMap.size).toBe(0);
      expect(getDraft(OWNER, "Old page")).toBeNull();
    });
  });
});
