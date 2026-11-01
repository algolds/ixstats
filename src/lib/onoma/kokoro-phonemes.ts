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

interface KokoroPhonemeResult {
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
  // Multi-char IPA clusters & long vowels from culture/template tables
  ["tʃʰ", "tʃ"],
  ["dʒʱ", "dʒ"],
  ["ʈʂʰ", "tʃ"],
  ["ʈʂ", "dʒ"],
  ["t̪ʰ", "t"],
  ["ᶮdʒ", "ndʒ"],
  ["aːɪ", "aɪ"],
  ["aːʊ", "aʊ"],
  ["ɔʏ", "ɔɪ"],
  ["uɪ", "wɪ"],
  ["aː", "ɑː"],
  ["eː", "eɪ"],
  ["oː", "oʊ"],
  ["ɒː", "ɑː"],
  ["tɕ", "tʃ"],
  ["ɡb", "ɡb"],
  ["kp", "kp"],
  ["ᵐb", "mb"],
  ["ⁿd", "nd"],
  // Single-char IPA -> Misaki-en equivalents
  ["r", "ɹ"], // American approximant
  ["ʁ", "ɹ"], // uvular -> approximant
  ["x", "k"], // voiceless velar fricative absent in en
  ["χ", "k"], // voiceless uvular fricative -> k
  ["ɣ", "ɡ"], // voiced velar fricative
  ["ɬ", "l"], // lateral fricative
  ["ɮ", "l"], // voiced lateral fricative -> l
  ["ʎ", "lj"], // palatal lateral approximant -> lj
  ["ɲ", "nj"], // palatal nasal -> nj
  ["ɳ", "n"], // retroflex nasal -> n
  ["ʈ", "t"], // retroflex plosive -> t
  ["ɖ", "d"], // voiced retroflex plosive -> d
  ["ɟ", "dʒ"], // voiced palatal plosive -> dʒ
  ["ɕ", "ʃ"], // alveolo-palatal fricative -> ʃ
  ["ʑ", "ʒ"], // voiced alveolo-palatal fricative -> ʒ
  ["ʂ", "ʃ"], // retroflex fricative -> ʃ
  ["ʐ", "ʒ"], // voiced retroflex fricative -> ʒ
  ["ɸ", "f"], // voiceless bilabial fricative -> f
  ["ʋ", "v"], // labiodental approximant -> v
  ["ħ", "h"], // voiceless pharyngeal fricative -> h
  ["ʕ", ""], // voiced pharyngeal fricative -- drop
  ["ʔ", ""], // glottal stop -- drop
  ["y", "iː"], // close front rounded -> unrounded
  ["ʏ", "ɪ"], // near-close near-front rounded -> ɪ
  ["ɯ", "u"], // close back unrounded -> u
  ["ø", "ɛ"], // mid front rounded -> eh
  ["œ", "ɛ"], // mid front rounded -> eh
  ["q", "k"], // uvular stop -> k
  ["g", "ɡ"], // ASCII g -> IPA voiced velar stop
  ["c", "k"], // palatal stop / bare c -> k
  ["-", " "], // hyphenated word boundary -> space
  // Misaki G2P shorthand tokens returned by /dev/phonemize
  ["O", "oʊ"],
  ["I", "aɪ"],
  ["A", "eɪ"],
  ["W", "aʊ"],
  ["Y", "ɔɪ"],
  ["Q", "əʊ"],
  ["ʧ", "tʃ"],
  ["ʤ", "dʒ"],
  ["T", "ɾ"],
  ["ᵻ", "ɪ"],
  ["ɜ", "ɜː"],
  // Suprasegmental / modifier diacritics that remap to audible glides/nasals
  ["ʲ", "j"],
  ["ᵐ", "m"],
  ["ⁿ", "n"],
  ["ᶮ", "n"],
]);

// Vowel tokens in Kokoro's inventory (syllable nuclei). In Misaki's phoneme
// format, primary/secondary stress marks (ˈ / ˌ) MUST immediately precede the
// vowel nucleus (e.g. "mˈɑɹkəs", "sˈakuɾə"), never the onset consonant
// ("ˈmɑɹkəs", "ˈsakuɾə") — placing ˈ before a consonant causes Kokoro's neural
// acoustic model to synthesize a phantom vowel ("uh-") before the consonant.
const KOKORO_VOWEL_TOKENS: ReadonlySet<string> = new Set([
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
]);

/**
 * Relocates IPA syllable-initial stress markers (`ˈ`, `ˌ`) past any onset
 * consonants so they sit immediately before the syllable's vowel nucleus,
 * matching Misaki/Kokoro's phoneme format. Stray stress markers with no
 * following vowel in the same word/syllable are dropped so Kokoro never voices
 * a leading vowel before a consonant.
 */
function relocateStressToVowel(tokens: readonly string[]): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i]!;
    if (tok === "ˈ" || tok === "ˌ") {
      let j = i + 1;
      while (
        j < tokens.length &&
        !KOKORO_VOWEL_TOKENS.has(tokens[j]!) &&
        tokens[j] !== " " &&
        tokens[j] !== "." &&
        tokens[j] !== "ˈ" &&
        tokens[j] !== "ˌ"
      ) {
        j++;
      }
      if (j < tokens.length && KOKORO_VOWEL_TOKENS.has(tokens[j]!)) {
        for (let k = i + 1; k < j; k++) {
          result.push(tokens[k]!);
        }
        result.push(tok);
        result.push(tokens[j]!);
        i = j + 1;
        continue;
      }
      // No vowel nucleus found before boundary or next stress mark — drop stray stress
      i++;
      continue;
    }
    result.push(tok);
    i++;
  }
  return result;
}

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
  "aːɪ",
  "aːʊ",
  "aɪ",
  "eɪ",
  "aʊ",
  "ɔɪ",
  "ɔʏ",
  "uɪ",
  "oʊ",
  "əʊ",
  "iː",
  "uː",
  "ɑː",
  "aː",
  "eː",
  "oː",
  "ɒː",
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
  "ɜ",
  "ɐ",
  "ɨ",
  "ᵻ",
  "ʉ",
  "ɯ",
  "y",
  "ʏ",
  "ø",
  "œ",
  "O",
  "I",
  "A",
  "W",
  "Y",
  "Q",
]);

// Stressed cardinals keep their quality; word-initial ones keep a clear onset instead of a
// hesitation schwa. Any other unstressed cardinal reduces to a schwa.
const STRESSED_CARDINALS: Record<string, string> = { e: "ɛ", o: "oʊ", a: "a" };
const INITIAL_CARDINALS: Record<string, string> = { e: "ɛ", o: "oʊ", a: "ɑ" };

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
    if (ch === " " || ch === "." || ch === "-" || ch === "/" || ch === "[" || ch === "]") {
      stressNext = false; // syllable/word boundary resets stress tracking
      if (ch === " " || ch === "." || ch === "-") {
        isWordInitial = true;
      }
      out += ch;
      i++;
      continue;
    }

    // Skip already-fine multi-char vowels whole (they are nuclei → clear stress).
    const skipVowel = ANGLICIZE_SKIP_VOWELS.find((v) => ipa.startsWith(v, i));
    if (skipVowel) {
      out += skipVowel;
      i += skipVowel.length;
      stressNext = false;
      isWordInitial = false;
      continue;
    }

    if (ch in STRESSED_CARDINALS) {
      out += stressNext ? STRESSED_CARDINALS[ch] : isWordInitial ? INITIAL_CARDINALS[ch] : "ə";
      stressNext = false;
      isWordInitial = false;
      i++;
      continue;
    }

    if (ANGLICIZE_OTHER_VOWELS.has(ch)) {
      stressNext = false; // also a nucleus
      isWordInitial = false;
    } else if (/[a-zɡøɛɔœɨŋʃʒθðɬɮʁχħʕɲʎɳʈɖɟɕʑʂʐɸʋvjɾɹʧʤ]/i.test(ch)) {
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
 * 3. Relocate syllable-onset stress markers (`ˈ`/`ˌ`) past onset consonants so
 *    they sit immediately before the vowel nucleus (Misaki phoneme convention).
 * 4. Collapse repeated spaces; trim.
 */
export function ipaToKokoroPhonemes(ipa: string): KokoroPhonemeResult {
  if (!ipa) return { phonemes: "", dropped: [] };

  // 1. Strip delimiters and silent suprasegmental/orthographic diacritics; keep stress / length / whitespace.
  const cleaned = ipa.replace(/[/[\]ʰʱˤʼ̥̪'’‘ʻ]/g, "").trim();
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

  const phonemes = relocateStressToVowel(out)
    .join("")
    .replace(/[^\S\n]+/g, " ")
    .trim();
  return { phonemes, dropped };
}
