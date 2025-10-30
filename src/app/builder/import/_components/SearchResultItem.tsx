import React from "react";
import { motion } from "framer-motion";
import { Search, Globe, ExternalLink, Users, DollarSign, MapPin, Building } from "lucide-react";
import { cn } from "~/lib/utils";
import { sanitizeWikiContent } from "~/lib/sanitize-html";

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
        "relative w-full overflow-hidden rounded-lg border p-4 text-left transition-all duration-200", // Added relative and overflow-hidden
        selectedResult?.title === result.title
          ? "border-border-secondary/50 bg-bg-accent/200/20"
          : "hover:border-border-secondary/30 hover:bg-bg-accent/200/10"
      )}
      style={{
        backgroundColor:
          selectedResult?.title === result.title ? undefined : "var(--color-bg-secondary)",
        borderColor:
          selectedResult?.title === result.title ? undefined : "var(--color-border-primary)",
      }}
    >
      {/* Blurred background image */}
      {result.flagUrl && (
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${result.flagUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: "blur(8px)", // Apply blur effect
            opacity: 0.2, // Adjust opacity for subtle effect
          }}
        />
      )}
      {/* Existing content, now with z-index to be above background */}
      <div className="relative z-10">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {result.flagUrl ? (
              <img
                src={result.flagUrl}
                alt={`Flag of ${result.title}`}
                className="border-border-secondary h-4 w-6 rounded-sm border object-cover shadow-sm"
                onError={(e) => {
                  // Fallback to globe icon if flag fails to load
                  const target = e.target as HTMLImageElement;
                  const container = target.parentElement;
                  if (container) {
                    container.innerHTML =
                      '<div class="w-6 h-4 bg-gradient-to-r from-bg-accent/20 to-bg-accent/30 rounded-sm flex items-center justify-center border border-border-secondary/30"><svg class="h-3 w-3 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>';
                  }
                }}
              />
            ) : (
              <div className="from-bg-accent/20 to-bg-accent/30 border-border-secondary/30 flex h-4 w-6 items-center justify-center rounded-sm border bg-gradient-to-r">
                <Globe className="text-text-secondary h-3 w-3" />
              </div>
            )}
            <h3 className="text-text-primary font-medium">{result.title}</h3>
          </div>
          <ExternalLink className="text-text-muted h-4 w-4" />
        </div>
        {/* Country Info Display */}
        {categoryFilter.toLowerCase() === "countries" &&
        (result.population || result.gdpPerCapita || result.capital || result.government) ? (
          <div className="mt-3 ml-9 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            {result.population && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" style={{ color: "var(--color-info)" }} />
                <span style={{ color: "var(--color-text-muted)" }}>
                  {formatNumber(result.population)}
                </span>
              </div>
            )}
            {result.gdpPerCapita && (
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" style={{ color: "var(--color-success)" }} />
                <span style={{ color: "var(--color-text-muted)" }}>
                  ${formatNumber(result.gdpPerCapita)}
                </span>
              </div>
            )}
            {result.capital && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" style={{ color: "var(--color-error)" }} />
                <span
                  className="truncate"
                  style={{ color: "var(--color-text-muted)" }}
                  // SECURITY: Sanitize wiki search result content
                  dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(result.capital) }}
                />
              </div>
            )}
            {result.government && (
              <div className="flex items-center gap-1">
                <Building className="h-3 w-3" style={{ color: "var(--color-brand-secondary)" }} />
                <span
                  className="truncate"
                  style={{ color: "var(--color-text-muted)" }}
                  // SECURITY: Sanitize wiki search result content
                  dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(result.government) }}
                />
              </div>
            )}
          </div>
        ) : (
          <p
            className="text-text-muted ml-9 text-sm"
            // SECURITY: Sanitize wiki search result snippet
            dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(result.snippet) }}
          />
        )}
      </div>
    </motion.div>
  );
};
