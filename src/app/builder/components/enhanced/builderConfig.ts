// Configuration file for Atomic Builder steps and constants
// Extracted from AtomicBuilderPage.tsx for modularity

export type BuilderStep = "foundation" | "core" | "government" | "economics" | "preview";

// Builder mode: create new country or edit existing
type BuilderMode = "create" | "edit";

// Field lock configuration for edit mode
// Field locks for edit mode (system-calculated fields that users cannot edit)

/**
 * Get the appropriate step order based on builder mode and creation origin.
 * In edit mode, or when starting from scratch/import, foundation step is excluded.
 */
export function getStepsForMode(mode: BuilderMode, isScratchOrImport?: boolean): BuilderStep[] {
  return mode === "edit" || isScratchOrImport
    ? ["core", "government", "economics", "preview"]
    : ["foundation", "core", "government", "economics", "preview"];
}
