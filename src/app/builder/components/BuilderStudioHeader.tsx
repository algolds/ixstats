"use client";

import React, { useMemo } from "react";
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
import { Button, focusRing, hitSlop } from "~/components/ui/button";
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
import { Card } from "~/components/ui/card";

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
  preview: "Preview and finalize",
  import: "Wiki import",
};

interface BuilderStudioHeaderProps {
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
        {/* The page title: the bar shows the step only in the stepper, so the h1 is for assistive
            tech (one h1 per page; step content starts at h2). */}
        <h1 className="sr-only">{SECTION_LABELS[activeSection]} · MyCountry Builder</h1>
        <div className="mx-auto w-full max-w-6xl px-4">
          <Card className="flex flex-wrap items-center justify-between gap-2 p-2 sm:flex-nowrap sm:p-3">
            {/* Back, restart and step count */}
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onBack}
                disabled={isBackDisabled}
                className="shrink-0 gap-2"
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
                    className="text-label-secondary hover:bg-destructive/10 hover:text-destructive h-8 w-8 shrink-0"
                    aria-label={mode === "edit" ? "Discard changes and exit" : "Restart builder"}
                  >
                    {mode === "edit" ? (
                      <XCircle aria-hidden="true" className="h-3.5 w-3.5" />
                    ) : (
                      <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-caption">
                  {mode === "edit" ? "Discard changes and exit" : "Restart builder"}
                </TooltipContent>
              </Tooltip>

              <div aria-hidden="true" className="bg-separator-opaque h-4 w-px shrink-0" />

              <div className="hidden items-center gap-2 px-1 md:flex">
                <Eyebrow>
                  Step {stepIndex + 1} of {steps.length}
                </Eyebrow>
              </div>
            </div>

            {/* Step track */}
            <nav
              aria-label="Builder steps"
              className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto py-0.5 sm:gap-2"
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
                          isCompleted ? "bg-green/40" : "bg-separator-opaque/60"
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
                        className={cn(
                          "border-tint/40 bg-tint/15 text-yellow-ink text-caption shadow-card relative flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 py-1 font-semibold",
                          focusRing,
                          hitSlop
                        )}
                      >
                        <Icon aria-hidden="true" className="text-tint h-3.5 w-3.5" />
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
                              "text-caption relative flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border px-2",
                              focusRing,
                              hitSlop,
                              isCompleted
                                ? "border-green/40 bg-green/15 text-green-ink hover:bg-green/25 cursor-pointer"
                                : isAccessible
                                  ? "border-separator bg-surface text-label-secondary hover:bg-fill-3 hover:text-label cursor-pointer"
                                  : "border-separator bg-surface text-label-secondary cursor-not-allowed opacity-40"
                            )}
                            aria-label={`${label}${isCompleted ? ", completed" : isAccessible ? "" : ", locked"}`}
                            data-cuelume-press="tick"
                          >
                            {isCompleted ? (
                              <Check aria-hidden="true" className="h-3 w-3 stroke-[2.5]" />
                            ) : (
                              <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 rounded-full bg-current"
                              />
                            )}
                            <span className="text-footnote hidden lg:inline">{label}</span>
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-caption">
                          {label} {isCompleted ? "(completed)" : isAccessible ? "" : "(locked)"}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>

            {/* Guide and primary action */}
            <div className="flex shrink-0 items-center gap-2">
              {hasAlerts && (
                <Badge
                  variant="outline"
                  className={
                    activeErrors.length > 0
                      ? "border-destructive/50 text-destructive"
                      : "border-tint/50 text-tint"
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
                    className="shrink-0 gap-2"
                    aria-label="Open the step guide"
                  >
                    <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Guide</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-caption">
                  Step guide
                </TooltipContent>
              </Tooltip>

              {isOnPreview ? (
                <Button
                  size="sm"
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="shrink-0"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                      <span>{mode === "edit" ? "Saving..." : "Creating..."}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>{mode === "edit" ? "Save nation" : "Create nation"}</span>
                    </>
                  )}
                </Button>
              ) : (
                <Button size="sm" onClick={onContinue} className="shrink-0">
                  <span>Continue</span>
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </Card>
        </div>
      </header>
    </TooltipProvider>
  );
});
