// Configuration file for Atomic Builder steps and constants
// Extracted from AtomicBuilderPage.tsx for modularity

import {
  Crown,
  WhiteFlag as Flag,
  City as Building2,
  StatUp as TrendingUp,
  CheckCircle,
} from "iconoir-react";

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

// v2 BUILDER_GOLD (the amber → yellow gradient) is the sanctioned `facet-gold` paint (Facet 3.1
// §16.5); the builder wears the MyCountry scope (app/builder/layout.tsx `data-app`), so its plain
// `<Button>` is gold too. The hover brightening lives in `facet-primary` / the Button.
export const BUILDER_GOLD = "facet-gold";
export const BUILDER_GOLD_HOVER = "";

export interface StepConfig {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  /** Background wash (a role class; no longer a gradient). */
  bgGradient: string;
  borderColor: string;
  hoverColor: string;
  tip: string;
  help: string;
}

export const stepConfig: Record<BuilderStep, StepConfig> = {
  foundation: {
    title: "Foundation",
    description: "Choose your starting country",
    icon: Crown,
    color: BUILDER_GOLD,
    bgGradient: "bg-tint-fill",
    borderColor: "border-tint/20",
    hoverColor: "hover:border-tint/40",
    tip: "Select a real-world country as your foundation to inherit its basic characteristics",
    help: "Choose a country that will serve as the foundation for your new country. You'll inherit its basic economic and demographic characteristics which you can then customize.",
  },
  core: {
    title: "Core Identity",
    description: "Define country character",
    icon: Flag,
    color: BUILDER_GOLD,
    bgGradient: "bg-tint-fill",
    borderColor: "border-tint/20",
    hoverColor: "hover:border-tint/40",
    tip: "Establish your country's identity and core economic metrics",
    help: "Set up your country's fundamental identity including name, symbols, and core economic indicators that will drive all other calculations.",
  },
  government: {
    title: "Government",
    description: "Design your structure",
    icon: Building2,
    color: BUILDER_GOLD,
    bgGradient: "bg-tint-fill",
    borderColor: "border-tint/20",
    hoverColor: "hover:border-tint/40",
    tip: "Build your government using atomic components that create emergent behaviors",
    help: "Design your government structure using atomic components. Each component adds unique characteristics and behaviors to your country.",
  },
  economics: {
    title: "Economics",
    description: "Configure systems",
    icon: TrendingUp,
    color: BUILDER_GOLD,
    bgGradient: "bg-tint-fill",
    borderColor: "border-tint/20",
    hoverColor: "hover:border-tint/40",
    tip: "Fine-tune economic parameters, tax policies, and demographic settings",
    help: "Configure detailed economic systems including sectors, labor markets, fiscal policy, tax structure, and demographics.",
  },
  preview: {
    title: "Preview",
    description: "Review & create",
    icon: CheckCircle,
    color: "bg-green text-on-green",
    bgGradient: "bg-green/10",
    borderColor: "border-green/20",
    hoverColor: "hover:border-green/40",
    tip: "Review all your configurations before creating your country",
    help: "Review all your selections and configurations. Make sure everything looks correct before finalizing your country.",
  },
};

export const stepOrder: BuilderStep[] = [
  "foundation",
  "core",
  "government",
  "economics",
  "preview",
];

/**
 * Get the appropriate step order based on builder mode and creation origin.
 * In edit mode, or when starting from scratch/import, foundation step is excluded.
 */
export function getStepsForMode(mode: BuilderMode, isScratchOrImport?: boolean): BuilderStep[] {
  return mode === "edit" || isScratchOrImport
    ? ["core", "government", "economics", "preview"]
    : ["foundation", "core", "government", "economics", "preview"];
}
