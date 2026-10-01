"use client";

/**
 * ArticleSearch Component
 *
 * Wiki article search with autocomplete for lore card generation
 */

import React, { useState, useCallback, useEffect } from "react";
import { debounce } from "~/lib/utils";
import { api } from "~/trpc/react";

interface ArticleSearchProps {
  wikiSource: "ixwiki" | "iiwiki";
  onSelect: (articleTitle: string) => void;
  value?: string;
}

interface ArticleSuggestion {
  title: string;
  snippet: string;
}

export function ArticleSearch({ wikiSource, onSelect, value = "" }: ArticleSearchProps) {
  const [searchQuery, setSearchQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<ArticleSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const utils = api.useUtils();

  // Debounced search — uses WikiBridge via tRPC (direct MySQL for ixwiki)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const searchArticles = useCallback(
    debounce(async (query: string) => {
      if (!query || query.length < 3) {
        setSuggestions([]);
        return;
      }

      setLoading(true);

      try {
        const results = await utils.wikios.searchPages.fetch({
          query,
          limit: 10,
          wiki: wikiSource,
        });

        setSuggestions(results.map((r: { title: string }) => ({ title: r.title, snippet: "" })));
      } catch (error) {
        console.error("Article search error:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 500),
    [wikiSource, utils]
  );

  useEffect(() => {
    searchArticles(searchQuery);
  }, [searchQuery, searchArticles]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    setShowSuggestions(true);
  };

  const handleSelect = (title: string) => {
    setSearchQuery(title);
    setShowSuggestions(false);
    onSelect(title);
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={`Search ${wikiSource === "ixwiki" ? "IxWiki" : "IIWiki"} articles...`}
          className="border-separator bg-fill-3 rounded-control text-label placeholder:text-label-tertiary w-full border px-4 py-3 pr-10"
        />

        {loading && (
          <div className="absolute top-1/2 right-3 -translate-y-1/2">
            <div className="border-separator border-t-separator h-5 w-5 animate-spin rounded-full border-2"></div>
          </div>
        )}

        {!loading && searchQuery && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSuggestions([]);
            }}
            className="text-label-secondary hover:text-label absolute top-1/2 right-3 -translate-y-1/2"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="border-separator bg-surface-elevated rounded-control shadow-floating absolute z-10 mt-2 max-h-96 w-full overflow-y-auto border">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(suggestion.title)}
              className="first:rounded-t-control last:rounded-b-control hover:bg-fill-3 w-full px-4 py-3 text-left transition-colors"
            >
              <div className="text-label font-semibold">{suggestion.title}</div>
              {suggestion.snippet && (
                <div className="text-body text-label-secondary mt-1 line-clamp-2">
                  {suggestion.snippet}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No Results Message */}
      {!loading && searchQuery.length >= 3 && suggestions.length === 0 && showSuggestions && (
        <div className="border-separator bg-surface-elevated rounded-control shadow-floating absolute z-10 mt-2 w-full border px-4 py-3">
          <div className="text-body text-label-secondary text-center">
            No articles found matching "{searchQuery}"
          </div>
        </div>
      )}
    </div>
  );
}
