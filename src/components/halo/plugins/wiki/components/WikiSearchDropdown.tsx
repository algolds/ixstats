"use client";
// src/components/halo/plugins/wiki/components/WikiSearchDropdown.tsx
// Full-text wiki article search input & results dropdown. Snippets are plain text.

import { useRef, useEffect, useState } from "react";
import { Search, Xmark as X } from "iconoir-react";
import { PreText } from "~/components/ui/pretext";
import { HighlightedSnippet } from "~/components/wiki-os/shared/HighlightedSnippet";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";

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

  // One full-text search per pause in typing, not per keystroke
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchData, isFetching: isSearching } = api.wikios.advancedSearch.useQuery(
    { query: debouncedQuery, limit: 8 },
    { enabled: debouncedQuery.length >= 2, staleTime: 60_000 }
  );
  const searchResults = searchData?.results ?? [];

  return (
    <>
      {/* Search Input Bar */}
      <div className="mb-3">
        <div className="border-separator bg-fill-4 rounded-control flex items-center gap-2 border px-3">
          <Search className="text-label-secondary h-4 w-4 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search wiki articles..."
            className="text-label placeholder:text-label-secondary text-body w-full bg-transparent py-2 outline-none"
            data-command-palette-search="true"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="text-label-secondary hover:text-label"
            >
              <X aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {/* Search Results Dropdown */}
      {searchQuery.length >= 2 && (
        <div className="border-separator mb-3 border-b pb-3">
          <div className="text-label-secondary text-subhead mb-1 flex items-center justify-between">
            <PreText className="text-inherit" whiteSpace="nowrap">
              {`Results${searchData?.totalHits ? ` (${searchData.totalHits})` : ""}`}
            </PreText>
            {isSearching && (
              <PreText className="text-label-secondary text-footnote" whiteSpace="nowrap">
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
                className="text-label-secondary hover:bg-fill-4 hover:text-label rounded-control-sm flex w-full flex-col px-2 py-2 text-left transition-colors"
              >
                <span className="text-body flex items-center gap-2">
                  <PreText className="truncate font-medium text-inherit" whiteSpace="nowrap">
                    {result.title}
                  </PreText>
                </span>
                {result.snippet && (
                  <span className="text-label-secondary text-footnote mt-0.5 line-clamp-1 pl-[22px]">
                    <HighlightedSnippet text={result.snippet} ranges={result.snippetRanges} />
                  </span>
                )}
              </button>
            ))
          ) : !isSearching ? (
            <PreText className="text-label-secondary text-footnote px-2 py-1" whiteSpace="nowrap">
              No results
            </PreText>
          ) : null}
        </div>
      )}
    </>
  );
}
