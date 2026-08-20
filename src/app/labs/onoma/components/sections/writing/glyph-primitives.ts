// src/app/labs/onoma/components/sections/writing/glyph-primitives.ts
// Onoma Lab — Glyph Primitives, Preset Shapes, and Starter Scripts

import type { Glyph } from "./types";

export interface ShapeStamp {
  id: string;
  name: string;
  category: "line" | "curve" | "loop" | "diacritic" | "geometric";
  path: string;
  viewBox?: string;
  description: string;
}

export const SHAPE_STAMPS: ShapeStamp[] = [
  {
    id: "stem-vertical",
    name: "Vertical Stem",
    category: "line",
    path: "M 64 24 L 64 96",
    description: "Vertical stroke from cap height to baseline",
  },
  {
    id: "stem-horizontal",
    name: "Horizontal Bar",
    category: "line",
    path: "M 28 64 L 100 64",
    description: "Crossbar at median line",
  },
  {
    id: "diagonal-forward",
    name: "Slash Diagonal",
    category: "line",
    path: "M 32 96 L 96 28",
    description: "Upward forward diagonal stroke",
  },
  {
    id: "diagonal-back",
    name: "Backslash Diagonal",
    category: "line",
    path: "M 32 28 L 96 96",
    description: "Downward backward diagonal stroke",
  },
  {
    id: "arch-top",
    name: "Upper Arch",
    category: "curve",
    path: "M 32 64 C 32 36, 96 36, 96 64",
    description: "Smooth curved arch over median line",
  },
  {
    id: "cup-bottom",
    name: "Lower Bowl",
    category: "curve",
    path: "M 32 52 C 32 88, 96 88, 96 52",
    description: "Rounded lower bowl touching baseline",
  },
  {
    id: "loop-full",
    name: "Central Circle",
    category: "loop",
    path: "M 64 36 C 80 36, 92 48, 92 64 C 92 80, 80 92, 64 92 C 48 92, 36 80, 36 64 C 36 48, 48 36, 64 36 Z",
    description: "Complete circular loop centered on grid",
  },
  {
    id: "crescent-left",
    name: "Left Crescent",
    category: "curve",
    path: "M 76 28 C 40 40, 40 84, 76 96",
    description: "Curved crescent moon arc opening right",
  },
  {
    id: "angle-chevron",
    name: "Chevron Angle",
    category: "geometric",
    path: "M 36 36 L 64 64 L 92 36",
    description: "Symmetrical downwards chevron",
  },
  {
    id: "cross-plus",
    name: "Equilateral Cross",
    category: "geometric",
    path: "M 64 36 L 64 92 M 36 64 L 92 64",
    description: "Balanced geometric cross",
  },
  {
    id: "diacritic-dot",
    name: "Superior Dot",
    category: "diacritic",
    path: "M 64 20 C 66 20, 68 22, 68 24 C 68 26, 66 28, 64 28 C 62 28, 60 26, 60 24 C 60 22, 62 20, 64 20 Z",
    description: "Diacritic crowning dot above cap height",
  },
  {
    id: "diacritic-macron",
    name: "Superior Macron",
    category: "diacritic",
    path: "M 48 18 L 80 18",
    description: "Horizontal length macron",
  },
];

export const QUICK_IPA_PHONEMES = [
  { symbol: "θ", name: "Voiceless dental fricative (th)" },
  { symbol: "ð", name: "Voiced dental fricative (th in this)" },
  { symbol: "ʃ", name: "Voiceless postalveolar fricative (sh)" },
  { symbol: "ʒ", name: "Voiced postalveolar fricative (si in vision)" },
  { symbol: "tʃ", name: "Voiceless postalveolar affricate (ch)" },
  { symbol: "dʒ", name: "Voiced postalveolar affricate (j)" },
  { symbol: "ŋ", name: "Velar nasal (ng)" },
  { symbol: "x", name: "Voiceless velar fricative (kh/ch in loch)" },
  { symbol: "ʔ", name: "Glottal stop" },
  { symbol: "æ", name: "Near-open front vowel (a in cat)" },
  { symbol: "ə", name: "Schwa (neutral vowel)" },
  { symbol: "ɛ", name: "Open-mid front unrounded vowel (e in bed)" },
  { symbol: "ɪ", name: "Near-close front vowel (i in bit)" },
  { symbol: "ʊ", name: "Near-close near-back vowel (u in put)" },
  { symbol: "ɔ", name: "Open-mid back rounded vowel (o in thought)" },
  { symbol: "ø", name: "Close-mid front rounded vowel" },
  { symbol: "y", name: "Close front rounded vowel (u in French tu)" },
  { symbol: "ɯ", name: "Close back unrounded vowel" },
];

export interface StarterScriptPack {
  id: string;
  name: string;
  description: string;
  typology: "alphabet" | "syllabary" | "abjad" | "logographic";
  direction: "ltr" | "rtl" | "ttb";
  glyphs: Array<Omit<Glyph, "id">>;
}

export const STARTER_SCRIPT_PACKS: StarterScriptPack[] = [
  {
    id: "phonetic-minimalist",
    name: "Phonetic Minimalist",
    description: "Clean modern geometric script with high legibility and balanced proportions.",
    typology: "alphabet",
    direction: "ltr",
    glyphs: [
      { phoneme: "a", svgPath: "M 64 32 L 36 92 M 64 32 L 92 92 M 46 72 L 82 72", unicode: "A" },
      { phoneme: "b", svgPath: "M 40 24 L 40 96 M 40 60 C 72 60, 72 96, 40 96", unicode: "B" },
      { phoneme: "d", svgPath: "M 88 24 L 88 96 M 88 60 C 56 60, 56 96, 88 96", unicode: "D" },
      { phoneme: "e", svgPath: "M 40 64 L 88 64 C 88 36, 40 36, 40 64 C 40 92, 88 92, 88 80", unicode: "E" },
      { phoneme: "f", svgPath: "M 80 28 C 50 28, 50 48, 50 96 M 36 56 L 70 56", unicode: "F" },
      { phoneme: "g", svgPath: "M 88 48 C 88 32, 40 32, 40 64 C 40 96, 88 96, 88 64 L 64 64", unicode: "G" },
      { phoneme: "i", svgPath: "M 64 44 L 64 96 M 64 24 L 64 28", unicode: "I" },
      { phoneme: "k", svgPath: "M 40 24 L 40 96 M 84 40 L 42 68 L 84 96", unicode: "K" },
      { phoneme: "l", svgPath: "M 48 24 L 48 96 L 84 96", unicode: "L" },
      { phoneme: "m", svgPath: "M 32 96 L 32 40 L 64 72 L 96 40 L 96 96", unicode: "M" },
      { phoneme: "n", svgPath: "M 36 96 L 36 40 L 92 96 L 92 40", unicode: "N" },
      { phoneme: "o", svgPath: "M 64 32 C 84 32, 96 48, 96 68 C 96 88, 84 96, 64 96 C 44 96, 32 88, 32 68 C 32 48, 44 32, 64 32 Z", unicode: "O" },
      { phoneme: "r", svgPath: "M 40 96 L 40 32 L 72 32 C 86 32, 86 56, 72 56 L 40 56 M 64 56 L 88 96", unicode: "R" },
      { phoneme: "s", svgPath: "M 84 40 C 84 28, 44 28, 44 48 C 44 68, 84 64, 84 84 C 84 100, 40 100, 40 88", unicode: "S" },
      { phoneme: "t", svgPath: "M 28 32 L 100 32 M 64 32 L 64 96", unicode: "T" },
      { phoneme: "u", svgPath: "M 36 32 L 36 76 C 36 94, 92 94, 92 76 L 92 32", unicode: "U" },
      { phoneme: "sh", svgPath: "M 88 36 C 40 36, 40 64, 88 64 C 88 92, 40 92, 40 96 M 64 20 L 64 28", unicode: "ʃ" },
      { phoneme: "th", svgPath: "M 64 28 C 84 28, 92 46, 92 64 C 92 82, 84 96, 64 96 C 44 96, 36 82, 36 64 C 36 46, 44 28, 64 28 Z M 36 64 L 92 64", unicode: "θ" },
    ],
  },
  {
    id: "runic-futhark",
    name: "Elder Runes (Nordic)",
    description: "Angular carved strokes designed for wood/stone inscriptions with no horizontal lines.",
    typology: "alphabet",
    direction: "ltr",
    glyphs: [
      { phoneme: "f", svgPath: "M 40 24 L 40 96 M 40 40 L 80 24 M 40 60 L 76 44", unicode: "ᚠ" },
      { phoneme: "u", svgPath: "M 40 24 L 40 96 M 40 24 L 88 56 L 88 96", unicode: "ᚢ" },
      { phoneme: "th", svgPath: "M 48 24 L 48 96 M 48 40 L 84 58 L 48 76", unicode: "ᚦ" },
      { phoneme: "a", svgPath: "M 40 24 L 40 96 M 40 44 L 80 60 M 40 64 L 76 80", unicode: "ᚨ" },
      { phoneme: "r", svgPath: "M 40 24 L 40 96 M 40 28 L 78 44 L 40 60 M 60 52 L 84 96", unicode: "ᚱ" },
      { phoneme: "k", svgPath: "M 40 24 L 40 96 M 40 56 L 80 32 M 40 56 L 80 80", unicode: "ᚲ" },
      { phoneme: "h", svgPath: "M 36 24 L 36 96 M 92 24 L 92 96 M 36 44 L 92 76", unicode: "ᚺ" },
      { phoneme: "n", svgPath: "M 64 24 L 64 96 M 36 48 L 92 72", unicode: "ᚾ" },
      { phoneme: "i", svgPath: "M 64 24 L 64 96", unicode: "ᛁ" },
      { phoneme: "s", svgPath: "M 76 24 L 44 48 L 84 72 L 52 96", unicode: "ᛋ" },
      { phoneme: "t", svgPath: "M 64 24 L 64 96 M 32 44 L 64 24 L 96 44", unicode: "ᛏ" },
      { phoneme: "b", svgPath: "M 40 24 L 40 96 M 40 24 L 76 42 L 40 60 L 76 78 L 40 96", unicode: "ᛒ" },
      { phoneme: "m", svgPath: "M 36 24 L 36 96 M 92 24 L 92 96 M 36 24 L 64 54 L 92 24 M 36 24 L 92 64 M 92 24 L 36 64", unicode: "ᛗ" },
      { phoneme: "l", svgPath: "M 48 24 L 48 96 M 48 24 L 84 48", unicode: "ᛚ" },
    ],
  },
  {
    id: "celestial-arcane",
    name: "Celestial Glyphs",
    description: "Curved mystical sigils with astronomical nodes and fluid arcs.",
    typology: "logographic",
    direction: "ltr",
    glyphs: [
      { phoneme: "sol", svgPath: "M 64 36 C 80 36, 92 48, 92 64 C 92 80, 80 92, 64 92 C 48 92, 36 80, 36 64 C 36 48, 48 36, 64 36 Z M 64 20 L 64 30 M 64 98 L 64 108 M 20 64 L 30 64 M 98 64 L 108 64", unicode: "☉" },
      { phoneme: "luna", svgPath: "M 74 24 C 42 36, 42 92, 74 104 C 54 90, 54 38, 74 24 Z", unicode: "☽" },
      { phoneme: "ast", svgPath: "M 64 20 L 64 108 M 20 64 L 108 64 M 34 34 L 94 94 M 34 94 L 94 34", unicode: "✶" },
      { phoneme: "pyr", svgPath: "M 64 24 L 28 92 L 100 92 Z M 64 48 L 48 84 L 80 84 Z", unicode: "▲" },
      { phoneme: "hydr", svgPath: "M 64 24 C 64 24, 36 60, 36 78 C 36 94, 48 104, 64 104 C 80 104, 92 94, 92 78 C 92 60, 64 24, 64 24 Z", unicode: "💧" },
      { phoneme: "aether", svgPath: "M 64 24 C 88 44, 88 84, 64 104 C 40 84, 40 44, 64 24 Z M 24 64 C 44 88, 84 88, 104 64 C 84 40, 44 40, 24 64 Z", unicode: "✧" },
    ],
  },
];
