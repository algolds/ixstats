"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, SlidersHorizontal, ArrowRight, X, HelpCircle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BUILDER_VERSION } from "~/lib/buildVersion";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import { cn } from "~/lib/utils";
import { PreText } from "~/components/ui/pretext";
import {
  archetypes,
  consolidatedCategories,
  getArchetypesByConsolidatedCategory,
} from "~/app/builder/utils/country-archetypes";

interface BuilderDIViewProps {
  onClose: () => void;
  filter: any; // Passed from BuilderDIPlugin closure
  context: any; // Passed from BuilderDIPlugin closure
}

export function BuilderDIView({ onClose, filter, context }: BuilderDIViewProps) {
  const namingInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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

  const showContinueButton = !!filter.selectedTemplate;

  const handleContinue = () => {
    // Navigate using the builder router continue action
    const btn = document.querySelector('[data-notch-continue="true"]') as HTMLButtonElement | null;
    if (btn) {
      btn.click();
    }
    onClose();
  };

  return (
    <div className="relative flex flex-col w-full text-left p-4 sm:p-5 select-none text-zinc-100">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 dark:border-white/5">
        <div className="flex items-center gap-2">
          <MyCountryLogo size="sm" animated={false} showVersion={false} />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            MyCountry Builder
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
          title="Collapse Hero"
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {filter.softSelectedCountry ? (
        /* Naming Mode */
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Name Your Custom Nation
            </h3>
            <p className="text-xs text-zinc-400">
              Give your selected base template (<span className="text-zinc-200 font-semibold">{filter.softSelectedCountry.name}</span>) a unique name.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              ref={namingInputRef}
              type="text"
              value={filter.newCountryName}
              onChange={(e) => filter.setNewCountryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filter.newCountryName.trim()) {
                  filter.confirmHandlerRef.current?.();
                  onClose();
                }
              }}
              placeholder="Enter nation name..."
              className="text-white placeholder-zinc-500 h-10 w-full rounded-lg border border-white/20 bg-white/5 px-4 text-sm font-bold shadow-[0_1.5px_3px_rgba(0,0,0,0.2)] focus:border-amber-500/50 focus:bg-white/10 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
            />
            <div className="flex w-full sm:w-auto shrink-0 gap-2">
              <button
                onClick={() => {
                  filter.clearSelection();
                  context.setFoundationPreviewCountry(null);
                }}
                className="flex-1 sm:flex-none flex h-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 text-xs font-bold text-zinc-200 hover:bg-zinc-800 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  filter.confirmHandlerRef.current?.();
                  onClose();
                }}
                disabled={!filter.newCountryName.trim()}
                className="flex-1 sm:flex-none flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-5 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/25 hover:from-amber-400 hover:to-yellow-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none transition-all"
              >
                Continue
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        /* Template Search & Filters Mode */
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center py-2">
            <MyCountryLogo size="lg" animated={true} showVersion={false} />
            <div className="mt-1 flex items-center gap-1.5 select-none">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                BUILDER®
              </span>
              <span className="text-zinc-600 dark:text-zinc-500 text-[9px] font-semibold">
                v{BUILDER_VERSION}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 max-w-sm mt-1 leading-normal">
              Select a baseline country template below to seed your geographical, economic, and population properties.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input Box */}
            <div className="relative flex-1 flex h-10 items-center gap-2.5 rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 focus-within:border-amber-500/40 focus-within:bg-zinc-900/60 focus-within:shadow-[0_0_12px_rgba(245,158,11,0.08)] transition-all">
              <Search className="h-4 w-4 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search templates (e.g. United Kingdom, Sierra Leone)..."
                value={filter.searchTerm}
                onChange={(e) => filter.setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
              />
              {filter.searchTerm && (
                <button
                  onClick={() => {
                    filter.setSearchTerm("");
                    searchInputRef.current?.focus();
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/10"
                  title="Clear search"
                >
                  <X className="h-3 w-3 text-zinc-400" />
                </button>
              )}
            </div>

            {/* Filters Toggle Button */}
            <button
              onClick={() => filter.toggleFilters()}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors",
                filter.showFilters
                  ? "border-amber-500/30 bg-amber-500/15 text-amber-400"
                  : "border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800 hover:text-white"
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
                <div className="flex flex-wrap gap-1.5 mb-2">
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
                                  filter.selectedArchetypes.filter((id: string) => id !== archetype.id)
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
                          className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
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
                      className="text-[9px] font-bold text-zinc-400 hover:text-white ml-auto"
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
