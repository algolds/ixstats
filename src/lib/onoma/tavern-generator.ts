// src/lib/onoma/tavern-generator.ts
// Onoma Lab — Tavern & Establishment Name Generator

import { TAVERN_DATA } from "./data/tavern-data";
import { pickRandom, resolvePatternTemplate } from "./template-resolver";
import type { GenerateOptions } from "./types";

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

  const dataMap = {
    noun: TAVERN_DATA.nouns,
    adjective: TAVERN_DATA.adjectives,
    title: TAVERN_DATA.titles,
  };

  while (name.length === 0 && attempts < maxAttempts) {
    attempts++;
    const pattern = pickRandom(TAVERN_DATA.patterns);
    const generated = resolvePatternTemplate(pattern, dataMap, { consumeElements: true });
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
