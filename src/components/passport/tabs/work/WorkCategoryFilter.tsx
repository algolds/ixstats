"use client";

import React from "react";
import { cn } from "~/lib/utils";

export type WorkCategory = "articles" | "languages" | "directives" | "sports" | "feed";

/** `all` pins every category; `null` is the unpinned default (also shows everything). */
export type WorkCategoryFilterValue = WorkCategory | "all" | null;

const CATEGORIES: Array<{ id: WorkCategory; label: string }> = [
  { id: "articles", label: "Authored Pages" },
  { id: "languages", label: "Languages" },
  { id: "directives", label: "Directives" },
  { id: "sports", label: "Clubs" },
  { id: "feed", label: "Activity Stream" },
];

function pillClass(active: boolean) {
  return cn(
    "cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.97]",
    active
      ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-950"
      : "hover:text-foreground text-stone-600 dark:text-stone-400"
  );
}

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
      <div className="flex max-w-fit flex-wrap items-center gap-1.5 rounded-2xl border border-black/6 bg-black/[0.02] p-1 dark:border-white/8 dark:bg-white/[0.02]">
        <button
          type="button"
          onClick={() => onSelect(selected === "all" ? null : "all")}
          aria-pressed={selected === "all"}
          data-cuelume-press="soft"
          className={pillClass(selected === "all")}
        >
          All Work ({total})
        </button>
        {CATEGORIES.filter((category) => counts[category.id] > 0).map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            aria-pressed={selected === category.id}
            data-cuelume-press="soft"
            className={pillClass(selected === category.id)}
          >
            {category.label} ({counts[category.id]})
          </button>
        ))}
      </div>

      {showSearch && (
        <div className="w-full sm:w-56">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search work & articles..."
            className="text-foreground placeholder:text-muted-foreground w-full rounded-xl border border-black/8 bg-black/[0.02] px-3 py-1.5 font-mono text-xs focus:ring-1 focus:ring-blue-500/40 focus:outline-none dark:border-white/10 dark:bg-white/[0.03]"
          />
        </div>
      )}
    </div>
  );
});
