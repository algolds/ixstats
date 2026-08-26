// src/lib/onoma/phonology.ts
// Onoma Lab — Phonology & Grapheme-to-IPA Translation Engine

import {
  TEMPLATE_PHONETIC_PROFILES,
  getTemplateLinguisticProfile,
} from "./template-phonetics";
import { getNameOverride } from "./ipa-overrides";
import type { IPAString, ResolvedNamePhonetics } from "./types";

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

export const CULTURE_RULES: Record<string, [string, string][]> = {
  latin: [
    ["ph", "f"],
    ["th", "t"],
    ["ch", "k"],
    ["gn", "ɲ"],
    ["gl", "ʎ"],
    ["sc", "ʃ"],
    ["ce", "tse"],
    ["ci", "tsi"],
    ["cy", "tsy"],
    ["cæ", "tsaɪ"],
    ["cœ", "tsɔɪ"],
    ["ae", "aɪ"],
    ["oe", "ɔɪ"],
    ["c", "k"],
    ["ge", "dʒe"],
    ["gi", "dʒi"],
    ["gy", "dʒy"],
    ["gu", "ɡw"],
    ["qu", "kw"],
    ["g", "ɡ"],
    ["v", "w"],
    ["x", "ks"],
    ["j", "j"],
    ["r", "ɾ"],
  ],
  germanic: [
    ["sch", "ʃ"],
    ["ch", "x"],
    ["sp", "ʃp"],
    ["st", "ʃt"],
    ["ei", "aɪ"],
    ["ie", "iː"],
    ["eu", "ɔʏ"],
    ["äu", "ɔʏ"],
    ["tz", "ts"],
    ["ph", "f"],
    ["th", "t"],
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
    ["ll", "ɬ"],
    ["dd", "ð"],
    ["rh", "r̥"],
    ["bh", "v"],
    ["mh", "v"],
    ["ch", "x"],
    ["dh", "ð"],
    ["gh", "ɣ"],
    ["fh", ""], // silent lenition
    ["sh", "h"],
    ["th", "θ"],
    ["ph", "f"],
    ["w", "ʊ"],
    ["y", "ə"],
    ["r", "ɾ"],
  ],
  slavic: [
    ["sz", "ʃ"],
    ["cz", "tʃ"],
    ["rz", "ʒ"],
    ["ż", "ʒ"],
    ["ź", "ʑ"],
    ["ś", "ɕ"],
    ["ć", "tɕ"],
    ["ń", "ɲ"],
    ["ł", "w"],
    ["ch", "x"],
    ["kh", "x"],
    ["ts", "ts"],
    ["zh", "ʒ"],
    ["sh", "ʃ"],
    ["ya", "ja"],
    ["yu", "ju"],
    ["ye", "jɛ"],
    ["c", "ts"],
    ["h", "x"],
    ["w", "v"],
    ["v", "v"],
    ["j", "j"],
    ["y", "i"],
    ["r", "r"],
  ],
  arabic: [
    ["kh", "x"],
    ["gh", "ɣ"],
    ["dh", "ð"],
    ["th", "θ"],
    ["sh", "ʃ"],
    ["zh", "ʒ"],
    ["ch", "tʃ"],
    ["aa", "aː"],
    ["ee", "iː"],
    ["uu", "uː"],
    ["ii", "iː"],
    ["oo", "uː"],
    ["ay", "eɪ"],
    ["aw", "aʊ"],
    ["q", "q"],
    ["h", "ħ"],
    ["ḥ", "ħ"],
    ["'", "ʔ"],
    ["‘", "ʕ"],
    ["’", "ʔ"],
    ["ṣ", "sˤ"],
    ["ḍ", "dˤ"],
    ["ṭ", "tˤ"],
    ["ẓ", "ðˤ"],
    ["w", "w"],
    ["y", "j"],
    ["r", "ɾ"],
  ],
  "east-asian": [
    ["zh", "ʈʂ"],
    ["ch", "ʈʂʰ"],
    ["sh", "ʂ"],
    ["tsu", "tsɯ"],
    ["shi", "ɕi"],
    ["chi", "tɕi"],
    ["fu", "ɸɯ"],
    ["ts", "ts"],
    ["sy", "ʃ"],
    ["ty", "tʃ"],
    ["ng", "ŋ"],
    ["ou", "oʊ"],
    ["ao", "aʊ"],
    ["yu", "y"],
    ["r", "ɾ"],
  ],
  austronesian: [
    ["ng", "ŋ"],
    ["ny", "ɲ"],
    ["wh", "f"],
    ["c", "tʃ"],
    ["j", "dʒ"],
    ["'", "ʔ"],
    ["ʻ", "ʔ"],
    ["aa", "aː"],
    ["ii", "iː"],
    ["uu", "uː"],
    ["r", "ɾ"],
  ],
  persian: [
    ["kh", "x"],
    ["gh", "ɣ"],
    ["ch", "tʃ"],
    ["sh", "ʃ"],
    ["zh", "ʒ"],
    ["aa", "ɒː"],
    ["ee", "iː"],
    ["oo", "uː"],
    ["ow", "oʊ"],
    ["ey", "eɪ"],
    ["q", "ɣ"],
    ["v", "v"],
    ["w", "v"],
    ["r", "ɾ"],
  ],
  turkic: [
    ["gh", "ɣ"],
    ["kh", "x"],
    ["ç", "tʃ"],
    ["ş", "ʃ"],
    ["ğ", ""], // soft g lengthens preceding vowel
    ["c", "dʒ"],
    ["ı", "ɯ"],
    ["ö", "ø"],
    ["ü", "y"],
    ["q", "q"],
    ["w", "v"],
    ["r", "ɾ"],
  ],
  african: [
    ["ng'", "ŋ"],
    ["ng", "ŋ"],
    ["ny", "ɲ"],
    ["dl", "ɮ"],
    ["gb", "ɡb"],
    ["kp", "kp"],
    ["dh", "ð"],
    ["th", "θ"],
    ["gh", "ɣ"],
    ["mb", "ᵐb"],
    ["nd", "ⁿd"],
    ["nj", "ᶮdʒ"],
    ["r", "ɾ"],
  ],
  indic: [
    ["bh", "bʱ"],
    ["dh", "dʱ"],
    ["gh", "ɡʱ"],
    ["kh", "kʰ"],
    ["th", "t̪ʰ"],
    ["ph", "pʰ"],
    ["jh", "dʒʱ"],
    ["ch", "tʃʰ"],
    ["sh", "ʂ"],
    ["ś", "ɕ"],
    ["ṣ", "ʂ"],
    ["ṭ", "ʈ"],
    ["ḍ", "ɖ"],
    ["ṇ", "ɳ"],
    ["aa", "aː"],
    ["ee", "iː"],
    ["oo", "uː"],
    ["ai", "aːɪ"],
    ["au", "aːʊ"],
    ["v", "ʋ"],
    ["w", "ʋ"],
    ["r", "ɾ"],
  ],
  uralic: [
    ["sz", "s"],
    ["zs", "ʒ"],
    ["cs", "tʃ"],
    ["gy", "ɟ"],
    ["ny", "ɲ"],
    ["ty", "c"],
    ["ly", "j"],
    ["s", "ʃ"],
    ["ä", "æ"],
    ["ö", "ø"],
    ["ü", "y"],
    ["kk", "kː"],
    ["tt", "tː"],
    ["pp", "pː"],
    ["j", "j"],
    ["w", "v"],
    ["v", "v"],
    ["r", "r"],
  ],
  constructed: [
    ["dh", "ð"],
    ["th", "θ"],
    ["ch", "x"],
    ["ph", "f"],
    ["lh", "ɬ"],
    ["rh", "r̥"],
    ["ë", "ɛ"],
    ["c", "k"],
    ["r", "ɾ"],
  ],
};

const IPA_VOWELS = /[aeiouyøɛɔœɨææǽǣûʊɪɑɒʌɯəäöü]/i;

/**
 * Built-in grapheme→IPA rules for a culture or template key.
 */
export function getCultureRules(cultureOrTemplate: string | null): [string, string][] {
  if (!cultureOrTemplate) return DEFAULT_RULES;

  // Check template profiles first (e.g. "species:elf")
  if (TEMPLATE_PHONETIC_PROFILES[cultureOrTemplate]) {
    return TEMPLATE_PHONETIC_PROFILES[cultureOrTemplate]!.rules;
  }

  const primaryCulture = cultureOrTemplate.split("+")[0].toLowerCase().trim();
  return CULTURE_RULES[primaryCulture] || DEFAULT_RULES;
}

export interface ResolvePhoneticsOptions {
  culture?: string | null;
  category?: string | null;
  subType?: string | null;
  customRules?: [string, string][];
  explicitIpa?: string | null;
  bcp47VoiceTag?: string;
  kokoroVoicePersona?: string;
}

/**
 * Hierarchical 5-tier phonetic resolver.
 * Computes exact IPA, BCP-47 voice tag, and Kokoro persona for any given name.
 */
export function resolveNamePhonetics(
  name: string,
  options: ResolvePhoneticsOptions = {}
): ResolvedNamePhonetics {
  if (!name || !name.trim()) {
    return {
      ipa: "" as IPAString,
      bcp47VoiceTag: "en-US",
      source: "default",
    };
  }

  // Tier 1: Explicit item IPA (passed directly or in localStorage)
  if (options.explicitIpa && options.explicitIpa.trim()) {
    const raw = options.explicitIpa.trim().replace(/^[/[]+|[/\\]+$/g, "");
    return {
      ipa: `/${raw}/` as IPAString,
      bcp47VoiceTag: options.bcp47VoiceTag || "en-US",
      kokoroVoicePersona: options.kokoroVoicePersona,
      source: "override",
    };
  }

  const localOverride = getNameOverride(name.trim());
  if (localOverride?.ipa) {
    const raw = localOverride.ipa.trim().replace(/^[/[]+|[/\\]+$/g, "");
    return {
      ipa: `/${raw}/` as IPAString,
      bcp47VoiceTag: options.bcp47VoiceTag || "en-US",
      kokoroVoicePersona: options.kokoroVoicePersona,
      source: "override",
    };
  }

  // Tier 2: Template-specific linguistic profile
  if (options.category && options.subType) {
    const templateProfile = getTemplateLinguisticProfile(options.category, options.subType);
    if (templateProfile) {
      const ipa = translateToIPA(name, templateProfile.id, options.customRules);
      return {
        ipa: ipa as IPAString,
        bcp47VoiceTag: templateProfile.bcp47VoiceTag,
        kokoroVoicePersona: templateProfile.kokoroVoicePersona,
        source: "template",
      };
    }
  }

  // Tier 3: Direct template ID passed as culture (e.g. "species:elf" or "noble:norman")
  if (options.culture && TEMPLATE_PHONETIC_PROFILES[options.culture]) {
    const prof = TEMPLATE_PHONETIC_PROFILES[options.culture]!;
    const ipa = translateToIPA(name, prof.id, options.customRules);
    return {
      ipa: ipa as IPAString,
      bcp47VoiceTag: prof.bcp47VoiceTag,
      kokoroVoicePersona: prof.kokoroVoicePersona,
      source: "template",
    };
  }

  // Tier 4: IRL culture family rules
  const primaryCulture = options.culture ? options.culture.split("+")[0].toLowerCase().trim() : "any";
  if (CULTURE_RULES[primaryCulture]) {
    const ipa = translateToIPA(name, primaryCulture, options.customRules);
    return {
      ipa: ipa as IPAString,
      bcp47VoiceTag: getCultureDefaultVoiceTag(primaryCulture),
      kokoroVoicePersona: getCultureDefaultKokoroVoice(primaryCulture),
      source: "culture",
    };
  }

  // Tier 5: Universal default
  const defaultIpa = translateToIPA(name, "any", options.customRules);
  return {
    ipa: defaultIpa as IPAString,
    bcp47VoiceTag: "en-US",
    source: "default",
  };
}

/**
 * Returns the default BCP-47 voice tag for a culture family.
 */
export function getCultureDefaultVoiceTag(culture: string): string {
  switch (culture) {
    case "latin": return "it-IT";
    case "germanic": return "de-DE";
    case "celtic": return "ga-IE";
    case "slavic": return "pl-PL";
    case "arabic": return "ar-SA";
    case "persian": return "fa-IR";
    case "turkic": return "tr-TR";
    case "indic": return "hi-IN";
    case "east-asian": return "ja-JP";
    case "austronesian": return "id-ID";
    case "african": return "sw-KE";
    case "uralic": return "fi-FI";
    case "constructed": return "is-IS";
    default: return "en-US";
  }
}

/**
 * Returns the default Kokoro neural voice persona for a culture family.
 */
export function getCultureDefaultKokoroVoice(culture: string): string {
  switch (culture) {
    case "latin": return "bf_emma";
    case "germanic": return "bm_george";
    case "celtic": return "bf_isabella";
    case "slavic": return "bm_george";
    case "arabic": return "af_nicole";
    case "persian": return "af_nicole";
    case "turkic": return "am_fenrir";
    case "indic": return "af_nicole";
    case "east-asian": return "af_nicole";
    case "austronesian": return "bf_emma";
    case "african": return "am_fenrir";
    case "uralic": return "bm_george";
    case "constructed": return "bm_fable";
    default: return "bf_emma";
  }
}

/**
 * Translates a given name string into its International Phonetic Alphabet (IPA) representation
 * based on the specified culture family or template.
 */
export function translateToIPA(
  name: string,
  cultureOrTemplate: string | null,
  overrideRules?: [string, string][]
): string {
  if (!name || !name.trim()) return "";

  let baseRules = DEFAULT_RULES;
  if (cultureOrTemplate) {
    if (TEMPLATE_PHONETIC_PROFILES[cultureOrTemplate]) {
      baseRules = TEMPLATE_PHONETIC_PROFILES[cultureOrTemplate]!.rules;
    } else {
      const primaryCulture = cultureOrTemplate.split("+")[0].toLowerCase().trim();
      baseRules = CULTURE_RULES[primaryCulture] || DEFAULT_RULES;
    }
  }

  const rules =
    overrideRules && overrideRules.length > 0 ? [...overrideRules, ...baseRules] : baseRules;

  // Process word-by-word to preserve spaces and hyphens
  const words = name.split(/(\s+|-)/);
  const translatedWords = words.map((part) => {
    // If it's punctuation or spacing, leave it
    if (/^[\s\-'"]+$/.test(part)) return part;

    const lowerWord = part.toLowerCase();
    let ipaWord = "";
    let i = 0;

    // Left-to-right matching scanner
    while (i < lowerWord.length) {
      let matched = false;

      // Try multi-character rules first (sorted by length descending)
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

  // Onset starts before the consonant cluster preceding the first vowel
  let onsetIndex = firstVowelIndex;
  while (onsetIndex > 0) {
    const prevChar = word[onsetIndex - 1];
    if (IPA_VOWELS.test(prevChar) || /[\s\-'.]/.test(prevChar)) {
      break;
    }
    onsetIndex--;
  }

  return word.slice(0, onsetIndex) + "ˈ" + word.slice(onsetIndex);
}

/**
 * Splits a word into its constituent grapheme segments according to phonetic matching rules.
 */
export function segmentGraphemes(
  name: string,
  cultureOrTemplate: string | null,
  overrideRules?: [string, string][]
): { grapheme: string; ipa: string }[] {
  if (!name || !name.trim()) return [];

  let baseRules = DEFAULT_RULES;
  if (cultureOrTemplate) {
    if (TEMPLATE_PHONETIC_PROFILES[cultureOrTemplate]) {
      baseRules = TEMPLATE_PHONETIC_PROFILES[cultureOrTemplate]!.rules;
    } else {
      const primaryCulture = cultureOrTemplate.split("+")[0].toLowerCase().trim();
      baseRules = CULTURE_RULES[primaryCulture] || DEFAULT_RULES;
    }
  }

  const rules =
    overrideRules && overrideRules.length > 0 ? [...overrideRules, ...baseRules] : baseRules;

  const lowerWord = name.toLowerCase().trim();
  const segments: { grapheme: string; ipa: string }[] = [];
  let i = 0;

  while (i < lowerWord.length) {
    let matched = false;

    for (const [grapheme, ipa] of rules) {
      if (grapheme.length > 1 && lowerWord.startsWith(grapheme, i)) {
        segments.push({ grapheme, ipa });
        i += grapheme.length;
        matched = true;
        break;
      }
    }

    if (matched) continue;

    for (const [grapheme, ipa] of rules) {
      if (grapheme.length === 1 && lowerWord[i] === grapheme) {
        segments.push({ grapheme, ipa });
        i++;
        matched = true;
        break;
      }
    }

    if (matched) continue;

    segments.push({ grapheme: lowerWord[i], ipa: lowerWord[i] });
    i++;
  }

  return segments;
}
