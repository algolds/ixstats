import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ProgressiveBlur } from "~/components/magicui/progressive-blur";
import { SearchResultItem } from "./SearchResultItem";
import { CountryPreview } from "./CountryPreview";

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  namespace?: number;
  flagUrl?: string | null;
  population?: number;
  gdpPerCapita?: number;
  capital?: string;
  government?: string;
}

interface WikiSite {
  name: string;
  displayName: string;
  baseUrl: string;
  description: string;
  categoryFilter?: string;
  theme: "blue" | "indigo";
  gradient: string;
}

interface SearchResultsDisplayProps {
  searchResults: SearchResult[];
  displayedResults: SearchResult[];
  selectedResult: SearchResult | null;
  handleSelectResult: (result: SearchResult) => void;
  categoryFilter: string;
  selectedSite: WikiSite;
  loadMoreResults: () => void;
  hasMoreResults: boolean;
  formatNumber: (num: number | undefined, _decimals?: number) => string;
  onCountryPreview?: (result: SearchResult) => void;
  onContinueWithCountry?: (result: SearchResult) => void;
}

export const SearchResultsDisplay: React.FC<SearchResultsDisplayProps> = ({
  searchResults,
  displayedResults,
  selectedResult,
  handleSelectResult,
  categoryFilter,
  selectedSite,
  loadMoreResults,
  hasMoreResults,
  formatNumber,
  onCountryPreview,
  onContinueWithCountry,
}) => {
  const [previewingCountry, setPreviewingCountry] = useState<SearchResult | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleCountrySelect = (result: SearchResult) => {
    if (
      categoryFilter.toLowerCase() === "countries" ||
      categoryFilter.toLowerCase() === "nations"
    ) {
      setPreviewingCountry(result);
      if (onCountryPreview) {
        onCountryPreview(result);
      }
    } else {
      handleSelectResult(result);
    }
  };

  const handleCancelPreview = () => {
    setPreviewingCountry(null);
    setFocusedIndex(-1);
  };

  const handleContinueWithPreview = () => {
    if (previewingCountry) {
      if (onContinueWithCountry) {
        onContinueWithCountry(previewingCountry);
      } else {
        handleSelectResult(previewingCountry);
      }
      setPreviewingCountry(null);
    }
  };

  // Keyboard navigation within result list
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (previewingCountry) {
        if (e.key === "Escape") {
          handleCancelPreview();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((i) => Math.min(i + 1, displayedResults.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (focusedIndex >= 0 && displayedResults[focusedIndex]) {
            handleCountrySelect(displayedResults[focusedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setFocusedIndex(-1);
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayedResults, focusedIndex, previewingCountry]
  );

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && resultRefs.current[focusedIndex]) {
      resultRefs.current[focusedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [focusedIndex]);

  // Reset focus when results change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [displayedResults.length]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="relative"
    >
      <motion.div
        animate={{
          opacity: previewingCountry ? 0.3 : 1,
          scale: previewingCountry ? 0.95 : 1,
          filter: previewingCountry ? "blur(2px)" : "blur(0px)",
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <Card className="bg-card/60 border-blue-500/20 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="border-border/30 rounded-lg border bg-amber-500/20 p-2">
                <Search className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Search Results ({searchResults.length})</CardTitle>
                {selectedSite.name === "iiwiki" &&
                  searchResults.some((r) => r.snippet.includes("subcategory")) && (
                    <p className="text-muted-foreground mt-1 text-sm">
                      Results include pages from subcategories
                    </p>
                  )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div
              className="relative"
              onKeyDown={handleKeyDown}
              role="listbox"
              aria-label="Search results"
              tabIndex={-1}
            >
              <div className="hide-scrollbar max-h-96 space-y-3 overflow-y-auto">
                {displayedResults.map((result, index) => (
                  <div
                    key={index}
                    ref={(el) => {
                      resultRefs.current[index] = el;
                    }}
                    role="option"
                    aria-selected={focusedIndex === index}
                    tabIndex={focusedIndex === index ? 0 : -1}
                  >
                    <SearchResultItem
                      result={result}
                      index={index}
                      selectedResult={selectedResult}
                      handleSelectResult={handleCountrySelect}
                      categoryFilter={categoryFilter}
                      formatNumber={formatNumber}
                      isFocused={focusedIndex === index}
                      onFocus={() => setFocusedIndex(index)}
                    />
                  </div>
                ))}
              </div>

              <ProgressiveBlur className="bottom-2" position="bottom" height="27%" />
            </div>

            {hasMoreResults && (
              <div className="mt-6 text-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={loadMoreResults}
                  className="border-border bg-muted/50 text-foreground hover:bg-muted rounded-lg border px-6 py-3 transition-all duration-200"
                >
                  Load More Results ({searchResults.length - displayedResults.length} remaining)
                </motion.button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {previewingCountry && (
        <CountryPreview
          selectedResult={previewingCountry}
          onCancel={handleCancelPreview}
          onContinue={handleContinueWithPreview}
          formatNumber={formatNumber}
          isVisible={!!previewingCountry}
        />
      )}
    </motion.div>
  );
};
