import React from "react";
import { motion } from "framer-motion";
import { Search, Loader2 } from "lucide-react";
import { GlassCard, GlassCardContent, GlassCardHeader } from "~/app/builder/components/glass/GlassCard";
import { cn } from "~/lib/utils";

interface WikiSite {
  displayName: string;
}

interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isSearching: boolean;
  categoryFilter: string;
  selectedSite: WikiSite;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  setSearchTerm,
  isSearching,
  categoryFilter,
  selectedSite,
}) => {
  return (
    <div className="sticky top-20 z-10">
      <GlassCard
        depth="elevated"
        blur="medium"
        theme="neutral"
        motionPreset="slide"
      >
        <GlassCardHeader>
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{
                backgroundColor: 'var(--color-bg-accent)',
                borderColor: 'var(--color-border-secondary)'
              }}
            >
              <Search className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary-center">
                Country Browser
              </h2>
              <p className="text-sm text-text-muted">
                Find countries and entities to import
              </p>
            </div>
          </div>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center">
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin text-text-secondary" />
              ) : (
                <Search className="h-4 w-4 text-text-muted" />
              )}
            </div>
            <input
              type="text"
              placeholder={`Type to search ${categoryFilter} on ${selectedSite.displayName}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-3 rounded-lg border transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary/50"
              )}
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
            />
            {searchTerm && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: 'var(--color-bg-accent)',
                  color: 'var(--color-text-muted)'
                }}
                title="Clear search"
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-muted)';
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-accent)';
                }}
              >
                ×
              </motion.button>
            )}
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
};