// src/app/labs/onoma/components/sections/writing/types.ts
// Onoma Lab — Writing System & Orthography Studio Type Definitions

export interface Glyph {
  id: string;
  phoneme: string;
  svgPath: string;
  unicode?: string;
  tags?: string[];
  description?: string;
  createdAt?: number;
}

export type ScriptTypology = "alphabet" | "syllabary" | "abjad" | "logographic";
export type ScriptDirection = "ltr" | "rtl" | "ttb";

export interface WritingSystemData {
  id?: string;
  name: string;
  scriptType: ScriptTypology;
  direction: ScriptDirection;
  glyphs: Glyph[];
  ligatures?: Array<{ id: string; phonemes: string[]; svgPath: string }>;
  glyphSize: number;
  baselineOffset: number;
  letterSpacing?: number;
  wordSpacing?: number;
  strokeWidth?: number;
}

export type GuideLevel = "all" | "baseline" | "minimal" | "none";

export interface CanvasGuideSettings {
  showGrid: boolean;
  guideLevel: GuideLevel;
  showOpticalCircle: boolean;
  showCrosshairs: boolean;
  snapToGrid: boolean;
}

export type InkColorPreset = "accent" | "mono" | "indigo" | "emerald" | "ruby" | "violet";

export interface RenderToken {
  id: string;
  charOrPhoneme: string;
  glyph?: Glyph;
  isMatched: boolean;
  isSpace: boolean;
  isNewline: boolean;
}
