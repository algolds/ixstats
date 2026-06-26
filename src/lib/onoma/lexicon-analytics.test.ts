// src/lib/onoma/lexicon-analytics.test.ts
// Onoma Lab — Lexicon Analytics Unit Tests

import {
  getLetterFrequencies,
  getNgramFrequencies,
  calculateEntropy,
  auditLexiconHealth,
} from "./lexicon-analytics";

describe("Lexicon Analytics", () => {
  describe("getLetterFrequencies", () => {
    it("should compute correct frequencies for simple words", () => {
      const words = ["aba", "c"];
      // Letters: a (2), b (1), c (1). Total: 4
      const freqs = getLetterFrequencies(words);

      expect(freqs).toHaveLength(3);
      expect(freqs[0]).toEqual({ letter: "a", frequency: 0.5 });
      // b and c have 0.25, order might be based on sort or occurrence
      expect(freqs.find(f => f.letter === "b")?.frequency).toBe(0.25);
      expect(freqs.find(f => f.letter === "c")?.frequency).toBe(0.25);
    });

    it("should ignore case and non-alphabetic characters", () => {
      const words = ["A-B!", "123a"];
      // Letters: a (2), b (1). Total: 3
      const freqs = getLetterFrequencies(words);
      expect(freqs).toHaveLength(2);
      expect(freqs.find(f => f.letter === "a")?.frequency).toBeCloseTo(2 / 3);
      expect(freqs.find(f => f.letter === "b")?.frequency).toBeCloseTo(1 / 3);
    });

    it("should return empty array for empty or invalid inputs", () => {
      expect(getLetterFrequencies([])).toEqual([]);
      expect(getLetterFrequencies(["123!", "???"])).toEqual([]);
    });
  });

  describe("getNgramFrequencies", () => {
    it("should extract bigrams correctly", () => {
      const words = ["roma", "oma"];
      // Bigrams in "roma" -> "ro", "om", "ma"
      // Bigrams in "oma" -> "om", "ma"
      // Total counts: "om" (2), "ma" (2), "ro" (1)
      const ngrams = getNgramFrequencies(words, 2);

      expect(ngrams).toHaveLength(3);
      expect(ngrams[0].count).toBe(2);
      expect(ngrams[1].count).toBe(2);
      expect(ngrams[2]).toEqual({ ngram: "ro", count: 1 });
    });

    it("should return empty if words are shorter than n", () => {
      expect(getNgramFrequencies(["a", "b"], 2)).toEqual([]);
    });
  });

  describe("calculateEntropy", () => {
    it("should return 0 for empty lists", () => {
      expect(calculateEntropy([])).toBe(0);
    });

    it("should return 0 for a single repeating letter", () => {
      expect(calculateEntropy(["aaaa"])).toBe(0);
    });

    it("should compute maximum entropy for a uniform distribution", () => {
      // 4 letters: a, b, c, d. Each frequency = 0.25
      // H(X) = -4 * (0.25 * log2(0.25)) = -4 * (0.25 * -2) = 2
      const words = ["abcd"];
      expect(calculateEntropy(words)).toBeCloseTo(2);
    });
  });

  describe("auditLexiconHealth", () => {
    it("should score 0 for empty lexicon", () => {
      const report = auditLexiconHealth([]);
      expect(report.score).toBe(0);
      expect(report.issues[0]).toContain("empty");
    });

    it("should score low for critically small lexicons", () => {
      const report = auditLexiconHealth(["Roma", "Pompeii"]);
      expect(report.score).toBeLessThan(100);
      expect(report.issues.some(i => i.includes("small"))).toBe(true);
    });

    it("should deduct score for duplicates", () => {
      // 6 words, 1 duplicate
      const report = auditLexiconHealth(["Roma", "Pompeii", "Verona", "Roma", "Toletum", "Tarraco"]);
      expect(report.score).toBeLessThan(100);
      expect(report.issues.some(i => i.toLowerCase().includes("duplicate"))).toBe(true);
    });

    it("should deduct score for invalid characters", () => {
      const report = auditLexiconHealth(["Roma1", "Pompeii", "Verona", "Toletum", "Tarraco", "Athera"]);
      expect(report.score).toBeLessThan(100);
      expect(report.issues.some(i => i.toLowerCase().includes("special characters"))).toBe(true);
    });

    it("should deduct score for noise/placeholder words", () => {
      const report = auditLexiconHealth(["Roma", "Pompeii", "Verona", "Toletum", "Tarraco", "undefined", "test"]);
      expect(report.score).toBeLessThan(100);
      expect(report.issues.some(i => i.toLowerCase().includes("noise"))).toBe(true);
    });
  });
});
