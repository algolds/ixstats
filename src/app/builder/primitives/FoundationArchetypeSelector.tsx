"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Sparkles, ChevronDown, ChevronRight, Check, Plus } from "lucide-react";
import { cn } from "~/lib/utils";
import { EnhancedTooltip, InfoIcon } from "~/components/ui/enhanced-tooltip";
import { GlassCard as EnhancedGlassCard } from "~/components/ui/enhanced-card";
import {
  archetypes,
  archetypeCategories,
  type CategorizedCountryArchetype,
} from "../utils/country-archetypes";
import type { RealCountryData } from "../lib/economy-data-service";

interface FoundationArchetypeSelectorProps {
  countries: RealCountryData[];
  selectedArchetypes: string[]; // Changed to array for multi-selection
  onArchetypeSelect: (archetypeIds: string[]) => void; // Changed to handle array
  onCreateFromScratch?: () => void;
}

export function FoundationArchetypeSelector({
  countries,
  selectedArchetypes,
  onArchetypeSelect,
  onCreateFromScratch,
}: FoundationArchetypeSelectorProps) {
  const filteredCountries = countries.filter((c) => c.name !== "World");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(archetypeCategories.map((category) => category.id))
  );

  // Group archetypes by category
  const archetypesByCategory = useMemo(() => {
    const grouped = new Map<string, CategorizedCountryArchetype[]>();

    archetypeCategories.forEach((category) => {
      grouped.set(category.id, []);
    });

    archetypes.forEach((archetype) => {
      const categoryArchetypes = grouped.get(archetype.categoryId) || [];
      categoryArchetypes.push(archetype);
      grouped.set(archetype.categoryId, categoryArchetypes);
    });

    // Sort within each category by priority
    grouped.forEach((categoryArchetypes) => {
      categoryArchetypes.sort((a, b) => a.priority - b.priority);
    });

    return grouped;
  }, []);

  // Handle multi-selection with constraints
  const handleArchetypeToggle = (archetypeId: string) => {
    if (archetypeId === "all") {
      // Special case for "all" - clear all selections
      onArchetypeSelect([]);
      return;
    }

    const archetype = archetypes.find((a) => a.id === archetypeId);
    if (!archetype) return;

    const isCurrentlySelected = selectedArchetypes.includes(archetypeId);

    if (isCurrentlySelected) {
      // Remove the archetype
      const newSelection = selectedArchetypes.filter((id) => id !== archetypeId);
      onArchetypeSelect(newSelection);
    } else {
      // Add the archetype, but check category limits
      const categoryCount = selectedArchetypes.filter((id) => {
        const a = archetypes.find((arch) => arch.id === id);
        return a?.categoryId === archetype.categoryId;
      }).length;

      if (categoryCount >= 2) {
        // Already at limit for this category, don't add
        return;
      }

      const newSelection = [...selectedArchetypes, archetypeId];
      onArchetypeSelect(newSelection);
    }
  };

  // Auto-expand categories when archetypes are selected in them
  useEffect(() => {
    const categoriesToExpand = new Set<string>();
    selectedArchetypes.forEach((archetypeId) => {
      const archetype = archetypes.find((a) => a.id === archetypeId);
      if (archetype) {
        categoriesToExpand.add(archetype.categoryId);
      }
    });

    if (categoriesToExpand.size > 0) {
      setCollapsedCategories((prev) => {
        const newSet = new Set(prev);
        categoriesToExpand.forEach((categoryId) => newSet.delete(categoryId));
        return newSet;
      });
    }
  }, [selectedArchetypes]);

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Check if category has selected archetypes and count them
  const categorySelectionInfo = (categoryId: string) => {
    const selectedInCategory = selectedArchetypes.filter((archetypeId) => {
      const archetype = archetypes.find((a) => a.id === archetypeId);
      return archetype?.categoryId === categoryId;
    });

    return {
      hasSelection: selectedInCategory.length > 0,
      count: selectedInCategory.length,
      selectedIds: selectedInCategory,
    };
  };

  return (
    <div className="fixed top-6 bottom-6 left-6 z-30 w-80">
      <EnhancedGlassCard variant="glass" glow="hover" hover="glow" className="flex h-full flex-col">
        <div className="flex-shrink-0 border-b border-[var(--color-border-primary)]/50 p-6">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-300" />
            <h3 className="font-semibold text-[var(--color-text-primary)]">
              Foundation Archetypes
            </h3>
            <EnhancedTooltip
              content="Pre-defined categories to help you find countries that match your vision"
              position="top"
            >
              <InfoIcon />
            </EnhancedTooltip>
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-6">
          <div
            className="h-full overflow-y-auto pr-2"
            data-scrollable="true"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "var(--color-border-secondary) transparent",
            }}
          >
            <div className="space-y-6">
              {/* Action Cards Grid */}
              <div className="grid grid-cols-1 gap-3">
                {/* All Countries */}
                <EnhancedTooltip content="View all available countries" position="right">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleArchetypeToggle("all")}
                    className={cn(
                      "w-full rounded-lg border p-4 transition-all duration-300",
                      "bg-gradient-to-br from-[var(--color-bg-secondary)]/20 to-[var(--color-bg-tertiary)]/20",
                      "hover:shadow-lg hover:shadow-blue-500/20 hover:backdrop-blur-md",
                      selectedArchetypes.length === 0
                        ? "border-blue-400/50 bg-blue-500/20 shadow-lg shadow-blue-500/30"
                        : "border-[var(--color-border-primary)] hover:border-[var(--color-border-secondary)]"
                    )}
                  >
                    <Globe className="mx-auto mb-3 h-8 w-8 text-blue-400" />
                    <div className="mb-1 text-2xl font-bold text-[var(--color-text-primary)]">
                      {filteredCountries.length}
                    </div>
                    <div className="text-sm text-[var(--color-text-secondary)]">All Countries</div>
                  </motion.button>
                </EnhancedTooltip>

                {/* Create from Scratch */}
                <EnhancedTooltip
                  content={
                    <div className="space-y-2">
                      <div className="font-medium">Create from Scratch</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        Start with a blank slate and build your nation entirely from custom values
                      </div>
                    </div>
                  }
                  position="right"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onCreateFromScratch?.()}
                    className={cn(
                      "w-full rounded-lg border p-4 transition-all duration-300",
                      "bg-gradient-to-br from-amber-500/20 to-yellow-500/10",
                      "hover:shadow-lg hover:shadow-amber-500/20 hover:backdrop-blur-md",
                      "border-[var(--color-border-primary)] hover:border-amber-400/50"
                    )}
                  >
                    <Plus className="mx-auto mb-3 h-8 w-8 text-amber-400" />
                    <div className="mb-1 text-lg font-bold text-amber-400">Create New</div>
                    <div className="text-sm text-[var(--color-text-secondary)]">
                      Create a new country
                    </div>
                  </motion.button>
                </EnhancedTooltip>
              </div>

              {/* Categories */}
              {archetypeCategories
                .filter((category) => category.isActive)
                .sort((a, b) => a.priority - b.priority)
                .map((category) => {
                  const categoryArchetypes = archetypesByCategory.get(category.id) || [];
                  const isCollapsed = collapsedCategories.has(category.id);
                  const selectionInfo = categorySelectionInfo(category.id);

                  return (
                    <div key={category.id} className="space-y-2">
                      {/* Category Header */}
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg p-2 transition-all duration-200",
                          "hover:bg-[var(--color-bg-secondary)]/20 hover:backdrop-blur-sm",
                          selectionInfo.hasSelection && "bg-[var(--color-bg-secondary)]/10"
                        )}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
                        )}
                        <span className={cn("text-sm font-medium", category.color)}>
                          {category.name}
                        </span>
                        {selectionInfo.hasSelection && (
                          <div className="ml-1 flex items-center gap-1">
                            <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs text-green-400">
                              {selectionInfo.count}/2
                            </span>
                            <Check className="h-3 w-3 text-green-400" />
                          </div>
                        )}
                        <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                          {categoryArchetypes.length}
                        </span>
                      </button>

                      {/* Category Archetypes */}
                      <AnimatePresence>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-2 pl-6"
                          >
                            {categoryArchetypes.map((archetype) => {
                              const Icon = archetype.icon;
                              const count = filteredCountries.filter(archetype.filter).length;
                              const isSelected = selectedArchetypes.includes(archetype.id);
                              const categoryCount = selectedArchetypes.filter((id) => {
                                const a = archetypes.find((arch) => arch.id === id);
                                return a?.categoryId === archetype.categoryId;
                              }).length;
                              const isAtLimit = categoryCount >= 2 && !isSelected;

                              return (
                                <EnhancedTooltip
                                  key={archetype.id}
                                  content={
                                    <div className="space-y-2">
                                      <div className="font-medium">{archetype.name}</div>
                                      <div className="text-sm text-[var(--color-text-secondary)]">
                                        {archetype.description}
                                      </div>
                                      <div className="text-xs text-[var(--color-text-muted)]">
                                        {count} countries match
                                      </div>
                                      {isAtLimit && (
                                        <div className="text-xs text-amber-400">
                                          Max 2 per category (limit reached)
                                        </div>
                                      )}
                                    </div>
                                  }
                                  position="right"
                                >
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() =>
                                      !isAtLimit && handleArchetypeToggle(archetype.id)
                                    }
                                    disabled={isAtLimit}
                                    className={cn(
                                      "w-full rounded-lg border p-3 text-left transition-all duration-300",
                                      `bg-gradient-to-br ${archetype.gradient}`,
                                      "hover:shadow-lg hover:backdrop-blur-md",
                                      isSelected
                                        ? "bg-opacity-30 border-current shadow-lg ring-2 shadow-current/30 ring-current/20"
                                        : "border-[var(--color-border-primary)] hover:border-[var(--color-border-secondary)] hover:shadow-[var(--color-border-secondary)]/20",
                                      isAtLimit && "cursor-not-allowed opacity-50 hover:scale-100"
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <Icon
                                        className={cn("h-5 w-5 flex-shrink-0", archetype.color)}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={cn("text-sm font-medium", archetype.color)}
                                          >
                                            {count}
                                          </span>
                                          <span className="truncate text-xs text-[var(--color-text-secondary)]">
                                            {archetype.name}
                                          </span>
                                          {isSelected && (
                                            <Check className="ml-auto h-3 w-3 text-green-400" />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </motion.button>
                                </EnhancedTooltip>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </EnhancedGlassCard>
    </div>
  );
}
