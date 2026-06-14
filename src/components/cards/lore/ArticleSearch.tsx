"use client";

/**
 * ArticleSearch Component
 *
 * Wiki article search with autocomplete for lore card generation
 */

import React, { useState, useCallback, useEffect } from "react";
import { debounce } from "lodash";
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
        const results = await utils.wiki.searchPages.fetch({
          query,
          limit: 10,
          wiki: wikiSource,
        });

        setSuggestions(results.map((r) => ({ title: r.title, snippet: "" })));
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
          className="glass-child w-full rounded-lg px-4 py-3 pr-10 text-white placeholder-white/40"
        />

        {loading && (
          <div className="absolute top-1/2 right-3 -translate-y-1/2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
          </div>
        )}

        {!loading && searchQuery && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSuggestions([]);
            }}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-white/60 hover:text-white"
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
        <div className="glass-parent absolute z-10 mt-2 max-h-96 w-full overflow-y-auto rounded-lg shadow-lg">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(suggestion.title)}
              className="w-full px-4 py-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-white/10"
            >
              <div className="font-semibold text-white">{suggestion.title}</div>
              {suggestion.snippet && (
                <div className="mt-1 line-clamp-2 text-sm text-white/60">{suggestion.snippet}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No Results Message */}
      {!loading && searchQuery.length >= 3 && suggestions.length === 0 && showSuggestions && (
        <div className="glass-parent absolute z-10 mt-2 w-full rounded-lg px-4 py-3 shadow-lg">
          <div className="text-center text-sm text-white/60">
            No articles found matching "{searchQuery}"
          </div>
        </div>
      )}
    </div>
  );
}
