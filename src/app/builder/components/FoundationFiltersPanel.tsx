"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  Filter,
  Globe,
  TrendingUp,
  Building2,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Users,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { safeGetItemSync, safeSetItemSync } from "~/lib/localStorageMutex";
import {
  archetypes,
  consolidatedCategories,
  // eslint-disable-next-line unused-imports/no-unused-imports
  type ConsolidatedCategory,
} from "../utils/country-archetypes";

interface FoundationFiltersPanelProps {
  selectedArchetypes: string[];
  onArchetypeSelect: (archetypeIds: string[]) => void;
  onStartFromScratch: () => void;
  totalCountries: number;
  filteredCount: number;
  className?: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  "economy-size": TrendingUp,
  region: Globe,
  government: Building2,
};

const STORAGE_KEY = "builder_filters_panel_collapsed";

export function FoundationFiltersPanel({
  selectedArchetypes,
  onArchetypeSelect,
  onStartFromScratch,
  totalCountries,
  filteredCount,
  className,
}: FoundationFiltersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    const collapsed = safeGetItemSync(STORAGE_KEY);
    if (collapsed === "true") {
      setIsExpanded(false);
    }
  }, []);

  // Toggle archetype selection
  const handleArchetypeToggle = useCallback(
    (archetypeId: string) => {
      const isSelected = selectedArchetypes.includes(archetypeId);
      let newSelection: string[];

      if (isSelected) {
        newSelection = selectedArchetypes.filter((id) => id !== archetypeId);
      } else {
        newSelection = [...selectedArchetypes, archetypeId];
      }

      onArchetypeSelect(newSelection);

      // Instant collapse after selection
      if (!isSelected && newSelection.length > 0) {
        setIsExpanded(false);
        safeSetItemSync(STORAGE_KEY, "true");
      }
    },
    [selectedArchetypes, onArchetypeSelect]
  );

  // Clear all filters
  const handleClearAll = useCallback(() => {
    onArchetypeSelect([]);
  }, [onArchetypeSelect]);

  // Toggle panel expansion
  const handleToggleExpand = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    safeSetItemSync(STORAGE_KEY, newExpanded ? "false" : "true");
  }, [isExpanded]);

  // Handle start from scratch
  const handleStartFromScratch = useCallback(() => {
    setShowConfirmDialog(true);
  }, []);

  const handleConfirmScratch = useCallback(() => {
    setShowConfirmDialog(false);
    onStartFromScratch();
  }, [onStartFromScratch]);

  // Get archetypes for a category
  const getArchetypesForCategory = (categoryId: string) => {
    return archetypes.filter((a) => a.consolidatedCategoryId === categoryId);
  };

  // Get selected archetype names for summary
  const selectedArchetypeNames = selectedArchetypes
    .map((id) => archetypes.find((a) => a.id === id)?.name)
    .filter(Boolean);

  const hasFilters = selectedArchetypes.length > 0;

  return (
    <>
      <div
        className={cn(
          "border-border bg-card/60 mb-4 overflow-hidden rounded-xl border backdrop-blur-md transition-all duration-300",
          className
        )}
      >
        {/* Collapsed Summary Bar */}
        {!isExpanded && (
          <div className="flex items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-emerald-500" />
              <span className="text-muted-foreground text-sm font-medium">
                {hasFilters ? (
                  <>
                    Showing {filteredCount} of {totalCountries} countries
                  </>
                ) : (
                  <>All {totalCountries} countries</>
                )}
              </span>
            </div>

            {/* Selected filters as chips */}
            {hasFilters && (
              <div className="flex flex-1 items-center gap-2 overflow-x-auto">
                {selectedArchetypeNames.slice(0, 3).map((name) => (
                  <span
                    key={name}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                  >
                    {name}
                  </span>
                ))}
                {selectedArchetypeNames.length > 3 && (
                  <span className="text-muted-foreground shrink-0 text-xs">
                    +{selectedArchetypeNames.length - 3} more
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-muted-foreground hover:text-foreground h-7 text-xs"
                >
                  Clear
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartFromScratch}
                className="h-7 gap-1.5 border-emerald-500/30 text-xs text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400"
              >
                <Sparkles className="h-3 w-3" />
                Start Fresh
              </Button>
              <Button variant="ghost" size="icon" onClick={handleToggleExpand} className="h-7 w-7">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Expanded Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="border-border/50 flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-semibold">Quick Filters</span>
                  <span className="text-muted-foreground text-xs">
                    ({filteredCount} of {totalCountries} countries)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                      className="text-muted-foreground hover:text-foreground h-7 text-xs"
                    >
                      Clear All
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleExpand}
                    className="h-7 w-7"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Filter Categories */}
              <div className="space-y-4 p-4">
                {consolidatedCategories.map((category) => {
                  const CategoryIcon = CATEGORY_ICONS[category.id] || Filter;
                  const categoryArchetypes = getArchetypesForCategory(category.id);

                  return (
                    <div key={category.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CategoryIcon className={cn("h-4 w-4", category.color)} />
                        <span className="text-muted-foreground text-xs font-medium">
                          {category.name}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {categoryArchetypes.map((archetype) => {
                          const isSelected = selectedArchetypes.includes(archetype.id);
                          const Icon = archetype.icon;

                          return (
                            <button
                              key={archetype.id}
                              onClick={() => handleArchetypeToggle(archetype.id)}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150",
                                isSelected
                                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                  : "border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:border-emerald-500/30 hover:bg-emerald-500/10"
                              )}
                            >
                              <Icon className="h-3 w-3" />
                              {archetype.name}
                              {isSelected && <X className="h-3 w-3 opacity-60" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Start from Scratch */}
                <div className="border-border/50 border-t pt-4">
                  <button
                    onClick={handleStartFromScratch}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:from-emerald-600 hover:to-teal-600 hover:shadow-emerald-500/30"
                  >
                    <Sparkles className="h-4 w-4" />
                    Start from Scratch — Build a completely custom nation
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              Start with a blank slate?
            </DialogTitle>
            <DialogDescription>
              You'll create your nation entirely from scratch with no pre-filled data. You can
              always come back to Foundation later if you change your mind.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmScratch}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600"
            >
              Continue to Identity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default FoundationFiltersPanel;
