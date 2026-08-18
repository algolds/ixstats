"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  SlidersHorizontal,
  ArrowRight,
  X,
  HelpCircle,
  Sparkles,
  Bell,
  Settings,
  CheckCircle2,
  Circle,
  RefreshCw,
  Crown,
  Coins,
  Building2,
  Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BUILDER_VERSION } from "~/lib/buildVersion";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import { cn, toTitleCase } from "~/lib/utils";
// eslint-disable-next-line unused-imports/no-unused-imports
import { PreText } from "~/components/ui/pretext";
import {
  archetypes,
  consolidatedCategories,
  getArchetypesByConsolidatedCategory,
} from "~/app/builder/utils/country-archetypes";
import { useBuilderActions } from "~/app/builder/hooks/useBuilderActions";

/**
 * Upgrades a flag URL to a high-resolution or SVG version if it is from FlagCDN or Wikimedia Commons.
 */
function getHighResFlagUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;

  // 1. Upgrade flagcdn.com thumbnail to SVG
  // e.g., https://flagcdn.com/w320/us.png -> https://flagcdn.com/us.svg
  if (url.includes("flagcdn.com")) {
    return url.replace(/\/w\d+\/([a-z0-9_-]+)\.(png|jpg|jpeg|gif|webp)$/i, "/$1.svg");
  }

  // 2. Upgrade Wikimedia Commons thumbnail to original (SVG if it is one, or original high-res image)
  // e.g., https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/320px-Flag_of_the_United_States.svg.png
  // -> https://upload.wikimedia.org/wikipedia/commons/a/a4/Flag_of_the_United_States.svg
  if (url.includes("upload.wikimedia.org/wikipedia/commons/thumb/")) {
    const parts = url.split("/");
    if (parts[5] === "thumb") {
      parts.splice(5, 1); // remove "thumb"
      parts.pop(); // remove trailing thumbnail size filename
      return parts.join("/");
    }
  }

  return url;
}

import type { ViewMode } from "./types";

interface BuilderDIViewProps {
  onClose: () => void;
  onSwitchMode?: (mode: ViewMode) => void;
  filter?: any;
  context?: any;
}

interface BuilderProgressViewProps {
  filter?: any;
  context?: any;
  onClose: () => void;
}

function BuilderProgressView({ filter, context, onClose }: BuilderProgressViewProps) {
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
  const baseTemplateName = activeTemplate?.name || "Not selected";

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

    // Order fallback
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
          {/* Autosave status pill inside expanded DI */}
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-xs font-medium text-zinc-400 select-none">
            <span className="relative flex h-1.5 w-1.5">
              {isAutoSaving ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
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

export function BuilderDIView({ onClose, onSwitchMode, filter, context }: BuilderDIViewProps) {
  const namingInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const activeTemplate =
    filter.selectedTemplate ||
    context.builderState?.selectedCountry ||
    (context.builderState?.economicInputs?.countryName
      ? {
          name: context.builderState.economicInputs.countryName,
          flag: context.builderState.economicInputs.flagUrl || "",
        }
      : null);

  const rawFlagUrl =
    activeTemplate?.flag ||
    activeTemplate?.flagUrl ||
    filter.softSelectedCountry?.flag ||
    filter.softSelectedCountry?.flagUrl;
  const flagUrl = getHighResFlagUrl(rawFlagUrl);

  // Focus naming input when soft-selected country is present
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (filter.softSelectedCountry) {
      timer = setTimeout(() => {
        if (namingInputRef.current) {
          namingInputRef.current.focus();
          namingInputRef.current.select();
        }
      }, 100);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [filter.softSelectedCountry]);

  // Focus search input on mount if no soft selection
  useEffect(() => {
    if (!filter.softSelectedCountry && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [filter.softSelectedCountry]);

  const showContinueButton = !!activeTemplate;

  const { handleContinue: actionsContinue } = useBuilderActions({
    builderState: context.builderState,
    setBuilderState: context.setBuilderState,
    mode: context.mode,
  });

  const handleContinue = () => {
    const currentStep = context.builderState.step;
    if (currentStep === "foundation") {
      const template = filter.selectedTemplate || context.builderState.selectedCountry;
      if (template) {
        context.updateStep("foundation", template);
      }
    } else {
      actionsContinue();
    }
    onClose();
  };

  return (
    <div className="relative flex w-full flex-col p-4 text-left text-zinc-100 select-none sm:p-5">
      {/* Background Refracted Flag Watermark */}
      {flagUrl && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] select-none">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.12] blur-[6px] saturate-[85%] transition-all duration-700 dark:opacity-[0.06] dark:saturate-[50%]"
            style={{ backgroundImage: `url(${flagUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 mix-blend-overlay" />
        </div>
      )}

      {/* Top Header */}
      <div className="relative z-10 mb-2 flex items-center justify-end pb-1">
        <div className="flex items-center gap-1.5">
          {onSwitchMode && (
            <>
              <button
                onClick={() => onSwitchMode("search")}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-white/10 hover:text-white"
                title="Global Search"
                type="button"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                onClick={() => onSwitchMode("notifications")}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-white/10 hover:text-white"
                title="Notifications"
                type="button"
              >
                <Bell className="h-4 w-4" />
              </button>
              <button
                onClick={() => onSwitchMode("settings")}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-white/10 hover:text-white"
                title="Settings"
                type="button"
              >
                <Settings className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={() => filter.setWelcomeModalOpen(true)}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-white/10 hover:text-amber-400"
            title="Open Welcome Guide"
            type="button"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-white/10 hover:text-white"
            title="Collapse Hero"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {filter.softSelectedCountry ? (
        /* Naming Mode */
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className="relative z-10 space-y-4"
        >
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-base font-bold text-white">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Name Your Custom Nation
            </h3>
            <p className="text-xs text-zinc-400">
              Give your selected base template (
              <span className="font-semibold text-zinc-200">{filter.softSelectedCountry.name}</span>
              ) a unique name.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <input
              ref={namingInputRef}
              type="text"
              value={filter.newCountryName}
              onChange={(e) => filter.setNewCountryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filter.newCountryName.trim()) {
                  filter.confirmHandlerRef.current?.();
                  if (context.builderState.step === "foundation") {
                    const finalCountry = {
                      ...(filter.softSelectedCountry ?? {}),
                      name: filter.newCountryName.trim(),
                      foundationCountryName: filter.softSelectedCountry?.name,
                    };
                    context.updateStep("foundation", finalCountry);
                  }
                  onClose();
                }
              }}
              placeholder="Enter nation name..."
              className="h-10 w-full rounded-lg border border-black/15 bg-white/70 px-4 text-sm font-bold text-zinc-900 shadow-[0_1.5px_3px_rgba(0,0,0,0.05)] backdrop-blur-md transition-all placeholder:text-zinc-500 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:outline-none dark:border-white/15 dark:bg-black/70 dark:text-zinc-100 dark:shadow-[0_1.5px_3px_rgba(0,0,0,0.3)] dark:placeholder:text-zinc-400 dark:focus:border-amber-500 dark:focus:bg-black/80"
            />
            <div className="flex w-full shrink-0 gap-2 sm:w-auto">
              <button
                onClick={() => {
                  filter.clearSelection();
                  context.setFoundationPreviewCountry(null);
                }}
                className="flex h-10 flex-1 cursor-pointer items-center justify-center rounded-lg border border-black/15 bg-white/90 px-4 text-xs font-bold text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md transition-all hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-600 sm:flex-none dark:border-white/15 dark:bg-black/70 dark:text-zinc-100 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)] dark:hover:border-red-500/40 dark:hover:bg-red-500/20 dark:hover:text-red-400"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  filter.confirmHandlerRef.current?.();
                  if (context.builderState.step === "foundation") {
                    const finalCountry = {
                      ...(filter.softSelectedCountry ?? {}),
                      name: filter.newCountryName.trim(),
                      foundationCountryName: filter.softSelectedCountry?.name,
                    };
                    context.updateStep("foundation", finalCountry);
                  }
                  onClose();
                }}
                disabled={!filter.newCountryName.trim()}
                className="flex h-10 flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-5 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-yellow-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:flex-none"
              >
                Continue
              </button>
            </div>
          </div>
        </motion.div>
      ) : activeTemplate ? (
        /* Progress / Status Mode */
        <BuilderProgressView filter={filter} context={context} onClose={onClose} />
      ) : (
        /* Template Search & Filters Mode */
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col items-center py-2 text-center">
            <MyCountryLogo size="lg" animated={true} showVersion={true} />
            <p className="mt-2 max-w-sm text-[12px] leading-normal text-zinc-200">
              Select a country template below to get started.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input Box */}
            <div className="relative flex h-10 flex-1 items-center gap-2.5 rounded-lg border border-black/15 bg-white/70 pr-2 pl-3 backdrop-blur-md transition-all focus-within:border-amber-500 focus-within:bg-white focus-within:shadow-[0_0_12px_rgba(245,158,11,0.08)] dark:border-white/15 dark:bg-black/70 dark:focus-within:border-amber-500 dark:focus-within:bg-black/80">
              <Search className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search countries (e.g. United Kingdom, Sierra Leone)..."
                value={filter.searchTerm}
                onChange={(e) => filter.setSearchTerm(e.target.value)}
                className="h-full flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-500 dark:text-zinc-100 dark:placeholder:text-zinc-400"
              />
              {filter.searchTerm && (
                <button
                  onClick={() => {
                    filter.setSearchTerm("");
                    searchInputRef.current?.focus();
                  }}
                  className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                  title="Clear search"
                >
                  <X className="h-3 w-3 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white" />
                </button>
              )}
            </div>

            <button
              onClick={() => filter.toggleFilters()}
              className={cn(
                "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border backdrop-blur-md transition-all duration-200",
                filter.showFilters
                  ? "border-amber-500/50 bg-amber-500/25 text-amber-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-400"
                  : filter.selectedArchetypes && filter.selectedArchetypes.length > 0
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    : "border-black/15 bg-white/70 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:border-white/15 dark:bg-black/70 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-white"
              )}
              title="Filter by Archetypes"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Expanded Archetype Filters Panel */}
          <AnimatePresence>
            {filter.showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden border-t border-zinc-800 pt-3"
              >
                {/* Category Selection Tabs */}
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {consolidatedCategories.map((cat) => {
                    const catArchetypes = getArchetypesByConsolidatedCategory(cat.id);
                    const selectedInCategory = filter.selectedArchetypes.filter((id: string) =>
                      catArchetypes.some((a) => a.id === id)
                    );
                    const isCatActive = activeCategory === cat.id;

                    return (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(isCatActive ? null : cat.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all",
                          isCatActive
                            ? "border-amber-400/50 bg-amber-500/15 text-white"
                            : selectedInCategory.length > 0
                              ? "border-amber-500/30 bg-amber-500/5 text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/10"
                              : "border-zinc-800 bg-zinc-900/20 text-zinc-400 hover:border-zinc-700 hover:text-white"
                        )}
                      >
                        <span>{cat.name}</span>
                        {selectedInCategory.length > 0 && (
                          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-bold text-zinc-950">
                            {selectedInCategory.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Sub-archetype Chips */}
                <AnimatePresence mode="wait">
                  {activeCategory && (
                    <motion.div
                      key={activeCategory}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-wrap gap-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2"
                    >
                      {getArchetypesByConsolidatedCategory(activeCategory).map((archetype) => {
                        const isSelected = filter.selectedArchetypes.includes(archetype.id);
                        const Icon = archetype.icon;

                        return (
                          <button
                            key={archetype.id}
                            onClick={() => {
                              const isSel = filter.selectedArchetypes.includes(archetype.id);
                              if (isSel) {
                                filter.setSelectedArchetypes(
                                  filter.selectedArchetypes.filter(
                                    (id: string) => id !== archetype.id
                                  )
                                );
                              } else {
                                filter.setSelectedArchetypes([
                                  ...filter.selectedArchetypes,
                                  archetype.id,
                                ]);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all",
                              isSelected
                                ? "border-amber-400/50 bg-amber-500/10 text-white"
                                : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-white"
                            )}
                          >
                            {Icon && <Icon className={cn("h-3 w-3", archetype.color)} />}
                            <span>{archetype.name}</span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Selected Filters chips summary */}
                {filter.selectedArchetypes.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-zinc-800 pt-2">
                    <span className="text-[10px] font-medium text-zinc-500">
                      Selected Archetypes:
                    </span>
                    {filter.selectedArchetypes.map((id: string) => {
                      const archetype = archetypes.find((a) => a.id === id);
                      if (!archetype) return null;
                      const Icon = archetype.icon;
                      return (
                        <button
                          key={id}
                          onClick={() => {
                            filter.setSelectedArchetypes(
                              filter.selectedArchetypes.filter((x: string) => x !== id)
                            );
                          }}
                          className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
                        >
                          {Icon && <Icon className="h-2.5 w-2.5" />}
                          <span>{archetype.name}</span>
                          <X className="h-2.5 w-2.5" />
                        </button>
                      );
                    })}
                    <button
                      onClick={() => {
                        filter.handleClearFilters();
                        setActiveCategory(null);
                      }}
                      className="ml-auto text-[9px] font-bold text-zinc-400 hover:text-white"
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
