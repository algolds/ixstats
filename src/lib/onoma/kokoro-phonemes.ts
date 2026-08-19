// src/lib/onoma/kokoro-phonemes.ts
// Pure IPA -> Kokoro-vocab phoneme normalizer.
//
// kokoro-fastapi's /dev/generate_from_phonemes speaks IPA directly (with stress
// marks honored), but only tokens in Kokoro's misaki English vocabulary. This
// normalizer rewrites Onoma's IPA -- including per-name / per-culture overrides
// -- into a string of tokens Kokoro can actually speak, dropping anything it
// can't (silently, so audio is never garbled) and reporting what was dropped.
//
// The valid-token set is seeded from the misaki en inventory; refine it with
// `scripts/onoma/kokoro-vocab-oracle.ts` once the container is up.

export interface KokoroPhonemeResult {
  phonemes: string; // ready for /dev/generate_from_phonemes
  dropped: string[]; // IPA tokens removed (not in Kokoro's vocab, no mapping)
}

// Kokoro's misaki English phoneme vocabulary -- tokens that pass through
// unchanged. Multi-char tokens (affricates, diphthongs, long vowels) are listed
// before their single-char components so the longest-first scanner prefers them.
export const KOKORO_VALID_TOKENS: ReadonlySet<string> = new Set([
  // affricates & common clusters
  "tʃ",
  "dʒ",
  "ts",
  // diphthongs
  "aɪ",
  "eɪ",
  "aʊ",
  "ɔɪ",
  "oʊ",
  "əʊ",
  // long vowels
  "iː",
  "uː",
  "ɑː",
  "ɔː",
  "ɜː",
  "əː",
  // consonants
  "p",
  "b",
  "t",
  "d",
  "k",
  "ɡ",
  "f",
  "v",
  "θ",
  "ð",
  "s",
  "z",
  "ʃ",
  "ʒ",
  "h",
  "m",
  "n",
  "ŋ",
  "l",
  "ɹ",
  "j",
  "w",
  "ɾ",
  // vowels (monophthongs)
  "i",
  "ɪ",
  "e",
  "ɛ",
  "æ",
  "ɑ",
  "ɒ",
  "ɔ",
  "o",
  "ʊ",
  "u",
  "ʌ",
  "ə",
  "ɚ",
  "ɝ",
  "ɐ",
  "ɨ",
  "ʉ",
  "a",
  // stress, length, syllable boundary -- preserved verbatim
  "ˈ",
  "ˌ",
  "ː",
  ".",
  " ",
]);

// IPA token -> nearest valid misaki-en equivalent. Empty target = drop (and the
// token is recorded in `dropped`).
export const KOKORO_REMAP: ReadonlyMap<string, string> = new Map<string, string>([
  ["r", "ɹ"], // American approximant
  ["ʁ", "ɹ"], // uvular -> approximant
  ["x", "k"], // voiceless velar fricative absent in en
  ["ɣ", "ɡ"], // voiced velar fricative
  ["ɬ", "l"], // lateral fricative
  ["ʔ", ""], // glottal stop -- drop
  ["y", "iː"], // close front rounded -> unrounded
  ["ø", "ɛ"], // mid front rounded -> eh
  ["œ", "ɛ"], // mid front rounded -> eh
  ["q", "k"], // uvular stop -> k
  ["g", "ɡ"], // ASCII g -> IPA voiced velar stop
  ["c", "k"], // palatal stop / bare c -> k
]);

// Known tokens (valid pass-through ∪ remap sources), longest-first for scanning.
// A token is either valid (passes through) or remapped -- never both.
const SORTED_KNOWN: readonly string[] = Object.freeze(
  [...new Set([...KOKORO_VALID_TOKENS, ...KOKORO_REMAP.keys()])]
    .filter((t) => t.length > 0)
    .sort((a, b) => b.length - a.length)
);

// Diphthongs / long vowels that are already English-natural — skipped whole so we
// never crack "oʊ" into a bare "o" and then reduce it.
const ANGLICIZE_SKIP_VOWELS: readonly string[] = [
  "aɪ",
  "eɪ",
  "aʊ",
  "ɔɪ",
  "oʊ",
  "əʊ",
  "iː",
  "uː",
  "ɑː",
  "ɔː",
  "ɜː",
  "əː",
];

// Other single-char vowels that act as syllable nuclei (so they clear the "stressed"
// flag) but are left as-is — only the over-articulated cardinals a/e/o get reworked.
const ANGLICIZE_OTHER_VOWELS = new Set([
  "i",
  "ɪ",
  "u",
  "ʊ",
  "ɛ",
  "æ",
  "ɑ",
  "ɒ",
  "ɔ",
  "ʌ",
  "ə",
  "ɚ",
  "ɝ",
  "ɐ",
  "ɨ",
  "ʉ",
  "y",
  "ø",
  "œ",
]);

/**
 * Soften Onoma's cardinal vowels toward English so kokoro stops voicing a crisp
 * "eh / ah / oh" on every syllable. Stress-aware:
 *   - stressed   cardinal: e → ɛ ("bed"), o → oʊ ("go"), a kept
 *   - unstressed cardinal: a / e / o → ə (schwa)
 * Diphthongs, long vowels and already-English vowels pass through untouched. Applied
 * only on the synthesis path (not the studio's canonical IPA display).
 *
 * Example: "/ˈdelepas/" → "/ˈdɛləpəs/"  ("DEH-luh-pus" instead of "DEH-leh-pahs")
 */
export function anglicizeForSpeech(ipa: string): string {
  if (!ipa) return "";
  let out = "";
  let stressNext = false; // a stress mark was seen; the next vowel is the stressed nucleus
  let isWordInitial = true;
  let i = 0;
  while (i < ipa.length) {
    const ch = ipa[i]!;

    if (ch === "ˈ" || ch === "ˌ") {
      stressNext = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === " " || ch === "." || ch === "/" || ch === "[" || ch === "]") {
      stressNext = false; // syllable/word boundary resets stress tracking
      if (ch === " " || ch === ".") {
        isWordInitial = true;
      }
      out += ch;
      i++;
      continue;
    }

    // Skip already-fine multi-char vowels whole (they are nuclei → clear stress).
    let skipped = false;
    for (const v of ANGLICIZE_SKIP_VOWELS) {
      if (ipa.startsWith(v, i)) {
        out += v;
        i += v.length;
        stressNext = false;
        isWordInitial = false;
        skipped = true;
        break;
      }
    }
    if (skipped) continue;

    if (ch === "e" || ch === "a" || ch === "o") {
      if (stressNext) {
        out += ch === "e" ? "ɛ" : ch === "o" ? "oʊ" : "a";
      } else if (isWordInitial) {
        // Word-initial cardinal vowel: preserve clear vowel onset rather than reducing to hesitation schwa
        out += ch === "e" ? "ɛ" : ch === "o" ? "oʊ" : "ɑ";
      } else {
        out += "ə";
      }
      stressNext = false;
      isWordInitial = false;
      i++;
      continue;
    }

    if (ANGLICIZE_OTHER_VOWELS.has(ch)) {
      stressNext = false; // also a nucleus
      isWordInitial = false;
    } else if (/[a-zøɛɔœɨŋʃtʃθðɬʁvjɾ]/i.test(ch)) {
      isWordInitial = false;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Normalize an IPA transcription into a string of Kokoro-vocab phonemes.
 *
 * 1. Strip delimiters `/[]`; keep stress `ˈ`/`ˌ`, length `ː`, and whitespace.
 * 2. Token-scan longest-first. For each token: pass through if valid, remap if
 *    in the remap table, otherwise drop it and record in `dropped`.
 * 3. Collapse repeated spaces; trim.
 */
export function ipaToKokoroPhonemes(ipa: string): KokoroPhonemeResult {
  if (!ipa) return { phonemes: "", dropped: [] };

  // 1. Strip delimiters; keep stress / length / whitespace.
  const cleaned = ipa.replace(/[/[\]]/g, "").trim();
  if (!cleaned) return { phonemes: "", dropped: [] };

  const dropped: string[] = [];
  const out: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    let matched = false;
    for (const tok of SORTED_KNOWN) {
      if (cleaned.startsWith(tok, i)) {
        if (KOKORO_VALID_TOKENS.has(tok)) {
          out.push(tok);
        } else {
          const target = KOKORO_REMAP.get(tok)!;
          if (target) out.push(target);
          else dropped.push(tok); // empty target = dropped
        }
        i += tok.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // No known token starts here -> unknown single char -> drop + record.
      dropped.push(cleaned[i]!);
      i++;
    }
  }

  const phonemes = out
    .join("")
    .replace(/[^\S\n]+/g, " ")
    .trim();
  return { phonemes, dropped };
}
