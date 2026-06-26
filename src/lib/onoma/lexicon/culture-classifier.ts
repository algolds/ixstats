// src/lib/onoma/corpus/culture-classifier.ts
// Onoma culture classifier (Phase 3 of plans/051). Pure-TS, no ML dep.
//
// A character n-gram (bigram+trigram) Naive-Bayes classifier — the standard
// language-ID technique. Trained at module load from the 7 cultures in
// CULTURAL_PROFILES.
//
// Result is either a single culture (one wins by MIN_MARGIN) or a compound
// "A+B" group (top two are close — typical of blended conworld names). This
// replaces the old catch-all "mixed" bucket with meaningful subgroups.
// (Adding more *single* real-world cultures was measured and absorbed <1.4% of
// "mixed" while catching mostly noise — the conworld blends the base families
// rather than matching new ones, so compounds are the right tool.)

import { CULTURAL_PROFILES } from "../cultural-profiles";

const BASE_CULTURES = [
  "latin",
  "germanic",
  "celtic",
  "slavic",
  "arabic",
  "east-asian",
  "austronesian",
] as const;

// Min per-gram log-prob margin between top and runner-up to call a single culture.
// Below it the name is a blend → compound "A+B". Tuning knob (sweep in the test).
const MIN_MARGIN = 0.08;

/** Boundary-padded, letter-only word tokens (apostrophes kept as letters). */
function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zà-ÿ']/g, ""))
    .filter(Boolean)
    .map((w) => `^${w}$`);
}

function ngramsOf(name: string): string[] {
  const grams: string[] = [];
  for (const t of tokens(name)) {
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i + n <= t.length; i++) grams.push(t.slice(i, i + n));
    }
  }
  return grams;
}

type Model = { counts: Map<string, number>; total: number };

function train(): { models: Record<string, Model>; cultures: string[]; vocab: number } {
  const data: Record<string, string[]> = {};
  for (const c of BASE_CULTURES) data[c] = Object.values(CULTURAL_PROFILES[c]).flat() as string[];

  const raw: Record<string, Map<string, number>> = {};
  const vocabSet = new Set<string>();
  for (const [c, names] of Object.entries(data)) {
    const counts = new Map<string, number>();
    for (const nm of names) {
      for (const g of ngramsOf(nm)) {
        counts.set(g, (counts.get(g) || 0) + 1);
        vocabSet.add(g);
      }
    }
    raw[c] = counts;
  }
  const models: Record<string, Model> = {};
  for (const [c, counts] of Object.entries(raw)) {
    let total = 0;
    for (const v of counts.values()) total += v;
    models[c] = { counts, total };
  }
  return { models, cultures: Object.keys(data), vocab: vocabSet.size };
}

const { models: MODELS, cultures: CULTURES_, vocab: VOCAB } = train();
export const CULTURES = CULTURES_;

/** Cultures ranked by length-normalized avg log-prob (best first). */
export function rankCultures(name: string): Array<{ culture: string; score: number }> {
  const grams = ngramsOf(name);
  if (grams.length === 0) return [];
  return CULTURES.map((c) => {
    const m = MODELS[c];
    let lp = 0;
    for (const g of grams) lp += Math.log(((m.counts.get(g) || 0) + 1) / (m.total + VOCAB));
    return { culture: c, score: lp / grams.length };
  }).sort((a, b) => b.score - a.score);
}

export type CultureResult = {
  culture: string; // single culture, or "A+B" (components sorted), or "mixed"
  compound: boolean;
  components: string[]; // [single] or [A, B]
  confidence: number; // top-vs-runnerup margin (0 when unclassifiable)
};

/** Classify a name into a single culture, or a compound "A+B" blend. */
export function classifyCulture(name: string): CultureResult {
  const ranked = rankCultures(name);
  if (ranked.length === 0)
    return { culture: "mixed", compound: false, components: [], confidence: 0 };

  const margin = ranked[0].score - (ranked[1]?.score ?? -Infinity);
  if (margin >= MIN_MARGIN || ranked.length === 1) {
    return {
      culture: ranked[0].culture,
      compound: false,
      components: [ranked[0].culture],
      confidence: margin,
    };
  }
  const pair = [ranked[0].culture, ranked[1].culture].sort();
  return { culture: pair.join("+"), compound: true, components: pair, confidence: margin };
}
