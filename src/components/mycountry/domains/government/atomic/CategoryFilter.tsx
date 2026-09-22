"use client";

/**
 * Category Filter
 *
 * Horizontal row of capsule tabs for filtering components by category.
 * Refactored to align with premium glassmorphism and tactile active states.
 *
 * @module CategoryFilter
 */

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Check } from "iconoir-react";
import { cn } from "~/lib/utils";

export interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string | null;
  onChange: (category: string | null) => void;
  categoryCounts?: Record<string, number>;
  selectedCategories?: Set<string>;
}

/**
 * Filter components by category with horizontal capsule pills and active glow states
 */
export const CategoryFilter = React.memo<CategoryFilterProps>(
  ({ categories, selectedCategory, onChange, categoryCounts = {}, selectedCategories }) => {
    const totalCount = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);

    const filterItems = [
      { id: null, label: "All Categories", count: totalCount },
      ...categories.map((cat) => ({
        id: cat,
        label: cat,
        count: categoryCounts[cat] ?? 0,
      })),
    ];

    // Theme color mappings matching the section accents
    const categoryColors: Record<string, { active: string; border: string }> = {
      all: {
        active: "text-cyan-400 border-cyan-500/40 bg-cyan-500/10",
        border:
          "border-border/60 bg-card/45 text-muted-foreground hover:text-cyan-600 hover:border-cyan-500/20 hover:bg-cyan-500/5 dark:border-white/5 dark:bg-white/[0.02] dark:text-muted-foreground dark:hover:text-cyan-400 dark:hover:border-cyan-500/30 dark:hover:bg-cyan-500/10",
      },
      governance: {
        active: "text-amber-400 border-amber-500/40 bg-amber-500/10",
        border:
          "border-border/60 bg-card/45 text-muted-foreground hover:text-amber-600 hover:border-amber-500/20 hover:bg-amber-500/5 dark:border-white/5 dark:bg-white/[0.02] dark:text-muted-foreground dark:hover:text-amber-400 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10",
      },
      administration: {
        active: "text-indigo-400 border-indigo-500/40 bg-indigo-500/10",
        border:
          "border-border/60 bg-card/45 text-muted-foreground hover:text-indigo-600 hover:border-indigo-500/20 hover:bg-indigo-500/5 dark:border-white/5 dark:bg-white/[0.02] dark:text-muted-foreground dark:hover:text-indigo-400 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10",
      },
      economic: {
        active: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
        border:
          "border-border/60 bg-card/45 text-muted-foreground hover:text-emerald-600 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:border-white/5 dark:bg-white/[0.02] dark:text-muted-foreground dark:hover:text-emerald-400 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10",
      },
      process: {
        active: "text-blue-400 border-blue-500/40 bg-blue-500/10",
        border:
          "border-border/60 bg-card/45 text-muted-foreground hover:text-blue-600 hover:border-blue-500/20 hover:bg-blue-500/5 dark:border-white/5 dark:bg-white/[0.02] dark:text-muted-foreground dark:hover:text-blue-400 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10",
      },
    };

    return (
      <div
        onWheel={(e) => {
          if (e.deltaY !== 0 && !e.deltaX) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
        className="flex w-full items-center gap-1.5 overflow-x-auto pb-2 pt-0.5 scrollbar-thin scrollbar-thumb-border/40 hover:scrollbar-thumb-border/70 scrollbar-track-transparent scroll-smooth touch-pan-x select-none"
      >
        {filterItems.map((item) => {
          const isSelected = selectedCategory === item.id;
          const key = item.id || "all";
          const colors = categoryColors[key] || categoryColors.all;
          const hasSelection = item.id !== null && selectedCategories?.has(item.id.toLowerCase());

          return (
            <button
              key={key}
              onClick={() => onChange(item.id)}
              className={cn(
                "relative flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1 text-[10px] font-bold tracking-wider uppercase shadow-xs backdrop-blur-md transition-all duration-200",
                isSelected
                  ? `${colors.active} shadow-sm`
                  : hasSelection
                    ? "border-dashed border-zinc-300 bg-zinc-100/10 text-zinc-400 opacity-60 hover:text-zinc-500 hover:opacity-100 dark:border-zinc-800/50 dark:bg-zinc-950/20 dark:text-zinc-500 dark:hover:text-zinc-400"
                    : colors.border
              )}
            >
              {hasSelection && (
                <Check
                  className={cn(
                    "h-3 w-3 shrink-0 transition-colors duration-200",
                    isSelected ? "text-current" : "text-zinc-400 dark:text-zinc-500"
                  )}
                />
              )}
              <span className="capitalize">{item.label}</span>
              {item.count > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    "flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full border-transparent px-1.5 py-0 text-[9px] font-bold",
                    isSelected
                      ? "bg-white/10 text-current"
                      : hasSelection
                        ? "bg-zinc-200/40 text-zinc-400 dark:bg-zinc-800/30 dark:text-zinc-600"
                        : "bg-white/5 text-zinc-500"
                  )}
                >
                  {item.count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    );
  }
);

CategoryFilter.displayName = "CategoryFilter";
