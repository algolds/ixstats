/**
 * Markov Chain Naming System (Syllable-level)
 *
 * Syllable-level Markov chain for generating linguistically coherent names
 * per language family. Falls back to character-level generation on dead ends.
 *
 * Used by: country-generator, water-generator, culture-generator
 */

import { makeRng } from "~/lib/worldgen/rng";

// ── Types ────────────────────────────────────

export interface LanguageFamily {
  id: string;
  name: string;
  /** last-char-of-prev-syllable → next-syllable → weight ("" = word start) */
  transitions: Map<string, Map<string, number>>;
  /** Starting syllables with relative weights */
  starters: Map<string, number>;
  suffixes: string[];
  minLength: number;
  maxLength: number;
  vowelRatio: [number, number];
  riverTemplates: string[];
  lakeTemplates: string[];
  mountainTemplates: string[];
  seaTemplates: string[];
}

export interface NamingConfig {
  families: LanguageFamily[];
  regionAssignments?: Map<number, string>;
}

// ── Constants ────────────────────────────────

const VOWELS = new Set("aeiouàáâãäåèéêëìíîïòóôõöùúûüæœ");
const END_TOKEN = "$";
const MAX_ATTEMPTS = 50;
const LINKING_VOWELS = ["a", "i"];
const MAX_SYLL = 5;

function isVowel(c: string): boolean {
  return VOWELS.has(c.toLowerCase());
}

// ── Syllable Splitting ───────────────────────

/**
 * Split a word into pseudo-syllables (max 5 chars each).
 * Breaks after a vowel followed by a consonant followed by another vowel,
 * keeping consonant clusters with the following vowel.
 * "nordheim" → ["nord","heim"], "istanbul" → ["is","tan","bul"]
 */
export function splitIntoSyllables(word: string): string[] {
  const w = word.toLowerCase();
  if (w.length <= MAX_SYLL) return [w];

  const out: string[] = [];
  let start = 0;

  for (let i = 0; i < w.length; i++) {
    // Force-break at max length
    if (i - start + 1 >= MAX_SYLL && i + 1 < w.length) {
      out.push(w.slice(start, i + 1));
      start = i + 1;
      continue;
    }
    // VCV break: vowel at i, consonant at i+1, vowel at i+2
    if (i + 2 < w.length && isVowel(w[i]!) && !isVowel(w[i + 1]!) && isVowel(w[i + 2]!)) {
      out.push(w.slice(start, i + 1));
      start = i + 1;
    }
  }

  if (start < w.length) {
    const rest = w.slice(start);
    if (rest.length > MAX_SYLL) {
      for (let j = 0; j < rest.length; j += MAX_SYLL) out.push(rest.slice(j, j + MAX_SYLL));
    } else {
      out.push(rest);
    }
  }
  return out.length > 0 ? out : [w];
}

// ── Post-processing ──────────────────────────

function removeTripleLetters(s: string): string {
  let r = "";
  for (let i = 0; i < s.length; i++) {
    if (i >= 2 && s[i] === s[i - 1] && s[i] === s[i - 2]) continue;
    r += s[i];
  }
  return r;
}

function collapseDoubleVowels(s: string): string {
  let r = s[0] ?? "";
  for (let i = 1; i < s.length; i++) {
    if (isVowel(s[i]!) && isVowel(s[i - 1]!) && s[i] === s[i - 1]) continue;
    r += s[i];
  }
  return r;
}

/** Insert linking vowel when suffix junction creates 3+ consecutive consonants */
function joinWithLinkingVowel(base: string, suffix: string, rng: () => number): string {
  if (!base.length || !suffix.length) return base + suffix;
  let tc = 0;
  for (let i = base.length - 1; i >= 0 && !isVowel(base[i]!); i--) tc++;
  let lc = 0;
  for (let i = 0; i < suffix.length && !isVowel(suffix[i]!); i++) lc++;
  if (tc + lc >= 3)
    return base + LINKING_VOWELS[Math.floor(rng() * LINKING_VOWELS.length)]! + suffix;
  return base + suffix;
}

function postProcess(s: string): string {
  return collapseDoubleVowels(removeTripleLetters(s));
}

// ── Training ─────────────────────────────────

/**
 * Build a language family from seed words.
 * Trains syllable-level transitions: outer key = last char of prev syllable
 * ("" for word start), inner map = next syllable → weight.
 */
export function buildLanguageFamily(
  id: string,
  name: string,
  seedWords: string[],
  options: {
    suffixes?: string[];
    minLength?: number;
    maxLength?: number;
    vowelRatio?: [number, number];
    riverTemplates?: string[];
    lakeTemplates?: string[];
    mountainTemplates?: string[];
    seaTemplates?: string[];
  } = {}
): LanguageFamily {
  const transitions = new Map<string, Map<string, number>>();
  const starters = new Map<string, number>();

  const addT = (ctx: string, next: string) => {
    let m = transitions.get(ctx);
    if (!m) {
      m = new Map();
      transitions.set(ctx, m);
    }
    m.set(next, (m.get(next) ?? 0) + 1);
  };

  for (const word of seedWords) {
    const lower = word.toLowerCase().trim();
    if (lower.length < 2) continue;
    const sylls = splitIntoSyllables(lower);
    if (!sylls.length) continue;

    const first = sylls[0]!;
    starters.set(first, (starters.get(first) ?? 0) + 1);
    addT("", first);

    for (let i = 1; i < sylls.length; i++) {
      const prev = sylls[i - 1]!;
      addT(prev[prev.length - 1]!, sylls[i]!);
    }
    const last = sylls[sylls.length - 1]!;
    addT(last[last.length - 1]!, END_TOKEN);
  }

  return {
    id,
    name,
    transitions,
    starters,
    suffixes: options.suffixes ?? [],
    minLength: options.minLength ?? 4,
    maxLength: options.maxLength ?? 12,
    vowelRatio: options.vowelRatio ?? [0.3, 0.6],
    riverTemplates: options.riverTemplates ?? ["$N River", "River $N"],
    lakeTemplates: options.lakeTemplates ?? ["Lake $N"],
    mountainTemplates: options.mountainTemplates ?? ["Mount $N", "$N Mountains"],
    seaTemplates: options.seaTemplates ?? ["Sea of $N", "$N Sea"],
  };
}

// ── Generation ───────────────────────────────

/**
 * Markov name generator. Deterministic when given a seed.
 * Syllable-level with character-level fallback on dead ends.
 */
export class MarkovNameGenerator {
  private rng: () => number;
  private family: LanguageFamily;
  private generated: Set<string> = new Set();

  constructor(family: LanguageFamily, seed: number) {
    this.family = family;
    this.rng = makeRng(seed);
  }

  private weightedPick(map: Map<string, number>): string | null {
    let total = 0;
    for (const w of map.values()) total += w;
    if (total === 0) return null;
    let r = this.rng() * total;
    for (const [key, weight] of map) {
      r -= weight;
      if (r <= 0) return key;
    }
    let last: string | null = null;
    for (const key of map.keys()) last = key;
    return last;
  }

  /** Character-level fallback when syllable chain reaches a dead end */
  private charFallback(prefix: string, remaining: number): string {
    const cons = "bcdfghjklmnprstvwz";
    let result = prefix;
    for (let i = 0; i < remaining; i++) {
      const lastV = result.length > 0 && isVowel(result[result.length - 1]!);
      if (lastV ? this.rng() < 0.3 : this.rng() < 0.6) {
        result += "aeiou"[Math.floor(this.rng() * 5)];
      } else {
        result += cons[Math.floor(this.rng() * cons.length)];
      }
    }
    return result;
  }

  /** Generate a raw name from the syllable Markov chain */
  private generateRaw(): string | null {
    const starter = this.weightedPick(this.family.starters);
    if (!starter) return null;

    let result = starter;
    let ctx = starter[starter.length - 1]!;
    const max = this.family.maxLength;

    for (let i = 0; i < 10; i++) {
      if (result.length >= max) break;
      const nextMap = this.family.transitions.get(ctx);
      if (!nextMap) {
        const need = this.family.minLength - result.length;
        if (need > 0) result = this.charFallback(result, Math.min(need, max - result.length));
        break;
      }
      const next = this.weightedPick(nextMap);
      if (!next || next === END_TOKEN) break;
      if (result.length + next.length > max) {
        const need = this.family.minLength - result.length;
        if (need > 0) result = this.charFallback(result, Math.min(need, max - result.length));
        break;
      }
      result += next;
      ctx = next[next.length - 1]!;
    }
    return postProcess(result);
  }

  private vowelRatio(s: string): number {
    if (!s.length) return 0;
    let v = 0;
    for (const c of s) if (VOWELS.has(c)) v++;
    return v / s.length;
  }

  private isValid(name: string): boolean {
    if (name.length < this.family.minLength || name.length > this.family.maxLength) return false;
    const vr = this.vowelRatio(name);
    if (vr < this.family.vowelRatio[0] || vr > this.family.vowelRatio[1]) return false;
    let run = 0;
    let lastType: "v" | "c" | null = null;
    for (const c of name) {
      const t = VOWELS.has(c) ? "v" : "c";
      if (t === lastType) {
        run++;
        if (run >= 3) return false;
      } else {
        run = 1;
        lastType = t;
      }
    }
    return true;
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Generate a unique country/place name. Optionally applies a suffix. */
  generate(options: { useSuffix?: boolean } = {}): string {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let raw = this.generateRaw();
      if (!raw) continue;

      if (options.useSuffix && this.family.suffixes.length > 0 && this.rng() < 0.4) {
        const suffix = this.family.suffixes[Math.floor(this.rng() * this.family.suffixes.length)]!;
        raw = collapseDoubleVowels(joinWithLinkingVowel(raw, suffix, this.rng));
      }
      raw = postProcess(raw);
      if (!this.isValid(raw)) continue;

      const name = this.capitalize(raw);
      if (this.generated.has(name)) continue;
      this.generated.add(name);
      return name;
    }
    const fallback = this.capitalize(this.generateRaw() ?? `region${this.generated.size}`);
    this.generated.add(fallback);
    return fallback;
  }

  private fromTemplate(templates: string[]): string {
    const root = this.generate();
    return templates[Math.floor(this.rng() * templates.length)]!.replace("$N", root);
  }

  generateRiverName(): string {
    return this.fromTemplate(this.family.riverTemplates);
  }
  generateLakeName(): string {
    return this.fromTemplate(this.family.lakeTemplates);
  }
  generateMountainName(): string {
    return this.fromTemplate(this.family.mountainTemplates);
  }
  generateSeaName(): string {
    return this.fromTemplate(this.family.seaTemplates);
  }

  getGenerated(): ReadonlySet<string> {
    return this.generated;
  }

  addExisting(names: Iterable<string>): void {
    for (const n of names) this.generated.add(n);
  }
}

// ── Multi-family coordinator ─────────────────

/**
 * Manages multiple naming generators, one per language family.
 * Assigns families to regions and ensures global name uniqueness.
 */
export class WorldNamingSystem {
  private generators: Map<string, MarkovNameGenerator> = new Map();
  private allNames: Set<string> = new Set();
  private familyIds: string[];
  private rng: () => number;

  constructor(families: LanguageFamily[], seed: number) {
    this.rng = makeRng(seed);
    this.familyIds = families.map((f) => f.id);
    for (const family of families) {
      this.generators.set(family.id, new MarkovNameGenerator(family, seed + hashString(family.id)));
    }
  }

  getGenerator(familyId: string): MarkovNameGenerator | undefined {
    return this.generators.get(familyId);
  }

  randomFamily(): string {
    return this.familyIds[Math.floor(this.rng() * this.familyIds.length)]!;
  }

  /** Assign families to regions via BFS from seed points, with mutation chance */
  assignFamilies(regionCount: number, neighbors: Map<number, number[]>): Map<number, string> {
    const assignments = new Map<number, string>();
    const fc = this.familyIds.length;
    const seedCount = Math.min(fc, regionCount);
    const idx = Array.from({ length: regionCount }, (_, i) => i);

    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [idx[i], idx[j]] = [idx[j]!, idx[i]!];
    }
    for (let i = 0; i < seedCount; i++) assignments.set(idx[i]!, this.familyIds[i % fc]!);

    const queue = idx.slice(0, seedCount);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const fam = assignments.get(cur);
      if (!fam) continue;
      for (const nb of neighbors.get(cur) ?? []) {
        if (!assignments.has(nb)) {
          assignments.set(
            nb,
            this.rng() < 0.15 ? this.familyIds[Math.floor(this.rng() * fc)]! : fam
          );
          queue.push(nb);
        }
      }
    }
    for (let i = 0; i < regionCount; i++) {
      if (!assignments.has(i)) assignments.set(i, this.randomFamily());
    }
    return assignments;
  }

  private withGen(
    familyId: string,
    fallback: string,
    fn: (g: MarkovNameGenerator) => string
  ): string {
    const gen = this.generators.get(familyId);
    if (!gen) return `${fallback}${this.allNames.size}`;
    gen.addExisting(this.allNames);
    const name = fn(gen);
    this.allNames.add(name);
    return name;
  }

  generateName(familyId: string, options: { useSuffix?: boolean } = {}): string {
    return this.withGen(familyId, "Region", (g) => g.generate(options));
  }
  generateRiverName(familyId: string): string {
    return this.withGen(familyId, "River ", (g) => g.generateRiverName());
  }
  generateLakeName(familyId: string): string {
    return this.withGen(familyId, "Lake ", (g) => g.generateLakeName());
  }
  generateSeaName(familyId: string): string {
    return this.withGen(familyId, "Sea ", (g) => g.generateSeaName());
  }
}

// ── Utilities ────────────────────────────────

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
