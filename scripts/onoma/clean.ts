// scripts/onoma/clean.ts — Phase 2 runner.
// Reads raw/lexicon-raw.json, cleans+dedups, writes raw/lexicon-clean.json.
//   bunx tsx scripts/onoma/clean.ts

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanLexicon, type LexiconName } from "../../src/lib/onoma/lexicon/clean";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "raw");
const raw: LexiconName[] = JSON.parse(fs.readFileSync(path.join(dir, "lexicon-raw.json"), "utf8"));
const clean = cleanLexicon(raw);

const tally = (rows: LexiconName[]) =>
  rows.reduce<Record<string, number>>((a, r) => ((a[r.category] = (a[r.category] || 0) + 1), a), {});

fs.writeFileSync(path.join(dir, "lexicon-clean.json"), JSON.stringify(clean));
console.log(`raw   ${raw.length}`, tally(raw));
console.log(`clean ${clean.length}`, tally(clean));
console.log(`dropped ${raw.length - clean.length} (${((1 - clean.length / raw.length) * 100).toFixed(1)}%)`);
console.log(`-> ${path.join(dir, "lexicon-clean.json")}`);
