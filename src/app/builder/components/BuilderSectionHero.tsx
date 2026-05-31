"use client";

import React, { useState } from "react";
import { Search, SlidersHorizontal, ArrowRight, X, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useBuilderActions } from "../hooks/useBuilderActions";
import { type BuilderSection } from "../lib/builder-theme";
import { BUILDER_VERSION } from "~/lib/buildVersion";
import { AutosaveHistoryPanel } from "~/components/builder/AutosaveHistoryPanel";
import { cn } from "~/lib/utils";
import { BuilderWelcomeModal } from "./BuilderWelcomeModal";
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
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  React.useEffect(() => {
    if (isEditMode) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const seen = localStorage.getItem("mycountry-builder-welcome-seen");
      if (!seen || seen !== "1.0") {
        timer = setTimeout(() => setWelcomeOpen(true), 800);
      }
    } catch {}
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isEditMode]);

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
  const showContinueButton = !isFoundation || !!foundationFilter.selectedTemplate;
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
          ? "border border-white/20 dark:border-white/10 h-14"
          : "glass-surface glass-refraction glass-edge backdrop-blur-xl",
        "lg:ml-[248px]",
        isFoundation ? "lg:mr-[344px]" : "lg:mr-[16px]"
      )}
      style={isFoundation ? DYNAMIC_ISLAND_STYLE : undefined}
    >
      {/* Top Right Version Badge & Help Button */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 select-none">
        <span className="text-muted-foreground/80 rounded border border-white/10 bg-black/25 px-1.5 py-0.5 text-[9px] font-bold shadow-sm backdrop-blur-sm dark:border-white/5">
          v{BUILDER_VERSION}
        </span>
        <button
          onClick={() => setWelcomeOpen(true)}
          className="cursor-pointer rounded-full p-0.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-amber-400"
          title="Open Welcome Guide"
          type="button"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Builder Welcome Screen Modal */}
      <BuilderWelcomeModal open={welcomeOpen} onOpenChange={setWelcomeOpen} />
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
      <div className={cn("transition-all duration-300", isFoundation ? "h-6 lg:h-8" : "h-10 lg:h-12")} />

      {section !== "import" && !isFoundation && (
        <div
          className={cn(
            "relative z-10 w-full overflow-hidden transition-all duration-300",
            isFoundation ? "" : "border-border/30 border-t bg-black/0"
          )}
        >
          <div className="relative z-10 flex w-full items-center justify-between gap-3 px-4 py-1.5">
            {foundationFilter.softSelectedCountry ? (
              <div className="flex w-full min-w-0 flex-1 flex-grow items-center gap-3">
                <input
                  ref={namingInputRef}
                  autoFocus
                  type="text"
                  value={foundationFilter.newCountryName}
                  onChange={(e) => foundationFilter.setNewCountryName(e.target.value)}
                  placeholder="Name your nation..."
                  className="text-foreground placeholder-muted-foreground h-10 w-full min-w-0 flex-[12] rounded-lg border border-white/20 bg-white/5 px-4 text-sm font-bold shadow-[0_1.5px_3px_rgba(0,0,0,0.04)] backdrop-blur-md transition-all duration-200 hover:shadow-xs focus:border-blue-500/50 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:shadow-[0_1.5px_3px_rgba(0,0,0,0.2)]"
                />
                <button
                  onClick={() => {
                    foundationFilter.clearSelection();
                    setFoundationPreviewCountry(null);
                  }}
                  className="flex h-10 shrink-0 cursor-pointer items-center rounded-lg border border-zinc-300 bg-white/90 px-4 text-xs font-bold text-zinc-700 shadow-sm transition-all hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => foundationFilter.confirmHandlerRef.current?.()}
                  disabled={!foundationFilter.newCountryName.trim()}
                  className="flex h-10 shrink-0 cursor-pointer items-center rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-5 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-yellow-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="flex w-full items-center gap-3">
                {/* Left column: Spacer to balance Continue button and center search */}
                <div
                  className="hidden shrink-0 transition-all duration-300 lg:block"
                  style={{
                    width: !showContinueButton
                      ? "0px"
                      : isSearchExpanded
                        ? "24px"
                        : "120px",
                  }}
                />
                <div
                  className="block shrink-0 transition-all duration-300 lg:hidden"
                  style={{ width: showContinueButton ? "8px" : "0px" }}
                />

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
                    <motion.div
                      ref={searchContainerRef}
                      layout
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      onClick={() => {
                        if (!isSearchExpanded) {
                          setIsSearchExpanded(true);
                        }
                      }}
                      className={cn(
                        "flex flex-col overflow-hidden rounded-xl border shadow-md transition-all duration-300",
                        isSearchExpanded
                          ? "w-full max-w-[480px] cursor-default"
                          : "h-9 w-[180px] cursor-pointer",
                        isSearchExpanded
                          ? isSearchFocused
                            ? "border-blue-500/40 bg-white/95 shadow-[0_0_15px_rgba(59,130,246,0.15)] dark:bg-black/35"
                            : "border-zinc-200 bg-zinc-50/80 hover:border-zinc-300 dark:border-zinc-800 dark:bg-black/20 dark:hover:border-zinc-700/80"
                          : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 hover:bg-zinc-100/80 dark:border-zinc-800 dark:bg-black/25 dark:hover:bg-black/40"
                      )}
                    >
                      <div className="relative z-10 flex h-9 items-center gap-2 px-3">
                        {/* Inline Filters Toggle */}
                        <AnimatePresence>
                          {isSearchExpanded && (
                            <motion.button
                              initial={{ opacity: 0, width: 0, scale: 0.8 }}
                              animate={{ opacity: 1, width: 28, scale: 1 }}
                              exit={{ opacity: 0, width: 0, scale: 0.8 }}
                              transition={{ type: "spring", stiffness: 350, damping: 25 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                foundationFilter.toggleFilters();
                              }}
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md transition-colors",
                                foundationFilter.showFilters
                                  ? "border border-blue-500/30 bg-blue-500/15 text-blue-500 dark:text-blue-400"
                                  : "dark:text-muted-foreground dark:hover:text-foreground text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-white/10"
                              )}
                              title="Toggle filters"
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                            </motion.button>
                          )}
                        </AnimatePresence>

                        <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-300" />

                        <input
                          ref={searchInputRef}
                          type="text"
                          placeholder="Search countries..."
                          value={isSearchExpanded ? foundationFilter.searchTerm : ""}
                          onChange={(e) => {
                            if (isSearchExpanded) {
                              foundationFilter.setSearchTerm(e.target.value);
                            }
                          }}
                          onFocus={() => {
                            if (isSearchExpanded) {
                              setIsSearchFocused(true);
                            }
                          }}
                          onBlur={() => setIsSearchFocused(false)}
                          readOnly={!isSearchExpanded}
                          className={cn(
                            "flex-1 bg-transparent text-sm text-zinc-800 transition-all duration-250 outline-none placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-300",
                            isSearchExpanded ? "cursor-text" : "cursor-pointer select-none"
                          )}
                        />

                        <AnimatePresence>
                          {isSearchExpanded && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.15 }}
                              className="flex items-center gap-1.5"
                            >
                              {foundationFilter.searchTerm && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    foundationFilter.setSearchTerm("");
                                    searchInputRef.current?.focus();
                                  }}
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-zinc-200 dark:hover:bg-white/10"
                                  title="Clear search"
                                >
                                  <X className="dark:text-muted-foreground dark:hover:text-foreground h-3 w-3 text-zinc-400 hover:text-zinc-600" />
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
                                  className="dark:text-muted-foreground dark:hover:text-foreground shrink-0 rounded-md px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-white/10"
                                  title="Clear all"
                                >
                                  Clear All
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Archetype Filters Panel */}
                      <AnimatePresence>
                        {isSearchExpanded && foundationFilter.showFilters && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="relative z-10 overflow-hidden border-t border-zinc-200 px-3 py-3 dark:border-zinc-800/60"
                          >
                            {/* Active category toggle */}
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {consolidatedCategories.map((cat) => {
                                const catArchetypes = getArchetypesByConsolidatedCategory(cat.id);
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
                                        ? "border-blue-300 bg-blue-50/50 text-blue-600 dark:border-blue-400/50 dark:bg-blue-500/15 dark:text-white"
                                        : "border-zinc-200 bg-zinc-50/30 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-800 dark:bg-transparent dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white"
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
                                  className="flex flex-wrap gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-800/40 dark:bg-zinc-900/40"
                                >
                                  {getArchetypesByConsolidatedCategory(activeCategory).map(
                                    (archetype) => {
                                      const isSelected =
                                        foundationFilter.selectedArchetypes.includes(archetype.id);
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
                                              ? "border-blue-300 bg-blue-50/50 text-blue-600 dark:border-blue-400/50 dark:bg-blue-500/15 dark:text-white"
                                              : "border-zinc-200 bg-white/60 text-zinc-600 hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-800/80 dark:bg-transparent dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white"
                                          )}
                                        >
                                          {Icon && (
                                            <Icon className={cn("h-3.5 w-3.5", archetype.color)} />
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
                              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-zinc-200 pt-2 dark:border-zinc-800/60">
                                <span className="dark:text-muted-foreground text-[10px] font-medium text-zinc-500">
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
                                      className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
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
                </div>

                {/* Right column: Spacer containing Continue button */}
                <div
                  className="flex shrink-0 items-center justify-end transition-all duration-300 overflow-hidden"
                  style={{ width: showContinueButton ? "120px" : "0px" }}
                >
                  {showContinueButton && (
                    <button
                      onClick={handleContinue}
                      className="flex h-7 cursor-pointer items-center gap-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-3 text-[11px] font-bold text-zinc-950 shadow-md shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-yellow-400"
                    >
                      <span>Continue</span>
                      <ArrowRight className="h-3 w-3 text-zinc-950" />
                    </button>
                  )}
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
