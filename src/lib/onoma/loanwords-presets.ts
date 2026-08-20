// src/lib/onoma/loanwords-presets.ts
// Thematic vocabulary presets and historical phonetic sound shift laws for loanwords

export interface SoundShift {
  from: string;
  to: string;
}

export interface SourceWord {
  word: string;
  meaning: string;
}

export const THEMATIC_PRESETS: Record<string, { label: string; words: SourceWord[] }> = {
  trade: {
    label: "Trade & Commerce",
    words: [
      { word: "emporium", meaning: "trading center" },
      { word: "talanton", meaning: "currency unit" },
      { word: "karavana", meaning: "merchant convoy" },
      { word: "bazaari", meaning: "market street" },
      { word: "portorium", meaning: "customs duty" },
    ],
  },
  military: {
    label: "Military & War",
    words: [
      { word: "phalanx", meaning: "infantry formation" },
      { word: "spatha", meaning: "cavalry broadsword" },
      { word: "tribunus", meaning: "military commander" },
      { word: "bastion", meaning: "defensive wall" },
      { word: "cataphract", meaning: "armored knight" },
    ],
  },
  science: {
    label: "Science & Arcana",
    words: [
      { word: "astrolabium", meaning: "celestial computer" },
      { word: "alchemia", meaning: "matter transmutation" },
      { word: "scholaris", meaning: "academic researcher" },
      { word: "mechanismus", meaning: "clockwork gear" },
      { word: "formula", meaning: "sacred theorem" },
    ],
  },
  maritime: {
    label: "Naval & Maritime",
    words: [
      { word: "trireme", meaning: "war galley" },
      { word: "anchoris", meaning: "mooring anchor" },
      { word: "nautilus", meaning: "deep voyager" },
      { word: "pelagos", meaning: "open ocean" },
      { word: "carrack", meaning: "ocean merchantman" },
    ],
  },
};

export const PHONETIC_LAW_PRESETS = [
  {
    name: "Romance Lenition",
    description: "p→b, t→d, k→g, ph→f",
    shifts: [
      { from: "ph", to: "f" },
      { from: "p", to: "b" },
      { from: "t", to: "d" },
      { from: "c", to: "g" },
      { from: "k", to: "g" },
    ],
  },
  {
    name: "Grimm's Consonant Shift",
    description: "b→p, d→t, g→k, p→f",
    shifts: [
      { from: "b", to: "p" },
      { from: "d", to: "t" },
      { from: "g", to: "k" },
      { from: "p", to: "f" },
      { from: "t", to: "th" },
    ],
  },
  {
    name: "Slavic Palatalization",
    description: "k→ch, g→zh, sk→sh",
    shifts: [
      { from: "k", to: "ch" },
      { from: "g", to: "zh" },
      { from: "sk", to: "sh" },
      { from: "x", to: "ks" },
    ],
  },
];
