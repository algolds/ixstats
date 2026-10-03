import React, { useEffect, useRef } from "react";
import { Search, Xmark, NavArrowRight } from "iconoir-react";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import type { SearchViewProps, SearchFilter } from "../types";
import { PreText } from "~/components/ui/pretext";
import { Button } from "~/components/ui/button";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { SegmentedControl } from "~/components/ui/segmented-control";

const FILTERS: { value: SearchFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "wiki", label: "Wiki" },
  { value: "countries", label: "Countries" },
  { value: "commands", label: "Commands" },
  { value: "features", label: "Features" },
];

/** Result category → Badge colour (system colours; the wiki uses its own ink tint). */
const CATEGORY_BADGE: Record<string, BadgeVariant> = {
  Statecraft: "warning",
  Vault: "info",
  Geography: "success",
  Knowledge: "info",
  Community: "info",
  Sports: "warning",
  Labs: "secondary",
  System: "default",
  Country: "info",
  Wiki: "secondary",
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

  // Auto-focus on mount with RAF + fallback
  useEffect(() => {
    const focusInput = () => {
      if (searchInputRef.current && document.activeElement !== searchInputRef.current) {
        searchInputRef.current.focus();
      }
    };
    const rafId = requestAnimationFrame(focusInput);
    const timer = setTimeout(focusInput, 60);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-label-tertiary pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
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
            className="text-label placeholder:text-label-tertiary rounded-row border-separator bg-fill-4 text-body focus-visible:outline-tint w-full border py-2 pr-14 pl-9 transition-[color,background-color,border-color,box-shadow,opacity,transform] outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            data-command-palette-search="true"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setSearchQuery?.("")}
              aria-label="Clear search"
              className="text-label-secondary hover:text-label absolute top-1/2 right-2 -translate-y-1/2"
            >
              <Xmark aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <SegmentedControl
        aria-label="Search in"
        size="sm"
        className="mb-3"
        value={searchFilter}
        onValueChange={(value) => setSearchFilter?.(value)}
        options={FILTERS}
      />

      {/* Results list */}
      <div className="max-h-[380px] space-y-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {searchResults.length > 0 ? (
          searchResults.map((result) => {
            const Icon = result.icon;
            const cat =
              (result.metadata?.category as string) ||
              (result.type === "country" ? "Country" : "Command");
            const badgeVariant = CATEGORY_BADGE[cat] ?? "default";

            return (
              <button
                type="button"
                key={result.id}
                onClick={() => {
                  result.action();
                  closeDropdown();
                }}
                className="group rounded-row hover:bg-fill-3 focus-visible:outline-tint flex w-full items-center gap-3 p-3 text-left select-none focus-visible:outline-2"
              >
                {/* Icon or Flag */}
                <div className="rounded-control bg-fill-4 flex h-9 w-9 shrink-0 items-center justify-center">
                  {result.type === "country" && result.metadata?.flagUrl ? (
                    <UnifiedCountryFlag
                      flagUrl={result.metadata.flagUrl as string}
                      countryName={result.title}
                      className="rounded-control-sm h-5 w-7 object-cover"
                    />
                  ) : Icon ? (
                    <Icon className="text-label-secondary group-hover:text-label h-4 w-4 transition-colors" />
                  ) : (
                    <Search className="text-label-tertiary h-4 w-4" />
                  )}
                </div>

                {/* Title + description */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <PreText
                      className="text-label text-body group-hover:text-tint block truncate font-medium transition-colors"
                      whiteSpace="nowrap"
                    >
                      {result.title}
                    </PreText>
                    <Badge variant={badgeVariant}>{cat}</Badge>
                  </div>
                  {result.description && (
                    <PreText
                      className="text-label-secondary text-footnote block truncate"
                      whiteSpace="nowrap"
                    >
                      {result.description}
                    </PreText>
                  )}
                </div>

                {/* Arrow */}
                <NavArrowRight className="text-label-tertiary group-hover:text-label-secondary h-4 w-4 shrink-0 transition-colors" />
              </button>
            );
          })
        ) : debouncedSearchQuery ? (
          /* ── No results ─────────────────────────────────────────── */
          <div className="py-8 text-center">
            <Search className="text-label-tertiary mx-auto mb-2 h-8 w-8" />
            <div className="text-label-secondary text-body">
              <PreText className="inline" whiteSpace="nowrap">
                {`Nothing found for "${debouncedSearchQuery}"${searchFilter !== "all" ? ` in ${searchFilter}.` : ""}`}
              </PreText>
              {searchFilter !== "all" && (
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setSearchFilter?.("all")}
                  className="ml-1 h-auto p-0"
                >
                  <PreText className="inline" whiteSpace="nowrap">
                    Search all
                  </PreText>
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* ── Empty state ────────────────────────────────────────── */
          <div className="py-10 text-center">
            <PreText className="text-label-secondary text-body mb-3" whiteSpace="nowrap">
              {`Type to search ${searchFilter === "all" ? "countries, commands, and features" : searchFilter}`}
            </PreText>
            <div className="text-label-secondary text-footnote flex items-center justify-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="bg-fill-4 rounded-control-sm px-2 py-0.5">⌘K</kbd>
                <PreText className="w-auto text-inherit" whiteSpace="nowrap">
                  search
                </PreText>
              </span>
              <span className="text-label-tertiary">·</span>
              <span className="flex items-center gap-1">
                <kbd className="bg-fill-4 rounded-control-sm px-2 py-0.5">Tab</kbd>
                <PreText className="w-auto text-inherit" whiteSpace="nowrap">
                  filter
                </PreText>
              </span>
              <span className="text-label-tertiary">·</span>
              <span className="flex items-center gap-1">
                <kbd className="bg-fill-4 rounded-control-sm px-2 py-0.5">Esc</kbd>
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
