/**
 * Category Filter
 *
 * Dropdown/tabs for filtering components by category.
 * Optimized with React.memo for performance.
 *
 * @module CategoryFilter
 */

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Filter } from "lucide-react";

export interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string | null;
  onChange: (category: string | null) => void;
  categoryCounts?: Record<string, number>;
}

/**
 * Filter components by category with component counts
 */
export const CategoryFilter = React.memo<CategoryFilterProps>(
  ({ categories, selectedCategory, onChange, categoryCounts = {} }) => {
    return (
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <Select
          value={selectedCategory ?? "all"}
          onValueChange={(value) => onChange(value === "all" ? null : value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex w-full items-center justify-between gap-2">
                <span>All Categories</span>
                {Object.values(categoryCounts).reduce((sum, count) => sum + count, 0) > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {Object.values(categoryCounts).reduce((sum, count) => sum + count, 0)}
                  </Badge>
                )}
              </div>
            </SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="capitalize">{category}</span>
                  {categoryCounts[category] && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {categoryCounts[category]}
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
);

CategoryFilter.displayName = "CategoryFilter";
