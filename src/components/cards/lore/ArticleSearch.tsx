"use client";

/**
 * ArticleSearch Component
 *
 * Wiki article search with autocomplete for lore card generation
 */

import React, { useState, useCallback, useEffect } from "react";
import { debounce } from "lodash";

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

  // Debounced search function
  const searchArticles = useCallback(
    debounce(async (query: string) => {
      if (!query || query.length < 3) {
        setSuggestions([]);
        return;
      }

      setLoading(true);

      try {
        // Call MediaWiki API for search
        const apiUrl =
          wikiSource === "ixwiki"
            ? "https://ixwiki.com/api.php"
            : "https://iiwiki.com/mediawiki/api.php";

        const url = new URL(apiUrl);
        url.searchParams.set("action", "opensearch");
        url.searchParams.set("format", "json");
        url.searchParams.set("search", query);
        url.searchParams.set("limit", "10");
        url.searchParams.set("namespace", "0"); // Main namespace only
        url.searchParams.set("origin", "*");

        const response = await fetch(url.toString());

        if (!response.ok) {
          console.error("Search failed:", response.status);
          setSuggestions([]);
          return;
        }

        const data = await response.json();

        // OpenSearch returns [query, [titles], [descriptions], [urls]]
        const titles = data[1] || [];
        const descriptions = data[2] || [];

        const results: ArticleSuggestion[] = titles.map((title: string, idx: number) => ({
          title,
          snippet: descriptions[idx] || "",
        }));

        setSuggestions(results);
      } catch (error) {
        console.error("Article search error:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 500),
    [wikiSource]
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
          className="glass-child w-full px-4 py-3 pr-10 rounded-lg text-white placeholder-white/40"
        />

        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white"></div>
          </div>
        )}

        {!loading && searchQuery && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSuggestions([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
        <div className="absolute z-10 w-full mt-2 glass-parent rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(suggestion.title)}
              className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              <div className="font-semibold text-white">{suggestion.title}</div>
              {suggestion.snippet && (
                <div className="text-sm text-white/60 mt-1 line-clamp-2">{suggestion.snippet}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No Results Message */}
      {!loading && searchQuery.length >= 3 && suggestions.length === 0 && showSuggestions && (
        <div className="absolute z-10 w-full mt-2 glass-parent rounded-lg shadow-lg px-4 py-3">
          <div className="text-sm text-white/60 text-center">
            No articles found matching "{searchQuery}"
          </div>
        </div>
      )}
    </div>
  );
}
