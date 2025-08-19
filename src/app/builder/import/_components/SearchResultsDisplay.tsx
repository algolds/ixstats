import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Globe, ExternalLink, Users, DollarSign, MapPin, Building } from "lucide-react";
import { GlassCard, GlassCardContent, GlassCardHeader } from "~/app/builder/components/glass/GlassCard";
import { ProgressiveBlur } from "~/components/magicui/progressive-blur";
import { cn } from "~/lib/utils";
import { SearchResultItem } from "./SearchResultItem";

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
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
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
          <div className="relative"> {/* Added relative positioning */}
            <div className="space-y-3 max-h-96 overflow-y-auto hide-scrollbar">
              {displayedResults.map((result, index) => (
                <SearchResultItem
                  key={index}
                  result={result}
                  index={index}
                  selectedResult={selectedResult}
                  handleSelectResult={handleSelectResult}
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
  );
};
