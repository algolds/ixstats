// Configuration file for Atomic Builder steps and constants
// Extracted from AtomicBuilderPage.tsx for modularity

export type BuilderStep = "foundation" | "core" | "government" | "economics" | "preview";

// Builder mode: create new country or edit existing
export type BuilderMode = "create" | "edit";

// Field lock configuration for edit mode
export interface FieldLockConfig {
  isLocked: boolean;
  reason: string;
  lockedBy: "system" | "calculation" | "atomic";
}

// Field locks for edit mode (system-calculated fields that users cannot edit)
export const EDIT_MODE_FIELD_LOCKS: Record<string, FieldLockConfig> = {
  // Core Indicators - Calculated by IxStats engine
  totalPopulation: {
    isLocked: true,
    reason: "Calculated by IxStats based on baseline + growth over time",
    lockedBy: "system",
  },
  nominalGDP: {
    isLocked: true,
    reason: "Calculated from population × GDP per capita",
    lockedBy: "calculation",
  },
  gdpPerCapita: {
    isLocked: true,
    reason: "Calculated by IxStats based on economic performance",
    lockedBy: "system",
  },

  // Labor - Calculated from economic activity
  unemploymentRate: {
    isLocked: true,
    reason: "Calculated by economic engine based on activity",
    lockedBy: "system",
  },
  laborForceParticipationRate: {
    isLocked: true,
    reason: "Calculated from demographics and economic factors",
    lockedBy: "calculation",
  },
  employmentRate: {
    isLocked: true,
    reason: "Inverse of unemployment rate",
    lockedBy: "calculation",
  },
  totalWorkforce: {
    isLocked: true,
    reason: "Calculated from population × labor force participation",
    lockedBy: "calculation",
  },
  averageAnnualIncome: {
    isLocked: true,
    reason: "Calculated from GDP per capita and income distribution",
    lockedBy: "calculation",
  },
};

/**
 * Get the appropriate step order based on builder mode and creation origin.
 * In edit mode, or when starting from scratch/import, foundation step is excluded.
 */
export function getStepsForMode(mode: BuilderMode, isScratchOrImport?: boolean): BuilderStep[] {
  return mode === "edit" || isScratchOrImport
    ? ["core", "government", "economics", "preview"]
    : ["foundation", "core", "government", "economics", "preview"];
}
