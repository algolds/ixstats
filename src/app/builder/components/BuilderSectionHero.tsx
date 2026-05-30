"use client";

import React, { useState } from "react";
import { Search, SlidersHorizontal, ArrowRight, X } from "lucide-react";
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

  const {
    builderState,
    setBuilderState,
    submitFn,
    isSubmittingGlobal,
    foundationPreviewCountry,
    setFoundationPreviewCountry,
  } = useBuilderContext();
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
      if (
        isSearchExpanded &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        if (
          !foundationFilter.searchTerm.trim() &&
          foundationFilter.selectedArchetypes.length === 0
        ) {
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
  const previewFlag =
    foundationPreviewCountry?.flag ||
    foundationPreviewCountry?.flagUrl ||
    foundationFilter.selectedTemplate?.flag ||
    foundationFilter.selectedTemplate?.flagUrl;
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
        isFoundation
          ? "border border-white/20 dark:border-white/10"
          : "glass-surface glass-refraction glass-edge backdrop-blur-xl"
      )}
      style={isFoundation ? DYNAMIC_ISLAND_STYLE : undefined}
    >
      {/* Top Right Version Badge */}
      <div className="pointer-events-none absolute top-3 right-3 z-30 select-none">
        <span className="text-muted-foreground/80 rounded border border-white/10 bg-black/25 px-1.5 py-0.5 text-[9px] font-bold shadow-sm backdrop-blur-sm dark:border-white/5">
          v{BUILDER_VERSION}
        </span>
      </div>
      {/* Dynamic Island background glow and glass physical layers for the entire card */}
      {isFoundation && <DynamicIslandEffects />}

      {/* Background Flag & Texture Overlay */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
        {countryFlagUrl &&
          (isFoundation ? foundationPreviewCountry || foundationFilter.selectedTemplate : true) && (
            <div
              className={cn(
                "absolute inset-0 bg-cover bg-center bg-no-repeat saturate-50 transition-all duration-700",
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
            isFoundation ? "" : "border-border/30 border-t bg-black/0"
          )}
        >
          <div className="relative z-10 flex w-full items-center justify-between gap-3 px-4 py-2.5">
            {foundationFilter.softSelectedCountry ? (
              <div className="flex w-full min-w-0 flex-1 flex-grow items-center gap-3">
                <input
                  ref={namingInputRef}
                  autoFocus
                  type="text"
                  value={foundationFilter.newCountryName}
                  onChange={(e) => foundationFilter.setNewCountryName(e.target.value)}
                  placeholder="Name your nation..."
                  className="text-foreground placeholder-muted-foreground h-12 w-full min-w-0 flex-[12] rounded-lg border-2 border-white/20 bg-white/5 px-5 text-base font-bold shadow-[0_1.5px_3px_rgba(0,0,0,0.04)] backdrop-blur-md transition-all duration-200 hover:shadow-xs focus:border-blue-500/50 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:shadow-[0_1.5px_3px_rgba(0,0,0,0.2)]"
                />
                <button
                  onClick={() => {
                    foundationFilter.clearSelection();
                    setFoundationPreviewCountry(null);
                  }}
                  className="text-muted-foreground hover:text-foreground flex h-12 shrink-0 cursor-pointer items-center rounded-lg border border-white/10 bg-white/5 px-5 text-xs font-bold backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={() => foundationFilter.confirmHandlerRef.current?.()}
                  disabled={!foundationFilter.newCountryName.trim()}
                  className="text-foreground hover:text-foreground flex h-12 shrink-0 cursor-pointer items-center rounded-lg border border-blue-500/30 bg-blue-500/20 px-6 text-xs font-bold shadow-sm backdrop-blur-sm transition-all hover:border-blue-500/40 hover:bg-blue-600/30 hover:shadow-md hover:shadow-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none dark:hover:border-blue-500/30 dark:hover:bg-blue-500/30"
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="flex w-full items-center gap-3">
                {/* Left column: Spacer matching the desktop sidebar nav + spacing + padding */}
                <div className="hidden shrink-0 lg:block" style={{ width: "264px" }} />
                <div className="block shrink-0 lg:hidden" style={{ width: "16px" }} />

                {/* Center column: Search Island Area */}
                <div className="flex min-w-0 flex-1 items-center justify-center">
                  {foundationFilter.selectedTemplate ? (
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3.5 py-1 text-xs shadow-md backdrop-blur-sm dark:border-white/5">
                      {(foundationFilter.selectedTemplate.flag ||
                        foundationFilter.selectedTemplate.flagUrl) && (
                        <div className="h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] border border-white/20">
                          <img
                            src={
                              foundationFilter.selectedTemplate.flag ||
                              foundationFilter.selectedTemplate.flagUrl
                            }
                            alt={`${foundationFilter.selectedTemplate.name} flag`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <span className="text-xs font-bold text-white select-none">
                        {foundationFilter.selectedTemplate.name}
                      </span>
                    </div>
                  ) : (
                    <AnimatePresence initial={false} mode="wait">
                      {!isSearchExpanded ? (
                        <motion.div
                          key="collapsed"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          onClick={() => setIsSearchExpanded(true)}
                          className="text-muted-foreground flex h-9 w-[180px] cursor-pointer items-center justify-center gap-2 rounded-full border border-white/10 bg-black/25 px-3.5 text-xs shadow-md backdrop-blur-sm transition-all hover:border-white/20 hover:bg-black/40 dark:border-white/5"
                        >
                          <Search className="text-muted-foreground h-4 w-4 shrink-0 dark:text-zinc-300" />
                          <span className="text-muted-foreground text-sm select-none dark:text-white">
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
                            "flex w-full flex-col overflow-hidden rounded-xl border shadow-md transition-all duration-200",
                            isSearchFocused
                              ? "border-blue-500/40 bg-black/35 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                              : "border-white/10 bg-black/20 hover:border-white/20 dark:border-white/5"
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
                                  ? "border border-blue-500/30 bg-blue-500/15 text-blue-400"
                                  : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                              )}
                              title="Toggle filters"
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                            </button>

                            <Search className="text-muted-foreground h-4 w-4 shrink-0 dark:text-zinc-300" />

                            <input
                              ref={searchInputRef}
                              type="text"
                              placeholder="Search countries..."
                              value={foundationFilter.searchTerm}
                              onChange={(e) => foundationFilter.setSearchTerm(e.target.value)}
                              onFocus={() => setIsSearchFocused(true)}
                              onBlur={() => setIsSearchFocused(false)}
                              className="placeholder:text-muted-foreground text-foreground flex-1 bg-transparent text-sm outline-none dark:text-white dark:placeholder:text-zinc-300"
                            />

                            {foundationFilter.searchTerm && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  foundationFilter.setSearchTerm("");
                                  searchInputRef.current?.focus();
                                }}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                                title="Clear search"
                              >
                                <X className="text-muted-foreground hover:text-foreground h-3 w-3" />
                              </button>
                            )}

                            {/* Inline Clear All */}
                            {(foundationFilter.searchTerm ||
                              foundationFilter.selectedArchetypes.length > 0) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  foundationFilter.handleClearFilters();
                                  setActiveCategory(null);
                                }}
                                className="text-muted-foreground hover:text-foreground shrink-0 rounded-md px-2 py-1 text-[10px] transition-colors hover:bg-white/10"
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
                                className="relative z-10 overflow-hidden border-t px-3 py-3"
                                style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
                              >
                                {/* Active category toggle */}
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                  {consolidatedCategories.map((cat) => {
                                    const catArchetypes = getArchetypesByConsolidatedCategory(
                                      cat.id
                                    );
                                    const selectedInCategory =
                                      foundationFilter.selectedArchetypes.filter((id) =>
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
                                          "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
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
                                      className="border-border/20 flex flex-wrap gap-1.5 rounded-lg border bg-black/10 p-2"
                                    >
                                      {getArchetypesByConsolidatedCategory(activeCategory).map(
                                        (archetype) => {
                                          const isSelected =
                                            foundationFilter.selectedArchetypes.includes(
                                              archetype.id
                                            );
                                          const Icon = archetype.icon;

                                          return (
                                            <button
                                              key={archetype.id}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const isSel =
                                                  foundationFilter.selectedArchetypes.includes(
                                                    archetype.id
                                                  );
                                                if (isSel) {
                                                  foundationFilter.setSelectedArchetypes(
                                                    foundationFilter.selectedArchetypes.filter(
                                                      (id) => id !== archetype.id
                                                    )
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
                                              {Icon && (
                                                <Icon
                                                  className={cn("h-3.5 w-3.5", archetype.color)}
                                                />
                                              )}
                                              <span>{archetype.name}</span>
                                            </button>
                                          );
                                        }
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>

                                {/* Selected Filters chips summary */}
                                {foundationFilter.selectedArchetypes.length > 0 && (
                                  <div className="border-border/10 mt-2.5 flex flex-wrap items-center gap-1.5 border-t pt-2">
                                    <span className="text-muted-foreground text-[10px] font-medium">
                                      Selected Archetypes:
                                    </span>
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
                                              foundationFilter.selectedArchetypes.filter(
                                                (x) => x !== id
                                              )
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
                <div className="flex shrink-0 items-center justify-end" style={{ width: "360px" }}>
                  <button
                    onClick={handleContinue}
                    className="flex h-7 cursor-pointer items-center gap-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-3 text-[11px] font-bold text-zinc-950 shadow-md shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-yellow-400"
                  >
                    <span>Continue</span>
                    <ArrowRight className="h-3 w-3 text-zinc-950" />
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
