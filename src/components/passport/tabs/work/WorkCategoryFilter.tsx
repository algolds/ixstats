"use client";

import React from "react";
import { SearchField } from "~/components/ui/search-field";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";

export type WorkCategory = "articles" | "languages" | "directives" | "sports" | "feed";

/** `all` pins every category; `null` is the unpinned default (also shows everything). */
export type WorkCategoryFilterValue = WorkCategory | "all" | null;

const CATEGORIES: Array<{ id: WorkCategory; label: string }> = [
  { id: "articles", label: "Authored pages" },
  { id: "languages", label: "Languages" },
  { id: "directives", label: "Directives" },
  { id: "sports", label: "Clubs" },
  { id: "feed", label: "Activity" },
];

interface WorkCategoryFilterProps {
  selected: WorkCategoryFilterValue;
  onSelect: (category: WorkCategoryFilterValue) => void;
  total: number;
  counts: Record<WorkCategory, number>;
  searchQuery: string;
  onSearch: (query: string) => void;
  showSearch: boolean;
}

export const WorkCategoryFilter = React.memo(function WorkCategoryFilter({
  selected,
  onSelect,
  total,
  counts,
  searchQuery,
  onSearch,
  showSearch,
}: WorkCategoryFilterProps) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <ToggleGroup
        type="single"
        aria-label="Work category"
        size="sm"
        variant="pill"
        value={selected ?? ""}
        onValueChange={(value) => {
          // Pressing "All work" again unpins it; a pressed category stays selected.
          if (value) onSelect(value as WorkCategoryFilterValue);
          else if (selected === "all") onSelect(null);
        }}
        className="flex-wrap"
      >
        <ToggleGroupItem value="all" className="tabular-nums">
          All work ({total})
        </ToggleGroupItem>
        {CATEGORIES.filter((category) => counts[category.id] > 0).map((category) => (
          <ToggleGroupItem key={category.id} value={category.id} className="tabular-nums">
            {category.label} ({counts[category.id]})
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {showSearch && (
        <SearchField
          size="sm"
          value={searchQuery}
          onValueChange={onSearch}
          placeholder="Search work and articles"
          aria-label="Search work and articles"
          containerClassName="w-full sm:w-56"
        />
      )}
    </div>
  );
});
