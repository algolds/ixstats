/**
 * @jest-environment node
 */
import {
  ALLOWED_FIELD_PATHS,
  isAllowedFieldPath,
  toEffectValue,
} from "~/server/modules/scheduled-changes/effect-value";

describe("scheduled-changes effect-value (plan 329)", () => {
  describe("toEffectValue", () => {
    it("returns the relative change for a positive move", () => {
      expect(toEffectValue("100", "110")).toEqual({ ok: true, value: 0.1 });
    });

    it("returns the relative change for a negative move", () => {
      expect(toEffectValue("0.03", "0.015")).toEqual({ ok: true, value: -0.5 });
    });

    it("rejects an oldValue of 0 (relative change undefined)", () => {
      const result = toEffectValue("0", "5");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/oldValue is 0/);
    });

    it("rejects non-JSON input", () => {
      expect(toEffectValue("abc", "5").ok).toBe(false);
      expect(toEffectValue("5", "abc").ok).toBe(false);
    });

    it("rejects non-finite and non-numeric JSON", () => {
      expect(toEffectValue("Infinity", "5").ok).toBe(false);
      expect(toEffectValue("null", "5").ok).toBe(false);
      expect(toEffectValue("5", "null").ok).toBe(false);
      expect(toEffectValue('"5"', "6").ok).toBe(false);
    });

    it("does not clamp large relative changes (the engine does)", () => {
      expect(toEffectValue("1", "5")).toEqual({ ok: true, value: 4 });
    });
  });

  describe("isAllowedFieldPath", () => {
    it("accepts every allowlisted Country field", () => {
      for (const path of ALLOWED_FIELD_PATHS) expect(isAllowedFieldPath(path)).toBe(true);
    });

    it("rejects fields outside the allowlist", () => {
      expect(isAllowedFieldPath("name")).toBe(false);
      expect(isAllowedFieldPath("")).toBe(false);
    });
  });
});
