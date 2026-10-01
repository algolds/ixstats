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
  /** Solid accent background (a Facet role class, e.g. "bg-teal"; formerly a gradient) */
  gradient: string;
  /** Shadow glow for active state */
  activeGlow: string;
  /** Border color class */
  border: string;
  /** Dark mode border */
  darkBorder: string;
  /** Background wash for sections (a Facet role class) */
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
    gradient: "bg-tint",
    activeGlow: "",
    border: "border-tint/30",
    darkBorder: "",
    bgGradient: "bg-tint-fill",
    text: "text-tint",
    accentColor: "amber",
    ring: "ring-tint",
    flavorTitle: "Foundation",
    flavorSubtitle: "Choose the roots of your nation",
  },
  identity: {
    gradient: "bg-teal",
    activeGlow: "",
    border: "border-teal/30",
    darkBorder: "",
    bgGradient: "bg-teal/10",
    text: "text-teal",
    accentColor: "teal",
    ring: "ring-teal",
    flavorTitle: "National Identity",
    flavorSubtitle: "Define your nation's character and soul",
  },
  government: {
    gradient: "bg-teal",
    activeGlow: "",
    border: "border-teal/30",
    darkBorder: "",
    bgGradient: "bg-teal/10",
    text: "text-teal",
    accentColor: "cyan",
    ring: "ring-teal",
    flavorTitle: "Government",
    flavorSubtitle: "Architect the halls of power",
  },
  economics: {
    gradient: "bg-green",
    activeGlow: "",
    border: "border-green/30",
    darkBorder: "",
    bgGradient: "bg-green/10",
    text: "text-green",
    accentColor: "green",
    ring: "ring-green",
    flavorTitle: "Economics",
    flavorSubtitle: "Shape the engines of prosperity",
  },
  preview: {
    gradient: "bg-tint",
    activeGlow: "",
    border: "border-tint/30",
    darkBorder: "",
    bgGradient: "bg-tint-fill",
    text: "text-tint",
    accentColor: "amber",
    ring: "ring-tint",
    flavorTitle: "Preview",
    flavorSubtitle: "Inspect your creation before it enters the world",
  },
  import: {
    gradient: "bg-blue",
    activeGlow: "",
    border: "border-blue/30",
    darkBorder: "",
    bgGradient: "bg-blue/10",
    text: "text-blue",
    accentColor: "blue",
    ring: "ring-blue",
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
export function isScratchOrImportOrigin(
  state?: {
    creationOrigin?: "scratch" | "import" | "template";
    selectedArchetypeId?: string | null;
    selectedCountry?: { countryCode?: string; name?: string } | null;
  } | null
): boolean {
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
