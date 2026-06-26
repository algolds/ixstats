// src/lib/onoma/name-generator.ts
// Onoma Lab — Fantasy Name Assembler

import { FANTASY_SYLLABLES } from "./data/fantasy-names-data";
import { MarkovChain } from "./markov-chain";
import { type GenerateOptions } from "./types";

/**
 * Generates a name by concatenating syllables from the original Onoma database
 * using the original weighted d20 probability distribution.
 */
export function generateFantasySyllableName(): string {
  const d20 = Math.floor(Math.random() * 20) + 1;
  let name = "";

  const ones = FANTASY_SYLLABLES[0];
  const twos = FANTASY_SYLLABLES[1];
  const threes = FANTASY_SYLLABLES[2];
  const multis = FANTASY_SYLLABLES[3];

  const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  if (d20 < 3) {
    // 10% — One syllable
    name = pickRandom(ones);
  } else if (d20 < 12) {
    // 45% — Two syllables
    name = pickRandom(twos);
  } else if (d20 < 17) {
    // 25% — Three syllables
    name = pickRandom(threes);
  } else if (d20 === 17) {
    // 5% — Multi syllables
    name = pickRandom(multis);
  } else if (d20 === 18) {
    // 5% — One syllable + Two syllables
    name = `${pickRandom(ones)} ${pickRandom(twos)}`;
  } else if (d20 === 19) {
    // 5% — Two syllables + One syllable
    name = `${pickRandom(twos)} ${pickRandom(ones)}`;
  } else {
    // 5% — Two random syllable lengths combined
    const firstList = FANTASY_SYLLABLES[Math.floor(Math.random() * FANTASY_SYLLABLES.length)];
    const secondList = FANTASY_SYLLABLES[Math.floor(Math.random() * FANTASY_SYLLABLES.length)];
    name = `${pickRandom(firstList)} ${pickRandom(secondList)}`;
  }

  // Capitalize each part of the name
  return name
    .split(" ")
    .map(word => MarkovChain.capitalize(word))
    .join(" ");
}

/**
 * Generates a name using a Markov chain trained on the provided names list.
 */
export function generateMarkovName(
  trainingNames: string[],
  options: GenerateOptions = {},
  order = 3
): string | null {
  if (!trainingNames || trainingNames.length === 0) {
    return null;
  }
  const chain = new MarkovChain(order);
  chain.addWords(trainingNames);
  return chain.generate(options);
}

/**
 * Generates a noble/clan surname formatted according to the rules of the selected culture.
 */
export function generateNobleSurname(
  culture: string,
  chain?: MarkovChain,
  options?: GenerateOptions
): string {
  const baseName = chain?.generate(options) || generateFantasySyllableName();
  const name = MarkovChain.capitalize(baseName);
  const cult = culture.toLowerCase();

  if (cult === "latin") {
    return Math.random() < 0.5 ? `de ${name}` : `di ${name}`;
  } else if (cult === "germanic") {
    return Math.random() < 0.5 ? `von ${name}` : `zu ${name}`;
  } else if (cult === "celtic") {
    return Math.random() < 0.5 ? `O'${name}` : `Mac${name}`;
  } else if (cult === "slavic") {
    // Trim ending vowel if present to make suffix sound more natural
    const base = name.replace(/[aeiou]$/i, "");
    return Math.random() < 0.5 ? `${base}ovich` : `${base}ic`;
  } else if (cult === "arabic") {
    return Math.random() < 0.5 ? `Al-${name}` : `ibn ${name}`;
  } else {
    return Math.random() < 0.5 ? `de ${name}` : name;
  }
}

