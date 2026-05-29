"use client";

import React, { useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ArrowRight,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useBuilderActions } from "../hooks/useBuilderActions";
import { type BuilderSection } from "../lib/builder-theme";
import { BUILDER_VERSION } from "~/lib/buildVersion";
import { AutosaveHistoryPanel } from "~/components/builder/AutosaveHistoryPanel";
import { cn } from "~/lib/utils";
import { useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import { useBuilderFilter } from "./builder-filter-context";
import { DynamicIslandEffects, DYNAMIC_ISLAND_STYLE } from "./glass";
import {
  archetypes,
  consolidatedCategories,
  getArchetypesByConsolidatedCategory,
} from "../utils/country-archetypes";

interface BuilderSectionHeroProps {
  section: BuilderSection;
  mode?: "create" | "edit";
  countryId?: string;
  onNavigate?: (section: BuilderSection) => void;
}


export const BuilderSectionHero = React.memo(function BuilderSectionHero({
  section,
  mode = "create",
  countryId,
  onNavigate,
}: BuilderSectionHeroProps) {
  const isEditMode = mode === "edit";
  const [showHistory, setShowHistory] = useState(false);

  const { builderState, setBuilderState, submitFn, isSubmittingGlobal, foundationPreviewCountry, setFoundationPreviewCountry } =
    useBuilderContext();
  const foundationFilter = useBuilderFilter();
  const { setHeroHeight } = foundationFilter;

  const heroRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rectHeight = el.getBoundingClientRect().height;
        if (rectHeight > 0) {
          setHeroHeight(rectHeight);
        }
      }
    });

    observer.observe(el);
    const initialHeight = el.getBoundingClientRect().height;
    if (initialHeight > 0) {
      setHeroHeight(initialHeight);
    }

    return () => {
      observer.disconnect();
      setHeroHeight(0);
    };
  }, [setHeroHeight]);

  const searchContainerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(
    !!foundationFilter.searchTerm || foundationFilter.selectedArchetypes.length > 0
  );
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isSearchExpanded && searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        if (!foundationFilter.searchTerm.trim() && foundationFilter.selectedArchetypes.length === 0) {
          setIsSearchExpanded(false);
          setActiveCategory(null);
          foundationFilter.setShowFilters(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSearchExpanded, foundationFilter.searchTerm, foundationFilter.selectedArchetypes]);

  // Focus input when expanded
  React.useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  const { handleContinue } = useBuilderActions({
    builderState,
    setBuilderState,
    mode,
  });

  const namingInputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (foundationFilter.softSelectedCountry) {
      timer = setTimeout(() => {
        if (namingInputRef.current) {
          namingInputRef.current.focus();
          namingInputRef.current.select();
        }
      }, 50);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [foundationFilter.softSelectedCountry]);

  // Get stable foundation country name
  const foundationCountryName = (() => {
    if (builderState.selectedCountry) {
      const c = builderState.selectedCountry;
      const name = c.foundationCountryName || c.name;
      return name.startsWith("New ") ? name.substring(4) : name;
    }
    if (mode === "edit" && builderState.economicInputs?.countryName) {
      return builderState.economicInputs.countryName;
    }
    return null;
  })();

  // On foundation step, use the hovered/selected country flag for the hero background
  const isFoundation = section === "foundation";
  const previewFlag = foundationPreviewCountry?.flag || foundationPreviewCountry?.flagUrl;
  const rawFlagUrl = isFoundation
    ? previewFlag || builderState.economicInputs?.flagUrl || builderState.selectedCountry?.flag
    : builderState.economicInputs?.flagUrl || builderState.selectedCountry?.flag;
  // Upgrade thumbnail flags (flagcdn.com/w320) to high-res for hero background
  const countryFlagUrl = rawFlagUrl?.replace("flagcdn.com/w320/", "flagcdn.com/w1280/");

  const steps = isEditMode
    ? ["identity", "government", "economics", "preview"]
    : ["foundation", "identity", "government", "economics", "preview"];

  return (
    <motion.div
      ref={heroRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "sticky top-0 z-[6000] overflow-hidden rounded-b-xl shadow-lg shadow-black/20 transition-all duration-300",
        isFoundation ? "border border-white/20 dark:border-white/10" : "glass-surface glass-refraction glass-edge backdrop-blur-xl"
      )}
      style={isFoundation ? DYNAMIC_ISLAND_STYLE : undefined}
    >
      {/* Top Right Version Badge */}
      <div className="absolute top-3 right-3 z-30 pointer-events-none select-none">
        <span className="rounded border border-white/10 dark:border-white/5 bg-black/25 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground/80 backdrop-blur-sm shadow-sm">
          v{BUILDER_VERSION}
        </span>
      </div>
      {/* Dynamic Island background glow and glass physical layers for the entire card */}
      {isFoundation && <DynamicIslandEffects />}

      {/* Background Flag & Texture Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {countryFlagUrl && (isFoundation ? foundationPreviewCountry : true) && (
          <div
            className={cn(
              "absolute inset-0 bg-center bg-no-repeat bg-cover saturate-50 transition-all duration-700",
              isFoundation ? "opacity-40" : "opacity-[0.08] blur-[2px]"
            )}
            style={{ backgroundImage: `url(${countryFlagUrl})` }}
          />
        )}
        <TextureOverlay texture="paperGrain" opacity={0.09} className="mix-blend-overlay" />
        <TextureOverlay texture="diagonal" opacity={0.06} className="mix-blend-overlay" />
      </div>

      {/* Spacer to clear Dynamic Island */}
      <div className="h-12 lg:h-16" />

      {section !== "import" && (
        <div 
          className={cn(
            "relative z-10 w-full overflow-hidden transition-all duration-300",
            isFoundation ? "" : "border-t border-border/30 bg-black/0"
          )}
        >

          <div className="relative z-10 flex w-full items-center justify-between gap-3 px-4 py-2.5">
            {foundationFilter.softSelectedCountry ? (
              <div className="flex min-w-0 w-full flex-grow flex-1 items-center gap-3">
                <input
                  ref={namingInputRef}
                  autoFocus
                  type="text"
                  value={foundationFilter.newCountryName}
                  onChange={(e) => foundationFilter.setNewCountryName(e.target.value)}
                  placeholder="Name your nation..."
                  className="h-12 min-w-0 w-full flex-[12] rounded-lg border-2 border-white/20 bg-white/5 backdrop-blur-md px-5 text-base font-bold text-foreground placeholder-muted-foreground focus:border-blue-500/50 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200"
                />
                <button
                  onClick={() => {
                    foundationFilter.clearSelection();
                    setFoundationPreviewCountry(null);
                  }}
                  className="flex h-12 shrink-0 cursor-pointer items-center rounded-lg border border-white/10 bg-white/5 px-5 text-xs font-bold text-muted-foreground backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10 hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={() => foundationFilter.confirmHandlerRef.current?.()}
                  disabled={!foundationFilter.newCountryName.trim()}
                  className="flex h-12 shrink-0 cursor-pointer items-center rounded-lg bg-blue-500/20 border border-blue-500/30 backdrop-blur-sm px-6 text-xs font-bold text-foreground shadow-sm transition-all hover:bg-blue-600/30 dark:hover:bg-blue-500/30 hover:border-blue-500/40 dark:hover:border-blue-500/30 hover:text-foreground hover:shadow-md hover:shadow-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="flex w-full items-center gap-3">
                {/* Left column: Spacer matching the desktop sidebar nav + spacing + padding */}
                <div className="hidden lg:block shrink-0" style={{ width: "264px" }} />
                <div className="block lg:hidden shrink-0" style={{ width: "16px" }} />

                {/* Center column: Search Island Area */}
                <div className="flex-1 flex justify-center items-center min-w-0">
                  {!foundationFilter.selectedTemplate && (
                    <AnimatePresence initial={false} mode="wait">
                       {!isSearchExpanded ? (
                        <motion.div
                          key="collapsed"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          onClick={() => setIsSearchExpanded(true)}
                          className="flex h-9 w-[180px] cursor-pointer items-center justify-center gap-2 rounded-full border border-white/10 dark:border-white/5 bg-black/25 px-3.5 text-xs text-muted-foreground transition-all hover:bg-black/40 hover:border-white/20 shadow-md backdrop-blur-sm"
                        >
                          <Search className="h-4 w-4 shrink-0 text-muted-foreground dark:text-zinc-300" />
                          <span className="text-sm text-muted-foreground dark:text-white select-none">
                            Search countries...
                          </span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="expanded"
                          ref={searchContainerRef}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          className={cn(
                            "flex flex-col w-full rounded-xl border transition-all duration-200 shadow-md overflow-hidden",
                            isSearchFocused
                              ? "border-blue-500/40 bg-black/35 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                              : "border-white/10 dark:border-white/5 bg-black/20 hover:border-white/20"
                          )}
                        >
                          <div className="relative z-10 flex h-9 items-center gap-2 px-3">
                            {/* Inline Filters Toggle */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                foundationFilter.toggleFilters();
                              }}
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                                foundationFilter.showFilters
                                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                  : "hover:bg-white/10 text-muted-foreground hover:text-foreground"
                              )}
                              title="Toggle filters"
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                            </button>

                            <Search className="h-4 w-4 shrink-0 text-muted-foreground dark:text-zinc-300" />
                            
                            <input
                              ref={searchInputRef}
                              type="text"
                              placeholder="Search countries..."
                              value={foundationFilter.searchTerm}
                              onChange={(e) => foundationFilter.setSearchTerm(e.target.value)}
                              onFocus={() => setIsSearchFocused(true)}
                              onBlur={() => setIsSearchFocused(false)}
                              className="placeholder:text-muted-foreground dark:placeholder:text-zinc-300 flex-1 bg-transparent text-sm outline-none text-foreground dark:text-white"
                            />

                            {foundationFilter.searchTerm && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  foundationFilter.setSearchTerm("");
                                  searchInputRef.current?.focus();
                                }}
                                className="hover:bg-white/10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors"
                                title="Clear search"
                              >
                                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                              </button>
                            )}

                            {/* Inline Clear All */}
                            {(foundationFilter.searchTerm || foundationFilter.selectedArchetypes.length > 0) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  foundationFilter.handleClearFilters();
                                  setActiveCategory(null);
                                }}
                                className="hover:bg-white/10 px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                title="Clear all"
                              >
                                Clear All
                              </button>
                            )}
                          </div>

                          {/* Archetype Filters Panel */}
                          <AnimatePresence>
                            {foundationFilter.showFilters && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="overflow-hidden border-t px-3 py-3 relative z-10"
                                style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
                              >
                                {/* Active category toggle */}
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                  {consolidatedCategories.map((cat) => {
                                    const catArchetypes = getArchetypesByConsolidatedCategory(cat.id);
                                    const selectedInCategory = foundationFilter.selectedArchetypes.filter((id) =>
                                      catArchetypes.some((a) => a.id === id)
                                    );
                                    const isCatActive = activeCategory === cat.id;

                                    return (
                                      <button
                                        key={cat.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveCategory(isCatActive ? null : cat.id);
                                        }}
                                        className={cn(
                                          "rounded-md border px-2.5 py-1 text-xs font-medium transition-all flex items-center gap-1.5",
                                          isCatActive
                                            ? "text-foreground border-blue-400/50 bg-blue-500/15"
                                            : "border-border/50 text-muted-foreground bg-transparent hover:border-blue-400/30"
                                        )}
                                      >
                                        <span>{cat.name}</span>
                                        {selectedInCategory.length > 0 && (
                                          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[8px] font-bold text-white">
                                            {selectedInCategory.length}
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Archetype Options in active category */}
                                <AnimatePresence mode="wait">
                                  {activeCategory && (
                                    <motion.div
                                      key={activeCategory}
                                      initial={{ opacity: 0, y: -5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -5 }}
                                      transition={{ duration: 0.15 }}
                                      className="flex flex-wrap gap-1.5 rounded-lg bg-black/10 p-2 border border-border/20"
                                    >
                                      {getArchetypesByConsolidatedCategory(activeCategory).map((archetype) => {
                                        const isSelected = foundationFilter.selectedArchetypes.includes(archetype.id);
                                        const Icon = archetype.icon;

                                        return (
                                          <button
                                            key={archetype.id}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const isSel = foundationFilter.selectedArchetypes.includes(archetype.id);
                                              if (isSel) {
                                                foundationFilter.setSelectedArchetypes(
                                                  foundationFilter.selectedArchetypes.filter((id) => id !== archetype.id)
                                                );
                                              } else {
                                                foundationFilter.setSelectedArchetypes([
                                                  ...foundationFilter.selectedArchetypes,
                                                  archetype.id,
                                                ]);
                                              }
                                            }}
                                            className={cn(
                                              "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-all",
                                              isSelected
                                                ? "text-foreground border-blue-400/50 bg-blue-500/15"
                                                : "border-border/50 text-muted-foreground bg-transparent hover:border-blue-400/30"
                                            )}
                                          >
                                            {Icon && <Icon className={cn("h-3.5 w-3.5", archetype.color)} />}
                                            <span>{archetype.name}</span>
                                          </button>
                                        );
                                      })}
                                    </motion.div>
                                  )}
                                </AnimatePresence>

                                {/* Selected Filters chips summary */}
                                {foundationFilter.selectedArchetypes.length > 0 && (
                                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t pt-2 border-border/10">
                                    <span className="text-[10px] text-muted-foreground font-medium">Selected Archetypes:</span>
                                    {foundationFilter.selectedArchetypes.map((id) => {
                                      const archetype = archetypes.find((a) => a.id === id);
                                      if (!archetype) return null;
                                      const Icon = archetype.icon;
                                      return (
                                        <button
                                          key={id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            foundationFilter.setSelectedArchetypes(
                                              foundationFilter.selectedArchetypes.filter((x) => x !== id)
                                            );
                                          }}
                                          className="flex items-center gap-1 rounded-full border border-blue-400/50 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
                                        >
                                          {Icon && <Icon className="h-3 w-3" />}
                                          <span>{archetype.name}</span>
                                          <X className="h-2.5 w-2.5" />
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>

                {/* Right column: Spacer matching right sidebar + spacing + padding, containing Continue button */}
                <div className="shrink-0 flex justify-end items-center" style={{ width: "360px" }}>
                  <button
                    onClick={handleContinue}
                    className="flex h-6 cursor-pointer items-center gap-1 rounded border border-border/30 bg-black/40 px-2.5 text-[9px] font-bold text-foreground transition-all hover:bg-black/60 hover:border-border/60 shadow-md shadow-black/20"
                  >
                    <span className="hidden sm:inline">Continue</span>
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Autosave History Panel */}
      {isEditMode && countryId && (
        <AutosaveHistoryPanel
          countryId={countryId}
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </motion.div>
  );
});
