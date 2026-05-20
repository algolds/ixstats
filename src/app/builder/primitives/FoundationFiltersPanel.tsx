"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  archetypes,
  consolidatedCategories,
  getArchetypesByConsolidatedCategory,
  type CategorizedCountryArchetype,
  type ConsolidatedCategory,
} from "../utils/country-archetypes";
import type { RealCountryData } from "../lib/economy-data-service";

const STORAGE_KEY = "builder_filters_panel_collapsed";

interface FoundationFiltersPanelProps {
  countries: RealCountryData[];
  selectedArchetypes: string[];
  onArchetypeSelect: (archetypeIds: string[]) => void;
  filteredCount?: number;
}

export function FoundationFiltersPanel({
  countries,
  selectedArchetypes,
  onArchetypeSelect,
  filteredCount,
}: FoundationFiltersPanelProps) {
  // Persisted collapse state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "true";
  });

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  // Instant collapse on filter selection
  const handleFilterSelect = useCallback(
    (archetypeId: string) => {
      const isSelected = selectedArchetypes.includes(archetypeId);

      if (isSelected) {
        // Deselect
        onArchetypeSelect(selectedArchetypes.filter((id) => id !== archetypeId));
      } else {
        // Select and collapse panel
        onArchetypeSelect([...selectedArchetypes, archetypeId]);
        setIsCollapsed(true);
        setActiveCategory(null);
      }
    },
    [selectedArchetypes, onArchetypeSelect]
  );

  // Clear all filters
  const handleClearAll = useCallback(() => {
    onArchetypeSelect([]);
  }, [onArchetypeSelect]);

  // Get archetypes grouped by consolidated category
  const archetypesByCategory = useMemo(() => {
    const map = new Map<string, CategorizedCountryArchetype[]>();
    consolidatedCategories.forEach((cat) => {
      map.set(cat.id, getArchetypesByConsolidatedCategory(cat.id));
    });
    return map;
  }, []);

  // Count matches for each archetype
  const archetypeMatchCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const filteredCountries = countries.filter((c) => c.name !== "World");

    archetypes.forEach((archetype) => {
      const matchCount = filteredCountries.filter((country) => archetype.filter(country)).length;
      counts.set(archetype.id, matchCount);
    });

    return counts;
  }, [countries]);

  // Get selected archetypes info for chips
  const selectedArchetypeInfo = useMemo(() => {
    return selectedArchetypes
      .map((id) => archetypes.find((a) => a.id === id))
      .filter(Boolean) as CategorizedCountryArchetype[];
  }, [selectedArchetypes]);

  // Toggle category dropdown
  const toggleCategory = (categoryId: string) => {
    setActiveCategory((prev) => (prev === categoryId ? null : categoryId));
  };

  return (
    <>
      <div
        ref={panelRef}
        className={cn(
          "relative rounded-xl border border-emerald-500/20 bg-[var(--color-bg-secondary)]/80 backdrop-blur-sm",
          "transition-all duration-300 ease-out"
        )}
      >
        {/* Header - Always visible */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3",
            !isCollapsed && "border-b border-emerald-500/10"
          )}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Quick Filters
            </span>
            {filteredCount !== undefined && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                {filteredCount} countries
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Selected filter chips (when collapsed) */}
            {isCollapsed && selectedArchetypeInfo.length > 0 && (
              <div className="flex items-center gap-1.5">
                {selectedArchetypeInfo.slice(0, 3).map((archetype) => (
                  <button
                    key={archetype.id}
                    onClick={() => handleFilterSelect(archetype.id)}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                      "bg-emerald-500/20 border border-emerald-500/50 text-emerald-300",
                      "hover:bg-emerald-500/30 transition-colors"
                    )}
                  >
                    {archetype.name}
                    <X className="h-3 w-3" />
                  </button>
                ))}
                {selectedArchetypeInfo.length > 3 && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    +{selectedArchetypeInfo.length - 3} more
                  </span>
                )}
              </div>
            )}

            {/* Clear all button */}
            {selectedArchetypes.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Clear
              </button>
            )}

            {/* Expand/Collapse toggle */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Expandable filter content */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ 
                height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
                opacity: { duration: 0.2, ease: "easeOut" }
              }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-2">
                {/* Category tabs */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {consolidatedCategories.map((category) => {
                    const categoryArchetypes = archetypesByCategory.get(category.id) || [];
                    const selectedInCategory = selectedArchetypes.filter((id) =>
                      categoryArchetypes.some((a) => a.id === id)
                    );

                    return (
                      <button
                        key={category.id}
                        onClick={() => toggleCategory(category.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                          activeCategory === category.id
                            ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-300"
                            : "bg-[var(--color-bg-tertiary)] border border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/80 hover:text-[var(--color-text-primary)]"
                        )}
                      >
                        {category.name}
                        {selectedInCategory.length > 0 && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
                            {selectedInCategory.length}
                          </span>
                        )}
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            activeCategory === category.id && "rotate-180"
                          )}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Active category dropdown */}
                <AnimatePresence mode="wait">
                  {activeCategory && (
                    <motion.div
                      key={activeCategory}
                      initial={{ height: 0, opacity: 0, y: -8 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0, y: -8 }}
                      transition={{ 
                        height: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
                        opacity: { duration: 0.15 },
                        y: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
                      }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap gap-2 rounded-lg bg-[var(--color-bg-tertiary)]/50 p-3">
                        {(archetypesByCategory.get(activeCategory) || []).map((archetype) => {
                          const isSelected = selectedArchetypes.includes(archetype.id);
                          const matchCount = archetypeMatchCounts.get(archetype.id) || 0;
                          const Icon = archetype.icon;

                          return (
                            <button
                              key={archetype.id}
                              onClick={() => handleFilterSelect(archetype.id)}
                              className={cn(
                                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all",
                                isSelected
                                  ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-300"
                                  : "bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/50 text-[var(--color-text-secondary)] hover:border-emerald-500/30 hover:text-[var(--color-text-primary)]"
                              )}
                            >
                              <Icon className={cn("h-4 w-4", archetype.color)} />
                              <span>{archetype.name}</span>
                              <span
                                className={cn(
                                  "text-xs",
                                  isSelected
                                    ? "text-emerald-400/80"
                                    : "text-[var(--color-text-muted)]"
                                )}
                              >
                                ({matchCount})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Selected filters summary (when expanded and has selections) */}
                {selectedArchetypeInfo.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)]">Active:</span>
                    {selectedArchetypeInfo.map((archetype) => {
                      const Icon = archetype.icon;
                      return (
                        <button
                          key={archetype.id}
                          onClick={() => handleFilterSelect(archetype.id)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
                            "bg-emerald-500/20 border border-emerald-500/50 text-emerald-300",
                            "hover:bg-emerald-500/30 transition-colors"
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {archetype.name}
                          <X className="h-3 w-3" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
