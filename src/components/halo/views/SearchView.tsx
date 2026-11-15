import React, { useEffect, useId, useRef, useState } from "react";
import { Globe, Search, Xmark, NavArrowRight } from "iconoir-react";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { assetUrl } from "~/lib/base-path";
import type { SearchViewProps, SearchFilter, SearchResult } from "../types";
import { PreText } from "~/components/ui/pretext";
import { Button } from "~/components/ui/button";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { HaloEmpty } from "./shared/HaloViewParts";

const FILTERS: { value: SearchFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "wiki", label: "Wiki" },
  { value: "countries", label: "Countries" },
  { value: "commands", label: "Commands" },
  { value: "features", label: "Features" },
];

/** Result category → Badge colour: system colours for categories that span several apps. */
const CATEGORY_BADGE: Record<string, BadgeVariant> = {
  "On this page": "info",
  Geography: "success",
  Knowledge: "info",
  Community: "info",
  System: "default",
  Country: "info",
};

/** A category that is one app wears that app's tint (`data-app` on a secondary Badge), whatever app Halo is over. */
const CATEGORY_APP: Record<string, string> = {
  Statecraft: "mycountry",
  Vault: "vault",
  Sports: "labs",
  Labs: "labs",
  Wiki: "wiki",
  Realm: "realms",
};

/** Badge text: the app name users see in the sidebar, in place of the internal category. */
const CATEGORY_LABEL: Record<string, string> = {
  "On this page": "On this page",
  Realm: "Realm",
  Statecraft: "MyCountry",
  Geography: "Maps",
  Knowledge: "Wiki",
  Community: "Community",
  Sports: "Sports",
  Labs: "Labs",
  Vault: "Vault",
  System: "System",
  Country: "Country",
  Wiki: "Wiki",
};

/** The palette shortcut as this platform writes it. Halo renders client-side only, so `navigator` exists. */
function shortcutHint(): string {
  if (typeof navigator === "undefined") return "Ctrl K";
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘K" : "Ctrl K";
}

export function SearchView({
  searchQuery,
  setSearchQuery,
  searchFilter,
  setSearchFilter,
  debouncedSearchQuery,
  searchResults,
  isSearchPending = false,
  closeDropdown,
}: SearchViewProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  // The active row belongs to one result list; a new list starts again at the top.
  const [active, setActive] = useState<{ forResults: SearchResult[]; index: number }>({
    forResults: searchResults,
    index: 0,
  });
  const activeIndex = active.forResults === searchResults ? active.index : 0;
  const activeId = searchResults.length > 0 ? `${listId}-${activeIndex}` : undefined;
  const hasQuery = searchQuery.trim().length > 0;

  const run = (chosen: SearchResult) => {
    closeDropdown();
    chosen.action();
  };

  const moveTo = (index: number) => {
    setActive({ forResults: searchResults, index });
    document.getElementById(`${listId}-${index}`)?.scrollIntoView?.({ block: "nearest" });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = searchResults.length;
    if (e.key === "Escape") {
      e.preventDefault();
      if (searchQuery) {
        setSearchQuery?.("");
      } else {
        closeDropdown();
      }
    } else if (count > 0 && e.key === "ArrowDown") {
      e.preventDefault();
      moveTo((activeIndex + 1) % count);
    } else if (count > 0 && e.key === "ArrowUp") {
      e.preventDefault();
      moveTo((activeIndex - 1 + count) % count);
    } else if (count > 0 && e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const chosen = searchResults[activeIndex];
      if (chosen) run(chosen);
    }
  };

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
            type="search"
            role="combobox"
            aria-expanded={searchResults.length > 0}
            aria-controls={searchResults.length > 0 ? listId : undefined}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Search IxStates"
            tabIndex={0}
            placeholder={`Search ${searchFilter === "all" ? "everything" : searchFilter}…`}
            value={searchQuery || ""}
            onChange={(e) => setSearchQuery?.(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-label placeholder:text-label-tertiary rounded-row border-separator bg-fill-4 text-body focus-visible:outline-tint w-full border py-2 pr-14 pl-9 transition-[color,background-color,border-color,box-shadow,opacity,scale,translate] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-search-cancel-button]:appearance-none"
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
      {hasQuery && !isSearchPending && (
        <p className="sr-only" aria-live="polite">
          {searchResults.length === 1 ? "1 result" : `${searchResults.length} results`}
        </p>
      )}
      <div className="max-h-[380px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {searchResults.length > 0 ? (
          <div role="listbox" id={listId} aria-label="Results" className="space-y-1">
            {searchResults.map((result, i) => {
              const Icon = result.icon;
              const cat =
                (result.metadata?.category as string) ||
                (result.type === "country" ? "Country" : "Command");
              const categoryApp = CATEGORY_APP[cat];
              const badgeVariant = categoryApp ? "secondary" : (CATEGORY_BADGE[cat] ?? "default");

              return (
                <button
                  type="button"
                  key={result.id}
                  role="option"
                  id={`${listId}-${i}`}
                  aria-selected={i === activeIndex}
                  tabIndex={-1}
                  onClick={() => run(result)}
                  className={`group rounded-row hover:bg-fill-3 focus-visible:outline-tint flex w-full items-center gap-3 p-3 text-left select-none focus-visible:outline-2 ${
                    i === activeIndex ? "bg-fill-3" : ""
                  }`}
                >
                  {/* Icon, Realm Crest, or Flag */}
                  <div className="rounded-control bg-fill-4 flex h-9 w-9 shrink-0 items-center justify-center">
                    {result.type === "country" && result.metadata?.flagUrl ? (
                      <UnifiedCountryFlag
                        flagUrl={result.metadata.flagUrl as string}
                        countryName={result.title}
                        className="rounded-control-sm h-5 w-7 object-cover"
                      />
                    ) : result.type === "realm" && result.metadata?.thumbnail ? (
                      <img
                        src={assetUrl(result.metadata.thumbnail as string) ?? undefined}
                        alt=""
                        className="rounded-control-sm h-6 w-6 object-cover"
                      />
                    ) : result.type === "realm" ? (
                      <Globe className="text-label-secondary group-hover:text-label h-4 w-4 transition-colors" />
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
                      <Badge variant={badgeVariant} data-app={categoryApp}>
                        {CATEGORY_LABEL[cat] ?? cat}
                      </Badge>
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
            })}
          </div>
        ) : hasQuery && isSearchPending ? (
          /* ── Still searching ────────────────────────────────────── */
          <div className="space-y-1" aria-busy="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : debouncedSearchQuery ? (
          /* ── No results ─────────────────────────────────────────── */
          <HaloEmpty
            icon={<Search />}
            title={`Nothing found for "${debouncedSearchQuery}"${searchFilter !== "all" ? ` in ${searchFilter}.` : ""}`}
            action={
              searchFilter !== "all" ? (
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setSearchFilter?.("all")}
                  className="h-auto p-0"
                >
                  Search all
                </Button>
              ) : undefined
            }
          />
        ) : (
          /* ── Empty state ────────────────────────────────────────── */
          <HaloEmpty
            title={`Type to search ${searchFilter === "all" ? "realms, countries, commands, and features" : searchFilter}`}
            message={
              <span className="text-label-secondary text-footnote inline-flex items-center justify-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="bg-fill-4 rounded-control-sm px-2 py-0.5">{shortcutHint()}</kbd>
                  <span>search</span>
                </span>
                <span className="text-label-tertiary">·</span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-fill-4 rounded-control-sm px-2 py-0.5">←</kbd>
                  <kbd className="bg-fill-4 rounded-control-sm px-2 py-0.5">→</kbd>
                  <span>filter</span>
                </span>
                <span className="text-label-tertiary">·</span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-fill-4 rounded-control-sm px-2 py-0.5">Esc</kbd>
                  <span>close</span>
                </span>
              </span>
            }
          />
        )}
      </div>
    </div>
  );
}
