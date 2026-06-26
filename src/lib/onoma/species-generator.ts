// src/lib/onoma/species-generator.ts
// Onoma Lab — Species Name Generator

import { SPECIES_SYLLABLES } from "./data/species-data";
import { MarkovChain } from "./markov-chain";
import { Gender } from "./types";

function isVowel(c: string): boolean {
  const cl = c.toLowerCase();
  return cl === "a" || cl === "e" || cl === "i" || cl === "o" || cl === "u";
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Helper to resolve neutral gender to male or female.
 */
function resolveGender(gender: Gender): "male" | "female" {
  if (gender === "neutral") {
    return Math.random() >= 0.5 ? "male" : "female";
  }
  return gender;
}

export function generateGoblinName(): string {
  const small = SPECIES_SYLLABLES.vileAndCrude.small;
  return MarkovChain.capitalize(pickRandom(small)) + pickRandom(small);
}

export function generateOrcName(): string {
  const medium = SPECIES_SYLLABLES.vileAndCrude.medium;
  return MarkovChain.capitalize(pickRandom(medium)) + pickRandom(medium);
}

export function generateOgreName(): string {
  const large = SPECIES_SYLLABLES.vileAndCrude.large;
  return MarkovChain.capitalize(pickRandom(large)) + pickRandom(large);
}

export function generatePrimitiveName(gender: Gender): string {
  const g = resolveGender(gender);
  const prim = SPECIES_SYLLABLES.primitive;

  if (g === "male") {
    const d10 = Math.floor(Math.random() * 10) + 1;
    let name = MarkovChain.capitalize(pickRandom(prim.names));
    if (d10 > 3) {
      name += "-" + MarkovChain.capitalize(pickRandom(prim.names));
    }
    if (d10 > 8) {
      name += "-" + MarkovChain.capitalize(pickRandom(prim.names));
    }
    return name;
  } else {
    let name = MarkovChain.capitalize(pickRandom(prim.names));
    if (Math.random() >= 0.5) {
      name += "-" + MarkovChain.capitalize(pickRandom(prim.names));
    }
    name += "-" + MarkovChain.capitalize(pickRandom(prim.suffixes));
    return name;
  }
}

export function generateDwarfName(gender: Gender): string {
  const g = resolveGender(gender);
  const doughty = SPECIES_SYLLABLES.doughty;
  let name = MarkovChain.capitalize(pickRandom(doughty.syllables));

  if (g === "male") {
    if (Math.random() > 0.8) {
      name += isVowel(name.slice(-1)) ? "r" : "i";
    } else {
      name += pickRandom(doughty.maleSuffixes);
    }
  } else {
    if (Math.random() > 0.8) {
      name += isVowel(name.slice(-1)) ? "ra" : "a";
    } else {
      name += pickRandom(doughty.femaleSuffixes);
    }
  }
  return name;
}

export function generateHalflingName(gender: Gender): string {
  const g = resolveGender(gender);
  const homely = SPECIES_SYLLABLES.homely;
  const engSurnames = SPECIES_SYLLABLES.familyName.english;

  let name = MarkovChain.capitalize(pickRandom(homely.syllables));
  if (g === "male") {
    name += pickRandom(homely.maleSuffixes);
  } else {
    name += pickRandom(homely.femaleSuffixes);
  }

  if (Math.random() > 0.7) {
    name += " " + pickRandom(engSurnames);
  }
  return name;
}

export function generateGnomeName(gender: Gender): string {
  const g = resolveGender(gender);
  const doughty = SPECIES_SYLLABLES.doughty;
  const homely = SPECIES_SYLLABLES.homely;
  const scotSurnames = SPECIES_SYLLABLES.familyName.scottish;

  let name = MarkovChain.capitalize(pickRandom(doughty.syllables));
  if (isVowel(name.slice(-1))) {
    name += "l";
  }

  if (g === "male") {
    name += pickRandom(homely.maleSuffixes);
  } else {
    name += pickRandom(homely.femaleSuffixes);
  }

  if (Math.random() > 0.7) {
    name += " " + pickRandom(scotSurnames);
  }
  return name;
}

export function generateElfName(gender: Gender, alternate = false): string {
  const g = resolveGender(gender);
  const noble = SPECIES_SYLLABLES.fairAndNoble;

  if (!alternate) {
    const prefix = pickRandom(noble.elfprefixes);
    const mid = pickRandom(noble.middle);
    const suffix = g === "male" ? pickRandom(noble.maleSuffixes) : pickRandom(noble.femaleSuffixes);
    return MarkovChain.capitalize(prefix) + mid + suffix;
  } else {
    const prefix = pickRandom(noble.alternativeElfPrefixes);
    const mid = pickRandom(noble.middle);
    // Note: original code swapped suffixes for alternate elven names
    const suffix = g === "male" ? pickRandom(noble.femaleSuffixes) : pickRandom(noble.maleSuffixes);
    return MarkovChain.capitalize(prefix) + mid + suffix;
  }
}

export function generateFaeryName(gender: Gender, alternate = false): string {
  const g = resolveGender(gender);
  const fae = SPECIES_SYLLABLES.faerykind;
  const altFae = SPECIES_SYLLABLES.alternativeFaerykind;

  if (!alternate) {
    const prefix = pickRandom(fae.prefixes);
    const suffix = g === "male" ? pickRandom(fae.maleSuffixes) : pickRandom(fae.femaleSuffixes);
    return MarkovChain.capitalize(prefix) + suffix;
  } else {
    const prefix = pickRandom(altFae.prefixes);
    const suffix =
      g === "male" ? pickRandom(altFae.maleSuffixes) : pickRandom(altFae.femaleSuffixes);
    return MarkovChain.capitalize(prefix) + suffix;
  }
}

export function generateDarkElfName(gender: Gender, alternate = false): string {
  const g = resolveGender(gender);
  const evil = SPECIES_SYLLABLES.elegantEvil;

  const prefixes = alternate ? evil.prefixesAlternateDarkElves : evil.prefixesDarkElves;
  let name = MarkovChain.capitalize(pickRandom(prefixes));

  if (Math.random() > 1 / 6) {
    name += pickRandom(evil.middle);
  }

  name += g === "male" ? pickRandom(evil.maleSuffixes) : pickRandom(evil.femaleSuffixes);
  return name;
}

export function generateHalfDemonName(gender: Gender): string {
  const g = resolveGender(gender);
  const mal = SPECIES_SYLLABLES.malevolent;
  const prefix = pickRandom(mal.prefixes);
  const suffix = g === "male" ? pickRandom(mal.maleSuffixes) : pickRandom(mal.femaleSuffixes);
  return MarkovChain.capitalize(prefix) + suffix;
}

export function generateDragonName(gender: Gender): string {
  const g = resolveGender(gender);
  const drac = SPECIES_SYLLABLES.draconic;
  const prefix = pickRandom(drac.prefixes);
  let suffix = pickRandom(drac.suffixes);

  if (g === "female") {
    if (suffix === "bazius") {
      suffix = "bazia";
    } else if (suffix.slice(-2) === "os") {
      suffix = suffix.slice(0, -2) + "ossa";
    } else {
      suffix += "is";
    }
  }

  return MarkovChain.capitalize(prefix) + suffix;
}

export function generateDemonName(): string {
  const inf = SPECIES_SYLLABLES.infernal;
  const d6 = Math.floor(Math.random() * 6) + 1;
  let name = "";

  const soft = () => MarkovChain.capitalize(pickRandom(inf.softs));
  const softLower = () => pickRandom(inf.softs);
  const dull = () => MarkovChain.capitalize(pickRandom(inf.dulls));
  const dullLower = () => pickRandom(inf.dulls);
  const sharp = () => MarkovChain.capitalize(pickRandom(inf.sharps));
  const sharpLower = () => pickRandom(inf.sharps);

  if (d6 === 1) {
    name = soft() + dullLower();
  } else if (d6 === 2) {
    name = soft() + sharpLower();
  } else if (d6 === 3) {
    name = dull() + softLower();
  } else if (d6 === 4) {
    name = dull() + sharpLower();
  } else if (d6 === 5) {
    name = sharp() + softLower();
  } else {
    name = sharp() + dullLower();
  }

  return name;
}

export function generateAngelName(gender: Gender): string {
  const g = resolveGender(gender);
  const emp = SPECIES_SYLLABLES.empyreal;
  let name = MarkovChain.capitalize(pickRandom(emp.prefixes));

  if (Math.random() <= 1 / 12) {
    if (g === "female") {
      // Replace last 'a' with 'e'
      const lastA = name.lastIndexOf("a");
      if (lastA !== -1) {
        name = name.substring(0, lastA) + "e" + name.substring(lastA + 1);
      }
    }

    const endsWithArOrAl = name.slice(-2) === "ar" || name.slice(-2) === "al";
    const endsWithAr = name.slice(-2) === "ar";

    if (!endsWithArOrAl) {
      name = MarkovChain.capitalize(pickRandom(emp.titles)) + name;
    } else if (endsWithAr) {
      // Male: pick titles index 4 to 7 (or 4 to 8, titles has length 9)
      // Female: pick titles index 0 to 3
      const titleList = g === "male" ? emp.titles.slice(4, 8) : emp.titles.slice(0, 4);
      name = MarkovChain.capitalize(pickRandom(titleList)) + name;
    } else {
      // Ends with 'al'
      // Male: pick titles index 0 to 3
      // Female: pick titles index 4 to 7 (or 4 to 8)
      const titleList = g === "male" ? emp.titles.slice(0, 4) : emp.titles.slice(4, 8);
      name = MarkovChain.capitalize(pickRandom(titleList)) + name;
    }
  } else {
    name += g === "male" ? pickRandom(emp.maleSuffixes) : pickRandom(emp.femaleSuffixes);
  }

  return name;
}
