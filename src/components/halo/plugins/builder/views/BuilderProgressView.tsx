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
import { BUILDER_VERSION } from "~/lib/buildVersion";
import { cn, toTitleCase } from "~/lib/utils";
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
  { key: "foundation", label: "1. Base Template", desc: "Select foundation country" },
  { key: "core", label: "2. National Identity", desc: "Configure naming, languages, motto" },
  {
    key: "government",
    label: "3. Government Structure",
    desc: "Design departments & legislature",
  },
  { key: "economics", label: "4. Economy Setup", desc: "Configure components & taxes" },
  { key: "preview", label: "5. Verify & Submit", desc: "Verify and initialize country" },
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
  foundation: { color: "text-amber-400 border-amber-500/30", bg: "bg-amber-500/10" },
  core: { color: "text-cyan-400 border-cyan-500/30", bg: "bg-cyan-500/10" },
  government: { color: "text-indigo-400 border-indigo-500/30", bg: "bg-indigo-500/10" },
  economics: { color: "text-emerald-400 border-emerald-500/30", bg: "bg-emerald-500/10" },
  preview: { color: "text-amber-400 border-amber-500/30", bg: "bg-amber-500/10" },
};

const DEFAULT_STEP_THEME: StepTheme = {
  color: "text-amber-400 border-amber-500/30",
  bg: "bg-amber-500/10",
};

function formatCurrencyValue(val: number): string {
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${val.toLocaleString()}`;
}

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
    builderState?.economicInputs?.countryName || activeTemplate?.name || "New Country";

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
      <div className="flex flex-col justify-between gap-2 border-b border-border/40 pb-3 sm:flex-row sm:items-center">
        <div className="space-y-0.5 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-wider text-amber-500 uppercase">
              MyCountry Builder
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
            <span className="text-[10px] font-medium text-muted-foreground">v{BUILDER_VERSION}</span>
          </div>
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">
            Building: <span className="text-amber-400">{countryName || "New Country"}</span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Autosave status pill */}
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-border/40 bg-card/40 px-3 text-xs font-medium text-muted-foreground select-none">
            <span className="relative flex h-1.5 w-1.5">
              {isAutoSaving ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                </>
              ) : (
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
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
            <div className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 p-0.5">
              <span className="px-2 text-[10px] font-semibold text-red-400">Reset draft?</span>
              <button
                onClick={handleConfirmRestart}
                className="flex h-7 items-center rounded-md bg-red-500 px-2.5 text-[11px] font-bold text-white shadow-xs transition-transform active:scale-[0.97]"
                type="button"
                data-cuelume-press
              >
                Yes, Reset
              </button>
              <button
                onClick={() => setIsConfirmingRestart(false)}
                className="flex h-7 items-center rounded-md border border-border/40 bg-background/80 px-2 text-[11px] font-bold text-muted-foreground transition-transform hover:text-foreground active:scale-[0.97]"
                type="button"
                data-cuelume-press
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsConfirmingRestart(true)}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/40 bg-card/40 px-3 text-xs font-bold text-muted-foreground transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 active:scale-[0.97]"
              title="Restart Builder"
              type="button"
              data-cuelume-press
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Restart
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Step Progress Tracker */}
        <div className="space-y-2 text-left md:col-span-7">
          <h3 className="mb-2.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Progress Checklist
          </h3>
          <div className="space-y-2">
            {BUILDER_STEPS.map((st) => {
              const state = getStepState(st.key);
              const isActive = state === "active";
              const isCompleted = state === "completed";

              return (
                <div
                  key={st.key}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-2 transition-all",
                    isActive
                      ? `${theme.bg} ${theme.color} border-current`
                      : isCompleted
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400/90"
                        : "border-border/40 bg-card/20 text-muted-foreground"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : isActive ? (
                      <span className="relative flex h-4 w-4">
                        <span className="duration-1000 absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
                        <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full border border-current bg-background">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        </span>
                      </span>
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs leading-none font-bold">{st.label}</p>
                    <p className="mt-1 truncate text-[10px] font-medium text-muted-foreground">{st.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Configuration Summary Card */}
        <div className="flex flex-col justify-between rounded-xl border border-border/40 bg-card/30 p-3 text-left shadow-xs md:col-span-5">
          <div className="space-y-3">
            <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Stats Configured
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-border/20 py-1">
                <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Government
                </span>
                <span className="max-w-[120px] truncate font-bold text-foreground">
                  {builderState?.governmentStructure?.structure?.governmentType
                    ? toTitleCase(builderState.governmentStructure.structure.governmentType)
                    : "Not configured"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/20 py-1">
                <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                  <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                  Total Budget
                </span>
                <span className="font-bold text-foreground">
                  {builderState?.governmentStructure?.structure?.totalBudget
                    ? formatCurrencyValue(builderState.governmentStructure.structure.totalBudget)
                    : "Not configured"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/20 py-1">
                <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  Capital City
                </span>
                <span className="max-w-[120px] truncate font-bold text-foreground">
                  {builderState?.economicInputs?.nationalIdentity?.capitalCity || "Not configured"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/20 py-1">
                <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                  <Crown className="h-3.5 w-3.5 text-muted-foreground" />
                  Currency
                </span>
                <span className="max-w-[120px] truncate font-bold text-foreground">
                  {builderState?.economicInputs?.nationalIdentity?.currency
                    ? `${builderState.economicInputs.nationalIdentity.currency} (${builderState.economicInputs.nationalIdentity.currencySymbol || "$"})`
                    : "Not configured"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleContinue}
            className="mt-4 flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-xs font-bold text-zinc-950 shadow-md transition-all hover:from-amber-400 hover:to-yellow-400 active:scale-[0.98]"
            type="button"
            data-cuelume-press
          >
            Continue Designing
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export const BuilderProgressView = memo(BuilderProgressViewComponent);
BuilderProgressView.displayName = "BuilderProgressView";
