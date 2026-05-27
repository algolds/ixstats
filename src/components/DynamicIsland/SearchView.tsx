import React, { useEffect, useRef } from "react";
import { ScrollArea } from "../ui/scroll-area";
import { Search, X, ChevronRight } from "lucide-react";
import { SimpleFlag } from "../SimpleFlag";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import type { SearchViewProps, SearchFilter } from "./types";

const FILTERS: { value: SearchFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "wiki", label: "Wiki" },
  { value: "countries", label: "Countries" },
  { value: "commands", label: "Commands" },
  { value: "features", label: "Features" },
];

const TYPE_COLORS: Record<string, string> = {
  country: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  wiki: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  command: "bg-green-500/10 text-green-600 dark:text-green-400",
  feature: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

export function SearchView({
  searchQuery,
  setSearchQuery,
  searchFilter,
  setSearchFilter,
  debouncedSearchQuery,
  searchResults,
  countriesData,
  closeDropdown,
}: SearchViewProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-4">
      {/* ── Search input ───────────────────────────────────────────── */}
      <div className="relative mb-3">
        <Search className="text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          ref={searchInputRef}
          type="text"
          tabIndex={0}
          placeholder={`Search ${searchFilter === "all" ? "everything" : searchFilter}…`}
          value={searchQuery || ""}
          onChange={(e) => setSearchQuery?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              if (searchQuery) {
                setSearchQuery?.("");
              } else {
                closeDropdown();
              }
            }
          }}
          className="bg-accent/10 text-foreground placeholder:text-muted-foreground/50 focus:bg-accent/15 w-full rounded-lg border border-transparent py-2 pr-14 pl-9 text-sm transition-all focus:border-blue-500/30 focus:outline-none"
          data-command-palette-search="true"
          autoFocus
        />
        <div className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1.5">
          <kbd className="bg-muted/60 text-muted-foreground/60 hidden rounded px-1.5 py-0.5 text-[10px] font-medium md:inline">
            ⌘K
          </kbd>
        </div>
        {/* Close */}
        <button
          onClick={closeDropdown}
          className="text-muted-foreground hover:text-foreground absolute -top-0.5 -right-0.5 flex h-5 w-5 translate-x-full items-center justify-center rounded-md transition-colors"
          aria-label="Close search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Filter pills ──────────────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-1">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSearchFilter?.(value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              searchFilter === value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Results ───────────────────────────────────────────────── */}
      <ScrollArea className="max-h-80">
        {searchResults && searchResults.length > 0 ? (
          <div className="space-y-0.5">
            {searchResults.map((result) => (
              <button
                key={result.id}
                onClick={result.action}
                className="hover:bg-accent/10 group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
              >
                {/* Icon */}
                <div className="bg-accent/10 group-hover:bg-accent/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors">
                  {result.type === "country" && result.metadata?.countryName ? (
                    <SimpleFlag
                      countryName={result.metadata.countryName}
                      className="h-3.5 w-5 rounded-sm object-cover"
                      showPlaceholder={true}
                    />
                  ) : (
                    result.icon && <result.icon className="h-4 w-4" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground truncate text-sm font-medium">
                      {result.title}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_COLORS[result.type] ?? ""}`}
                    >
                      {result.type}
                    </span>
                  </div>
                  {result.description && (
                    <div className="text-muted-foreground/70 truncate text-xs">
                      {result.description}
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight className="text-muted-foreground/30 group-hover:text-muted-foreground/60 h-3.5 w-3.5 shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        ) : debouncedSearchQuery ? (
          /* ── No results ─────────────────────────────────────────── */
          <div className="py-10 text-center">
            <Search className="text-muted-foreground/30 mx-auto mb-3 h-8 w-8" />
            <div className="text-muted-foreground text-sm font-medium">No results</div>
            <div className="text-muted-foreground/60 mt-1 text-xs">
              Nothing found for &ldquo;{debouncedSearchQuery}&rdquo;
              {searchFilter !== "all" && (
                <>
                  {" "}
                  in {searchFilter}.{" "}
                  <button
                    onClick={() => setSearchFilter?.("all")}
                    className="text-primary hover:underline"
                  >
                    Search all
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* ── Empty state ────────────────────────────────────────── */
          <div className="py-10 text-center">
            <div className="text-muted-foreground/60 mb-3 text-sm">
              Type to search{" "}
              {searchFilter === "all" ? "countries, commands, and features" : searchFilter}
            </div>
            <div className="text-muted-foreground/40 flex items-center justify-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <kbd className="bg-muted/50 rounded px-1.5 py-0.5">⌘K</kbd> search
              </span>
              <span className="text-muted-foreground/20">·</span>
              <span className="flex items-center gap-1">
                <kbd className="bg-muted/50 rounded px-1.5 py-0.5">Tab</kbd> filter
              </span>
              <span className="text-muted-foreground/20">·</span>
              <span className="flex items-center gap-1">
                <kbd className="bg-muted/50 rounded px-1.5 py-0.5">Esc</kbd> close
              </span>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
