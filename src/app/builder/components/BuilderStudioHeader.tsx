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
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FacetCard } from "~/components/ui/facet-container";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { soundEffects } from "~/lib/sound/cuelume";
import {
  type BuilderSection,
  isScratchOrImportOrigin,
  getBuilderSteps,
} from "../lib/builder-theme";
import type { BuilderAlertResult } from "../lib/builder-alerts";

import { useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { useBuilderFilter } from "./builder-filter-context";
import { useBuilderGuide } from "./builder-guide-context";
import { BuilderModeToggle } from "./BuilderModeToggle";
import { Eyebrow } from "~/components/ui/eyebrow";

const SECTION_ICONS: Record<
  BuilderSection,
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>
> = {
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

  const isScratchOrImport = useMemo(() => isScratchOrImportOrigin(builderState), [builderState]);

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
      <header className="relative w-full pb-3">
        <div className="mx-auto w-full max-w-6xl px-4">
          <FacetCard
            depth={2}
            className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl p-2 sm:flex-nowrap sm:p-2.5"
          >
            {/* Left Group: Back Button & Step Context */}
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onBack}
                disabled={isBackDisabled}
                className="shrink-0 gap-1.5"
                aria-label="Previous step"
              >
                <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back</span>
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleReset}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 shrink-0"
                    aria-label={mode === "edit" ? "Discard Changes & Exit" : "Restart Builder"}
                  >
                    {mode === "edit" ? (
                      <XCircle aria-hidden="true" className="h-3.5 w-3.5" />
                    ) : (
                      <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-medium">
                  {mode === "edit" ? "Discard Changes & Exit" : "Restart Builder"}
                </TooltipContent>
              </Tooltip>

              <div aria-hidden="true" className="bg-border h-4 w-px shrink-0" />

              <div className="hidden items-center gap-1.5 px-1 md:flex">
                <Eyebrow>
                  Step {stepIndex + 1} of {steps.length}
                </Eyebrow>
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
                        transition={{ type: "spring", bounce: 0.15, duration: 0.25 }}
                        onClick={() => onNavigate(stepKey)}
                        aria-current="step"
                        data-cuelume-press="tick"
                        className="text-foreground flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-semibold active:scale-[0.97]"
                      >
                        <Icon aria-hidden="true" className="h-3.5 w-3.5 text-amber-500" />
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
                              "flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border px-2 text-xs font-medium transition-[color,background-color,border-color,opacity,transform] active:scale-[0.97]",
                              isCompleted
                                ? "bg-card hover:bg-accent cursor-pointer border-emerald-500/40 text-emerald-600"
                                : isAccessible
                                  ? "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
                                  : "border-border bg-card text-muted-foreground cursor-not-allowed opacity-40"
                            )}
                            aria-label={label}
                            data-cuelume-press="tick"
                          >
                            {isCompleted ? (
                              <Check className="h-3 w-3 stroke-[2.5]" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            )}
                            <span className="hidden text-xs lg:inline">{label}</span>
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
                <Badge
                  variant="outline"
                  className={
                    activeErrors.length > 0
                      ? "border-destructive/50 text-destructive"
                      : "border-amber-500/50 text-amber-600"
                  }
                  title={`${activeErrors.length} errors, ${activeWarnings.length} warnings`}
                >
                  {activeErrors.length > 0
                    ? `${activeErrors.length} req`
                    : `${activeWarnings.length} tip`}
                </Badge>
              )}

              <BuilderModeToggle />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      soundEffects.press();
                      openGuide({ tab: "milestones", section: activeSection });
                    }}
                    className="shrink-0 gap-1.5"
                    aria-label="Open Step Guide"
                  >
                    <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Guide</span>
                  </Button>
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
                  aria-busy={isSubmitting}
                  className="shrink-0 bg-amber-600 font-semibold text-white hover:bg-amber-600/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                      <span>{mode === "edit" ? "Saving..." : "Creating..."}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>{mode === "edit" ? "Save Nation" : "Create Nation"}</span>
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={onContinue}
                  className="shrink-0 bg-amber-600 font-semibold text-white hover:bg-amber-600/90"
                >
                  <span>Continue</span>
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </FacetCard>
        </div>
      </header>
    </TooltipProvider>
  );
});
