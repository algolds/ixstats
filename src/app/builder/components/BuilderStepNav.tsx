"use client";

import React from "react";
import { motion } from "motion/react";
import {
  Globe,
  Building2,
  TrendingUp,
  CheckCircle,
  Check,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Lock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  HEADER_NAV_STEPS,
  BUILDER_SECTION_THEMES,
  sectionToHeaderNavStep,
  type BuilderSection,
  type HeaderNavStep,
} from "../lib/builder-theme";

// ─── Icon mapping for header nav steps ───

const STEP_ICONS: Record<string, LucideIcon> = {
  foundation: Globe,
  government: Building2,
  economics: TrendingUp,
  preview: CheckCircle,
};

// ─── Props ───

interface BuilderStepNavProps {
  activeSection: BuilderSection;
  onNavigate: (section: BuilderSection) => void;
  completedSteps?: Set<BuilderSection>;
  accessibleSteps?: Set<BuilderSection>;
}

// ─── Component ───

export const BuilderStepNav = React.memo(function BuilderStepNav({
  activeSection,
  onNavigate,
  completedSteps = new Set(),
  accessibleSteps,
}: BuilderStepNavProps) {
  const activeHeaderStep = sectionToHeaderNavStep(activeSection);

  const isStepCompleted = (step: HeaderNavStep): boolean => {
    return step.sections.every((s) => completedSteps.has(s));
  };

  const isStepAccessible = (step: HeaderNavStep): boolean => {
    if (!accessibleSteps) return true;
    // A header step is accessible if ANY of its sections are accessible
    return step.sections.some((s) => accessibleSteps.has(s));
  };

  const isStepActive = (step: HeaderNavStep): boolean => {
    return activeHeaderStep?.id === step.id;
  };

  const handleStepClick = (step: HeaderNavStep) => {
    if (!isStepAccessible(step)) return;
    // Navigate to the first section of the step
    onNavigate(step.sections[0]!);
  };

  return (
    <nav className="relative flex items-center" aria-label="Builder steps">
      {/* Background track */}
      <div className="border-border/60 bg-card/40 dark:bg-card/30 flex w-full items-center gap-0 rounded-xl border p-1 backdrop-blur-lg">
        {HEADER_NAV_STEPS.map((step, index) => {
          const Icon = STEP_ICONS[step.id] ?? Globe;
          const active = isStepActive(step);
          const completed = isStepCompleted(step);
          const accessible = isStepAccessible(step);
          const theme = BUILDER_SECTION_THEMES[step.sections[0]!];

          const activeBgClass =
            step.sections[0] === "identity"
              ? "bg-teal-500"
              : step.sections[0] === "government"
                ? "bg-cyan-500"
                : step.sections[0] === "economics"
                  ? "bg-emerald-500"
                  : "bg-amber-500";

          return (
            <React.Fragment key={step.id}>
              {/* Connector line between steps */}
              {index > 0 && (
                <div
                  className={cn(
                    "hidden h-px w-3 shrink-0 transition-colors duration-300 sm:block lg:w-5",
                    completed || isStepCompleted(HEADER_NAV_STEPS[index - 1]!)
                      ? "bg-emerald-500/50"
                      : "bg-border/40"
                  )}
                />
              )}

              <button
                onClick={() => handleStepClick(step)}
                disabled={!accessible}
                className={cn(
                  "group relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all duration-200 sm:gap-2 sm:px-3 sm:py-2.5",
                  active
                    ? "font-bold text-zinc-950 shadow-md"
                    : accessible
                      ? "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      : "text-muted-foreground/30 cursor-not-allowed"
                )}
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${step.stepNumber}: ${step.label}`}
              >
                {/* Active background */}
                {active && (
                  <motion.div
                    layoutId="activeStepBg"
                    className={cn(
                      "absolute inset-0 rounded-lg shadow-md",
                      activeBgClass,
                      theme.activeGlow
                    )}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}

                {/* Step content */}
                <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                  {/* Step number / completion indicator */}
                  {completed && !active ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        active ? "bg-black/15 text-zinc-950" : "bg-muted text-muted-foreground",
                        !accessible && "opacity-50"
                      )}
                    >
                      {step.stepNumber}
                    </span>
                  )}

                  {/* Icon */}
                  <Icon
                    size={14}
                    className={cn(
                      "shrink-0 transition-transform duration-150",
                      !active && accessible && "group-hover:scale-110"
                    )}
                  />

                  {/* Label — visible only when active */}
                  <div
                    className={cn(
                      "flex items-center overflow-hidden transition-all duration-300 ease-in-out",
                      active ? "ml-1 max-w-[200px] opacity-100 sm:ml-2" : "ml-0 max-w-0 opacity-0"
                    )}
                  >
                    <span className="whitespace-nowrap">
                      <span className="hidden sm:inline">{step.label}</span>
                      <span className="sm:hidden">{step.shortLabel}</span>
                    </span>
                  </div>
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
});
