// src/lib/onoma/data-bridge.ts
// Onoma Lab — Universal Linguistic Data Bridge & Dynamic Phonetic Analysis
// Cross-System Data Interoperability across CREATE · STUDIO · EXPLORE · STASH

import { translateToIPA } from "./phonology";
import { getAllProfileSeeds } from "./comparator";
import { IPA_VOWEL_SET } from "./phonetics-shared";
import type { CulturalProfile } from "./types";

export interface DynamicCorpus {
  id: string;
  label: string;
  words: string[];
  type: "culture" | "custom" | "stash" | "studio";
  cultureTag?: CulturalProfile;
  category?: string | null;
}

export interface DynamicPhoneticInventory {
  phonemes: string[];
  vowels: string[];
  consonants: string[];
  entropy: number;
  sampleCount: number;
}

export interface DynamicComparisonResult {
  labelA: string;
  labelB: string;
  linguisticDistance: number; // 0 to 100 (0 = identical, 100 = completely distant)
  phonemeOverlap: number; // 0 to 100%
  bigramSimilarity: number; // 0 to 100%
  sharedPhonemes: string[];
  uniqueToA: string[];
  uniqueToB: string[];
  entropyA: number;
  entropyB: number;
  entropyDelta: number;
}



/**
 * Extract clean IPA phonemes from an arbitrary list of words.
 */
export function extractPhonemeInventory(
  words: string[],
  fallbackCulture: string = "latin"
): DynamicPhoneticInventory {
  const phonemeSet = new Set<string>();
  const vowelSet = new Set<string>();
  const consonantSet = new Set<string>();

  const validWords = words.filter((w) => Boolean(w && w.trim()));
  const samples = validWords.length > 0 ? validWords : ["alcius", "verona"];

  for (const word of samples) {
    const ipa = translateToIPA(word, fallbackCulture);
    // Tokenize IPA (handling simple digraphs and stress marks)
    const cleaned = ipa.replace(/['ˈˌ.]/g, "");
    for (const char of cleaned) {
      if (char.trim()) {
        phonemeSet.add(char);
        if (IPA_VOWEL_SET.has(char)) {
          vowelSet.add(char);
        } else {
          consonantSet.add(char);
        }
      }
    }
  }

  const entropy = computeShannonEntropy(samples);

  return {
    phonemes: Array.from(phonemeSet).sort(),
    vowels: Array.from(vowelSet).sort(),
    consonants: Array.from(consonantSet).sort(),
    entropy,
    sampleCount: samples.length,
  };
}

/**
 * Calculates Shannon Entropy H(X) in bits from letter/phoneme distributions.
 * H = -sum(p_i * log2(p_i))
 */
export function computeShannonEntropy(words: string[]): number {
  if (words.length === 0) return 0;
  const counts: Record<string, number> = {};
  let total = 0;

  for (const word of words) {
    for (const char of word.toLowerCase()) {
      if (/[a-z\u00C0-\u024F]/i.test(char)) {
        counts[char] = (counts[char] || 0) + 1;
        total++;
      }
    }
  }

  if (total === 0) return 0;

  let entropy = 0;
  for (const count of Object.values(counts)) {
    const p = count / total;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return Math.round(entropy * 1000) / 1000;
}

/**
 * Calculates bigram frequency profile of a word list.
 */
export function computeBigramFrequencies(words: string[]): Record<string, number> {
  const bigrams: Record<string, number> = {};
  let total = 0;

  for (const word of words) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    for (let i = 0; i < clean.length - 1; i++) {
      const bg = clean.slice(i, i + 2);
      bigrams[bg] = (bigrams[bg] || 0) + 1;
      total++;
    }
  }

  if (total === 0) return {};
  const normalized: Record<string, number> = {};
  for (const [bg, count] of Object.entries(bigrams)) {
    normalized[bg] = count / total;
  }
  return normalized;
}

/**
 * Compares any two custom or built-in word lists dynamically.
 */
export function compareDynamicWordLists(
  wordsA: string[],
  labelA: string,
  cultureA: string,
  wordsB: string[],
  labelB: string,
  cultureB: string
): DynamicComparisonResult {
  const invA = extractPhonemeInventory(wordsA, cultureA);
  const invB = extractPhonemeInventory(wordsB, cultureB);

  const setA = new Set(invA.phonemes);
  const setB = new Set(invB.phonemes);

  const sharedPhonemes: string[] = [];
  const uniqueToA: string[] = [];
  const uniqueToB: string[] = [];

  for (const ph of setA) {
    if (setB.has(ph)) {
      sharedPhonemes.push(ph);
    } else {
      uniqueToA.push(ph);
    }
  }

  for (const ph of setB) {
    if (!setA.has(ph)) {
      uniqueToB.push(ph);
    }
  }

  const unionSize = setA.size + setB.size - sharedPhonemes.length;
  const phonemeOverlap = unionSize > 0 ? Math.round((sharedPhonemes.length / unionSize) * 100) : 0;

  // Bigram Cosine Similarity
  const bgA = computeBigramFrequencies(wordsA);
  const bgB = computeBigramFrequencies(wordsB);

  const allBigrams = new Set([...Object.keys(bgA), ...Object.keys(bgB)]);
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (const bg of allBigrams) {
    const valA = bgA[bg] || 0;
    const valB = bgB[bg] || 0;
    dotProduct += valA * valB;
    magA += valA * valA;
    magB += valB * valB;
  }

  const bigramSimilarity =
    magA > 0 && magB > 0
      ? Math.round((dotProduct / (Math.sqrt(magA) * Math.sqrt(magB))) * 100)
      : 0;

  // Composite Distance: 100 - (0.6 * phonemeOverlap + 0.4 * bigramSimilarity)
  const linguisticDistance = Math.max(
    0,
    Math.min(100, Math.round(100 - (0.6 * phonemeOverlap + 0.4 * bigramSimilarity)))
  );

  const entropyDelta = Math.round(Math.abs(invA.entropy - invB.entropy) * 1000) / 1000;

  return {
    labelA,
    labelB,
    linguisticDistance,
    phonemeOverlap,
    bigramSimilarity,
    sharedPhonemes: sharedPhonemes.sort(),
    uniqueToA: uniqueToA.sort(),
    uniqueToB: uniqueToB.sort(),
    entropyA: invA.entropy,
    entropyB: invB.entropy,
    entropyDelta,
  };
}

/**
 * Resolves standard seeds or custom words for any dynamic corpus ID.
 */
export function resolveCorpusWords(
  corpusId: string,
  customDicts?: Array<{ id: string; title: string; values: string[] }>,
  studioWords?: string[]
): { words: string[]; label: string; fallbackCulture: string } {
  // 1. Check studio words
  if (corpusId === "studio-active" && studioWords && studioWords.length > 0) {
    return {
      words: studioWords,
      label: "Active Studio Lexicon",
      fallbackCulture: "constructed",
    };
  }

  // 2. Check custom stash dictionaries
  if (customDicts && customDicts.length > 0) {
    const found = customDicts.find((d) => d.id === corpusId || d.title.toLowerCase() === corpusId.toLowerCase());
    if (found) {
      return {
        words: found.values,
        label: found.title,
        fallbackCulture: "constructed",
      };
    }
  }

  // 3. Fallback to standard cultural profile seeds
  const seeds = getAllProfileSeeds(corpusId as CulturalProfile);
  return {
    words: seeds.length > 0 ? seeds : ["alcius", "verona", "roma"],
    label: corpusId.charAt(0).toUpperCase() + corpusId.slice(1),
    fallbackCulture: corpusId,
  };
}
