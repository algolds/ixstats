import React, { useEffect, useRef } from "react";
import { Search, Xmark, NavArrowRight } from "iconoir-react";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
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
  Statecraft: "bg-yellow/10 text-yellow border border-yellow/20",
  Vault: "bg-teal/10 text-teal border border-teal/20",
  Geography: "bg-green/10 text-green border border-green/20",
  Knowledge: "bg-blue/10 text-blue border border-blue/20",
  Community: "bg-blue/10 text-blue border border-blue/20",
  Sports: "bg-yellow/10 text-yellow border border-yellow/20",
  Labs: "bg-indigo/10 text-indigo border border-indigo/20",
  System: "bg-fill-3 text-label-secondary border border-separator",
  Country: "bg-blue/10 text-blue border border-blue/20",
  Wiki: "bg-wiki/10 text-wiki border border-wiki/30",
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
            <button
              onClick={() => setSearchQuery?.("")}
              className="text-label-secondary hover:text-label absolute top-1/2 right-3 -translate-y-1/2 p-1"
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
            className={`text-caption rounded-full px-3 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98] ${
              searchFilter === f.value
                ? "bg-tint-fill text-tint"
                : "text-label-secondary hover:text-label bg-fill-4 hover:bg-fill-2"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results list */}
      <div className="max-h-[380px] space-y-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {searchResults.length > 0 ? (
          searchResults.map((result) => {
            const Icon = result.icon;
            const cat =
              (result.metadata?.category as string) ||
              (result.type === "country" ? "Country" : "Command");
            const badgeStyle = CATEGORY_COLORS[cat] || "bg-fill-3 text-label-secondary";

            return (
              <button
                key={result.id}
                onClick={() => {
                  soundEffects.press();
                  result.action();
                  closeDropdown();
                }}
                className="group rounded-row hover:bg-fill-3 flex w-full items-center gap-3 p-2.5 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none active:scale-[0.985]"
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
                    <span
                      className={`text-caption inline-flex shrink-0 rounded-full px-2 py-0.5 ${badgeStyle}`}
                    >
                      {cat}
                    </span>
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
                <button
                  onClick={() => setSearchFilter?.("all")}
                  className="text-tint ml-1 font-medium hover:underline"
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
            <PreText className="text-label-secondary text-body mb-3" whiteSpace="nowrap">
              {`Type to search ${searchFilter === "all" ? "countries, commands, and features" : searchFilter}`}
            </PreText>
            <div className="text-label-secondary text-footnote flex items-center justify-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="bg-fill-4 rounded-control-sm px-1.5 py-0.5">⌘K</kbd>
                <PreText className="w-auto text-inherit" whiteSpace="nowrap">
                  search
                </PreText>
              </span>
              <span className="text-label-tertiary">·</span>
              <span className="flex items-center gap-1">
                <kbd className="bg-fill-4 rounded-control-sm px-1.5 py-0.5">Tab</kbd>
                <PreText className="w-auto text-inherit" whiteSpace="nowrap">
                  filter
                </PreText>
              </span>
              <span className="text-label-tertiary">·</span>
              <span className="flex items-center gap-1">
                <kbd className="bg-fill-4 rounded-control-sm px-1.5 py-0.5">Esc</kbd>
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
