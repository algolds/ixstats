/**
 * Category Filter
 *
 * Filter economic components by category with visual category selector.
 * Optimized with React.memo for performance.
 */

"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { COMPONENT_CATEGORIES, type EconomicCategory } from "~/lib/atomic-economic-data";

export interface CategoryFilterProps {
  category: EconomicCategory | null;
  setCategory: (category: EconomicCategory | null) => void;
  componentCounts?: Record<string, number>;
}

/**
 * Category Filter Component
 */
function CategoryFilterComponent({
  category,
  setCategory,
  componentCounts = {},
}: CategoryFilterProps) {
  const categories = Object.values(COMPONENT_CATEGORIES);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700">Filter by Category</h4>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={category === null ? "default" : "outline"}
          onClick={() => setCategory(null)}
        >
          All Components
        </Button>
        {categories.map((cat) => {
          const Icon = cat.icon;
          const count = componentCounts[cat.name] || 0;
          const isActive = category === cat.name;

          return (
            <Button
              key={cat.name}
              size="sm"
              variant={isActive ? "default" : "outline"}
              onClick={() => setCategory(cat.name as EconomicCategory)}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              {cat.name}
              {count > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export const CategoryFilter = React.memo(CategoryFilterComponent);
