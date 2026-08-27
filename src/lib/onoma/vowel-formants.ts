// src/lib/onoma/vowel-formants.ts
// Onoma — Acoustic Phonetics & IPA Vowel Quadrilateral Formant Coordinates

export interface VowelFormant {
  ipa: string;
  f1: number; // Hz (Height: lower value = high/close jaw, higher value = low/open jaw)
  f2: number; // Hz (Frontness: higher value = front tongue, lower value = back tongue)
  label: string;
  category: "front" | "central" | "back";
  openness: "close" | "near-close" | "close-mid" | "open-mid" | "open";
}

/** Standard acoustic phonetics reference frequencies (in Hz) for cardinal vowels */
export const IPA_VOWEL_FORMANTS: Record<string, VowelFormant> = {
  i: { ipa: "i", f1: 280, f2: 2250, label: "Close Front", category: "front", openness: "close" },
  y: {
    ipa: "y",
    f1: 290,
    f2: 2000,
    label: "Close Front Rounded",
    category: "front",
    openness: "close",
  },
  ɪ: {
    ipa: "ɪ",
    f1: 390,
    f2: 1990,
    label: "Near-Close Front",
    category: "front",
    openness: "near-close",
  },
  e: {
    ipa: "e",
    f1: 400,
    f2: 1900,
    label: "Close-Mid Front",
    category: "front",
    openness: "close-mid",
  },
  ø: {
    ipa: "ø",
    f1: 410,
    f2: 1600,
    label: "Close-Mid Front Rounded",
    category: "front",
    openness: "close-mid",
  },
  ɛ: {
    ipa: "ɛ",
    f1: 550,
    f2: 1750,
    label: "Open-Mid Front",
    category: "front",
    openness: "open-mid",
  },
  œ: {
    ipa: "œ",
    f1: 560,
    f2: 1500,
    label: "Open-Mid Front Rounded",
    category: "front",
    openness: "open-mid",
  },
  æ: { ipa: "æ", f1: 660, f2: 1720, label: "Near-Open Front", category: "front", openness: "open" },
  a: { ipa: "a", f1: 750, f2: 1550, label: "Open Front", category: "front", openness: "open" },
  ä: { ipa: "ä", f1: 750, f2: 1350, label: "Open Central", category: "central", openness: "open" },
  ɑ: { ipa: "ɑ", f1: 700, f2: 1100, label: "Open Back", category: "back", openness: "open" },
  ɒ: {
    ipa: "ɒ",
    f1: 680,
    f2: 1000,
    label: "Open Back Rounded",
    category: "back",
    openness: "open",
  },
  ʌ: {
    ipa: "ʌ",
    f1: 600,
    f2: 1170,
    label: "Open-Mid Back",
    category: "back",
    openness: "open-mid",
  },
  ɔ: {
    ipa: "ɔ",
    f1: 570,
    f2: 900,
    label: "Open-Mid Back Rounded",
    category: "back",
    openness: "open-mid",
  },
  o: {
    ipa: "o",
    f1: 450,
    f2: 950,
    label: "Close-Mid Back",
    category: "back",
    openness: "close-mid",
  },
  ʊ: {
    ipa: "ʊ",
    f1: 440,
    f2: 1020,
    label: "Near-Close Back",
    category: "back",
    openness: "near-close",
  },
  u: { ipa: "u", f1: 300, f2: 800, label: "Close Back", category: "back", openness: "close" },
  ə: {
    ipa: "ə",
    f1: 500,
    f2: 1400,
    label: "Mid Central (Schwa)",
    category: "central",
    openness: "close-mid",
  },
  ɨ: {
    ipa: "ɨ",
    f1: 300,
    f2: 1500,
    label: "Close Central",
    category: "central",
    openness: "close",
  },
  ʉ: {
    ipa: "ʉ",
    f1: 310,
    f2: 1400,
    label: "Close Central Rounded",
    category: "central",
    openness: "close",
  },
};

/** All background reference vowels on the standard IPA chart */
export const CARDINAL_VOWEL_GRID = Object.values(IPA_VOWEL_FORMANTS);

/**
 * Extracts recognized vowel formant points in chronological sequence from an IPA phonetic string.
 */
export function extractVowelsFromIpa(ipa: string): VowelFormant[] {
  if (!ipa) return [];
  // Strip non-phonetic punctuation (brackets, slashes, stress marks, length marks, tie bars)
  const clean = ipa.replace(/[/[\]ˈˌː.͡_]/g, "");
  const found: VowelFormant[] = [];

  for (const ch of clean) {
    if (IPA_VOWEL_FORMANTS[ch]) {
      found.push(IPA_VOWEL_FORMANTS[ch]!);
    }
  }
  return found;
}

/**
 * Maps an F2 (Frontness) frequency to an X coordinate on an inverted acoustic scale (2500Hz on left, 700Hz on right).
 */
export function f2ToX(f2: number, width: number, padding = 40, minF2 = 700, maxF2 = 2500): number {
  const clamped = Math.max(minF2, Math.min(maxF2, f2));
  // Inverted: higher F2 is further left (front)
  const ratio = (maxF2 - clamped) / (maxF2 - minF2);
  return padding + ratio * (width - 2 * padding);
}

/**
 * Maps an F1 (Height/Openness) frequency to a Y coordinate on an inverted acoustic scale (200Hz on top, 900Hz on bottom).
 */
export function f1ToY(f1: number, height: number, padding = 40, minF1 = 200, maxF1 = 900): number {
  const clamped = Math.max(minF1, Math.min(maxF1, f1));
  // Inverted: lower F1 is higher on screen (close vowels at top)
  const ratio = (clamped - minF1) / (maxF1 - minF1);
  return padding + ratio * (height - 2 * padding);
}

/**
 * Computes the mean acoustic center of gravity ($F_1/F_2$) for a collection of vowels in a word or lexicon.
 */
export function calculateAcousticCenter(vowels: VowelFormant[]): { f1: number; f2: number } | null {
  if (vowels.length === 0) return null;
  const total = vowels.reduce((acc, v) => ({ f1: acc.f1 + v.f1, f2: acc.f2 + v.f2 }), {
    f1: 0,
    f2: 0,
  });
  return {
    f1: Math.round(total.f1 / vowels.length),
    f2: Math.round(total.f2 / vowels.length),
  };
}
