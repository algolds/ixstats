"use client";

import React, { useState, memo } from "react";
import {
  ArrowRight,
  CheckCircle as CheckCircle2,
  Circle,
  Refresh as RefreshCw,
  Crown,
  Coins,
  City as Building2,
  Globe,
} from "iconoir-react";
import { motion } from "motion/react";
import { Button } from "~/components/ui/button";
import { BUILDER_VERSION } from "~/lib/buildVersion";
import { cn, formatCurrency, toTitleCase } from "~/lib/utils";
import { useBuilderActions } from "~/app/builder/hooks/useBuilderActions";
import type { BuilderFilterState } from "~/app/builder/components/builder-filter-context";
import type { BuilderContextValue } from "~/app/builder/components/enhanced/context/BuilderStateContext";
import type { DIViewProps } from "~/components/halo/types";

import type { BuilderStep } from "~/app/builder/components/enhanced/builderConfig";
import type { BuilderState } from "~/app/builder/hooks/builderStateTypes";

export type BuilderProgressViewProps = DIViewProps<BuilderFilterState, BuilderContextValue>;

interface BuilderStepItem {
  key: BuilderStep;
  label: string;
  desc: string;
}

const BUILDER_STEPS: readonly BuilderStepItem[] = [
  { key: "foundation", label: "1. Base template", desc: "Select foundation country" },
  { key: "core", label: "2. National identity", desc: "Configure naming, languages, motto" },
  {
    key: "government",
    label: "3. Government structure",
    desc: "Design departments and legislature",
  },
  { key: "economics", label: "4. Economy setup", desc: "Configure components and taxes" },
  { key: "preview", label: "5. Verify and submit", desc: "Verify and initialize country" },
] as const;

const STEP_ORDER: readonly BuilderStep[] = [
  "foundation",
  "core",
  "government",
  "economics",
  "preview",
] as const;

const FALLBACK_BUILDER_STATE: BuilderState = {
  step: "foundation",
  completedSteps: [],
  selectedCountry: null,
  selectedArchetypeId: null,
  economicInputs: null,
  governmentComponents: [],
  taxSystemData: null,
  governmentStructure: null,
  activeCoreTab: "general",
  activeGovernmentTab: "general",
  activeEconomicsTab: "general",
  showAdvancedMode: false,
  economyBuilderState: null,
};

interface StepTheme {
  color: string;
  bg: string;
}

const STEP_THEMES: Record<string, StepTheme> = {
  foundation: { color: "text-yellow border-yellow/30", bg: "bg-yellow/10" },
  core: { color: "text-teal border-teal/30", bg: "bg-teal/10" },
  government: { color: "text-indigo border-indigo/30", bg: "bg-indigo/10" },
  economics: { color: "text-green border-green/30", bg: "bg-green/10" },
  preview: { color: "text-yellow border-yellow/30", bg: "bg-yellow/10" },
};

const DEFAULT_STEP_THEME: StepTheme = {
  color: "text-yellow border-yellow/30",
  bg: "bg-yellow/10",
};

function BuilderProgressViewComponent({ filter, context, onClose }: BuilderProgressViewProps) {
  const [isConfirmingRestart, setIsConfirmingRestart] = useState(false);

  const builderState = context?.builderState;
  const clearDraft = context?.clearDraft;
  const isAutoSaving = context?.isAutoSaving ?? false;
  const lastSaved = context?.lastSaved ?? null;
  const currentStep = builderState?.step ?? "foundation";

  const activeTemplate =
    filter?.selectedTemplate ||
    builderState?.selectedCountry ||
    (builderState?.economicInputs?.countryName
      ? {
          name: builderState.economicInputs.countryName,
          flag: builderState.economicInputs.flagUrl || "",
        }
      : null);

  const countryName =
    builderState?.economicInputs?.countryName || activeTemplate?.name || "New country";

  const getStepState = (stepKey: BuilderStep) => {
    if (currentStep === stepKey) return "active";
    if (builderState?.completedSteps?.includes(stepKey)) return "completed";

    const currentIdx = STEP_ORDER.indexOf(currentStep);
    const stepIdx = STEP_ORDER.indexOf(stepKey);
    if (currentIdx !== -1 && stepIdx !== -1 && stepIdx < currentIdx) return "completed";
    return "pending";
  };

  const { handleContinue: actionsContinue } = useBuilderActions({
    builderState: builderState ?? FALLBACK_BUILDER_STATE,
    setBuilderState: context?.setBuilderState ?? (() => {}),
    mode: context?.mode,
    viewMode: filter?.viewMode,
  });

  const handleConfirmRestart = () => {
    clearDraft?.();
    filter?.clearSelection?.();
    filter?.setSearchTerm?.("");
    filter?.setSelectedArchetypes?.([]);
    filter?.setNewCountryName?.("");
    setIsConfirmingRestart(false);
    onClose();
    filter?.onNavigate?.("foundation");
  };

  const handleContinue = () => {
    if (currentStep === "foundation") {
      const template = filter?.selectedTemplate || builderState?.selectedCountry;
      if (template && context?.updateStep) {
        context.updateStep("foundation", template);
      }
    } else {
      actionsContinue();
    }
    onClose();
  };

  const theme = STEP_THEMES[currentStep] ?? DEFAULT_STEP_THEME;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="relative z-10 space-y-4"
    >
      <div className="border-separator flex flex-col justify-between gap-2 border-b pb-3 sm:flex-row sm:items-center">
        <div className="space-y-0.5 text-left">
          <div className="flex items-center gap-2">
            <span className="text-eyebrow text-yellow">MyCountry Builder</span>
            <span className="bg-border h-1.5 w-1.5 rounded-full" />
            <span className="text-caption text-label-secondary">v{BUILDER_VERSION}</span>
          </div>
          <h2 className="text-title-3 text-label">
            Building: <span className="text-yellow">{countryName || "New country"}</span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Autosave status pill */}
          <div className="rounded-control border-separator bg-surface text-caption text-label-secondary flex h-8 items-center gap-2 border px-3 select-none">
            <span className="relative flex h-1.5 w-1.5">
              {isAutoSaving ? (
                <>
                  <span className="bg-yellow absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                  <span className="bg-yellow relative inline-flex h-1.5 w-1.5 rounded-full" />
                </>
              ) : (
                <span className="bg-green relative inline-flex h-1.5 w-1.5 rounded-full" />
              )}
            </span>
            <span>
              {isAutoSaving
                ? "Saving..."
                : lastSaved
                  ? `Saved ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                  : "Auto-save enabled"}
            </span>
          </div>

          {isConfirmingRestart ? (
            <div className="rounded-control border-red/30 bg-red/10 flex items-center gap-2 border p-0.5">
              <span className="text-caption text-red px-2 font-semibold">Reset draft?</span>
              <Button type="button" variant="destructive" size="sm" onClick={handleConfirmRestart}>
                Yes, reset
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsConfirmingRestart(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmingRestart(true)}
              title="Restart builder"
              className="text-label-secondary hover:border-red/30 hover:bg-red/10 hover:text-red"
            >
              <RefreshCw aria-hidden />
              Restart
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Step Progress Tracker */}
        <div className="space-y-2 text-left md:col-span-7">
          <h3 className="text-eyebrow text-label-secondary mb-2">Progress checklist</h3>
          <div className="space-y-2">
            {BUILDER_STEPS.map((st) => {
              const state = getStepState(st.key);
              const isActive = state === "active";
              const isCompleted = state === "completed";

              return (
                <div
                  key={st.key}
                  className={cn(
                    "rounded-control flex items-start gap-3 border p-2 transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                    isActive
                      ? `${theme.bg} ${theme.color} border-current`
                      : isCompleted
                        ? "border-green/20 bg-green/10 text-green/90"
                        : "border-separator bg-surface text-label-secondary"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="text-green h-4 w-4" />
                    ) : isActive ? (
                      <span className="relative flex h-4 w-4">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75 duration-1000" />
                        <span className="bg-surface relative inline-flex h-4 w-4 items-center justify-center rounded-full border border-current">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        </span>
                      </span>
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-caption leading-none font-semibold">{st.label}</p>
                    <p className="text-caption text-label-secondary mt-1 truncate">{st.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Configuration Summary Card */}
        <div className="rounded-row border-separator bg-surface flex flex-col justify-between border p-3 text-left md:col-span-5">
          <div className="space-y-3">
            <h3 className="text-eyebrow text-label-secondary">Stats configured</h3>

            <div className="text-footnote space-y-2">
              <div className="border-separator flex items-center justify-between border-b py-1">
                <span className="text-label-secondary flex items-center gap-2 font-semibold">
                  <Building2 className="text-label-secondary h-3.5 w-3.5" />
                  Government
                </span>
                <span className="text-label max-w-[120px] truncate font-semibold">
                  {builderState?.governmentStructure?.structure?.governmentType
                    ? toTitleCase(builderState.governmentStructure.structure.governmentType)
                    : "Not configured"}
                </span>
              </div>
              <div className="border-separator flex items-center justify-between border-b py-1">
                <span className="text-label-secondary flex items-center gap-2 font-semibold">
                  <Coins className="text-label-secondary h-3.5 w-3.5" />
                  Total budget
                </span>
                <span className="text-label font-semibold">
                  {builderState?.governmentStructure?.structure?.totalBudget
                    ? formatCurrency(builderState.governmentStructure.structure.totalBudget)
                    : "Not configured"}
                </span>
              </div>
              <div className="border-separator flex items-center justify-between border-b py-1">
                <span className="text-label-secondary flex items-center gap-2 font-semibold">
                  <Globe className="text-label-secondary h-3.5 w-3.5" />
                  Capital city
                </span>
                <span className="text-label max-w-[120px] truncate font-semibold">
                  {builderState?.economicInputs?.nationalIdentity?.capitalCity || "Not configured"}
                </span>
              </div>
              <div className="border-separator flex items-center justify-between border-b py-1">
                <span className="text-label-secondary flex items-center gap-2 font-semibold">
                  <Crown className="text-label-secondary h-3.5 w-3.5" />
                  Currency
                </span>
                <span className="text-label max-w-[120px] truncate font-semibold">
                  {builderState?.economicInputs?.nationalIdentity?.currency
                    ? `${builderState.economicInputs.nationalIdentity.currency} (${builderState.economicInputs.nationalIdentity.currencySymbol || "$"})`
                    : "Not configured"}
                </span>
              </div>
            </div>
          </div>

          {/* Halo floats outside the Builder's `data-app="mycountry"` scope, so the button opts into the gold itself. */}
          <Button
            onClick={handleContinue}
            data-app="mycountry"
            className="mt-4 w-full"
            type="button"
          >
            Continue designing
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export const BuilderProgressView = memo(BuilderProgressViewComponent);
BuilderProgressView.displayName = "BuilderProgressView";
