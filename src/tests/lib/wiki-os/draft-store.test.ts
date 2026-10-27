import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  saveDraft,
  getDraft,
  clearDraft,
  hasDraft,
  isDraftStale,
  listDrafts
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
  describe("base revision (WK-2)", () => {
    const draft = { title: "Based", source: "ixwiki", mode: "source", wikitext: "x" } as const;

    it("stores the base revision the caller passes, including null for a new page", () => {
      saveDraft(OWNER, { ...draft, baseRevisionRef: "rev-4" });
      expect(getDraft(OWNER, "Based")?.baseRevisionRef).toBe("rev-4");
      saveDraft(OWNER, { ...draft, baseRevisionRef: null });
      expect(getDraft(OWNER, "Based")?.baseRevisionRef).toBeNull();
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
    it("writes no unowned mirror: the legacy keys would show one user's text to the next", () => {
      saveDraft(OWNER, { title: "Mirror", source: "ixwiki", mode: "visual", html: "<p>secret</p>" });
      saveDraft(OWNER, { title: "Mirror", source: "ixwiki", mode: "source", wikitext: "secret" });

      expect(storageMap.keys().filter((key) => key.startsWith("wikios-draft-"))).toEqual([]);
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
    it("never overwrites a draft the user already has: theirs wins, the old one stays unclaimed", () => {
      storageMap.set(OLD_KEY, oldDraft);
      saveDraft(OWNER, { title: "Old page", source: "ixwiki", mode: "source", wikitext: "Newer, per user" });

      expect(getDraft(OWNER, "Old page")?.wikitext).toBe("Newer, per user");
      expect(storageMap.has(OLD_KEY)).toBe(true);
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
