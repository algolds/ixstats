import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Globe, ExternalLink, Users, DollarSign, MapPin, Building } from "lucide-react";
import { GlassCard, GlassCardContent, GlassCardHeader } from "~/app/builder/components/glass/GlassCard";
import { ProgressiveBlur } from "~/components/magicui/progressive-blur";
import { cn } from "~/lib/utils";
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
  theme: 'blue' | 'indigo';
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
  formatNumber: (num: number | undefined) => string;
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

  const handleCountrySelect = (result: SearchResult) => {
    if (categoryFilter.toLowerCase() === 'countries' || categoryFilter.toLowerCase() === 'nations') {
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
          filter: previewingCountry ? 'blur(2px)' : 'blur(0px)'
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <GlassCard
          depth="elevated"
          blur="medium"
          theme="neutral"
          motionPreset="slide"
        >
          <GlassCardHeader>
            <div className="flex items-center gap-3">
              <div 
                className="p-2 rounded-lg border border-border-secondary/30"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)' }}
              >
                <Search className="h-5 w-5 text-text-secondary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Search Results ({searchResults.length})
                </h2>
                {selectedSite.name === 'iiwiki' && searchResults.some(r => r.snippet.includes('subcategory')) && (
                  <p className="text-sm text-text-muted mt-1">
                    Results include pages from subcategories
                  </p>
                )}
              </div>
            </div>
          </GlassCardHeader>
          <GlassCardContent className="relative">
            <div className="relative">
              <div className="space-y-3 max-h-96 overflow-y-auto hide-scrollbar">
                {displayedResults.map((result, index) => (
                  <SearchResultItem
                    key={index}
                    result={result}
                    index={index}
                    selectedResult={selectedResult}
                    handleSelectResult={handleCountrySelect}
                    categoryFilter={categoryFilter}
                    formatNumber={formatNumber}
                  />
                ))}
              </div>

              {/* Progressive Blur for scroll fade */}
              <ProgressiveBlur 
                className="bottom-2"
                position="bottom"
                height="27%"
              />
            </div>

            {/* Load More Button */}
            {hasMoreResults && (
              <div className="mt-6 text-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={loadMoreResults}
                  className="px-6 py-3 rounded-lg border transition-all duration-200"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  Load More Results ({searchResults.length - displayedResults.length} remaining)
                </motion.button>
              </div>
            )}
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Country Preview Overlay */}
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
