// src/lib/onoma/phonetics-shared.ts
// Centralized IPA phonetic constants, vowel matrices, consonant inventories, and phonotactic rules

export const IPA_VOWELS = [
  "i",
  "ɪ",
  "e",
  "ɛ",
  "æ",
  "a",
  "ɑ",
  "ɒ",
  "ɔ",
  "o",
  "ʊ",
  "u",
  "ʌ",
  "ə",
  "ø",
  "y",
  "œ",
  "ɨ",
  "ʉ",
  "ɯ",
] as const;

export const IPA_VOWEL_SET: ReadonlySet<string> = new Set(IPA_VOWELS);

/**
 * Returns true if character is a standard Latin or IPA vowel.
 */
export function isVowel(c: string): boolean {
  if (!c) return false;
  const cl = c.toLowerCase();
  return "aeiouyäëöüáéíóúàèìòùâêîôûãẽĩõũøæå".includes(cl) || IPA_VOWEL_SET.has(cl);
}

export const IPA_CONSONANTS = [
  "p",
  "b",
  "t",
  "d",
  "k",
  "ɡ",
  "f",
  "v",
  "θ",
  "ð",
  "s",
  "z",
  "ʃ",
  "ʒ",
  "h",
  "x",
  "ɣ",
  "ɬ",
  "ɮ",
  "m",
  "n",
  "ŋ",
  "l",
  "ɹ",
  "j",
  "w",
  "r",
  "ɾ",
  "tʃ",
  "dʒ",
  "ts",
] as const;

export const IPA_DIPHTHONGS = [
  "aɪ",
  "eɪ",
  "aʊ",
  "ɔɪ",
  "oʊ",
  "əʊ",
  "iː",
  "uː",
  "ɑː",
  "ɔː",
  "ɜː",
  "əː",
  "ː",
] as const;

export const STANDARD_CULTURES = [
  "latin",
  "germanic",
  "celtic",
  "slavic",
  "arabic",
  "persian",
  "turkic",
  "indic",
  "east-asian",
  "austronesian",
  "african",
  "uralic",
  "constructed",
] as const;

export type StandardCulture = (typeof STANDARD_CULTURES)[number];

export const PHONOTACTIC_PRESETS: Record<
  string,
  {
    maxConsonantCluster?: number;
    maxVowelCluster?: number;
    allowDoubleLetters?: boolean;
    vowelHarmony?: "none" | "front" | "back";
  }
> = {
  austronesian: { maxConsonantCluster: 1, maxVowelCluster: 2 },
  "east-asian": { maxConsonantCluster: 1, maxVowelCluster: 2 },
  arabic: { maxConsonantCluster: 2, maxVowelCluster: 2 },
  persian: { maxConsonantCluster: 2, maxVowelCluster: 2 },
  turkic: { maxConsonantCluster: 2, maxVowelCluster: 2, vowelHarmony: "back" },
  indic: { maxConsonantCluster: 2, maxVowelCluster: 2 },
  african: { maxConsonantCluster: 2, maxVowelCluster: 2 },
  uralic: { maxConsonantCluster: 2, maxVowelCluster: 2, vowelHarmony: "front" },
  germanic: { maxConsonantCluster: 3, maxVowelCluster: 2 },
  slavic: { maxConsonantCluster: 4, maxVowelCluster: 2 },
};
