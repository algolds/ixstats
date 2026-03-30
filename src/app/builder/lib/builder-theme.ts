/**
 * Builder Theme System
 * RPG-themed color palettes for each builder section.
 * Modeled after src/lib/mycountry-theme.ts SECTION_THEME_CLASSES.
 */

export type BuilderSection =
  | "welcome"
  | "import"
  | "foundation"
  | "identity"
  | "government"
  | "economics"
  | "preview";

export const BUILDER_SECTIONS: BuilderSection[] = [
  "welcome",
  "import",
  "foundation",
  "identity",
  "government",
  "economics",
  "preview",
];

/** Steps that form the actual build flow (excludes welcome/import which are entry points) */
export const BUILD_STEPS: BuilderSection[] = [
  "foundation",
  "identity",
  "government",
  "economics",
  "preview",
];

export interface BuilderSectionTheme {
  gradient: string;
  activeGlow: string;
  border: string;
  bgGradient: string;
  text: string;
  accentColor: string;
  flavorTitle: string;
  flavorSubtitle: string;
}

export const BUILDER_THEME: Record<BuilderSection, BuilderSectionTheme> = {
  welcome: {
    gradient: "from-amber-500 to-yellow-500",
    activeGlow: "shadow-amber-500/30",
    border: "border-amber-500/30",
    bgGradient: "from-amber-500/8 via-amber-500/3 to-transparent",
    text: "text-amber-500",
    accentColor: "amber",
    flavorTitle: "Nation Builder",
    flavorSubtitle: "Begin your journey",
  },
  import: {
    gradient: "from-violet-500 to-purple-500",
    activeGlow: "shadow-violet-500/30",
    border: "border-violet-500/30",
    bgGradient: "from-violet-500/8 via-violet-500/3 to-transparent",
    text: "text-violet-500",
    accentColor: "violet",
    flavorTitle: "Import from Wiki",
    flavorSubtitle: "Bring your nation to life from lore",
  },
  foundation: {
    gradient: "from-amber-500 to-yellow-500",
    activeGlow: "shadow-amber-500/30",
    border: "border-amber-500/30",
    bgGradient: "from-amber-500/8 via-amber-500/3 to-transparent",
    text: "text-amber-500",
    accentColor: "amber",
    flavorTitle: "Foundation",
    flavorSubtitle: "Choose the roots of your nation",
  },
  identity: {
    gradient: "from-blue-500 to-cyan-500",
    activeGlow: "shadow-blue-500/30",
    border: "border-blue-500/30",
    bgGradient: "from-blue-500/8 via-blue-500/3 to-transparent",
    text: "text-blue-500",
    accentColor: "blue",
    flavorTitle: "National Identity",
    flavorSubtitle: "Define your nation's character and soul",
  },
  government: {
    gradient: "from-indigo-500 to-violet-500",
    activeGlow: "shadow-indigo-500/30",
    border: "border-indigo-500/30",
    bgGradient: "from-indigo-500/8 via-indigo-500/3 to-transparent",
    text: "text-indigo-500",
    accentColor: "indigo",
    flavorTitle: "Government",
    flavorSubtitle: "Architect the halls of power",
  },
  economics: {
    gradient: "from-emerald-500 to-green-500",
    activeGlow: "shadow-emerald-500/30",
    border: "border-emerald-500/30",
    bgGradient: "from-emerald-500/8 via-emerald-500/3 to-transparent",
    text: "text-emerald-500",
    accentColor: "emerald",
    flavorTitle: "Economics",
    flavorSubtitle: "Shape the engines of prosperity",
  },
  preview: {
    gradient: "from-teal-500 to-cyan-500",
    activeGlow: "shadow-teal-500/30",
    border: "border-teal-500/30",
    bgGradient: "from-teal-500/8 via-teal-500/3 to-transparent",
    text: "text-teal-500",
    accentColor: "teal",
    flavorTitle: "Preview",
    flavorSubtitle: "Inspect your creation before it enters the world",
  },
};

/**
 * Map old BuilderStep names to new BuilderSection names.
 * foundation -> foundation, core -> identity, government -> government,
 * economics -> economics, preview -> preview
 */
export function legacyStepToSection(step: string): BuilderSection {
  if (step === "core") return "identity";
  if (BUILDER_SECTIONS.includes(step as BuilderSection)) return step as BuilderSection;
  return "foundation";
}

export function sectionToLegacyStep(section: BuilderSection): string {
  if (section === "identity") return "core";
  if (section === "welcome" || section === "import") return "foundation";
  return section;
}
