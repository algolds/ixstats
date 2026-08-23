// src/components/halo/plugins/wiki/components/WikiSearchDropdown.tsx
// Full-text wiki article search input & results dropdown with snippet highlights.

"use client";

import { useRef, useEffect } from "react";
import { Search, Xmark as X } from "iconoir-react";
import { PreText } from "~/components/ui/pretext";
import { api } from "~/trpc/react";

interface WikiSearchDropdownProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectArticle: (title: string) => void;
}

export function WikiSearchDropdown({
  searchQuery,
  onSearchChange,
  onSelectArticle,
}: WikiSearchDropdownProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const { data: searchData, isFetching: isSearching } = api.wikios.advancedSearch.useQuery(
    { query: searchQuery, limit: 8 },
    { enabled: searchQuery.length >= 2, staleTime: 30_000 }
  );
  const searchResults = searchData?.results ?? [];

  return (
    <>
      {/* Search Input Bar */}
      <div className="mb-3">
        <div className="border-border bg-accent/5 flex items-center gap-2 rounded-lg border px-3">
          <Search className="text-muted-foreground h-4 w-4 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search wiki articles..."
            className="text-foreground placeholder:text-muted-foreground w-full bg-transparent py-2 text-sm outline-none"
            data-command-palette-search="true"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search Results Dropdown */}
      {searchQuery.length >= 2 && (
        <div className="border-border mb-3 border-b pb-3">
          <div className="text-muted-foreground mb-1 flex items-center justify-between text-[10px] font-semibold tracking-wider uppercase">
            <PreText className="text-inherit" whiteSpace="nowrap">
              {`Results${searchData?.totalHits ? ` (${searchData.totalHits})` : ""}`}
            </PreText>
            {isSearching && (
              <PreText
                className="text-muted-foreground/80 animate-pulse text-[10px]"
                whiteSpace="nowrap"
              >
                searching...
              </PreText>
            )}
          </div>
          {searchResults.length > 0 ? (
            searchResults.map((result) => (
              <button
                key={result.title}
                type="button"
                onClick={() => onSelectArticle(result.title)}
                className="text-foreground/70 hover:bg-accent/10 hover:text-foreground flex w-full flex-col rounded-md px-2 py-1.5 text-left transition-colors"
              >
                <span className="flex items-center gap-2 text-sm">
                  <PreText className="truncate font-medium text-inherit" whiteSpace="nowrap">
                    {result.title}
                  </PreText>
                </span>
                {result.snippet && (
                  <span
                    className="text-muted-foreground [&_.searchmatch]:text-foreground mt-0.5 line-clamp-1 pl-[22px] text-[11px] [&_.searchmatch]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: result.snippet }}
                  />
                )}
              </button>
            ))
          ) : !isSearching ? (
            <PreText className="text-muted-foreground/75 px-2 py-1 text-xs" whiteSpace="nowrap">
              No results
            </PreText>
          ) : null}
        </div>
      )}
    </>
  );
}
