import { describe, it, expect } from "@jest/globals";
import {
  getHighResFlagUrl,
  formatFullWordNumber,
  formatFullWordCurrency,
  getComplexityBadgeClass,
  getArchetypeColorClass,
  HISTORICAL_ARCHETYPE_IDS,
  getStepLabel,
} from "../components/enhanced/steps/foundation/foundationUtils";

describe("foundationUtils", () => {
  describe("getHighResFlagUrl", () => {
    it("converts flagcdn png urls to svg", () => {
      const input = "https://flagcdn.com/w320/us.png";
      const output = getHighResFlagUrl(input);
      expect(output).toBe("https://flagcdn.com/us.svg");
    });

    it("returns original url if not flagcdn", () => {
      const input = "https://example.com/flags/custom.png";
      const output = getHighResFlagUrl(input);
      expect(output).toBe(input);
    });

    it("handles null and undefined safely", () => {
      expect(getHighResFlagUrl(null)).toBeNull();
      expect(getHighResFlagUrl(undefined)).toBeUndefined();
    });
  });

  describe("formatFullWordNumber", () => {
    it("formats billions correctly", () => {
      expect(formatFullWordNumber(1_500_000_000)).toBe("1.5 billion");
    });

    it("formats millions correctly", () => {
      expect(formatFullWordNumber(42_000_000)).toBe("42 million");
    });

    it("formats thousands correctly", () => {
      expect(formatFullWordNumber(250_000)).toBe("250 thousand");
    });

    it("handles zero or empty values", () => {
      expect(formatFullWordNumber(0)).toBe("0");
      expect(formatFullWordNumber(null)).toBe("0");
      expect(formatFullWordNumber(undefined)).toBe("0");
    });
  });

  describe("formatFullWordCurrency", () => {
    it("formats trillions correctly", () => {
      expect(formatFullWordCurrency(2_100_000_000_000)).toBe("$2.1 trillion");
    });

    it("formats billions correctly", () => {
      expect(formatFullWordCurrency(500_000_000_000)).toBe("$500 billion");
    });

    it("formats millions correctly", () => {
      expect(formatFullWordCurrency(15_000_000)).toBe("$15 million");
    });

    it("handles zero or null", () => {
      expect(formatFullWordCurrency(0)).toBe("$0");
      expect(formatFullWordCurrency(null)).toBe("$0");
    });
  });

  describe("getComplexityBadgeClass", () => {
    it("returns rose styling for high complexity", () => {
      expect(getComplexityBadgeClass("high")).toContain("text-rose-600");
    });

    it("returns emerald styling for low complexity", () => {
      expect(getComplexityBadgeClass("low")).toContain("text-emerald-600");
    });

    it("defaults to blue styling for medium complexity", () => {
      expect(getComplexityBadgeClass("medium")).toContain("text-blue-600");
    });
  });

  describe("getArchetypeColorClass", () => {
    it("returns emerald styling for social democratic archetypes", () => {
      expect(getArchetypeColorClass("nordic-welfare")).toContain("text-emerald-600");
    });

    it("returns cyan styling for free market / silicon valley archetypes", () => {
      expect(getArchetypeColorClass("silicon-valley")).toContain("text-cyan-600");
    });

    it("returns rose styling for command / state planned archetypes", () => {
      expect(getArchetypeColorClass("soviet-command")).toContain("text-rose-600");
    });
  });

  describe("HISTORICAL_ARCHETYPE_IDS", () => {
    it("contains the canonical historical archetypes", () => {
      expect(HISTORICAL_ARCHETYPE_IDS).toContain("british-empire");
      expect(HISTORICAL_ARCHETYPE_IDS).toContain("venetian-republic");
      expect(HISTORICAL_ARCHETYPE_IDS.length).toBe(10);
    });
  });

  describe("getStepLabel", () => {
    it("returns correct phase labels for builder steps", () => {
      expect(getStepLabel("core")).toBe("National Identity Phase");
      expect(getStepLabel("identity")).toBe("National Identity Phase");
      expect(getStepLabel("government")).toBe("Government Phase");
      expect(getStepLabel("economics")).toBe("Economics Phase");
      expect(getStepLabel("preview")).toBe("Preview & Create Phase");
      expect(getStepLabel("foundation")).toBe("Foundation Phase");
      expect(getStepLabel("unknown")).toBe("Foundation Phase");
    });
  });
});
