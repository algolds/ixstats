/**
 * Builder Theme System
 *
 * Unified theming for the MyCountry Builder system.
 * Follows the same structure as src/lib/mycountry-theme.ts for consistency.
 *
 * Primary Builder Identity: Amber/Gold (matches MyCountry executive/overview theme)
 * Each section has unique accents while maintaining overall builder identity.
 */

// ─── Types ───

export type BuilderSection =
  "foundation" | "identity" | "government" | "economics" | "preview" | "import";

export type BuilderTabTheme =
  | "builder" // Overall builder theme
  | "foundation"
  | "identity"
  | "government"
  | "economics"
  | "preview"
  | "import";

export type IconCategory = "primary" | "secondary" | "tertiary" | "accent";

// ─── Constants ───

export const BUILDER_SECTIONS: BuilderSection[] = [
  "foundation",
  "identity",
  "government",
  "economics",
  "preview",
  "import",
];

/** Steps that form the actual build flow */
export const BUILD_STEPS: BuilderSection[] = BUILDER_SECTIONS;

/**
 * Header nav steps — collapsed view for the inline step navigation.
 * Foundation + Identity are merged into a single "Foundation" entry.
 * This is purely a display concept; internal routing uses BuilderSection.
 */
export interface HeaderNavStep {
  id: string;
  /** Which BuilderSections this step covers */
  sections: BuilderSection[];
  label: string;
  shortLabel: string;
  stepNumber: number;
}

export const HEADER_NAV_STEPS: HeaderNavStep[] = [
  {
    id: "foundation",
    sections: ["foundation", "identity"],
    label: "Foundation",
    shortLabel: "Foundation",
    stepNumber: 1,
  },
  {
    id: "government",
    sections: ["government"],
    label: "Government",
    shortLabel: "Govt.",
    stepNumber: 2,
  },
  {
    id: "economics",
    sections: ["economics"],
    label: "Economics",
    shortLabel: "Econ.",
    stepNumber: 3,
  },
  {
    id: "preview",
    sections: ["preview"],
    label: "Preview & Create",
    shortLabel: "Preview",
    stepNumber: 4,
  },
];

/** Map a BuilderSection to the header nav step that owns it */
export function sectionToHeaderNavStep(section: BuilderSection): HeaderNavStep | undefined {
  return HEADER_NAV_STEPS.find((step) => step.sections.includes(section));
}

// ─── Section Theme Interface ───

export interface BuilderSectionTheme {
  /** Tailwind gradient classes (e.g., "from-emerald-500 to-teal-500") */
  gradient: string;
  /** Shadow glow for active state */
  activeGlow: string;
  /** Border color class */
  border: string;
  /** Dark mode border */
  darkBorder: string;
  /** Background gradient for sections */
  bgGradient: string;
  /** Text color class */
  text: string;
  /** Primary accent color name */
  accentColor: string;
  /** Ring/focus Tailwind class */
  ring: string;
  /** Section display title */
  flavorTitle: string;
  /** Section subtitle/description */
  flavorSubtitle: string;
}

// ─── Section Themes ───

/**
 * Per-section theme definitions
 * Each section has unique accents while maintaining builder identity
 */
export const BUILDER_SECTION_THEMES: Record<BuilderSection, BuilderSectionTheme> = {
  foundation: {
    gradient: "from-amber-500 to-yellow-500",
    activeGlow: "shadow-amber-500/30",
    border: "border-amber-500/30",
    darkBorder: "dark:border-amber-500/20",
    bgGradient: "from-amber-500/8 via-amber-500/3 to-transparent",
    text: "text-amber-500",
    accentColor: "amber",
    ring: "ring-amber-500",
    flavorTitle: "Foundation",
    flavorSubtitle: "Choose the roots of your nation",
  },
  identity: {
    gradient: "from-teal-500 to-cyan-500",
    activeGlow: "shadow-teal-500/30",
    border: "border-teal-500/30",
    darkBorder: "dark:border-teal-500/20",
    bgGradient: "from-teal-500/8 via-teal-500/3 to-transparent",
    text: "text-teal-500",
    accentColor: "teal",
    ring: "ring-teal-500",
    flavorTitle: "National Identity",
    flavorSubtitle: "Define your nation's character and soul",
  },
  government: {
    gradient: "from-cyan-500 to-blue-500",
    activeGlow: "shadow-cyan-500/30",
    border: "border-cyan-500/30",
    darkBorder: "dark:border-cyan-500/20",
    bgGradient: "from-cyan-500/8 via-cyan-500/3 to-transparent",
    text: "text-cyan-500",
    accentColor: "cyan",
    ring: "ring-cyan-500",
    flavorTitle: "Government",
    flavorSubtitle: "Architect the halls of power",
  },
  economics: {
    gradient: "from-green-500 to-emerald-500",
    activeGlow: "shadow-green-500/30",
    border: "border-green-500/30",
    darkBorder: "dark:border-green-500/20",
    bgGradient: "from-green-500/8 via-green-500/3 to-transparent",
    text: "text-green-500",
    accentColor: "green",
    ring: "ring-green-500",
    flavorTitle: "Economics",
    flavorSubtitle: "Shape the engines of prosperity",
  },
  preview: {
    gradient: "from-amber-400 to-yellow-400",
    activeGlow: "shadow-amber-400/30",
    border: "border-amber-400/30",
    darkBorder: "dark:border-amber-400/20",
    bgGradient: "from-amber-400/8 via-amber-400/3 to-transparent",
    text: "text-amber-400",
    accentColor: "amber",
    ring: "ring-amber-400",
    flavorTitle: "Preview",
    flavorSubtitle: "Inspect your creation before it enters the world",
  },
  import: {
    gradient: "from-blue-500 to-indigo-500",
    activeGlow: "shadow-blue-500/30",
    border: "border-blue-500/30",
    darkBorder: "dark:border-blue-500/20",
    bgGradient: "from-blue-500/8 via-blue-500/3 to-transparent",
    text: "text-blue-500",
    accentColor: "blue",
    ring: "ring-blue-500",
    flavorTitle: "Import from Wiki",
    flavorSubtitle: "Automagically import your country data from multiple wiki sources",
  },
};

// Legacy alias for backwards compatibility
export const BUILDER_THEME = BUILDER_SECTION_THEMES;



// ─── Legacy Compatibility ───

/**
 * Map old BuilderStep names to new BuilderSection names.
 * foundation -> foundation, core -> identity, government -> government,
 * economics -> economics, preview -> preview
 */
export function legacyStepToSection(step: string): BuilderSection {
  if (step === "core") return "identity";
  if (step === "import") return "import";
  if (step === "welcome") return "foundation";
  if (BUILDER_SECTIONS.includes(step as BuilderSection)) return step as BuilderSection;
  return "foundation";
}

export function sectionToLegacyStep(section: BuilderSection): string {
  if (section === "identity") return "core";
  return section;
}

/**
 * Checks if the builder was initiated from scratch or wiki import (not a template/archetype).
 * When true, the Foundation step is hidden from the wizard track, making Identity step 1 of 4.
 */
export function isScratchOrImportOrigin(state?: {
  creationOrigin?: "scratch" | "import" | "template";
  selectedArchetypeId?: string | null;
  selectedCountry?: { countryCode?: string; name?: string } | null;
} | null): boolean {
  if (!state) return false;
  if (state.creationOrigin === "scratch" || state.creationOrigin === "import") return true;
  if (state.creationOrigin === "template") return false;
  const isCustomCountry = Boolean(
    state.selectedCountry &&
      (state.selectedCountry.countryCode === "custom" ||
        state.selectedCountry.name === "Custom Nation")
  );
  if (isCustomCountry) return true;
  return false;
}

/**
 * Returns the sequential list of builder sections for a given section, mode, and origin.
 */
export function getBuilderSteps(
  activeSection: BuilderSection,
  mode: "create" | "edit" = "create",
  isScratchOrImport = false
): BuilderSection[] {
  if (activeSection === "import") {
    return ["import"];
  }
  if (mode === "edit" || isScratchOrImport) {
    return ["identity", "government", "economics", "preview"];
  }
  return ["foundation", "identity", "government", "economics", "preview"];
}

