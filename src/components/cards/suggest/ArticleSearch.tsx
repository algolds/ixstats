"use client";

/** The wiki article search in the suggest-a-card dialog: pick the article a lore card is suggested for. */

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { debounce } from "~/lib/utils";
import { api } from "~/trpc/react";
import { cardSourceLabel, type CardArticleSource } from "~/lib/cards/card-sources";
import { Button } from "~/components/ui/button";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Signal } from "~/components/ui/signal";

interface ArticleSearchProps {
  /** The search field's id, for its label. */
  id?: string;
  wikiSource: CardArticleSource;
  onSelect: (articleTitle: string) => void;
}

interface ArticleSuggestion {
  title: string;
  snippet: string;
}

export function ArticleSearch({ id, wikiSource, onSelect }: ArticleSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ArticleSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  /** The last search failed, so its empty list is an outage and not "no articles". */
  const [failed, setFailed] = useState(false);
  /** The id of the newest search; an answer to an older one (or one for an old query or wiki) is dropped. */
  const latestRequest = useRef(0);

  const utils = api.useUtils();

  // Uses WikiBridge via tRPC (PostgreSQL for ixwiki)
  const runSearch = useCallback(
    async (query: string) => {
      const request = ++latestRequest.current;
      setFailed(false);
      if (!query || query.length < 3) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const results = await utils.wikios.searchPages.fetch({
          query,
          limit: 10,
          wiki: wikiSource,
        });
        if (request !== latestRequest.current) return;

        setSuggestions(results.map((r: { title: string }) => ({ title: r.title, snippet: "" })));
      } catch (error) {
        if (request !== latestRequest.current) return;
        console.error("Article search error:", error);
        setSuggestions([]);
        setFailed(true);
      } finally {
        if (request === latestRequest.current) setLoading(false);
      }
    },
    [wikiSource, utils]
  );
  const searchArticles = useMemo(() => debounce(runSearch, 500), [runSearch]);

  useEffect(() => {
    searchArticles(searchQuery);
    return () => {
      // A new query, a new wiki or unmounting: drop the pending call and any answer still on its way.
      searchArticles.cancel();
      latestRequest.current++;
    };
  }, [searchQuery, searchArticles]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setFailed(false);
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
          id={id}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={`Search ${cardSourceLabel(wikiSource)} articles`}
          className="border-separator bg-fill-3 rounded-control text-label placeholder:text-label-tertiary w-full border px-4 py-3 pr-10"
        />

        {loading && (
          <div className="absolute top-1/2 right-3 -translate-y-1/2">
            <div className="border-separator border-t-separator h-5 w-5 animate-spin rounded-full border-2"></div>
          </div>
        )}

        {!loading && searchQuery && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear search"
            onClick={() => {
              setSearchQuery("");
              setSuggestions([]);
            }}
            className="text-label-secondary absolute top-1/2 right-2 -translate-y-1/2"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="border-separator bg-surface-elevated rounded-control shadow-floating absolute z-10 mt-2 max-h-96 w-full overflow-y-auto border">
          <FacetListSection variant="plain" aria-label="Article suggestions">
            {suggestions.map((suggestion, idx) => (
              <FacetRow
                key={idx}
                onClick={() => handleSelect(suggestion.title)}
                title={suggestion.title}
                subtitle={
                  suggestion.snippet ? (
                    <span className="line-clamp-2">{suggestion.snippet}</span>
                  ) : undefined
                }
              />
            ))}
          </FacetListSection>
        </div>
      )}

      {!loading && failed && searchQuery.length >= 3 && (
        <Signal
          tone="destructive"
          title={`Could not search ${cardSourceLabel(wikiSource)} articles`}
          className="mt-2"
        >
          <Button variant="outline" size="sm" onClick={() => void runSearch(searchQuery)}>
            Try again
          </Button>
        </Signal>
      )}

      {/* No Results Message */}
      {!loading &&
        !failed &&
        searchQuery.length >= 3 &&
        suggestions.length === 0 &&
        showSuggestions && (
          <div className="border-separator bg-surface-elevated rounded-control shadow-floating absolute z-10 mt-2 w-full border px-4 py-3">
            <div className="text-body text-label-secondary text-center">
              No articles found matching "{searchQuery}"
            </div>
          </div>
        )}
    </div>
  );
}
