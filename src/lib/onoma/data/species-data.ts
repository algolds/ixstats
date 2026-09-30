// src/lib/onoma/data/species-data.ts
import rawSpecies from "./species-data.json";

export interface SpeciesSyllables {
  vileAndCrude: { small: string[]; medium: string[]; large: string[] };
  primitive: { names: string[]; suffixes: string[] };
  doughty: { syllables: string[]; maleSuffixes: string[]; femaleSuffixes: string[] };
  homely: { syllables: string[]; maleSuffixes: string[]; femaleSuffixes: string[] };
  familyName: { english: string[]; scottish: string[] };
  fairAndNoble: {
    elfprefixes: string[];
    alternativeElfPrefixes: string[];
    middle: string[];
    maleSuffixes: string[];
    femaleSuffixes: string[];
  };
  faerykind: { prefixes: string[]; maleSuffixes: string[]; femaleSuffixes: string[] };
  alternativeFaerykind: { prefixes: string[]; maleSuffixes: string[]; femaleSuffixes: string[] };
  elegantEvil: {
    prefixesDarkElves: string[];
    prefixesAlternateDarkElves: string[];
    middle: string[];
    maleSuffixes: string[];
    femaleSuffixes: string[];
  };
  malevolent: { prefixes: string[]; maleSuffixes: string[]; femaleSuffixes: string[] };
  draconic: { prefixes: string[]; suffixes: string[] };
  infernal: { softs: string[]; dulls: string[]; sharps: string[] };
  empyreal: {
    prefixes: string[];
    maleSuffixes: string[];
    femaleSuffixes: string[];
    titles: string[];
  };
}

export const SPECIES_SYLLABLES: SpeciesSyllables = rawSpecies as SpeciesSyllables;
