/** @jest-environment node */
/**
 * IxStates Passport handles: pure format, reserved-word and slug rules.
 */
import { describe, expect, it } from "@jest/globals";
import {
  HANDLE_PATTERN,
  RESERVED_HANDLES,
  normalizeHandle,
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

describe("normalizeHandle", () => {
  it("lowercases, strips a leading @ and trims", () => {
    expect(normalizeHandle("@Name")).toBe("name");
    expect(normalizeHandle("  @Jean_Luc  ")).toBe("jean_luc");
    expect(normalizeHandle("PLAIN")).toBe("plain");
  });

  it("strips only one leading @", () => {
    expect(normalizeHandle("@@x")).toBe("@x");
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

  it("lists the required reserved words", () => {
    expect([...RESERVED_HANDLES].sort()).toEqual(
      [
        "me",
        "admin",
        "embed",
        "settings",
        "board",
        "nations",
        "rules",
        "manage",
        "happenings",
        "api",
        "id",
        "new",
      ].sort()
    );
  });

  it.each([...RESERVED_HANDLES])("rejects reserved word %s", (word) => {
    expect(validateHandle(word)).toEqual({ ok: false, reason: "reserved" });
    expect(validateHandle(`@${word.toUpperCase()}`)).toEqual({ ok: false, reason: "reserved" });
  });
});

describe("slugifyHandle", () => {
  it("slugifies names", () => {
    expect(slugifyHandle("Jean-Luc Picard")).toBe("jean_luc_picard");
  });

  it("drops other characters", () => {
    expect(slugifyHandle("Zed!@#.Co")).toBe("zedco");
  });

  it("pads short results to 3 with underscores", () => {
    expect(slugifyHandle("ab")).toBe("ab_");
    expect(slugifyHandle("")).toBe("___");
  });

  it("truncates to 24", () => {
    expect(slugifyHandle("a".repeat(40))).toBe("a".repeat(24));
  });

  it("appends _1 to reserved results", () => {
    expect(slugifyHandle("Admin")).toBe("admin_1");
    expect(slugifyHandle("Happenings")).toBe("happenings_1");
  });

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

  it("truncates the base so the result stays within 24", () => {
    const base = "a".repeat(24);
    const result = pickAvailableHandle(base, new Set([base]));
    expect(result).toBe(`${"a".repeat(22)}_2`);
    expect(result).toHaveLength(24);
    expect(HANDLE_PATTERN.test(result)).toBe(true);
  });

  it("handles two-digit suffixes at the length limit", () => {
    const base = "a".repeat(24);
    const taken = new Set([base, ...Array.from({ length: 8 }, (_, i) => `${"a".repeat(22)}_${i + 2}`)]);
    expect(pickAvailableHandle(base, taken)).toBe(`${"a".repeat(21)}_10`);
  });
});
