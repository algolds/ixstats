// src/lib/onoma/corpus/bucket.ts
// Final bucket assignment for corpus names (Phase 4 of plans/051).
// Every name lands in exactly one bucket: a single culture, or one of the
// top-N compound blends. Tail compounds (not in the kept set) collapse to their
// dominant single culture, so there's no junk "mixed" bucket.

import { classifyCulture, rankCultures } from "./culture-classifier";

/** Assign a name to its dictionary bucket given the set of kept compound labels. */
export function assignBucket(name: string, keptCompounds: Set<string>): string {
  const r = classifyCulture(name);
  if (!r.compound) return r.culture; // clear single culture
  if (keptCompounds.has(r.culture)) return r.culture; // a kept top-N compound
  return rankCultures(name)[0]?.culture ?? r.culture; // collapse tail → dominant single
}

/** Rank compound labels by frequency across a name list; return the top `n`. */
export function topCompounds(names: string[], n: number): string[] {
  const freq = new Map<string, number>();
  for (const name of names) {
    const r = classifyCulture(name);
    if (r.compound) freq.set(r.culture, (freq.get(r.culture) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label]) => label);
}
