import React from "react";
import { motion } from "framer-motion";
import { Search, Globe, ExternalLink, Users, DollarSign, MapPin, Building } from "lucide-react";
import { cn } from "~/lib/utils";

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

interface SearchResultItemProps {
  result: SearchResult;
  index: number;
  selectedResult: SearchResult | null;
  handleSelectResult: (result: SearchResult) => void;
  categoryFilter: string;
  formatNumber: (num: number | undefined) => string;
}

export const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  index,
  selectedResult,
  handleSelectResult,
  categoryFilter,
  formatNumber,
}) => {
  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => handleSelectResult(result)}
      className={cn(
        "relative w-full p-4 rounded-lg border text-left transition-all duration-200 overflow-hidden", // Added relative and overflow-hidden
        selectedResult?.title === result.title
          ? 'border-border-secondary/50 bg-bg-accent/200/20'
          : 'hover:border-border-secondary/30 hover:bg-bg-accent/200/10'
      )}
      style={{
        backgroundColor: selectedResult?.title === result.title
          ? undefined
          : 'var(--color-bg-secondary)',
        borderColor: selectedResult?.title === result.title
          ? undefined
          : 'var(--color-border-primary)'
      }}
    >
      {/* Blurred background image */}
      {result.flagUrl && (
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${result.flagUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'blur(8px)', // Apply blur effect
            opacity: 0.2, // Adjust opacity for subtle effect
          }}
        />
      )}
      {/* Existing content, now with z-index to be above background */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            {result.flagUrl ? (
              <img
              src={result.flagUrl}
              alt={`Flag of ${result.title}`}
              className="w-6 h-4 object-cover rounded-sm border border-border-secondary shadow-sm"
              onError={(e) => {
                // Fallback to globe icon if flag fails to load
                const target = e.target as HTMLImageElement;
                const container = target.parentElement;
                if (container) {
                  container.innerHTML = '<div class="w-6 h-4 bg-gradient-to-r from-bg-accent/20 to-bg-accent/30 rounded-sm flex items-center justify-center border border-border-secondary/30"><svg class="h-3 w-3 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>';
                }
              }}
            />
          ) : (
            <div className="w-6 h-4 bg-gradient-to-r from-bg-accent/20 to-bg-accent/30 rounded-sm flex items-center justify-center border border-border-secondary/30">
              <Globe className="h-3 w-3 text-text-secondary" />
            </div>
          )}
          <h3 className="font-medium text-text-primary">{result.title}</h3>
        </div>
        <ExternalLink className="h-4 w-4 text-text-muted" />
      </div>
      {/* Country Info Display */}
      {categoryFilter.toLowerCase() === 'countries' && (result.population || result.gdpPerCapita || result.capital || result.government) ? (
        <div className="ml-9 mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {result.population && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" style={{ color: 'var(--color-info)' }} />
              <span style={{ color: 'var(--color-text-muted)' }}>
                {formatNumber(result.population)}
              </span>
            </div>
          )}
          {result.gdpPerCapita && (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" style={{ color: 'var(--color-success)' }} />
              <span style={{ color: 'var(--color-text-muted)' }}>
                ${formatNumber(result.gdpPerCapita)}
              </span>
            </div>
          )}
          {result.capital && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" style={{ color: 'var(--color-error)' }} />
              <span
                className="truncate"
                style={{ color: 'var(--color-text-muted)' }}
                dangerouslySetInnerHTML={{ __html: result.capital }}
              />
            </div>
          )}
          {result.government && (
            <div className="flex items-center gap-1">
              <Building className="h-3 w-3" style={{ color: 'var(--color-brand-secondary)' }} />
              <span
                className="truncate"
                style={{ color: 'var(--color-text-muted)' }}
                dangerouslySetInnerHTML={{ __html: result.government }}
              />
            </div>
          )}
        </div>
      ) : (
        <p
          className="text-sm text-text-muted ml-9"
          dangerouslySetInnerHTML={{ __html: result.snippet }}
        />
      )}
      </div>
    </motion.div>
    
  );
  
};
