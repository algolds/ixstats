// src/lib/onoma/phonology.ts
// Onoma Lab — Phonology & Grapheme-to-IPA Translation Engine

// Standard English-like phonetic rules for fallback
const DEFAULT_RULES: [string, string][] = [
  ["sch", "ʃ"],
  ["ch", "tʃ"],
  ["sh", "ʃ"],
  ["th", "θ"],
  ["ph", "f"],
  ["ee", "iː"],
  ["oo", "uː"],
  ["ae", "eɪ"],
  ["ou", "aʊ"],
  ["ai", "eɪ"],
  ["ce", "se"],
  ["ci", "si"],
  ["cy", "sy"],
  ["c", "k"],
  ["qu", "kw"],
  ["x", "ks"],
  ["j", "dʒ"],
];

const CULTURE_RULES: Record<string, [string, string][]> = {
  latin: [
    ["ph", "f"],
    ["th", "t"],
    ["ch", "k"],
    ["ce", "tse"],
    ["ci", "tsi"],
    ["cy", "tsy"],
    ["cæ", "tsaɪ"],
    ["cœ", "tsɔɪ"],
    ["ae", "aɪ"],
    ["œ", "ɔɪ"],
    ["c", "k"],
    ["ge", "dʒe"],
    ["gi", "dʒi"],
    ["gy", "dʒy"],
    ["g", "g"],
    ["v", "w"],
    ["x", "ks"],
    ["j", "j"],
    ["r", "ɾ"],
  ],
  germanic: [
    ["sch", "ʃ"],
    ["ch", "x"],
    ["ei", "aɪ"],
    ["ie", "iː"],
    ["tz", "ts"],
    ["ph", "f"],
    ["v", "f"],
    ["w", "v"],
    ["z", "ts"],
    ["j", "j"],
    ["ä", "ɛ"],
    ["ö", "ø"],
    ["ü", "y"],
    ["r", "ʁ"],
  ],
  celtic: [
    ["bh", "v"],
    ["ch", "x"],
    ["dh", "ð"],
    ["gh", "ɣ"],
    ["fh", ""], // silent
    ["mh", "v"],
    ["sh", "h"],
    ["th", "θ"],
    ["ll", "ɬ"],
    ["r", "ɾ"],
  ],
  slavic: [
    ["sz", "ʃ"],
    ["cz", "tʃ"],
    ["rz", "ʒ"],
    ["ch", "x"],
    ["c", "ts"],
    ["j", "j"],
    ["y", "i"],
    ["r", "r"],
  ],
  arabic: [
    ["kh", "x"],
    ["gh", "ɣ"],
    ["sh", "ʃ"],
    ["th", "θ"],
    ["dh", "ð"],
    ["aa", "aː"],
    ["ee", "iː"],
    ["uu", "uː"],
    ["q", "q"],
    ["r", "ɾ"],
  ],
  "east-asian": [
    ["sy", "ʃ"],
    ["ty", "tʃ"],
    ["ch", "tʃ"],
    ["sh", "ʃ"],
    ["ts", "ts"],
    ["r", "ɾ"],
  ],
  austronesian: [
    ["ng", "ŋ"],
    ["wh", "f"],
    ["r", "ɾ"],
  ],
  constructed: [
    ["dh", "ð"],
    ["th", "θ"],
    ["ch", "x"],
    ["ph", "f"],
    ["lh", "ɬ"],
    ["c", "k"],
    ["r", "ɾ"],
  ],
};

const IPA_VOWELS = /[aeiouyøɛɔœɨææǽǣ]/i;

/** Built-in grapheme→IPA rules for a culture, exposed so the IPA Studio can show/extend them. */
export function getCultureRules(culture: string | null): [string, string][] {
  const primaryCulture = culture ? culture.split("+")[0].toLowerCase().trim() : "any";
  return CULTURE_RULES[primaryCulture] || DEFAULT_RULES;
}

/**
 * Translates a given name string into its International Phonetic Alphabet (IPA) representation
 * based on the specified culture family.
 *
 * `overrideRules` are user-supplied grapheme→IPA pairs (from the IPA Studio) that take priority
 * over the built-in culture rules. Multi-character precedence is preserved by the scanner.
 */
export function translateToIPA(
  name: string,
  culture: string | null,
  overrideRules?: [string, string][]
): string {
  if (!name || !name.trim()) return "";

  // Parse culture compounds (e.g. "germanic+slavic" -> "germanic")
  const primaryCulture = culture ? culture.split("+")[0].toLowerCase().trim() : "any";
  const baseRules = CULTURE_RULES[primaryCulture] || DEFAULT_RULES;
  const rules =
    overrideRules && overrideRules.length > 0 ? [...overrideRules, ...baseRules] : baseRules;

  // Process word-by-word to preserve spaces and hyphens
  const words = name.split(/(\s+|-)/);
  const translatedWords = words.map((part) => {
    // If it's punctuation or spacing, leave it
    if (/^[\s\-'\"]+$/.test(part)) return part;

    const lowerWord = part.toLowerCase();
    let ipaWord = "";
    let i = 0;

    // Left-to-right matching scanner
    while (i < lowerWord.length) {
      let matched = false;

      // Try multi-character rules first (sorted by length descending is implicit by our arrays)
      for (const [grapheme, ipa] of rules) {
        if (grapheme.length > 1 && lowerWord.startsWith(grapheme, i)) {
          ipaWord += ipa;
          i += grapheme.length;
          matched = true;
          break;
        }
      }

      if (matched) continue;

      // Try single-character rules
      for (const [grapheme, ipa] of rules) {
        if (grapheme.length === 1 && lowerWord[i] === grapheme) {
          ipaWord += ipa;
          i++;
          matched = true;
          break;
        }
      }

      if (matched) continue;

      // Fallback: append character as is
      ipaWord += lowerWord[i];
      i++;
    }

    // Apply Syllable-Aware Stress Heuristic:
    // Identify the first syllable and place the stress marker 'ˈ' right before
    // the consonant cluster preceding its vowel group.
    return applyStress(ipaWord);
  });

  return `/${translatedWords.join("")}/`;
}

/**
 * Inserts the primary stress mark 'ˈ' before the consonant onset of the first syllable.
 */
function applyStress(word: string): string {
  if (!word) return "";

  // Find the index of the first vowel
  const match = word.match(IPA_VOWELS);
  if (!match || match.index === undefined) return word;

  const firstVowelIndex = match.index;

  // Find the starting point of the consonant cluster preceding the first vowel
  let onsetIndex = firstVowelIndex;
  while (onsetIndex > 0) {
    const prevChar = word[onsetIndex - 1];
    // Stop if we hit a non-alphabetic character (e.g. space, apostrophe)
    if (!/[a-zøɛɔœɨŋʃtʃθðɬʁvj]/.test(prevChar) || IPA_VOWELS.test(prevChar)) {
      break;
    }
    onsetIndex--;
  }

  // Insert stress mark
  return word.slice(0, onsetIndex) + "ˈ" + word.slice(onsetIndex);
}
