// src/lib/onoma/morphology.ts
// Onoma Lab — Linguistics Engine Morphology Simulator

import { MarkovChain } from "./markov-chain";

type GrammaticalGender = "masculine" | "feminine" | "neuter" | "common";

interface DeclensionCase {
  singular: string;
  plural: string;
  descriptionSingular: string;
  descriptionPlural: string;
}

interface DeclensionTable {
  nominative: DeclensionCase;
  genitive: DeclensionCase;
  accusative: DeclensionCase;
  dative: DeclensionCase;
  ablative: DeclensionCase;
}

export interface MorphologyDetails {
  gender: GrammaticalGender;
  declensionTable: DeclensionTable;
}

/** Gender rules per culture family: the first family whose keyword the culture contains wins. */
const GENDER_RULES: Array<{
  cultures: string[];
  endings: Array<[GrammaticalGender, string[]]>;
  fallback: GrammaticalGender;
}> = [
  {
    cultures: ["latin", "roman"],
    endings: [
      ["masculine", ["us", "er"]],
      ["feminine", ["a"]],
      ["neuter", ["um", "u"]],
    ],
    fallback: "masculine",
  },
  {
    cultures: ["german"],
    endings: [
      ["feminine", ["e"]],
      ["neuter", ["chen", "lein", "um"]],
    ],
    fallback: "masculine",
  },
  {
    cultures: ["greek"],
    endings: [
      ["masculine", ["os", "as", "es"]],
      ["feminine", ["a", "i", "o"]],
      ["neuter", ["on", "ma"]],
    ],
    fallback: "masculine",
  },
  {
    cultures: ["slav"],
    endings: [
      ["feminine", ["a", "ya", "ia"]],
      ["neuter", ["o", "e", "ye"]],
    ],
    fallback: "masculine",
  },
  { cultures: ["arab"], endings: [["feminine", ["ah", "a", "t"]]], fallback: "masculine" },
  {
    cultures: ["constructed", "tolkien", "elf"],
    endings: [
      ["masculine", ["on", "ion", "or"]],
      ["feminine", ["iel", "wen", "ril"]],
    ],
    fallback: "neuter",
  },
  {
    cultures: [],
    endings: [
      ["feminine", ["a", "e", "i"]],
      ["neuter", ["o", "u"]],
    ],
    fallback: "masculine",
  },
];

const matchesCulture = (culture: string, keywords: string[]) =>
  keywords.length === 0 || keywords.some((keyword) => culture.includes(keyword));

/**
 * Detects the grammatical gender of a word based on its ending and culture profile.
 */
export function detectGender(word: string, culture: string | null): GrammaticalGender {
  if (!word) return "common";
  const w = word.trim().toLowerCase();
  const c = (culture || "any").toLowerCase();

  const rule = GENDER_RULES.find(({ cultures }) => matchesCulture(c, cultures))!;
  const match = rule.endings.find(([, endings]) => endings.some((ending) => w.endsWith(ending)));
  return match ? match[0] : rule.fallback;
}

/** A declension: how many letters make way for the stem, and the ten forms as `|`-separated templates. */
interface Declension {
  matches: (lower: string) => boolean;
  strip: number;
  /** Nominative, genitive, accusative, dative, ablative; singular then plural each. {w} is the word, {s} its stem. */
  forms: string;
}

const endsWithAny =
  (...endings: string[]) =>
  (lower: string) =>
    endings.some((ending) => lower.endsWith(ending));

const ARABIC_FEMININE_FORMS =
  "{s}atu|{s}atun|{s}ati|{s}atin|{s}ata|{s}atin|li-{s}ah|li-{s}at|min {s}ah|min {s}at";

/** Declensions per culture family, tried in order; the first matching entry applies. */
const DECLENSIONS: Array<{ cultures: string[]; declensions: Declension[] }> = [
  {
    // 1st/2nd/3rd Latin declensions (Verona -> Veronae, Marcus -> Marci, Carthago -> Carthagines)
    cultures: ["latin", "roman"],
    declensions: [
      {
        matches: endsWithAny("a"),
        strip: 1,
        forms: "{w}|{s}ae|{s}ae|{s}arum|{s}am|{s}as|{s}ae|{s}is|{s}a|{s}is",
      },
      {
        matches: endsWithAny("us"),
        strip: 2,
        forms: "{w}|{s}i|{s}i|{s}orum|{s}um|{s}os|{s}o|{s}is|{s}o|{s}is",
      },
      {
        matches: endsWithAny("um"),
        strip: 2,
        forms: "{w}|{s}a|{s}i|{s}orum|{s}um|{s}a|{s}o|{s}is|{s}o|{s}is",
      },
      {
        matches: () => true,
        strip: 0,
        forms: "{w}|{w}es|{w}is|{w}um|{w}em|{w}es|{w}i|{w}ibus|{w}e|{w}ibus",
      },
    ],
  },
  {
    // Germanic weak/strong declensions
    cultures: ["german"],
    declensions: [
      {
        matches: endsWithAny("e"),
        strip: 1,
        forms: "{w}|{s}en|{w}n|{s}en|{w}|{s}en|{w}n|{s}en|von {w}|von {s}en",
      },
      {
        matches: () => true,
        strip: 0,
        forms: "{w}|{w}e|{w}s|{w}e|{w}|{w}e|{w}e|{w}en|von {w}|von {w}e",
      },
    ],
  },
  {
    cultures: ["greek"],
    declensions: [
      {
        matches: endsWithAny("os"),
        strip: 2,
        forms: "{w}|{s}oi|{s}ou|{s}on|{s}on|{s}ous|{s}o|{s}ois|apo {w}|apo {s}ous",
      },
      {
        matches: endsWithAny("a", "e"),
        strip: 1,
        forms: "{w}|{s}es|{s}as|{s}on|{s}an|{s}es|{s}a|{s}ais|apo {w}|apo {s}es",
      },
      {
        matches: endsWithAny("on"),
        strip: 2,
        forms: "{w}|{s}a|{s}ou|{s}on|{s}on|{s}a|{s}o|{s}ois|apo {w}|apo {s}a",
      },
    ],
  },
  {
    cultures: ["slav"],
    declensions: [
      {
        matches: endsWithAny("a"),
        strip: 1,
        forms: "{w}|{s}y|{s}y|{s}|{s}u|{s}y|{s}e|{s}am|s {s}oy|s {s}ami",
      },
      {
        matches: () => true,
        strip: 0,
        forms: "{w}|{w}y|{w}a|{w}ov|{w}a|{w}ov|{w}u|{w}am|s {w}om|s {w}ami",
      },
    ],
  },
  {
    // Simplified Arabic triptote case markings (-u, -i, -a) and sound plural suffixes (-un, -in)
    cultures: ["arab"],
    declensions: [
      {
        matches: endsWithAny("ah"),
        strip: 2,
        forms: ARABIC_FEMININE_FORMS,
      },
      {
        matches: endsWithAny("a"),
        strip: 1,
        forms: ARABIC_FEMININE_FORMS,
      },
      {
        matches: () => true,
        strip: 0,
        forms: "{w}u|{w}una|{w}i|{w}ina|{w}a|{w}ina|li-{w}|li-{w}in|min {w}|min {w}in",
      },
    ],
  },
  {
    // Quenya-like noun cases
    cultures: ["constructed", "tolkien", "elf"],
    declensions: [
      {
        matches: (lower) => "aeiouyëöü".includes(lower.charAt(lower.length - 1)),
        strip: 0,
        forms: "{w}|{w}r|{w}o|{w}ron|{w}|{w}r|{w}n|{w}ryo|{w}llo|{w}llon",
      },
      {
        matches: () => true,
        strip: 0,
        forms: "{w}|{w}i|{w}o|{w}ion|{w}|{w}i|{w}n|{w}inyo|{w}ello|{w}ellon",
      },
    ],
  },
];

const DEFAULT_FORMS = "{w}|{w}s|{w}'s|{w}s'|{w}|{w}s|to {w}|to {w}s|from {w}|from {w}s";

const CASE_DESCRIPTIONS: Record<keyof DeclensionTable, [singular: string, plural: string]> = {
  nominative: [
    'Subject (e.g. "The city is here")',
    'Multiple subjects (e.g. "These cities are here")',
  ],
  genitive: [
    'Possession / Origin (e.g. "Of the city")',
    'Plural possession / Origin (e.g. "Of the cities")',
  ],
  accusative: [
    'Direct Object (e.g. "I found the city")',
    'Plural direct objects (e.g. "I found the cities")',
  ],
  dative: [
    'Recipient (e.g. "Dedicated to/for the city")',
    'Plural recipients (e.g. "Dedicated to/for the cities")',
  ],
  ablative: [
    'Origin / Instrument (e.g. "From/by the city")',
    'Plural origins / instruments (e.g. "From/by the cities")',
  ],
};

/**
 * Generates Singular & Plural declined forms for all 5 cases.
 */
export function generateNounDeclension(word: string, culture: string | null): DeclensionTable {
  const baseWord = word.trim();
  const lower = baseWord.toLowerCase();
  const c = (culture || "any").toLowerCase();

  const family = DECLENSIONS.find(({ cultures }) => matchesCulture(c, cultures));
  const declension = family?.declensions.find(({ matches }) => matches(lower));
  const stem = declension ? baseWord.slice(0, baseWord.length - declension.strip) : baseWord;
  const forms = (declension?.forms ?? DEFAULT_FORMS)
    .split("|")
    .map((template) =>
      MarkovChain.capitalize(
        template.replaceAll("{w}", () => baseWord).replaceAll("{s}", () => stem)
      )
    );

  const table = {} as DeclensionTable;
  (Object.keys(CASE_DESCRIPTIONS) as Array<keyof DeclensionTable>).forEach((name, i) => {
    const [descriptionSingular, descriptionPlural] = CASE_DESCRIPTIONS[name];
    table[name] = {
      singular: forms[2 * i],
      plural: forms[2 * i + 1],
      descriptionSingular,
      descriptionPlural,
    };
  });
  return table;
}

/**
 * Returns full morphology details for a name candidate.
 */
export function getMorphologyDetails(word: string, culture: string | null): MorphologyDetails {
  return {
    gender: detectGender(word, culture),
    declensionTable: generateNounDeclension(word, culture),
  };
}
