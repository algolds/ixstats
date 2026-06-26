// src/lib/onoma/speech.ts
// Onoma Lab — Speech helpers (Phase 7). Pure, deterministic, no dependency.
// Converts the IPA the phonology engine emits into eSpeak's [[phoneme]] notation
// (Kirshenbaum-style) so meSpeak can synthesize the actual sounds, and maps each
// culture to the closest eSpeak voice.

// Closest eSpeak voice id (meSpeak voice_id; file lives at voices/<id>.json) per
// culture family. `en/en` is the fallback. Note meSpeak's English id is "en/en".
export const CULTURE_VOICE: Record<string, string> = {
  latin: "la",
  germanic: "de",
  celtic: "en/en",
  slavic: "pl",
  arabic: "en/en", // meSpeak has no Arabic voice bundled
  "east-asian": "zh",
  austronesian: "eo",
  constructed: "eo",
  any: "en/en",
};

// Admin-tunable pronunciation settings (meSpeak/eSpeak speak() params + voice map).
export interface SpeechConfig {
  speed: number; // words/min, ~80–450 (eSpeak default 175)
  pitch: number; // 0–99 (default 50)
  amplitude: number; // 0–200 (default 100)
  wordgap: number; // pause between words, ×10ms (default 0)
  variant: string; // voice variant e.g. "m1".."m7" / "f1".."f5", or "" for none
  voices: Record<string, string>; // culture → meSpeak voice id (overrides CULTURE_VOICE)
}

export const DEFAULT_SPEECH_CONFIG: SpeechConfig = {
  speed: 125,
  pitch: 50,
  amplitude: 100,
  wordgap: 0,
  variant: "",
  voices: { ...CULTURE_VOICE },
};

let activeConfig: SpeechConfig = DEFAULT_SPEECH_CONFIG;

/** Apply admin overrides (partial) to the active pronunciation config. */
export function setSpeechConfig(cfg: Partial<SpeechConfig>): void {
  activeConfig = {
    ...DEFAULT_SPEECH_CONFIG,
    ...cfg,
    voices: { ...CULTURE_VOICE, ...(cfg.voices ?? {}) },
  };
}

export function getSpeechConfig(): SpeechConfig {
  return activeConfig;
}

export function voiceForCulture(culture: string | null | undefined): string {
  const voices = activeConfig.voices;
  if (!culture) return voices.any ?? "en/en";
  const primary = culture.split("+")[0].toLowerCase().trim();
  return voices[primary] ?? voices.any ?? "en/en";
}

// IPA → eSpeak phoneme, longest-match first. Covers the inventory phonology.ts emits.
const IPA_TO_ESPEAK: [string, string][] = [
  // diphthongs / long vowels (multi-char first)
  ["aɪ", "aI"],
  ["eɪ", "eI"],
  ["aʊ", "aU"],
  ["ɔɪ", "OI"],
  ["oʊ", "oU"],
  ["iː", "i:"],
  ["uː", "u:"],
  ["aː", "A:"],
  ["ɑː", "A:"],
  // affricates
  ["tʃ", "tS"],
  ["dʒ", "dZ"],
  ["ts", "ts"],
  ["kw", "kw"],
  ["ks", "ks"],
  // single consonants
  ["θ", "T"],
  ["ð", "D"],
  ["ʃ", "S"],
  ["ʒ", "Z"],
  ["ŋ", "N"],
  ["ɣ", "Q"],
  ["ɬ", "l"],
  ["ʁ", "r"],
  ["ɾ", "r"],
  ["x", "x"],
  ["ʔ", "?"],
  // single vowels
  ["ø", "2"],
  ["œ", "9"],
  ["ɛ", "E"],
  ["ɔ", "O"],
  ["ə", "@"],
  ["æ", "{"],
  ["y", "y"],
  ["ʌ", "V"],
  ["ɨ", "i"],
];

/**
 * Convert an IPA transcription (optionally wrapped in /…/ with a ˈ stress mark)
 * into an eSpeak phoneme string suitable for `[[ … ]]` input.
 */
export function ipaToEspeak(ipa: string): string {
  if (!ipa) return "";
  // Drop the /…/ delimiters; move the primary-stress mark ˈ to a leading eSpeak '
  let s = ipa.replace(/[/\[\]]/g, "").trim();
  const stressed = s.includes("ˈ");
  s = s.replace(/[ˈˌ]/g, "");

  let out = "";
  let i = 0;
  outer: while (i < s.length) {
    for (const [from, to] of IPA_TO_ESPEAK) {
      if (s.startsWith(from, i)) {
        out += to;
        i += from.length;
        continue outer;
      }
    }
    out += s[i]; // plain ASCII letters (p,b,t,d,k,g,m,n,l,r,f,v,s,z,h,w,j,a,e,i,o,u) pass through
    i++;
  }
  return (stressed ? "'" : "") + out;
}
