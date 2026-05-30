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
import { Check } from "lucide-react";
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
    const categoryColors: Record<string, { active: string; border: string; glow: string }> = {
      all: {
        active: "text-cyan-400 border-cyan-500/40 bg-cyan-500/10",
        border: "border-slate-200 bg-slate-50/45 text-slate-500 hover:text-cyan-600 hover:border-cyan-500/20 hover:bg-cyan-500/5 dark:border-white/5 dark:bg-white/[0.02] dark:text-zinc-400 dark:hover:text-cyan-400 dark:hover:border-cyan-500/30 dark:hover:bg-cyan-500/10",
        glow: "shadow-[0_0_8px_rgba(6,182,212,0.15)]",
      },
      governance: {
        active: "text-amber-400 border-amber-500/40 bg-amber-500/10",
        border: "border-slate-200 bg-slate-50/45 text-slate-500 hover:text-amber-600 hover:border-amber-500/20 hover:bg-amber-500/5 dark:border-white/5 dark:bg-white/[0.02] dark:text-zinc-400 dark:hover:text-amber-400 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10",
        glow: "shadow-[0_0_8px_rgba(245,158,11,0.15)]",
      },
      administration: {
        active: "text-teal-400 border-teal-500/40 bg-teal-500/10",
        border: "border-slate-200 bg-slate-50/45 text-slate-500 hover:text-teal-600 hover:border-teal-500/20 hover:bg-teal-500/5 dark:border-white/5 dark:bg-white/[0.02] dark:text-zinc-400 dark:hover:text-teal-400 dark:hover:border-teal-500/30 dark:hover:bg-teal-500/10",
        glow: "shadow-[0_0_8px_rgba(20,184,166,0.15)]",
      },
      economic: {
        active: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
        border: "border-slate-200 bg-slate-50/45 text-slate-500 hover:text-emerald-600 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:border-white/5 dark:bg-white/[0.02] dark:text-zinc-400 dark:hover:text-emerald-400 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10",
        glow: "shadow-[0_0_8px_rgba(16,185,129,0.15)]",
      },
      process: {
        active: "text-blue-400 border-blue-500/40 bg-blue-500/10",
        border: "border-slate-200 bg-slate-50/45 text-slate-500 hover:text-blue-600 hover:border-blue-500/20 hover:bg-blue-500/5 dark:border-white/5 dark:bg-white/[0.02] dark:text-zinc-400 dark:hover:text-blue-400 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10",
        glow: "shadow-[0_0_8px_rgba(59,130,246,0.15)]",
      },
    };

    return (
      <div className="flex w-full flex-wrap items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none">
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
                "relative flex items-center gap-2 rounded-full border px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-xs backdrop-blur-md",
                isSelected
                  ? `${colors.active} ${colors.glow} shadow-md`
                  : hasSelection
                  ? "border-dashed border-zinc-300 bg-zinc-100/10 text-zinc-400 dark:border-zinc-800/50 dark:bg-zinc-950/20 dark:text-zinc-500 opacity-60 hover:opacity-100 hover:text-zinc-500 dark:hover:text-zinc-400"
                  : colors.border
              )}
            >
              {hasSelection && (
                <Check className={cn(
                  "h-3 w-3 shrink-0 transition-colors duration-200",
                  isSelected ? "text-current" : "text-zinc-400 dark:text-zinc-500"
                )} />
              )}
              <span className="capitalize">{item.label}</span>
              {item.count > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4.5 min-w-4.5 rounded-full px-1.5 py-0 text-[9px] font-bold border-transparent flex items-center justify-center shrink-0",
                    isSelected
                      ? "bg-white/10 text-current"
                      : hasSelection
                      ? "bg-zinc-200/40 dark:bg-zinc-800/30 text-zinc-400 dark:text-zinc-600"
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
