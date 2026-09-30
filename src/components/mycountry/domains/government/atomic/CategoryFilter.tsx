"use client";

/**
 * Category Filter
 *
 * Horizontal row of toggle pills for filtering components by category.
 *
 * @module CategoryFilter
 */

import React from "react";
import { Toggle } from "~/components/ui/toggle";
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
 * Filter components by category with a scrollable row of toggle pills
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

    return (
      <div
        onWheel={(e) => {
          if (e.deltaY !== 0 && !e.deltaX) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
        className="scrollbar-thumb-border/40 hover:scrollbar-thumb-border/70 flex w-full touch-pan-x scrollbar-thin scrollbar-track-transparent items-center gap-1.5 overflow-x-auto pt-0.5 pb-2 select-none"
      >
        {filterItems.map((item) => {
          const isSelected = selectedCategory === item.id;
          const key = item.id || "all";
          const hasSelection = item.id !== null && selectedCategories?.has(item.id.toLowerCase());

          return (
            <Toggle
              key={key}
              variant="outline"
              size="sm"
              pressed={isSelected}
              onPressedChange={() => onChange(item.id)}
              className={cn(
                "shrink-0 rounded-full px-3",
                hasSelection && !isSelected && "border-dashed"
              )}
            >
              {hasSelection && <Check aria-hidden="true" className="h-3 w-3 shrink-0" />}
              <span className="capitalize">{item.label}</span>
              {item.count > 0 && (
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {item.count}
                </span>
              )}
            </Toggle>
          );
        })}
      </div>
    );
  }
);

CategoryFilter.displayName = "CategoryFilter";
