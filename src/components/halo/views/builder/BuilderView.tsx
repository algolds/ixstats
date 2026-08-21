"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  SlidersHorizontal,
  X,
  HelpCircle,
  Crown,
  Bell,
  Settings,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import { cn } from "~/lib/utils";
import {
  archetypes,
  consolidatedCategories,
  getArchetypesByConsolidatedCategory,
} from "~/app/builder/utils/country-archetypes";
import { BuilderProgressView } from "./BuilderProgressView";
import type { ViewMode } from "../../types";

/**
 * Upgrades a flag URL to a high-resolution or SVG version if it is from FlagCDN or Wikimedia Commons.
 */
function getHighResFlagUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;

  if (url.includes("flagcdn.com")) {
    return url.replace(/\/w\d+\/([a-z0-9_-]+)\.(png|jpg|jpeg|gif|webp)$/i, "/$1.svg");
  }

  if (url.includes("upload.wikimedia.org/wikipedia/commons/thumb/")) {
    const parts = url.split("/");
    if (parts[5] === "thumb") {
      parts.splice(5, 1);
      parts.pop();
      return parts.join("/");
    }
  }

  return url;
}

export interface BuilderViewProps {
  onClose: () => void;
  onSwitchMode?: (mode: ViewMode) => void;
  filter?: any;
  context?: any;
}

export function BuilderView({ onClose, onSwitchMode, filter, context }: BuilderViewProps) {
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
              <Crown className="h-4 w-4 text-amber-400" />
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

// Backwards compatibility alias
export const BuilderDIView = BuilderView;
