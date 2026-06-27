// src/lib/onoma/branding-utils.ts
// Onoma Lab — Branding & Typographical utilities

export const GOOGLE_FONTS = [
  { id: "Gentium Book Plus", family: "Gentium Book Plus", type: "serif" },
  { id: "Cardo", family: "Cardo", type: "serif" },
  { id: "Cinzel", family: "Cinzel", type: "serif" },
  { id: "Outfit", family: "Outfit", type: "sans" },
  { id: "Syne", family: "Syne", type: "display" },
  { id: "JetBrains Mono", family: "JetBrains Mono", type: "mono" },
  { id: "Lora", family: "Lora", type: "serif" },
  { id: "Inter", family: "Inter", type: "sans" },
];

/**
 * Wraps the brand name "Onoma" inside a string with linguistic flanking notations.
 */
export function applyFlanking(text: string, style?: string): string {
  if (!text) return "";
  const brandWord = "Onoma";
  if (!text.includes(brandWord)) return text;

  let decorated = brandWord;
  switch (style) {
    case "brackets":
      decorated = `⟨${brandWord}⟩`;
      break;
    case "slashes":
      decorated = `/${brandWord}/`;
      break;
    case "brackets-square":
      decorated = `[${brandWord}]`;
      break;
    case "asterisk":
      decorated = `*${brandWord}`;
      break;
    case "ipa":
      decorated = `${brandWord} [oʊˈnoʊmə]`;
      break;
    case "none":
    default:
      decorated = brandWord;
      break;
  }

  return text.replace(brandWord, decorated);
}

/**
 * Returns the Google Fonts CSS import link for a given font family name.
 */
export function getGoogleFontLink(fontFamily: string): string {
  const font = GOOGLE_FONTS.find((f) => f.family === fontFamily);
  if (!font) return "";
  const queryFamily = fontFamily.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${queryFamily}:wght@400;600;800&display=swap`;
}

// IPA tokens that act as syllable nuclei (vowels & diphthongs).
const IPA_VOWEL_TOKENS = new Set([
  "aɪ", "eɪ", "aʊ", "ɔɪ", "oʊ", "iː", "uː", "ɑː", "ɔː",
  "ø", "œ", "ɛ", "ɔ", "ə", "æ", "y", "ʌ", "ɪ", "ʊ", "a", "e", "i", "o", "u",
]);

// IPA token → English re-spelling chunk. Longest tokens first (scanner takes first match).
const IPA_RESPELL: [string, string][] = [
  ["aɪ", "eye"], ["eɪ", "ay"], ["aʊ", "ow"], ["ɔɪ", "oy"], ["oʊ", "oh"],
  ["iː", "ee"], ["uː", "oo"], ["ɑː", "ah"], ["ɔː", "aw"],
  ["tʃ", "ch"], ["dʒ", "j"], ["ts", "ts"], ["ks", "ks"], ["kw", "kw"],
  ["θ", "th"], ["ð", "th"], ["ʃ", "sh"], ["ʒ", "zh"], ["ŋ", "ng"],
  ["ʁ", "r"], ["ɣ", "gh"], ["ɬ", "l"], ["ɾ", "r"], ["x", "kh"], ["ʔ", ""],
  ["ø", "ur"], ["œ", "ur"], ["ɛ", "eh"], ["ɔ", "aw"], ["ə", "uh"], ["æ", "ah"],
  ["y", "ew"], ["ʌ", "uh"], ["ɪ", "ih"], ["ʊ", "uu"],
  ["a", "ah"], ["e", "eh"], ["i", "ee"], ["o", "oh"], ["u", "oo"],
];

interface RespellChunk {
  text: string;
  vowel: boolean;
}

/** Tokenize one IPA word into re-spelled chunks, tracking which chunk carries primary stress. */
function chunkIpaWord(word: string): { chunks: RespellChunk[]; stressChunk: number } {
  const stressPos = word.indexOf("ˈ");
  const removedBefore = stressPos < 0 ? 0 : (word.slice(0, stressPos).match(/[ˈˌ]/g) || []).length;
  const cleanStressPos = stressPos < 0 ? -1 : stressPos - removedBefore;
  const clean = word.replace(/[ˈˌ]/g, "");

  const chunks: RespellChunk[] = [];
  let stressChunk = -1;
  let sawStress = false;
  let i = 0;
  while (i < clean.length) {
    if (cleanStressPos >= 0 && i >= cleanStressPos) sawStress = true;
    let tok = clean[i]!;
    let rep = clean[i]!;
    for (const [t, r] of IPA_RESPELL) {
      if (clean.startsWith(t, i)) {
        tok = t;
        rep = r;
        break;
      }
    }
    const vowel = IPA_VOWEL_TOKENS.has(tok);
    if (rep) chunks.push({ text: rep, vowel });
    if (sawStress && vowel && stressChunk === -1) stressChunk = chunks.length - 1;
    i += tok.length;
  }
  return { chunks, stressChunk };
}

/** Group chunks into syllables — one nucleus each; a single intervocalic consonant is the next onset. */
function syllabifyChunks(chunks: RespellChunk[]): { text: string; start: number; end: number }[] {
  const vowels: number[] = [];
  chunks.forEach((c, idx) => { if (c.vowel) vowels.push(idx); });
  const join = (s: number, e: number) => chunks.slice(s, e).map((c) => c.text).join("");
  if (vowels.length === 0) return [{ text: join(0, chunks.length), start: 0, end: chunks.length }];

  const out: { text: string; start: number; end: number }[] = [];
  let start = 0;
  for (let v = 0; v < vowels.length; v++) {
    let end: number;
    if (v === vowels.length - 1) {
      end = chunks.length;
    } else {
      const between = vowels[v + 1]! - vowels[v]! - 1;
      // 0–1 consonants → coda stays with this vowel; 2+ → last consonant becomes the next onset.
      end = between <= 1 ? vowels[v]! + 1 : vowels[v + 1]! - 1;
    }
    out.push({ text: join(start, end), start, end });
    start = end;
  }
  return out;
}

/**
 * Translates an IPA transcription into a phonetically readable English re-spelling for TTS.
 * The stressed syllable is upper-cased; syllables are hyphen-joined.
 *
 * Example: "/ʃəˈnoʊmə/" → "shuh-NOH-muh"
 */
export function ipaToSpeechSpelling(ipa: string): string {
  if (!ipa) return "";
  const cleaned = ipa.replace(/[/[\]]/g, "").trim();
  if (!cleaned) return "";

  const parts = cleaned.split(/(\s+|-)/); // keep spaces/hyphens as separators
  return parts
    .map((part) => {
      if (!part || /^(\s+|-)$/.test(part)) return part;
      const { chunks, stressChunk } = chunkIpaWord(part);
      const sylls = syllabifyChunks(chunks);
      if (sylls.length <= 1) return sylls.map((s) => s.text).join("").toUpperCase();
      let anyStressed = false;
      const rendered = sylls.map((s) => {
        const stressed = stressChunk >= s.start && stressChunk < s.end;
        if (stressed) anyStressed = true;
        return stressed ? s.text.toUpperCase() : s.text.toLowerCase();
      });
      if (!anyStressed && rendered.length > 0) rendered[0] = rendered[0]!.toUpperCase();
      return rendered.join("-");
    })
    .join("");
}

/**
 * Re-spelling formatted for kokoro-web's text input (no phoneme input supported via REST).
 * Stress caps dropped (TTS ignores letter case); syllables are space-separated.
 */
export function ipaToSpokenText(ipa: string): string {
  const spelled = ipaToSpeechSpelling(ipa);
  if (!spelled) return "";
  return spelled.toLowerCase().replace(/-/g, " ");
}
