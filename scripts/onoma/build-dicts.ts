// scripts/onoma/build-dicts.ts — Phase 4 runner.
// Turns raw/corpus-clean.json into the compact, committed dictionaries the
// browser loads: src/lib/onoma/data/corpus/<category>.json (grouped by culture
// bucket) + manifest.json.
// Run with bun (tsx ESM mishandles cultural-profiles' type-only import):
//   bun scripts/onoma/build-dicts.ts

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { CorpusName } from "../../src/lib/onoma/corpus/clean";
import { assignBucket, topCompounds } from "../../src/lib/onoma/corpus/bucket";

const TOP_N_COMPOUNDS = 6;
const CAP_PER_BUCKET = 300; // plenty for a Markov chain; keeps files small
const MIN_BUCKET = 12;      // drop buckets too small to train on

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(here, "raw", "corpus-clean.json");
const OUT = path.join(here, "..", "..", "src", "lib", "onoma", "data", "corpus");

/** Deterministic stride sample of up to `cap` items (avoids source-order bias). */
function sample<T>(arr: T[], cap: number): T[] {
  if (arr.length <= cap) return arr;
  const step = arr.length / cap;
  const out: T[] = [];
  for (let i = 0; out.length < cap && Math.floor(i) < arr.length; i += step) out.push(arr[Math.floor(i)]);
  return out;
}

const corpus: CorpusName[] = JSON.parse(fs.readFileSync(RAW, "utf8"));
const keptCompounds = new Set(topCompounds(corpus.map((r) => r.name), TOP_N_COMPOUNDS));

const byCategory = new Map<string, Map<string, string[]>>();
for (const { name, category } of corpus) {
  const bucket = assignBucket(name, keptCompounds);
  if (!byCategory.has(category)) byCategory.set(category, new Map());
  const buckets = byCategory.get(category)!;
  (buckets.get(bucket) ?? buckets.set(bucket, []).get(bucket)!).push(name);
}

fs.mkdirSync(OUT, { recursive: true });
const manifest: Record<string, { total: number; buckets: Record<string, number> }> = {};
let grandTotal = 0;

for (const [category, buckets] of byCategory) {
  const dict: Record<string, string[]> = {};
  const counts: Record<string, number> = {};
  const overflow: string[] = [];
  for (const [bucket, names] of buckets) {
    if (names.length < MIN_BUCKET) { overflow.push(...names); continue; } // pool thin buckets
    const capped = sample(names, CAP_PER_BUCKET);
    dict[bucket] = capped;
    counts[bucket] = capped.length;
  }
  // Under-represented cultures for this category → a "mixed" grab-bag (never drop names).
  if (overflow.length) {
    const capped = sample(overflow, CAP_PER_BUCKET);
    dict.mixed = capped;
    counts.mixed = capped.length;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  grandTotal += total;
  manifest[category] = { total, buckets: counts };
  fs.writeFileSync(path.join(OUT, `${category}.json`), JSON.stringify(dict));
}

fs.writeFileSync(
  path.join(OUT, "manifest.json"),
  JSON.stringify({ keptCompounds: [...keptCompounds], categories: manifest }, null, 2)
);

console.log("kept compounds:", [...keptCompounds].join(", "));
for (const [cat, m] of Object.entries(manifest)) {
  console.log(`${cat.padEnd(13)} ${String(m.total).padStart(5)}  ${Object.keys(m.buckets).length} buckets`);
}
const bytes = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`total ${grandTotal} names, ${(bytes / 1024).toFixed(0)} KB across ${byCategory.size} category files -> ${OUT}`);
