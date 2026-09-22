"use client";

import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  Globe,
  WhiteFlag as Flag,
  City as Building2,
  StatUp as TrendingUp,
  CheckCircle,
  Download,
  Check,
  ArrowLeft,
  ArrowRight,
  SystemRestart as Loader2,
  OpenBook as BookOpen,
  Refresh as RefreshCw,
  XmarkCircle as XCircle,
} from "iconoir-react";
import { cn, createUrl } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { soundEffects } from "~/lib/sound/cuelume";
import { type BuilderSection, isScratchOrImportOrigin, getBuilderSteps } from "../lib/builder-theme";
import type { BuilderAlertResult } from "../lib/builder-alerts";

import { useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { useBuilderFilter } from "./builder-filter-context";
import { useBuilderGuide } from "./builder-guide-context";
import { BuilderModeToggle } from "./BuilderModeToggle";

const SECTION_ICONS: Record<BuilderSection, React.ComponentType<{ className?: string }>> = {
  foundation: Globe,
  identity: Flag,
  government: Building2,
  economics: TrendingUp,
  preview: CheckCircle,
  import: Download,
};

const SECTION_LABELS: Record<BuilderSection, string> = {
  foundation: "Foundation",
  identity: "Identity",
  government: "Government",
  economics: "Economics",
  preview: "Preview & Finalize",
  import: "Wiki Import",
};

export interface BuilderStudioHeaderProps {
  activeSection: BuilderSection;
  completedSteps: Set<BuilderSection>;
  accessibleSteps: Set<BuilderSection>;
  mode: "create" | "edit";
  onNavigate: (section: BuilderSection) => void;
  onBack: () => void;
  onContinue: () => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  alertResult?: BuilderAlertResult;
  onReset?: () => void;
}

export const BuilderStudioHeader = React.memo(function BuilderStudioHeader({
  activeSection,
  completedSteps,
  accessibleSteps,
  mode,
  onNavigate,
  onBack,
  onContinue,
  onSubmit,
  isSubmitting = false,
  alertResult,
  onReset,
}: BuilderStudioHeaderProps) {
  const { openGuide } = useBuilderGuide();
  const { clearDraft, builderState } = useBuilderContext();
  const filter = useBuilderFilter();
  const router = useRouter();

  const handleReset = () => {
    if (onReset) {
      onReset();
      return;
    }
    soundEffects.press();
    clearDraft();
    if (mode === "edit") {
      router.push(createUrl("/mycountry"));
    } else {
      filter.clearSelection();
      onNavigate("foundation");
    }
  };

  const isScratchOrImport = useMemo(
    () => isScratchOrImportOrigin(builderState),
    [builderState]
  );

  const steps = useMemo(
    () => getBuilderSteps(activeSection, mode, isScratchOrImport),
    [activeSection, mode, isScratchOrImport]
  );

  const stepIndex = Math.max(0, steps.indexOf(activeSection));
  const isBackDisabled = activeSection === steps[0] || steps.indexOf(activeSection) <= 0;
  const isOnPreview = activeSection === "preview";


  const sectionAlerts = useMemo(
    () => alertResult?.forSection(activeSection) || [],
    [alertResult, activeSection]
  );
  const activeErrors = useMemo(
    () => sectionAlerts.filter((a) => a.severity === "error"),
    [sectionAlerts]
  );
  const activeWarnings = useMemo(
    () => sectionAlerts.filter((a) => a.severity === "warning"),
    [sectionAlerts]
  );
  const hasAlerts = activeErrors.length > 0 || activeWarnings.length > 0;

  return (
    <TooltipProvider delayDuration={150}>
      <header className="relative w-full pb-3 transition-all">
        <div className="mx-auto w-full max-w-6xl px-4">
          <div className="border-border/50 bg-card/60 relative flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border p-2 sm:p-2.5 backdrop-blur-xl transition-all sm:flex-nowrap">
            {/* Left Group: Back Button & Step Context */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={onBack}
                disabled={isBackDisabled}
                data-cuelume-press
                className={cn(
                  "flex h-8 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-all active:scale-[0.97]",
                  isBackDisabled
                    ? "cursor-not-allowed text-muted-foreground/30 opacity-40"
                    : "cursor-pointer text-foreground/75 hover:bg-accent/50 hover:text-foreground"
                )}
                aria-label="Previous step"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back</span>
              </button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleReset}
                    data-cuelume-press
                    className="hover:bg-destructive/10 hover:text-destructive flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground/60 transition-all active:scale-[0.97]"
                    aria-label={mode === "edit" ? "Discard Changes & Exit" : "Restart Builder"}
                  >
                    {mode === "edit" ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-medium">
                  {mode === "edit" ? "Discard Changes & Exit" : "Restart Builder"}
                </TooltipContent>
              </Tooltip>

              <div className="h-4 w-px shrink-0 bg-border/60" />

              <div className="hidden items-center gap-1.5 px-1 md:flex">
                <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Step {stepIndex + 1} of {steps.length}
                </span>
              </div>

            </div>

            {/* Center: Connected Step Progression Track */}
            <nav
              aria-label="Wizard Steps"
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-x-auto py-0.5 sm:gap-2"
              style={{ scrollbarWidth: "none" }}
            >
              {steps.map((stepKey, idx) => {
                const isActive = stepKey === activeSection;
                const isCompleted = completedSteps.has(stepKey);
                const isAccessible = accessibleSteps.has(stepKey);
                const Icon = SECTION_ICONS[stepKey];
                const label = SECTION_LABELS[stepKey];

                return (
                  <React.Fragment key={stepKey}>
                    {idx > 0 && (
                      <div
                        className={cn(
                          "hidden h-px w-2.5 shrink-0 transition-colors sm:block sm:w-4",
                          isCompleted ? "bg-emerald-500/40" : "bg-border/60"
                        )}
                      />
                    )}

                    {isActive ? (
                      <motion.button
                        layout
                        type="button"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                        onClick={() => onNavigate(stepKey)}
                        className="border-amber-500/40 bg-amber-500/15 text-amber-500 dark:text-amber-400 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-xs active:scale-[0.97]"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="whitespace-nowrap">{label}</span>
                      </motion.button>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            layout
                            type="button"
                            disabled={!isAccessible}
                            onClick={() => isAccessible && onNavigate(stepKey)}
                            className={cn(
                              "flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border px-2 text-xs font-medium transition-all active:scale-[0.97]",
                              isCompleted
                                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/25 cursor-pointer"
                                : isAccessible
                                  ? "border-border/60 bg-muted/30 text-muted-foreground hover:border-border hover:bg-accent/40 hover:text-foreground cursor-pointer"
                                  : "border-border/30 bg-muted/10 text-muted-foreground/30 opacity-40 cursor-not-allowed"
                            )}
                            aria-label={label}
                          >
                            {isCompleted ? (
                              <Check className="h-3 w-3 stroke-[2.5]" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            )}
                            <span className="hidden lg:inline text-[11px]">{label}</span>
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs font-medium">
                          {label} {isCompleted ? "(Completed)" : isAccessible ? "" : "(Locked)"}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>

            {/* Right Group: Guide Trigger & Primary Action CTA */}
            <div className="flex shrink-0 items-center gap-2">
              {hasAlerts && (
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold",
                    activeErrors.length > 0
                      ? "bg-destructive/15 text-destructive"
                      : "bg-amber-500/15 text-amber-500 dark:text-amber-400"
                  )}
                  title={`${activeErrors.length} errors, ${activeWarnings.length} warnings`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                  <span>{activeErrors.length > 0 ? `${activeErrors.length} req` : `${activeWarnings.length} tip`}</span>
                </div>
              )}

              {mode === "create" && <BuilderModeToggle />}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.press();
                      openGuide({ tab: "milestones", section: activeSection });
                    }}
                    data-cuelume-press
                    className="border-blue-500/30 bg-blue-500/10 text-blue-500 dark:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/20 flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition-all active:scale-[0.97]"
                    aria-label="Open Step Guide"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Guide</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-medium">
                  Step Companion & Guidelines
                </TooltipContent>
              </Tooltip>

              {isOnPreview ? (
                <Button
                  size="sm"
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className="h-8 shrink-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 text-xs font-bold text-white shadow-sm transition-all hover:from-emerald-500 hover:to-teal-500 active:scale-[0.97]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      <span>{mode === "edit" ? "Saving..." : "Creating..."}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                      <span>{mode === "edit" ? "Save Nation" : "Create Nation"}</span>
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={onContinue}
                  className="h-8 shrink-0 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-[0.97]"
                >
                  <span>Continue</span>
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
});
