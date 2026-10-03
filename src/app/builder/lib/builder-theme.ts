/** Builder section and step definitions. */

// ─── Types ───

export type BuilderSection =
  "foundation" | "identity" | "government" | "economics" | "preview" | "import";

// ─── Constants ───

const BUILDER_SECTIONS: BuilderSection[] = [
  "foundation",
  "identity",
  "government",
  "economics",
  "preview",
  "import",
];

/** Steps that form the actual build flow */
export const BUILD_STEPS: BuilderSection[] = BUILDER_SECTIONS;

export const BUILDER_THEME: Record<
  BuilderSection,
  { flavorTitle: string; flavorSubtitle: string }
> = {
  foundation: { flavorTitle: "Foundation", flavorSubtitle: "Pick a starting point" },
  identity: { flavorTitle: "National identity", flavorSubtitle: "Name, symbols and culture" },
  government: { flavorTitle: "Government", flavorSubtitle: "Structure, departments and budget" },
  economics: {
    flavorTitle: "Economics",
    flavorSubtitle: "Sectors, labor, fiscal policy and demographics",
  },
  preview: {
    flavorTitle: "Preview",
    flavorSubtitle: "Review everything before you create the nation",
  },
  import: {
    flavorTitle: "Import from wiki",
    flavorSubtitle: "Pull country data from wiki sources",
  },
};

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
