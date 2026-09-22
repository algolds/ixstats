/**
 * Sport-Adaptive Theming Engine & Semantic Dictionaries
 * Provides centralized tokens, gradients, and CSS properties for all sports.
 */

export type { SportPresetKey, ArchetypeType } from "./presets";
import type { SportPresetKey, ArchetypeType } from "./presets";

export interface SportThemeConfig {
  key: SportPresetKey;
  name: string;
  emoji: string;
  federation: string;
  federationShort: string;
  accentHsl: string; // e.g. "152 100% 45%"
  highlightHsl: string; // e.g. "274 57% 65%"
  glowColor: string; // rgba or hsl string for box-shadows
  badgeClass: string;
  gradientClass: string;
  borderClass: string;
  textClass: string;
  surfaceGlowClass: string;
}

export type SportTheme = SportThemeConfig;

export const SPORT_THEMES: Record<SportPresetKey, SportThemeConfig> = {
  soccer: {
    key: "soccer",
    name: "Soccer",
    emoji: "⚽",
    federation: "World Association Football Federation",
    federationShort: "WAFF",
    accentHsl: "152 75% 46%",
    highlightHsl: "274 65% 60%",
    glowColor: "rgba(16, 185, 129, 0.25)",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    gradientClass: "from-emerald-500/20 to-teal-500/5",
    borderClass: "border-emerald-500/30",
    textClass: "text-emerald-400",
    surfaceGlowClass: "shadow-[0_-8px_25px_-8px_rgba(16,185,129,0.2)]",
  },
  hockey: {
    key: "hockey",
    name: "Ice Hockey",
    emoji: "🏒",
    federation: "World Ice Hockey Federation",
    federationShort: "WIHF",
    accentHsl: "199 89% 48%",
    highlightHsl: "210 50% 75%",
    glowColor: "rgba(6, 182, 212, 0.25)",
    badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    gradientClass: "from-cyan-500/20 to-blue-500/5",
    borderClass: "border-cyan-500/30",
    textClass: "text-cyan-400",
    surfaceGlowClass: "shadow-[0_-8px_25px_-8px_rgba(6,182,212,0.2)]",
  },
  football: {
    key: "football",
    name: "American Football",
    emoji: "🏈",
    federation: "International Gridiron Federation",
    federationShort: "IGF",
    accentHsl: "217 91% 60%",
    highlightHsl: "43 96% 56%",
    glowColor: "rgba(59, 130, 246, 0.25)",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    gradientClass: "from-blue-500/20 to-indigo-500/5",
    borderClass: "border-blue-500/30",
    textClass: "text-blue-400",
    surfaceGlowClass: "shadow-[0_-8px_25px_-8px_rgba(59,130,246,0.2)]",
  },
  basketball: {
    key: "basketball",
    name: "Basketball",
    emoji: "🏀",
    federation: "Global Basketball Association",
    federationShort: "GBA",
    accentHsl: "24 95% 53%",
    highlightHsl: "38 92% 50%",
    glowColor: "rgba(249, 115, 22, 0.25)",
    badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    gradientClass: "from-orange-500/20 to-amber-500/5",
    borderClass: "border-orange-500/30",
    textClass: "text-orange-400",
    surfaceGlowClass: "shadow-[0_-8px_25px_-8px_rgba(249,115,22,0.2)]",
  },
  baseball: {
    key: "baseball",
    name: "Baseball",
    emoji: "⚾",
    federation: "Continental Baseball Union",
    federationShort: "CBU",
    accentHsl: "348 83% 53%",
    highlightHsl: "217 91% 60%",
    glowColor: "rgba(244, 63, 94, 0.25)",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    gradientClass: "from-rose-500/20 to-pink-500/5",
    borderClass: "border-rose-500/30",
    textClass: "text-rose-400",
    surfaceGlowClass: "shadow-[0_-8px_25px_-8px_rgba(244,63,94,0.2)]",
  },
  f1: {
    key: "f1",
    name: "Formula 1",
    emoji: "🏎️",
    federation: "Grand Prix Federation",
    federationShort: "GPF",
    accentHsl: "0 84% 60%",
    highlightHsl: "0 0% 85%",
    glowColor: "rgba(239, 68, 68, 0.25)",
    badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
    gradientClass: "from-red-500/20 to-orange-500/5",
    borderClass: "border-red-500/30",
    textClass: "text-red-400",
    surfaceGlowClass: "shadow-[0_-8px_25px_-8px_rgba(239,68,68,0.2)]",
  },
  boxing: {
    key: "boxing",
    name: "Boxing",
    emoji: "🥊",
    federation: "World Boxing Council",
    federationShort: "WBC",
    accentHsl: "45 93% 47%",
    highlightHsl: "35 92% 65%",
    glowColor: "rgba(234, 179, 8, 0.25)",
    badgeClass: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    gradientClass: "from-yellow-500/20 to-amber-500/5",
    borderClass: "border-yellow-500/30",
    textClass: "text-yellow-400",
    surfaceGlowClass: "shadow-[0_-8px_25px_-8px_rgba(234,179,8,0.2)]",
  },
};

export const SPORT_LABELS: Record<string, string> = {
  soccer: "Soccer",
  football: "American Football",
  hockey: "Ice Hockey",
  basketball: "Basketball",
  baseball: "Baseball",
  f1: "Formula 1",
  boxing: "Boxing",
};

export const SPORT_EMOJIS: Record<SportPresetKey, string> = {
  soccer: "⚽",
  football: "🏈",
  hockey: "🏒",
  basketball: "🏀",
  baseball: "⚾",
  f1: "🏎️",
  boxing: "🥊",
};

export const ARCHETYPE_LABELS: Record<ArchetypeType | string, string> = {
  league: "League",
  division_conference: "Division / Conference",
  bracket: "Bracket",
  circuit: "Circuit",
};

export function getSportTheme(sportKey?: string | null): SportThemeConfig {
  const normalized = (sportKey ?? "soccer").toLowerCase() as SportPresetKey;
  return SPORT_THEMES[normalized] ?? SPORT_THEMES.soccer;
}

export function getSportCssVars(sportKey?: string | null): React.CSSProperties {
  const theme = getSportTheme(sportKey);
  return {
    "--sport-accent": theme.accentHsl,
    "--sport-highlight": theme.highlightHsl,
    "--sport-glow": theme.glowColor,
  } as React.CSSProperties;
}
