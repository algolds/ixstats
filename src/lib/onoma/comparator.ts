// src/lib/onoma/comparator.ts
// Onoma — Linguistic Profile Comparator Engine

import { CULTURAL_PROFILES } from "./cultural-profiles";
import { segmentGraphemes } from "./phonology";
import { calculateEntropy, getNgramFrequencies } from "./lexicon-analytics";
import type { CulturalProfile } from "./types";

/**
 * Extracts unique IPA phonemes/segments from a cultural profile's seed lists.
 */
export function getPhonemeInventory(profile: CulturalProfile): Set<string> {
  const phonemes = new Set<string>();
  const categories = Object.keys(CULTURAL_PROFILES[profile] ?? {}) as Array<
    keyof (typeof CULTURAL_PROFILES)[CulturalProfile]
  >;

  for (const cat of categories) {
    const names = CULTURAL_PROFILES[profile]?.[cat] || [];
    for (const name of names) {
      const segments = segmentGraphemes(name, profile);
      for (const seg of segments) {
        if (seg.ipa && /[a-zøɛɔœɨŋʃθðɬʁvjˈ]/.test(seg.ipa)) {
          // Normalize phoneme (remove stress markings or brackets for strict inventory comparison)
          const cleanPhoneme = seg.ipa.replace(/[ˈ\[\]\/]/g, "").trim();
          if (cleanPhoneme) {
            phonemes.add(cleanPhoneme);
          }
        }
      }
    }
  }

  return phonemes;
}

/**
 * Get all seed words grouped across all categories for a cultural profile.
 */
export function getAllProfileSeeds(profile: CulturalProfile): string[] {
  const seeds: string[] = [];
  const categories = Object.keys(CULTURAL_PROFILES[profile] ?? {}) as Array<
    keyof (typeof CULTURAL_PROFILES)[CulturalProfile]
  >;

  for (const cat of categories) {
    seeds.push(...(CULTURAL_PROFILES[profile]?.[cat] || []));
  }

  return seeds;
}

/**
 * Calculate Jaccard similarity between two sets.
 * J(A, B) = |A ∩ B| / |A ∪ B|
 */
export function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1.0;

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Calculate cosine similarity between two bigram frequency maps.
 */
export function calculateCosineSimilarity(
  bigramsA: { ngram: string; count: number }[],
  bigramsB: { ngram: string; count: number }[]
): number {
  const mapA = new Map<string, number>();
  const mapB = new Map<string, number>();

  let sumA2 = 0;
  bigramsA.forEach((x) => {
    mapA.set(x.ngram, x.count);
    sumA2 += x.count * x.count;
  });

  let sumB2 = 0;
  bigramsB.forEach((x) => {
    mapB.set(x.ngram, x.count);
    sumB2 += x.count * x.count;
  });

  if (sumA2 === 0 || sumB2 === 0) return 0.0;

  let dotProduct = 0;
  const allNgrams = new Set([...mapA.keys(), ...mapB.keys()]);
  allNgrams.forEach((ngram) => {
    const valA = mapA.get(ngram) || 0;
    const valB = mapB.get(ngram) || 0;
    dotProduct += valA * valB;
  });

  return dotProduct / (Math.sqrt(sumA2) * Math.sqrt(sumB2));
}

export interface ComparisonResult {
  phonemeOverlap: number; // Jaccard similarity percentage (0-100)
  bigramSimilarity: number; // Cosine similarity percentage (0-100)
  entropyDelta: number; // Absolute difference in shannon entropy
  linguisticDistance: number; // Composite distance score (0-100)
  sharedPhonemes: string[];
  uniqueToA: string[];
  uniqueToB: string[];
  entropyA: number;
  entropyB: number;
}

/**
 * Compares two linguistic profiles across multiple dimensions and returns a detailed analysis.
 */
export function compareProfiles(
  profileA: CulturalProfile,
  profileB: CulturalProfile
): ComparisonResult {
  const phonemesA = getPhonemeInventory(profileA);
  const phonemesB = getPhonemeInventory(profileB);

  const sharedPhonemes = Array.from(phonemesA).filter((x) => phonemesB.has(x));
  const uniqueToA = Array.from(phonemesA).filter((x) => !phonemesB.has(x));
  const uniqueToB = Array.from(phonemesB).filter((x) => !phonemesA.has(x));

  const phonemeOverlap = calculateJaccardSimilarity(phonemesA, phonemesB);

  const seedsA = getAllProfileSeeds(profileA);
  const seedsB = getAllProfileSeeds(profileB);

  const bigramsA = getNgramFrequencies(seedsA, 2);
  const bigramsB = getNgramFrequencies(seedsB, 2);

  const bigramSimilarity = calculateCosineSimilarity(bigramsA, bigramsB);

  const entropyA = calculateEntropy(seedsA);
  const entropyB = calculateEntropy(seedsB);
  const entropyDelta = Math.abs(entropyA - entropyB);

  // Composite linguistic distance score (0 to 100)
  // Higher distance means more different.
  // We weight phoneme overlap (Jaccard) at 50% and bigram similarity (Cosine) at 50%.
  const similarityScore = (phonemeOverlap * 0.5 + bigramSimilarity * 0.5) * 100;
  const linguisticDistance = Math.max(0, Math.min(100, Math.round(100 - similarityScore)));

  return {
    phonemeOverlap: Math.round(phonemeOverlap * 100),
    bigramSimilarity: Math.round(bigramSimilarity * 100),
    entropyDelta,
    linguisticDistance,
    sharedPhonemes: sharedPhonemes.sort(),
    uniqueToA: uniqueToA.sort(),
    uniqueToB: uniqueToB.sort(),
    entropyA,
    entropyB,
  };
}
