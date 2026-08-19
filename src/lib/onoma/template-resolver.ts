// src/lib/onoma/template-resolver.ts
// Shared template pattern tag resolver and randomized element selectors for Onoma generators

import { MarkovChain } from "./markov-chain";

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickAndRemove<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  const idx = Math.floor(Math.random() * arr.length);
  const val = arr[idx];
  arr.splice(idx, 1);
  return val;
}

/**
 * Resolves a template pattern string like "<group> of the <description> <entity>"
 * by matching `<tag>` tokens against lists in `dataMap`.
 */
export function resolvePatternTemplate(
  pattern: string,
  dataMap: Record<string, string[]>,
  options?: {
    consumeElements?: boolean;
    capitalize?: boolean;
  }
): string {
  const consume = options?.consumeElements ?? false;
  const shouldCapitalize = options?.capitalize ?? true;

  // Clone arrays if consuming elements to avoid mutating source datasets
  const workingMap: Record<string, string[]> = {};
  if (consume) {
    for (const key in dataMap) {
      workingMap[key] = [...dataMap[key]];
    }
  }

  const result = pattern.replace(/<([\w\W]*?)>/g, (match) => {
    const key = match.replace(/<|>/g, "");
    const list = consume ? workingMap[key] : dataMap[key];
    if (!list || list.length === 0) return "";

    const selected = consume ? (pickAndRemove(list) ?? "") : pickRandom(list);
    if (!selected) return "";
    return shouldCapitalize ? MarkovChain.capitalize(selected) : selected;
  });

  return result.replace(/\s+/g, " ").trim();
}
