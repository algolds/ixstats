// src/lib/onoma/comparator.test.ts
// Onoma — Linguistic Profile Comparator Tests

import { describe, expect, test } from "@jest/globals";
import {
  calculateJaccardSimilarity,
  calculateCosineSimilarity,
  compareProfiles,
} from "~/lib/onoma/comparator";

describe("Onoma Comparator Engine", () => {
  test("Jaccard Similarity calculates correct overlap percentages", () => {
    const setA = new Set(["a", "b", "c", "d"]);
    const setB = new Set(["c", "d", "e", "f"]);
    const setEmpty = new Set<string>();

    // Intersection: c, d (size 2). Union: a, b, c, d, e, f (size 6). Jaccard = 2/6 = 0.333
    expect(calculateJaccardSimilarity(setA, setB)).toBeCloseTo(0.3333, 4);

    // Identical sets Jaccard = 1.0
    expect(calculateJaccardSimilarity(setA, setA)).toBe(1.0);

    // Completely separate sets Jaccard = 0.0
    expect(calculateJaccardSimilarity(new Set(["a"]), new Set(["b"]))).toBe(0.0);

    // Empty sets Jaccard = 1.0
    expect(calculateJaccardSimilarity(setEmpty, setEmpty)).toBe(1.0);
  });

  test("Cosine Similarity computes correct cosine values", () => {
    const bigramsA = [
      { ngram: "ka", count: 10 },
      { ngram: "ra", count: 5 },
    ];
    const bigramsB = [
      { ngram: "ka", count: 8 },
      { ngram: "ra", count: 4 },
    ];
    const bigramsC = [
      { ngram: "za", count: 10 },
      { ngram: "ba", count: 5 },
    ];

    // Parallel vectors should yield 1.0 (identical direction)
    expect(calculateCosineSimilarity(bigramsA, bigramsB)).toBeCloseTo(1.0, 4);

    // Disjoint bigrams (orthogonal vectors) should yield 0.0
    expect(calculateCosineSimilarity(bigramsA, bigramsC)).toBe(0.0);
  });

  test("compareProfiles returns valid comparison payload structure", () => {
    const result = compareProfiles("latin", "germanic");

    expect(result).toHaveProperty("phonemeOverlap");
    expect(result).toHaveProperty("bigramSimilarity");
    expect(result).toHaveProperty("entropyDelta");
    expect(result).toHaveProperty("linguisticDistance");
    expect(result).toHaveProperty("sharedPhonemes");
    expect(result).toHaveProperty("uniqueToA");
    expect(result).toHaveProperty("uniqueToB");

    expect(typeof result.phonemeOverlap).toBe("number");
    expect(typeof result.bigramSimilarity).toBe("number");
    expect(typeof result.linguisticDistance).toBe("number");
    expect(result.linguisticDistance).toBeGreaterThanOrEqual(0);
    expect(result.linguisticDistance).toBeLessThanOrEqual(100);

    expect(Array.isArray(result.sharedPhonemes)).toBe(true);
    expect(Array.isArray(result.uniqueToA)).toBe(true);
    expect(Array.isArray(result.uniqueToB)).toBe(true);
  });
});
