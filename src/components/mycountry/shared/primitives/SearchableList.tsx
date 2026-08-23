"use client";

import React, { useMemo, useState } from "react";
import { NavArrowDown as ChevronDown, NavArrowRight as ChevronRight, Search, MailIn as Inbox } from "iconoir-react";

export interface SearchableListProps<T> {
  /** Section title shown in the header (e.g. "Cities"). */
  title: string;
  /** Optional icon shown next to the title. */
  icon?: React.ReactNode;
  /** Accent for the count badge — tailwind text/bg class pair. */
  accent?: {
    badge: string;
    ring: string;
  };
  /** Full list of items. */
  items: T[];
  /** Keys searched against (case-insensitive substring match). */
  searchKeys: (keyof T | ((item: T) => string))[];
  /** Render a single item. */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Optional wrapper class for each rendered item. */
  itemClassName?: string;
  /** Default state when items.length > this threshold: collapsed. */
  collapseThreshold?: number;
  /** Empty-state message when there are zero items (before search). */
  emptyMessage?: string;
  /** Empty-state message when search filters everything out. */
  noMatchMessage?: string;
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
  /** When false, hide the search input entirely. */
  searchable?: boolean;
  /** Class for the outer wrapper. */
  className?: string;
}

const DEFAULT_ACCENT = {
  badge: "bg-blue-600/20 text-blue-500",
  ring: "ring-blue-500/30",
};

/**
 * SearchableList — collapsible + searchable list primitive.
 *
 * Used by the MyCountry Geography page (and any other section that needs
 * a long, filterable, expandable list). Default state is expanded when
 * the list is small (≤ threshold) and collapsed when it grows, so the
 * page stays scannable for big countries without sacrificing one-click
 * access for small ones.
 */
export function SearchableList<T>({
  title,
  icon,
  accent = DEFAULT_ACCENT,
  items,
  searchKeys,
  renderItem,
  itemClassName = "",
  collapseThreshold = 5,
  emptyMessage = "No items yet.",
  noMatchMessage = "No matches.",
  searchPlaceholder = "Search…",
  searchable = true,
  className = "",
}: SearchableListProps<T>) {
  const [open, setOpen] = useState(items.length <= collapseThreshold);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      searchKeys.some((key) => {
        const value = typeof key === "function" ? key(item) : (item as any)[key];
        return typeof value === "string" && value.toLowerCase().includes(q);
      })
    );
  }, [items, query, searchKeys]);

  const isEmpty = items.length === 0;
  const isFilteredEmpty = !isEmpty && filtered.length === 0;

  return (
    <div className={`border-border bg-card/30 overflow-hidden rounded-lg border ${className}`}>
      {/* Header (click to collapse) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-accent/30 flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          {open ? (
            <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
          )}
          {icon}
          {title}
        </span>
        <span
          className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium ${accent.badge}`}
        >
          {items.length}
        </span>
      </button>

      {/* Body */}
      {open && (
        <div className="space-y-2 px-3 pb-3">
          {searchable && !isEmpty && (
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="border-border bg-background/60 w-full rounded border py-1 pr-2 pl-7 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {isEmpty && (
            <div className="text-muted-foreground flex items-center justify-center gap-1.5 py-4 text-[11px]">
              <Inbox className="h-3 w-3" />
              {emptyMessage}
            </div>
          )}

          {isFilteredEmpty && (
            <div className="text-muted-foreground flex items-center justify-center gap-1.5 py-4 text-[11px]">
              <Inbox className="h-3 w-3" />
              {noMatchMessage}
            </div>
          )}

          {!isEmpty && !isFilteredEmpty && (
            <div className="space-y-2">
              {filtered.map((item, index) => (
                <div key={(item as any).id ?? index} className={itemClassName}>
                  {renderItem(item, index)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
