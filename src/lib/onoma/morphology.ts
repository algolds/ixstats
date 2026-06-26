// src/lib/onoma/morphology.ts
// Onoma Lab — Linguistics Engine Morphology Simulator

export type GrammaticalGender = "masculine" | "feminine" | "neuter" | "common";

export interface DeclensionCase {
  singular: string;
  plural: string;
  descriptionSingular: string;
  descriptionPlural: string;
}

export interface DeclensionTable {
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

/**
 * Detects the grammatical gender of a word based on its ending and culture profile.
 */
export function detectGender(word: string, culture: string | null): GrammaticalGender {
  if (!word) return "common";
  const w = word.trim().toLowerCase();
  const c = (culture || "any").toLowerCase();

  if (c.includes("latin") || c.includes("roman")) {
    if (w.endsWith("us") || w.endsWith("er")) return "masculine";
    if (w.endsWith("a")) return "feminine";
    if (w.endsWith("um") || w.endsWith("u")) return "neuter";
    return "masculine"; // Default Latin
  }

  if (c.includes("german")) {
    if (w.endsWith("e")) return "feminine";
    if (w.endsWith("chen") || w.endsWith("lein") || w.endsWith("um")) return "neuter";
    return "masculine"; // Default German ends in consonant
  }

  if (c.includes("greek")) {
    if (w.endsWith("os") || w.endsWith("as") || w.endsWith("es")) return "masculine";
    if (w.endsWith("a") || w.endsWith("i") || w.endsWith("o")) return "feminine";
    if (w.endsWith("on") || w.endsWith("ma")) return "neuter";
    return "masculine";
  }

  if (c.includes("slavic") || c.includes("slav")) {
    if (w.endsWith("a") || w.endsWith("ya") || w.endsWith("ia")) return "feminine";
    if (w.endsWith("o") || w.endsWith("e") || w.endsWith("ye")) return "neuter";
    return "masculine"; // Consonant
  }

  if (c.includes("arab")) {
    if (w.endsWith("ah") || w.endsWith("a") || w.endsWith("t")) return "feminine";
    return "masculine";
  }

  if (c.includes("constructed") || c.includes("tolkien") || c.includes("elf")) {
    if (w.endsWith("on") || w.endsWith("ion") || w.endsWith("or")) return "masculine";
    if (w.endsWith("iel") || w.endsWith("wen") || w.endsWith("ril")) return "feminine";
    return "neuter";
  }

  // Generic fallback based on standard vowel/consonant rules
  if (w.endsWith("a") || w.endsWith("e") || w.endsWith("i")) return "feminine";
  if (w.endsWith("o") || w.endsWith("u")) return "neuter";
  return "masculine"; // ends in consonant
}

/**
 * Capitalizes the first letter of a word while preserving case.
 */
function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generates Singular & Plural declined forms for all 5 cases.
 */
export function generateNounDeclension(word: string, culture: string | null): DeclensionTable {
  const baseWord = word.trim();
  const lower = baseWord.toLowerCase();
  const c = (culture || "any").toLowerCase();

  // Singular and Plural builders
  let nomS = baseWord;
  let nomP = baseWord + "s";
  let genS = baseWord + "'s";
  let genP = baseWord + "s'";
  let accS = baseWord;
  let accP = baseWord + "s";
  let datS = "to " + baseWord;
  let datP = "to " + baseWord + "s";
  let ablS = "from " + baseWord;
  let ablP = "from " + baseWord + "s";

  if (c.includes("latin") || c.includes("roman")) {
    if (lower.endsWith("a")) {
      // 1st Declension (e.g. Verona -> Veronae)
      const stem = baseWord.slice(0, -1);
      nomS = baseWord;
      nomP = stem + "ae";
      genS = stem + "ae";
      genP = stem + "arum";
      accS = stem + "am";
      accP = stem + "as";
      datS = stem + "ae";
      datP = stem + "is";
      ablS = stem + "a";
      ablP = stem + "is";
    } else if (lower.endsWith("us")) {
      // 2nd Declension Masculine (e.g. Marcus -> Marci)
      const stem = baseWord.slice(0, -2);
      nomS = baseWord;
      nomP = stem + "i";
      genS = stem + "i";
      genP = stem + "orum";
      accS = stem + "um";
      accP = stem + "os";
      datS = stem + "o";
      datP = stem + "is";
      ablS = stem + "o";
      ablP = stem + "is";
    } else if (lower.endsWith("um")) {
      // 2nd Declension Neuter (e.g. Latium -> Latia)
      const stem = baseWord.slice(0, -2);
      nomS = baseWord;
      nomP = stem + "a";
      genS = stem + "i";
      genP = stem + "orum";
      accS = stem + "um";
      accP = stem + "a";
      datS = stem + "o";
      datP = stem + "is";
      ablS = stem + "o";
      ablP = stem + "is";
    } else {
      // 3rd Declension/Other (e.g. Carthago -> Carthagines)
      nomS = baseWord;
      nomP = baseWord + "es";
      genS = baseWord + "is";
      genP = baseWord + "um";
      accS = baseWord + "em";
      accP = baseWord + "es";
      datS = baseWord + "i";
      datP = baseWord + "ibus";
      ablS = baseWord + "e";
      ablP = baseWord + "ibus";
    }
  } else if (c.includes("german")) {
    // Germanic weak/strong declensions
    if (lower.endsWith("e")) {
      const stem = baseWord.slice(0, -1);
      nomS = baseWord;
      nomP = stem + "en";
      genS = baseWord + "n";
      genP = stem + "en";
      accS = baseWord;
      accP = stem + "en";
      datS = baseWord + "n";
      datP = stem + "en";
      ablS = "von " + baseWord;
      ablP = "von " + stem + "en";
    } else {
      nomS = baseWord;
      nomP = baseWord + "e";
      genS = baseWord + "s";
      genP = baseWord + "e";
      accS = baseWord;
      accP = baseWord + "e";
      datS = baseWord + "e";
      datP = baseWord + "en";
      ablS = "von " + baseWord;
      ablP = "von " + baseWord + "e";
    }
  } else if (c.includes("greek")) {
    if (lower.endsWith("os")) {
      const stem = baseWord.slice(0, -2);
      nomS = baseWord;
      nomP = stem + "oi";
      genS = stem + "ou";
      genP = stem + "on";
      accS = stem + "on";
      accP = stem + "ous";
      datS = stem + "o";
      datP = stem + "ois";
      ablS = "apo " + baseWord;
      ablP = "apo " + stem + "ous";
    } else if (lower.endsWith("a") || lower.endsWith("e")) {
      const stem = baseWord.slice(0, -1);
      nomS = baseWord;
      nomP = stem + "es";
      genS = stem + "as";
      genP = stem + "on";
      accS = stem + "an";
      accP = stem + "es";
      datS = stem + "a";
      datP = stem + "ais";
      ablS = "apo " + baseWord;
      ablP = "apo " + stem + "es";
    } else if (lower.endsWith("on")) {
      const stem = baseWord.slice(0, -2);
      nomS = baseWord;
      nomP = stem + "a";
      genS = stem + "ou";
      genP = stem + "on";
      accS = stem + "on";
      accP = stem + "a";
      datS = stem + "o";
      datP = stem + "ois";
      ablS = "apo " + baseWord;
      ablP = "apo " + stem + "a";
    }
  } else if (c.includes("slavic") || c.includes("slav")) {
    if (lower.endsWith("a")) {
      const stem = baseWord.slice(0, -1);
      nomS = baseWord;
      nomP = stem + "y";
      genS = stem + "y";
      genP = stem;
      accS = stem + "u";
      accP = stem + "y";
      datS = stem + "e";
      datP = stem + "am";
      ablS = "s " + stem + "oy";
      ablP = "s " + stem + "ami";
    } else {
      // Consonant ending masculine
      nomS = baseWord;
      nomP = baseWord + "y";
      genS = baseWord + "a";
      genP = baseWord + "ov";
      accS = baseWord + "a";
      accP = baseWord + "ov";
      datS = baseWord + "u";
      datP = baseWord + "am";
      ablS = "s " + baseWord + "om";
      ablP = "s " + baseWord + "ami";
    }
  } else if (c.includes("arab")) {
    // Simplified Arabic triptote case markings (-u, -i, -a) or sound plural suffixes (-un, -in)
    if (lower.endsWith("ah") || lower.endsWith("a")) {
      const stem = lower.endsWith("ah") ? baseWord.slice(0, -2) : baseWord.slice(0, -1);
      nomS = stem + "atu";
      nomP = stem + "atun";
      genS = stem + "ati";
      genP = stem + "atin";
      accS = stem + "ata";
      accP = stem + "atin";
      datS = "li-" + stem + "ah";
      datP = "li-" + stem + "at";
      ablS = "min " + stem + "ah";
      ablP = "min " + stem + "at";
    } else {
      nomS = baseWord + "u";
      nomP = baseWord + "una";
      genS = baseWord + "i";
      genP = baseWord + "ina";
      accS = baseWord + "a";
      accP = baseWord + "ina";
      datS = "li-" + baseWord;
      datP = "li-" + baseWord + "in";
      ablS = "min " + baseWord;
      ablP = "min " + baseWord + "in";
    }
  } else if (c.includes("constructed") || c.includes("tolkien") || c.includes("elf")) {
    // Quenya-like noun cases
    const lastChar = lower.charAt(lower.length - 1);
    const isVowel = "aeiouyëöü".includes(lastChar);

    if (isVowel) {
      nomS = baseWord;
      nomP = baseWord + "r";
      genS = baseWord + "o";
      genP = baseWord + "ron";
      accS = baseWord;
      accP = baseWord + "r";
      datS = baseWord + "n";
      datP = baseWord + "ryo";
      ablS = baseWord + "llo";
      ablP = baseWord + "llon";
    } else {
      nomS = baseWord;
      nomP = baseWord + "i";
      genS = baseWord + "o";
      genP = baseWord + "ion";
      accS = baseWord;
      accP = baseWord + "i";
      datS = baseWord + "n";
      datP = baseWord + "inyo";
      ablS = baseWord + "ello";
      ablP = baseWord + "ellon";
    }
  }

  // Return formatted Table
  return {
    nominative: {
      singular: capitalize(nomS),
      plural: capitalize(nomP),
      descriptionSingular: 'Subject (e.g. "The city is here")',
      descriptionPlural: 'Multiple subjects (e.g. "These cities are here")',
    },
    genitive: {
      singular: capitalize(genS),
      plural: capitalize(genP),
      descriptionSingular: 'Possession / Origin (e.g. "Of the city")',
      descriptionPlural: 'Plural possession / Origin (e.g. "Of the cities")',
    },
    accusative: {
      singular: capitalize(accS),
      plural: capitalize(accP),
      descriptionSingular: 'Direct Object (e.g. "I found the city")',
      descriptionPlural: 'Plural direct objects (e.g. "I found the cities")',
    },
    dative: {
      singular: capitalize(datS),
      plural: capitalize(datP),
      descriptionSingular: 'Recipient (e.g. "Dedicated to/for the city")',
      descriptionPlural: 'Plural recipients (e.g. "Dedicated to/for the cities")',
    },
    ablative: {
      singular: capitalize(ablS),
      plural: capitalize(ablP),
      descriptionSingular: 'Origin / Instrument (e.g. "From/by the city")',
      descriptionPlural: 'Plural origins / instruments (e.g. "From/by the cities")',
    },
  };
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
