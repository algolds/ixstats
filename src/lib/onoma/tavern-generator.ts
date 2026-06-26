// src/lib/onoma/tavern-generator.ts
// Onoma Lab — Tavern & Establishment Name Generator

import { TAVERN_DATA } from "./data/tavern-data";
import { MarkovChain } from "./markov-chain";
import { GenerateOptions } from "./types";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a tavern or establishment name using template-patterns with filters.
 */
export function generateTavernName(options: GenerateOptions = {}): string | null {
  const startWith = (options.startsWith || "").toLowerCase();
  const endWith = (options.endsWith || "").toLowerCase();
  const contains = (options.contains || "").toLowerCase();
  const excludes = (options.excludes || "").toLowerCase();
  const minLength = options.minLength || 0;
  const maxLength = options.maxLength || -1;
  const maxAttempts = options.maxAttempts || 500;

  let name = "";
  let attempts = 0;

  const patterns = TAVERN_DATA.patterns;

  while (name.length === 0 && attempts < maxAttempts) {
    attempts++;

    // Copy options to slice if needed (we can slice to prevent duplicates in "<noun> & <noun>")
    const nouns = [...TAVERN_DATA.nouns];
    const adjectives = [...TAVERN_DATA.adjectives];
    const titles = [...TAVERN_DATA.titles];

    const pickAndRemove = (list: string[]) => {
      const idx = Math.floor(Math.random() * list.length);
      const val = list[idx];
      list.splice(idx, 1);
      return val;
    };

    const resolveTag = (tag: string): string => {
      if (tag === "noun" && nouns.length > 0) return pickAndRemove(nouns);
      if (tag === "adjective" && adjectives.length > 0) return pickAndRemove(adjectives);
      if (tag === "title" && titles.length > 0) return pickAndRemove(titles);
      return "";
    };

    const pattern = pickRandom(patterns);
    let generated = pattern.replace(/<([\w\W]*?)>/g, (match) => {
      const tag = match.replace(/<|>/g, "");
      const resolved = resolveTag(tag);
      return resolved ? MarkovChain.capitalize(resolved) : "";
    });

    // Clean up double spaces if any
    generated = generated.replace(/\s+/g, " ").trim();

    const genLower = generated.toLowerCase();

    // Check filters
    if (
      (startWith && !genLower.startsWith(startWith)) ||
      (endWith && !genLower.endsWith(endWith)) ||
      (contains && !genLower.includes(contains)) ||
      (excludes && genLower.includes(excludes)) ||
      generated.length < minLength ||
      (maxLength >= 0 && generated.length > maxLength)
    ) {
      name = "";
    } else {
      name = generated;
    }
  }

  return name || null;
}
