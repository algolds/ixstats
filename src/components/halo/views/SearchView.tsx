import React, { useEffect, useRef } from "react";
import { Search, Xmark, NavArrowRight } from "iconoir-react";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import type { SearchViewProps, SearchFilter } from "../types";
import { PreText } from "~/components/ui/pretext";
import { soundEffects } from "~/lib/sound/cuelume";

const FILTERS: { value: SearchFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "wiki", label: "Wiki" },
  { value: "countries", label: "Countries" },
  { value: "commands", label: "Commands" },
  { value: "features", label: "Features" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Statecraft: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  Vault: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20",
  Geography: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  Knowledge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  Community: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
  Sports: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  Labs: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
  System: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20",
  Country: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  Wiki: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20",
};

function SearchViewComponent({
  searchQuery,
  setSearchQuery,
  searchFilter,
  setSearchFilter,
  debouncedSearchQuery,
  searchResults,
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
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
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
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery?.("")}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 p-1"
            >
              <Xmark className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="mb-3 flex items-center gap-1 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              soundEffects.tick();
              setSearchFilter?.(f.value);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              searchFilter === f.value
                ? "bg-foreground text-background shadow-xs"
                : "bg-accent/10 text-muted-foreground hover:bg-accent/20 hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results list */}
      <div
        className="max-h-[380px] space-y-1 overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        {searchResults.length > 0 ? (
          searchResults.map((result) => {
            const Icon = result.icon;
            const cat =
              (result.metadata?.category as string) ||
              (result.type === "country" ? "Country" : "Command");
            const badgeStyle =
              CATEGORY_COLORS[cat] || "bg-muted text-muted-foreground";

            return (
              <button
                key={result.id}
                onClick={() => {
                  soundEffects.press();
                  result.action();
                  closeDropdown();
                }}
                className="hover:bg-accent/15 group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all"
              >
                {/* Icon or Flag */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/5 dark:bg-white/5">
                  {result.type === "country" && result.metadata?.flagUrl ? (
                    <UnifiedCountryFlag
                      flagUrl={result.metadata.flagUrl as string}
                      countryName={result.title}
                      className="h-5 w-7 rounded object-cover shadow-xs"
                    />
                  ) : Icon ? (
                    <Icon className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
                  ) : (
                    <Search className="text-muted-foreground/60 h-4 w-4" />
                  )}
                </div>

                {/* Title + description */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <PreText
                      className="text-foreground group-hover:text-blue-500 dark:group-hover:text-blue-400 block truncate text-sm font-medium transition-colors"
                      whiteSpace="nowrap"
                    >
                      {result.title}
                    </PreText>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeStyle}`}
                    >
                      {cat}
                    </span>
                  </div>
                  {result.description && (
                    <PreText
                      className="text-muted-foreground block truncate text-xs"
                      whiteSpace="nowrap"
                    >
                      {result.description}
                    </PreText>
                  )}
                </div>

                {/* Arrow */}
                <NavArrowRight className="text-muted-foreground/30 group-hover:text-muted-foreground/80 h-4 w-4 shrink-0 transition-colors" />
              </button>
            );
          })
        ) : debouncedSearchQuery ? (
          /* ── No results ─────────────────────────────────────────── */
          <div className="py-8 text-center">
            <Search className="text-muted-foreground/40 mx-auto mb-2 h-8 w-8" />
            <div className="text-muted-foreground/80 text-sm">
              <PreText className="inline" whiteSpace="nowrap">
                {`Nothing found for "${debouncedSearchQuery}"${searchFilter !== "all" ? ` in ${searchFilter}.` : ""}`}
              </PreText>
              {searchFilter !== "all" && (
                <button
                  onClick={() => setSearchFilter?.("all")}
                  className="text-primary hover:underline ml-1 font-medium"
                >
                  <PreText className="inline" whiteSpace="nowrap">
                    Search all
                  </PreText>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ── Empty state ────────────────────────────────────────── */
          <div className="py-10 text-center">
            <PreText className="text-muted-foreground/80 mb-3 text-sm" whiteSpace="nowrap">
              {`Type to search ${searchFilter === "all" ? "countries, commands, and features" : searchFilter}`}
            </PreText>
            <div className="text-muted-foreground/65 flex items-center justify-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <kbd className="bg-muted/50 rounded px-1.5 py-0.5">⌘K</kbd>
                <PreText className="w-auto text-inherit" whiteSpace="nowrap">
                  search
                </PreText>
              </span>
              <span className="text-muted-foreground/30">·</span>
              <span className="flex items-center gap-1">
                <kbd className="bg-muted/50 rounded px-1.5 py-0.5">Tab</kbd>
                <PreText className="w-auto text-inherit" whiteSpace="nowrap">
                  filter
                </PreText>
              </span>
              <span className="text-muted-foreground/20">·</span>
              <span className="flex items-center gap-1">
                <kbd className="bg-muted/50 rounded px-1.5 py-0.5">Esc</kbd>
                <PreText className="w-auto text-inherit" whiteSpace="nowrap">
                  close
                </PreText>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const SearchView = React.memo(SearchViewComponent);
