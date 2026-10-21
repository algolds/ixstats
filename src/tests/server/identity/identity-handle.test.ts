/** @jest-environment node */
/**
 * IxStates Passport handles: pure format, reserved-word and slug rules.
 */
import { describe, expect, it } from "@jest/globals";
import {
  HANDLE_PATTERN,
  RESERVED_HANDLES,
  chooseBackfillHandle,
  needsCanonicalRedirect,
  pickAvailableHandle,
  slugifyHandle,
  validateHandle,
} from "~/server/modules/identity/identity.handle";

describe("HANDLE_PATTERN", () => {
  it.each(["abc", "a_b", "user_123", "a".repeat(24), "123"])("accepts %s", (h) => {
    expect(HANDLE_PATTERN.test(h)).toBe(true);
  });

  it.each(["ab", "a".repeat(25), "Abc", "a-b", "a b", "a.b", "", "ünï"])("rejects %s", (h) => {
    expect(HANDLE_PATTERN.test(h)).toBe(false);
  });
});
describe("validateHandle", () => {
  it("accepts and normalises a valid handle", () => {
    expect(validateHandle("@Picard_1")).toEqual({ ok: true, handle: "picard_1" });
  });

  it("rejects bad formats", () => {
    expect(validateHandle("ab")).toEqual({ ok: false, reason: "format" });
    expect(validateHandle("has space")).toEqual({ ok: false, reason: "format" });
    expect(validateHandle("a".repeat(25))).toEqual({ ok: false, reason: "format" });
  });
  it.each([...RESERVED_HANDLES])("rejects reserved word %s", (word) => {
    expect(validateHandle(word)).toEqual({ ok: false, reason: "reserved" });
    expect(validateHandle(`@${word.toUpperCase()}`)).toEqual({ ok: false, reason: "reserved" });
  });
});

describe("slugifyHandle", () => {
  it("always produces a valid handle", () => {
    for (const s of ["Admin", "x", "!!!", "Jean-Luc Picard", "a".repeat(30), "settings"]) {
      expect(validateHandle(slugifyHandle(s)).ok).toBe(true);
    }
  });
});

describe("pickAvailableHandle", () => {
  it("returns base when free", () => {
    expect(pickAvailableHandle("picard", new Set())).toBe("picard");
  });

  it("suffixes _2, _3 on collision", () => {
    expect(pickAvailableHandle("picard", new Set(["picard"]))).toBe("picard_2");
    expect(pickAvailableHandle("picard", new Set(["picard", "picard_2"]))).toBe("picard_3");
  });
});

describe("needsCanonicalRedirect", () => {
  it("redirects a legacy segment to the stored handle", () => {
    expect(needsCanonicalRedirect("Kir Forum", "kir")).toBe(true);
    expect(needsCanonicalRedirect("clerk_abc", "kir")).toBe(true);
  });
  it("never redirects me", () => {
    expect(needsCanonicalRedirect("me", "kir")).toBe(false);
    expect(needsCanonicalRedirect("@Me", "kir")).toBe(false);
  });
});

describe("chooseBackfillHandle", () => {
  const none = { wiki: null, forum: null, persona: null, nation: null };

  it("prefers the verified wiki name, then forum, persona and nation names", () => {
    const all = { wiki: "Kir Wiki", forum: "KirForum", persona: "Kir Persona", nation: "Caphiria" };
    expect(chooseBackfillHandle(all)).toEqual({ source: "wiki", handle: "kir_wiki" });
    expect(chooseBackfillHandle({ ...all, wiki: null })).toEqual({
      source: "forum",
      handle: "kirforum",
    });
    expect(chooseBackfillHandle({ ...none, persona: "Kir Persona", nation: "Caphiria" })).toEqual({
      source: "persona",
      handle: "kir_persona",
    });
    expect(chooseBackfillHandle({ ...none, nation: "Caphiria" })).toEqual({
      source: "nation",
      handle: "caphiria",
    });
  });
  it("gives no handle without a usable name, never a Clerk or row id", () => {
    expect(chooseBackfillHandle(none)).toBeNull();
  });
});
