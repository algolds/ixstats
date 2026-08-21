/**
 * Atomic Selector Workspace (Plan 166)
 *
 * Domain-agnostic layout shell providing:
 * - Search bar and category tab selection
 * - Main component grid (rendered via children or item slot)
 * - Optional selected-items slot or sidebar
 */

"use client";

import React from "react";
import { Search } from "lucide-react";
import { cn } from "~/lib/utils";

export interface CategoryOption {
  id: string;
  name: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface AtomicSelectorWorkspaceProps {
  categories?: CategoryOption[];
  activeCategory?: string | null;
  onSelectCategory?: (categoryId: string) => void;

  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;

  headerActions?: React.ReactNode;
  selectedSidebarSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AtomicSelectorWorkspace({
  categories = [],
  activeCategory,
  onSelectCategory,
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "Search components...",
  headerActions,
  selectedSidebarSlot,
  children,
  className,
}: AtomicSelectorWorkspaceProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Search & Category Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Category Pill Filters */}
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategory?.(cat.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-secondary/60 text-secondary-foreground hover:bg-secondary"
                  )}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  <span>{cat.name}</span>
                  {typeof cat.count === "number" && (
                    <span className="opacity-70">({cat.count})</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Search Bar & Header Actions */}
        <div className="flex items-center gap-2">
          {onSearchChange && (
            <div className="relative min-w-[200px] flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-input bg-background/50 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
          {headerActions}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className={cn("grid gap-4", selectedSidebarSlot ? "lg:grid-cols-3" : "grid-cols-1")}>
        <div className={cn(selectedSidebarSlot ? "lg:col-span-2" : "col-span-1")}>
          {children}
        </div>
        {selectedSidebarSlot && (
          <div className="lg:col-span-1">{selectedSidebarSlot}</div>
        )}
      </div>
    </div>
  );
}
