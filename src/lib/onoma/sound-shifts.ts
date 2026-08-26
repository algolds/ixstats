// src/lib/onoma/sound-shifts.ts
// Onoma — Historical Sound Change & Language Evolution Engine

export interface SoundShiftRule {
  id: string;
  source: string;
  target: string;
  context?: string; // e.g. "_[ei]", "V_V", "#_", "_#", "_C", "C_"
  description?: string;
  enabled?: boolean;
}

export interface SoundShiftEpoch {
  id: string;
  name: string;
  description?: string;
  rules: SoundShiftRule[];
}

export interface EvolutionStep {
  epochName: string;
  ruleDescription: string;
  before: string;
  after: string;
}

export interface WordEvolutionResult {
  original: string;
  final: string;
  steps: EvolutionStep[];
}

// Regex shorthand token definitions
const VOWEL_CLASS = "[aeiouyɑɛɪɔʊəäöüæøåáéíóúàèìòùâêîôûãẽĩõũ]";
const CONSONANT_CLASS = "[^aeiouyɑɛɪɔʊəäöüæøåáéíóúàèìòùâêîôûãẽĩõũ\\s\\d_]";

/**
 * Compiles a linguistic sound shift rule (X -> Y / ENV) into an executable RegExp.
 */
export function compileRuleRegex(source: string, context?: string): RegExp {
  const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!context || !context.trim()) {
    return new RegExp(escapedSource, "gi");
  }

  const rawCtx = context.trim();
  const underscoreIdx = rawCtx.indexOf("_");

  if (underscoreIdx === -1) {
    // If no underscore position placeholder, treat context as literal environment
    return new RegExp(escapedSource, "gi");
  }

  let leftCtx = rawCtx.substring(0, underscoreIdx);
  let rightCtx = rawCtx.substring(underscoreIdx + 1);

  const expandLeft = (s: string) =>
    s
      .replace(/#/g, "^")
      .replace(/V/g, VOWEL_CLASS)
      .replace(/C/g, CONSONANT_CLASS);

  const expandRight = (s: string) =>
    s
      .replace(/#/g, "$")
      .replace(/V/g, VOWEL_CLASS)
      .replace(/C/g, CONSONANT_CLASS);

  leftCtx = expandLeft(leftCtx);
  rightCtx = expandRight(rightCtx);

  const leftPattern = leftCtx ? `(${leftCtx})` : "";
  const rightPattern = rightCtx ? `(${rightCtx})` : "";

  return new RegExp(`${leftPattern}${escapedSource}${rightPattern}`, "gi");
}

/**
 * Applies a single sound shift rule to a target word.
 */
export function applySingleRule(word: string, rule: SoundShiftRule): string {
  if (rule.enabled === false || !rule.source) return word;

  const rawCtx = (rule.context || "").trim();
  const underscoreIdx = rawCtx.indexOf("_");

  const escapedSource =
    rule.source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
    (!rule.source.includes("ʰ") ? "(?!ʰ)" : "");

  if (!rawCtx || underscoreIdx === -1) {
    const regex = new RegExp(escapedSource, "gi");
    return word.replace(regex, (match) => {
      // Preserve uppercase on first letter if source was capitalized
      if (match.length > 0 && match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
        return rule.target.charAt(0).toUpperCase() + rule.target.slice(1);
      }
      return rule.target;
    });
  }

  const leftCtx = rawCtx.substring(0, underscoreIdx);
  const rightCtx = rawCtx.substring(underscoreIdx + 1);

  const expandLeft = (s: string) =>
    s
      .replace(/#/g, "^")
      .replace(/V/g, VOWEL_CLASS)
      .replace(/C/g, CONSONANT_CLASS);

  const expandRight = (s: string) =>
    s
      .replace(/#/g, "$")
      .replace(/V/g, VOWEL_CLASS)
      .replace(/C/g, CONSONANT_CLASS);

  const leftRegexStr = leftCtx ? expandLeft(leftCtx) : "";
  const rightRegexStr = rightCtx ? expandRight(rightCtx) : "";

  let fullRegex: RegExp;
  try {
    if (leftRegexStr && rightRegexStr) {
      fullRegex = new RegExp(`(${leftRegexStr})(${escapedSource})(${rightRegexStr})`, "gi");
      return word.replace(fullRegex, (_match, p1, p2, p3) => {
        const replacement =
          p2.charAt(0) === p2.charAt(0).toUpperCase() && p2.charAt(0) !== p2.charAt(0).toLowerCase()
            ? rule.target.charAt(0).toUpperCase() + rule.target.slice(1)
            : rule.target;
        return `${p1}${replacement}${p3}`;
      });
    } else if (leftRegexStr) {
      fullRegex = new RegExp(`(${leftRegexStr})(${escapedSource})`, "gi");
      return word.replace(fullRegex, (_match, p1, p2) => {
        const replacement =
          p2.charAt(0) === p2.charAt(0).toUpperCase() && p2.charAt(0) !== p2.charAt(0).toLowerCase()
            ? rule.target.charAt(0).toUpperCase() + rule.target.slice(1)
            : rule.target;
        return `${p1}${replacement}`;
      });
    } else if (rightRegexStr) {
      fullRegex = new RegExp(`(${escapedSource})(${rightRegexStr})`, "gi");
      return word.replace(fullRegex, (_match, p1, p2) => {
        const replacement =
          p1.charAt(0) === p1.charAt(0).toUpperCase() && p1.charAt(0) !== p1.charAt(0).toLowerCase()
            ? rule.target.charAt(0).toUpperCase() + rule.target.slice(1)
            : rule.target;
        return `${replacement}${p2}`;
      });
    }
  } catch {
    // Fallback if user regex was malformed
    return word;
  }

  return word;
}

/**
 * Applies a list of chronological epochs containing ordered sound shift rules across words.
 */
export function applySoundShifts(
  words: string[],
  epochs: SoundShiftEpoch[]
): WordEvolutionResult[] {
  return words.map((word) => {
    let current = word.trim();
    const steps: EvolutionStep[] = [];

    for (const epoch of epochs) {
      for (const rule of epoch.rules) {
        if (rule.enabled === false) continue;
        const prev = current;
        current = applySingleRule(current, rule);
        if (prev !== current) {
          steps.push({
            epochName: epoch.name,
            ruleDescription: `${rule.source} → ${rule.target}${
              rule.context ? ` / ${rule.context}` : ""
            }${rule.description ? ` (${rule.description})` : ""}`,
            before: prev,
            after: current,
          });
        }
      }
    }

    return {
      original: word,
      final: current,
      steps,
    };
  });
}

/**
 * Curated preset sound change rules and historical evolution models.
 */
export interface SoundShiftPreset {
  id: string;
  name: string;
  description: string;
  family: string;
  sampleInput: string[];
  epochs: SoundShiftEpoch[];
}

export const SOUND_SHIFT_PRESETS: SoundShiftPreset[] = [
  {
    id: "grimms-law",
    name: "Grimm's Law (PIE → Proto-Germanic)",
    description:
      "The classic Indo-European sound shift: voiceless stops become fricatives, voiced aspirated stops become plain voiced stops, and plain voiced stops become voiceless.",
    family: "germanic",
    sampleInput: ["pater", "tres", "kann", "deka", "gelu", "dʰwer", "bʰer"],
    epochs: [
      {
        id: "epoch-1",
        name: "Phase 1: Voiceless Stops → Fricatives",
        description: "Voiceless stops soften to voiceless fricatives",
        rules: [
          { id: "g1", source: "p", target: "f", description: "p → f", enabled: true },
          { id: "g2", source: "t", target: "θ", description: "t → θ", enabled: true },
          { id: "g3", source: "k", target: "h", description: "k → h", enabled: true },
        ],
      },
      {
        id: "epoch-2",
        name: "Phase 2: Voiced Stops → Voiceless Stops",
        description: "Plain voiced stops become voiceless stops",
        rules: [
          { id: "g4", source: "b", target: "p", description: "b → p", enabled: true },
          { id: "g5", source: "d", target: "t", description: "d → t", enabled: true },
          { id: "g6", source: "g", target: "k", description: "g → k", enabled: true },
        ],
      },
      {
        id: "epoch-3",
        name: "Phase 3: Aspirated Stops → Plain Voiced",
        description: "Aspirated stops deaspirate to plain voiced stops",
        rules: [
          { id: "g7", source: "bʰ", target: "b", description: "bʰ → b", enabled: true },
          { id: "g8", source: "dʰ", target: "d", description: "dʰ → d", enabled: true },
          { id: "g9", source: "gʰ", target: "g", description: "gʰ → g", enabled: true },
        ],
      },
    ],
  },
  {
    id: "latin-to-romance",
    name: "Latin → Early Romance Lenition",
    description:
      "Palatalization before front vowels, intervocalic stop voicing, and loss of word-final consonants.",
    family: "latin",
    sampleInput: ["centum", "civitas", "amicus", "ripa", "vita", "aurum", "noctem"],
    epochs: [
      {
        id: "epoch-1",
        name: "Classical → Vulgar Latin Palatalization",
        description: "Velars palatalize before front vowels [e, i]",
        rules: [
          { id: "r1", source: "c", target: "tʃ", context: "_[ei]", description: "c → tʃ / _[ei]", enabled: true },
          { id: "r2", source: "g", target: "dʒ", context: "_[ei]", description: "g → dʒ / _[ei]", enabled: true },
        ],
      },
      {
        id: "epoch-2",
        name: "Intervocalic Lenition",
        description: "Voiceless stops voice between vowels",
        rules: [
          { id: "r3", source: "p", target: "b", context: "V_V", description: "p → b / V_V", enabled: true },
          { id: "r4", source: "t", target: "d", context: "V_V", description: "t → d / V_V", enabled: true },
          { id: "r5", source: "c", target: "g", context: "V_V", description: "c → g / V_V", enabled: true },
        ],
      },
      {
        id: "epoch-3",
        name: "Terminal Consonant Apocope",
        description: "Loss of final -m and -t",
        rules: [
          { id: "r6", source: "m", target: "", context: "_#", description: "m → ∅ / _#", enabled: true },
        ],
      },
    ],
  },
  {
    id: "slavic-palatalization",
    name: "Proto-Slavic First Palatalization",
    description:
      "Velar consonants k, g, x shift to postalveolar affricates and fricatives before front vowels.",
    family: "slavic",
    sampleInput: ["krik", "plakati", "bog", "glagol", "tixa", "muha"],
    epochs: [
      {
        id: "epoch-1",
        name: "First Slavic Palatalization",
        description: "k, g, x → č, ž, š before front vowels",
        rules: [
          { id: "s1", source: "k", target: "č", context: "_[eiěь]", description: "k → č / _[front]", enabled: true },
          { id: "s2", source: "g", target: "ž", context: "_[eiěь]", description: "g → ž / _[front]", enabled: true },
          { id: "s3", source: "x", target: "š", context: "_[eiěь]", description: "x → š / _[front]", enabled: true },
          { id: "s4", source: "h", target: "š", context: "_[eiěь]", description: "h → š / _[front]", enabled: true },
        ],
      },
    ],
  },
  {
    id: "great-vowel-shift",
    name: "Great Vowel Shift (Middle → Modern English)",
    description:
      "Systematic raising and diphthongization of long vowels during the 15th-18th centuries.",
    family: "germanic",
    sampleInput: ["bite", "mouse", "meet", "goose", "make", "boat"],
    epochs: [
      {
        id: "epoch-1",
        name: "Phase 1: High Vowel Diphthongization",
        description: "High long vowels diphthongize to /aɪ/ and /aʊ/",
        rules: [
          { id: "v1", source: "i", target: "ai", context: "_[tksdn]", description: "i → ai", enabled: true },
          { id: "v2", source: "ou", target: "au", description: "ou → au", enabled: true },
        ],
      },
      {
        id: "epoch-2",
        name: "Phase 2: Mid-Vowel Raising",
        description: "Mid vowels raise toward high vowels",
        rules: [
          { id: "v3", source: "ee", target: "i", description: "ee → i", enabled: true },
          { id: "v4", source: "oo", target: "u", description: "oo → u", enabled: true },
          { id: "v5", source: "a", target: "ei", context: "_[ktp]", description: "a → ei", enabled: true },
        ],
      },
    ],
  },
];
