// src/lib/onoma/perplexity.ts
// Onoma Lab — Phonotactic Perplexity Scorer (Phase 5).
// A character n-gram language model that scores how "natural"/pronounceable a
// name is relative to a training set. Pure TS, no ML dependency — it reuses the
// same n-gram idea as the culture classifier but for likelihood scoring.

export interface NgramLM {
  n: number;
  /** context ("ab") -> next-char -> count */
  counts: Map<string, Map<string, number>>;
  /** context -> total following observations */
  totals: Map<string, number>;
  vocab: number;
  /** sorted training cross-entropies (bits/char), for percentile calibration */
  trainingEntropies: number[];
}

const PAD = "^"; // boundary marker (start padding + end token)

function ngramContexts(word: string, n: number): Array<[string, string]> {
  const padded = PAD.repeat(n - 1) + word.toLowerCase() + PAD;
  const out: Array<[string, string]> = [];
  for (let i = n - 1; i < padded.length; i++) {
    out.push([padded.slice(i - (n - 1), i), padded[i]]);
  }
  return out;
}

/** Average cross-entropy in bits/char under the model (lower = more natural). */
function crossEntropy(word: string, lm: NgramLM): number {
  const grams = ngramContexts(word, lm.n);
  if (grams.length === 0) return Infinity;
  let bits = 0;
  for (const [ctx, ch] of grams) {
    const ctxTotal = lm.totals.get(ctx) ?? 0;
    const chCount = lm.counts.get(ctx)?.get(ch) ?? 0;
    // Laplace (add-1) smoothing over the vocabulary.
    const p = (chCount + 1) / (ctxTotal + lm.vocab);
    bits -= Math.log2(p);
  }
  return bits / grams.length;
}

/** Train a char n-gram LM from a word list (n=3 by default). */
export function trainLM(words: string[], n = 3): NgramLM {
  const counts = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  const vocabSet = new Set<string>();

  for (const word of words) {
    const w = word.trim();
    if (!w) continue;
    for (const [ctx, ch] of ngramContexts(w, n)) {
      let row = counts.get(ctx);
      if (!row) counts.set(ctx, (row = new Map()));
      row.set(ch, (row.get(ch) ?? 0) + 1);
      totals.set(ctx, (totals.get(ctx) ?? 0) + 1);
      vocabSet.add(ch);
    }
  }

  const lm: NgramLM = { n, counts, totals, vocab: vocabSet.size || 1, trainingEntropies: [] };

  // Calibrate: cross-entropy of each training word, sorted ascending.
  lm.trainingEntropies = words
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => crossEntropy(w, lm))
    .filter((e) => Number.isFinite(e))
    .sort((a, b) => a - b);

  return lm;
}

/** Perplexity (2^cross-entropy) — lower means a better fit to the training style. */
export function perplexity(word: string, lm: NgramLM): number {
  return 2 ** crossEntropy(word, lm);
}

/**
 * Naturalness 0–100: the percentage of training words a candidate is at least as
 * natural as (i.e. whose cross-entropy is ≥ the candidate's). No magic constants —
 * it's a percentile against the model's own exemplars.
 */
export function naturalnessScore(word: string, lm: NgramLM): number {
  if (!word.trim() || lm.trainingEntropies.length === 0) return 0;
  const e = crossEntropy(word, lm);
  if (!Number.isFinite(e)) return 0;
  // count training entropies >= e (candidate beats or ties them)
  const arr = lm.trainingEntropies;
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < e) lo = mid + 1;
    else hi = mid;
  }
  const atLeastAsNatural = arr.length - lo; // entries with entropy >= e
  return Math.round((atLeastAsNatural / arr.length) * 100);
}
