// src/lib/onoma/corpus/clean.ts
// Onoma corpus cleaning (Phase 2 of plans/051). Pure logic — no IO — so it's
// fully jest-testable. Turns raw wiki page titles into trainable names.

export type CorpusName = { name: string; category: string; sourceWiki: string };

const ROMAN = /^[IVXLCDM]+$/; // standalone regnal numeral (I, II, XIV…)

// Governmental descriptors that prefix a country's proper name on the wiki
// ("Republic of Nasastan" → "Nasastan"). Longest-first so multi-word wins.
const GOV_PREFIX =
  /^(?:Federal Republic|Democratic Republic|People's Republic|Socialist Republic|United Republic|Grand Duchy|Free State|Republic|Kingdom|Empire|Federation|Confederation|Principality|Duchy|Commonwealth|Union|State) of\s+/i;

/**
 * Normalize one raw title into a trainable name, or null to drop it.
 * Category-aware: country strips gov descriptors, person strips regnal/territorial suffixes.
 */
export function cleanName(raw: string, category: string): string | null {
  let s = raw.normalize("NFC");

  s = s.replace(/\s*[([][^)\]]*[)\]]/g, " "); // drop "(city)", "(1983: Doomsday)", "[note]"
  s = s.split(",")[0];                        // drop ", Region" qualifier tails
  s = s.replace(/["“”]/g, " ");               // strip double-quotes (nicknames, scare quotes)…
  s = s.replace(/\s+/g, " ").trim();
  // …but KEEP apostrophes inside words (O'Connor, T'kampa, Patrick's); only trim
  // them when dangling at a word edge.
  s = s.replace(/(^|\s)['‘’]+|['‘’]+(\s|$)/g, "$1$2").replace(/\s+/g, " ").trim();
  if (!s) return null;

  if (category === "country") {
    s = s.replace(GOV_PREFIX, "").trim();
  }

  if (category === "person") {
    s = s.replace(/\s+of\s+.+$/i, "").trim();                       // "Rhys I of Faneria" → "Rhys I"
    s = s.split(" ").filter((w) => !ROMAN.test(w)).join(" ").trim(); // drop regnal numerals
  }

  if (s.length < 2) return null;
  if (/\d/.test(s)) return null;                 // dates/codes aren't names
  if (!/[A-Za-zÀ-ÿ]/.test(s)) return null;       // must contain a letter
  if (s.split(" ").length > 5) return null;      // sentence-like list/meta titles
  return s;
}

/** Clean + dedup a raw corpus (case-insensitive within each category). */
export function cleanCorpus(rows: CorpusName[]): CorpusName[] {
  const seen = new Set<string>();
  const out: CorpusName[] = [];
  for (const r of rows) {
    const name = cleanName(r.name, r.category);
    if (!name) continue;
    const key = `${r.category}|${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...r, name });
  }
  return out;
}
