// src/lib/onoma/morphology.test.ts
// Onoma Lab — Unit tests for Morphology Simulator

import { detectGender, generateNounDeclension, getMorphologyDetails } from "~/lib/onoma/morphology";

describe("Morphology Simulator", () => {
  describe("detectGender", () => {
    it("should detect Latin genders correctly", () => {
      expect(detectGender("Marcus", "Latin")).toBe("masculine");
      expect(detectGender("Roma", "Roman")).toBe("feminine");
      expect(detectGender("Latium", "Latin")).toBe("neuter");
      expect(detectGender("Veritas", "Latin")).toBe("masculine"); // default
    });

    it("should detect Germanic genders correctly", () => {
      expect(detectGender("Burg", "Germanic")).toBe("masculine");
      expect(detectGender("Gabe", "German")).toBe("feminine");
      expect(detectGender("Mädchen", "Germanic")).toBe("neuter");
    });

    it("should detect Greek genders correctly", () => {
      expect(detectGender("Helios", "Greek")).toBe("masculine");
      expect(detectGender("Athena", "Greek")).toBe("feminine");
      expect(detectGender("Parthenon", "Greek")).toBe("neuter");
    });

    it("should detect Constructed genders correctly", () => {
      expect(detectGender("Mithril", "Constructed")).toBe("feminine");
      expect(detectGender("Elendil", "Elf")).toBe("neuter"); // default
      expect(detectGender("Elessar", "Tolkien")).toBe("neuter"); // default
    });
  });

  describe("generateNounDeclension", () => {
    it("should decline Latin 1st declension nouns (-a)", () => {
      const table = generateNounDeclension("Roma", "Latin");
      expect(table.nominative.singular).toBe("Roma");
      expect(table.nominative.plural).toBe("Romae");
      expect(table.genitive.singular).toBe("Romae");
      expect(table.genitive.plural).toBe("Romarum");
      expect(table.accusative.singular).toBe("Romam");
      expect(table.dative.plural).toBe("Romis");
    });

    it("should decline Latin 2nd declension masculine nouns (-us)", () => {
      const table = generateNounDeclension("Marcus", "Latin");
      expect(table.nominative.singular).toBe("Marcus");
      expect(table.nominative.plural).toBe("Marci");
      expect(table.genitive.singular).toBe("Marci");
      expect(table.genitive.plural).toBe("Marcorum");
      expect(table.accusative.singular).toBe("Marcum");
      expect(table.dative.plural).toBe("Marcis");
    });

    it("should decline Greek nouns (-os)", () => {
      const table = generateNounDeclension("Helios", "Greek");
      expect(table.nominative.singular).toBe("Helios");
      expect(table.nominative.plural).toBe("Helioi");
      expect(table.genitive.singular).toBe("Heliou");
      expect(table.genitive.plural).toBe("Helion");
      expect(table.accusative.singular).toBe("Helion");
      expect(table.accusative.plural).toBe("Helious");
    });

    it("should decline Constructed nouns (Quenya-like)", () => {
      const table = generateNounDeclension("Valar", "Constructed");
      expect(table.nominative.singular).toBe("Valar");
      expect(table.nominative.plural).toBe("Valari");
      expect(table.genitive.singular).toBe("Valaro");
      expect(table.genitive.plural).toBe("Valarion");
    });
  });

  describe("getMorphologyDetails", () => {
    it("should return correct merged details", () => {
      const details = getMorphologyDetails("Carthago", "Latin");
      expect(details.gender).toBe("masculine");
      expect(details.declensionTable.nominative.singular).toBe("Carthago");
      expect(details.declensionTable.nominative.plural).toBe("Carthagoes"); // 3rd declension fallback
    });
  });
});
