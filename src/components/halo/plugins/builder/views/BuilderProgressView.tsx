"use client";

import React from "react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  RefreshCw,
  Crown,
  Coins,
  Building2,
  Globe,
} from "lucide-react";
import { motion } from "motion/react";
import { BUILDER_VERSION } from "~/lib/buildVersion";
import { cn, toTitleCase } from "~/lib/utils";
import { useBuilderActions } from "~/app/builder/hooks/useBuilderActions";

export interface BuilderProgressViewProps {
  filter: any;
  context: any;
  onClose: () => void;
}

export function BuilderProgressView({ filter, context, onClose }: BuilderProgressViewProps) {
  const { builderState, clearDraft, isAutoSaving, lastSaved } = context;
  const currentStep = builderState.step;

  const activeTemplate =
    filter.selectedTemplate ||
    builderState.selectedCountry ||
    (builderState.economicInputs?.countryName
      ? {
          name: builderState.economicInputs.countryName,
          flag: builderState.economicInputs.flagUrl || "",
        }
      : null);

  const countryName =
    builderState.economicInputs?.countryName || activeTemplate?.name || "New Nation";

  // Steps map
  const steps = [
    { key: "foundation", label: "1. Base Template", desc: "Select foundation country" },
    { key: "core", label: "2. National Identity", desc: "Configure naming, languages, motto" },
    {
      key: "government",
      label: "3. Government Structure",
      desc: "Design departments & legislature",
    },
    { key: "economics", label: "4. Economy Setup", desc: "Configure components & taxes" },
    { key: "preview", label: "5. Verify & Submit", desc: "Verify and initialize nation" },
  ];

  const getStepState = (stepKey: string) => {
    if (currentStep === stepKey) return "active";
    if (builderState.completedSteps.includes(stepKey)) return "completed";

    const order = ["foundation", "core", "government", "economics", "preview"];
    const currentIdx = order.indexOf(currentStep);
    const stepIdx = order.indexOf(stepKey);
    if (stepIdx < currentIdx) return "completed";
    return "pending";
  };

  const { handleContinue: actionsContinue } = useBuilderActions({
    builderState,
    setBuilderState: context.setBuilderState,
    mode: context.mode,
  });

  const handleRestart = () => {
    const confirmReset = window.confirm(
      "Are you sure you want to restart the builder? This will clear all current progress and start fresh."
    );
    if (confirmReset) {
      clearDraft();
      filter.clearSelection();
      filter.setSearchTerm("");
      filter.setSelectedArchetypes([]);
      filter.setNewCountryName("");
      onClose();
      filter.onNavigate?.("foundation");
    }
  };

  const handleContinue = () => {
    if (currentStep === "foundation") {
      const template = filter.selectedTemplate || builderState.selectedCountry;
      if (template) {
        context.updateStep("foundation", template);
      }
    } else {
      actionsContinue();
    }
    onClose();
  };

  const activeThemeColor = (() => {
    switch (currentStep) {
      case "foundation":
        return "text-amber-400 border-amber-500/30";
      case "core":
        return "text-teal-400 border-teal-500/30";
      case "government":
        return "text-cyan-400 border-cyan-500/30";
      case "economics":
        return "text-emerald-400 border-emerald-500/30";
      case "preview":
        return "text-amber-400 border-amber-500/30";
      default:
        return "text-amber-400 border-amber-500/30";
    }
  })();

  const activeThemeBg = (() => {
    switch (currentStep) {
      case "foundation":
        return "bg-amber-500/10";
      case "core":
        return "bg-teal-500/10";
      case "government":
        return "bg-cyan-500/10";
      case "economics":
        return "bg-emerald-500/10";
      case "preview":
        return "bg-amber-500/10";
      default:
        return "bg-amber-500/10";
    }
  })();

  const formatCurrencyValue = (val: number) => {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    return `$${val.toLocaleString()}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="relative z-10 space-y-4"
    >
      <div className="flex flex-col justify-between gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-center">
        <div className="space-y-0.5 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-wider text-amber-500 uppercase">
              MyCountry Builder
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
            <span className="text-[10px] font-medium text-zinc-400">v{BUILDER_VERSION}</span>
          </div>
          <h2 className="text-lg font-extrabold tracking-tight text-white">
            Building: <span className="text-amber-400">{countryName || "New Nation"}</span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Autosave status pill */}
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-xs font-medium text-zinc-400 select-none">
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

          <button
            onClick={handleRestart}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-xs font-bold text-zinc-400 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
            title="Restart Builder"
            type="button"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Restart
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Step Progress Tracker */}
        <div className="space-y-2 text-left md:col-span-7">
          <h3 className="mb-2.5 text-xs font-bold tracking-wider text-zinc-400 uppercase">
            Progress Checklist
          </h3>
          <div className="space-y-2">
            {steps.map((st) => {
              const state = getStepState(st.key);
              const isActive = state === "active";
              const isCompleted = state === "completed";

              return (
                <div
                  key={st.key}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-2 transition-all",
                    isActive
                      ? `${activeThemeBg} ${activeThemeColor} border-current`
                      : isCompleted
                        ? "border-emerald-500/10 bg-emerald-500/5 text-emerald-400/80"
                        : "border-zinc-800 bg-zinc-900/10 text-zinc-500"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : isActive ? (
                      <span className="relative flex h-4 w-4">
                        <span className="animate-duration-1000 absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
                        <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full border border-current bg-zinc-950">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        </span>
                      </span>
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs leading-none font-bold">{st.label}</p>
                    <p className="mt-1 truncate text-[10px] font-medium text-zinc-400">{st.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Configuration Summary Card */}
        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.01] p-3 text-left shadow-md md:col-span-5">
          <div className="space-y-3">
            <h3 className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
              Stats Configured
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-white/5 py-1">
                <span className="flex items-center gap-1.5 font-semibold text-zinc-500">
                  <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                  Government
                </span>
                <span className="max-w-[120px] truncate font-bold text-zinc-200">
                  {builderState.governmentStructure?.structure?.governmentType
                    ? toTitleCase(builderState.governmentStructure.structure.governmentType)
                    : "Not configured"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 py-1">
                <span className="flex items-center gap-1.5 font-semibold text-zinc-500">
                  <Coins className="h-3.5 w-3.5 text-zinc-400" />
                  Total Budget
                </span>
                <span className="font-bold text-zinc-200">
                  {builderState.governmentStructure?.structure?.totalBudget
                    ? formatCurrencyValue(builderState.governmentStructure.structure.totalBudget)
                    : "Not configured"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 py-1">
                <span className="flex items-center gap-1.5 font-semibold text-zinc-500">
                  <Globe className="h-3.5 w-3.5 text-zinc-400" />
                  Capital City
                </span>
                <span className="max-w-[120px] truncate font-bold text-zinc-200">
                  {builderState.economicInputs?.nationalIdentity?.capitalCity || "Not configured"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 py-1">
                <span className="flex items-center gap-1.5 font-semibold text-zinc-500">
                  <Crown className="h-3.5 w-3.5 text-zinc-400" />
                  Currency
                </span>
                <span className="max-w-[120px] truncate font-bold text-zinc-200">
                  {builderState.economicInputs?.nationalIdentity?.currency
                    ? `${builderState.economicInputs.nationalIdentity.currency} (${builderState.economicInputs.nationalIdentity.currencySymbol || "$"})`
                    : "Not configured"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleContinue}
            className="animate-duration-300 mt-4 flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-xs font-bold text-zinc-950 shadow-md transition-all hover:from-amber-400 hover:to-yellow-400"
          >
            Continue Designing
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
