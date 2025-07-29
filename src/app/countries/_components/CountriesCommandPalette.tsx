"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RainbowButton } from "~/components/magicui/rainbow-button";
import { 
  RiSearchLine, 
  RiCommandLine
} from "react-icons/ri";

type SortOption = 'random' | 'name' | 'population' | 'gdp' | 'gdpPerCapita' | 'tier';
type FilterOption = 'all' | 'developed' | 'developing' | 'superpower';

interface CountriesCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  searchInput: string;
  onSearchChange: (value: string) => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  filterBy: FilterOption;
  onFilterChange: (value: FilterOption) => void;
  onReshuffle: () => void;
  onImFeelingLucky: () => void;
  resultsCount: number;
}

export const CountriesCommandPalette: React.FC<CountriesCommandPaletteProps> = ({
  isOpen,
  onClose,
  searchInput,
  onSearchChange,
  sortBy,
  onSortChange,
  filterBy,
  onFilterChange,
  onReshuffle,
  onImFeelingLucky,
  resultsCount
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10001]"
          />
          
          {/* Command Palette */}
          <motion.div
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-4 top-1/2 -translate-y-1/2 w-96 z-[10002]"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "12px",
              boxShadow: "0 16px 64px rgba(0, 0, 0, 0.15), 0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.4)"
            }}
          >
            {/* Refraction border effects */}
            <div className="absolute inset-0 pointer-events-none rounded-xl">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-white/30 to-transparent" />
              <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-white/20 to-transparent" />
            </div>

            <div className="relative z-10 p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xl font-bold text-foreground flex items-center gap-3">
                    <RiCommandLine className="h-6 w-6 text-blue-400" />
                    Countries Filter
                  </div>
                  <button
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent/10 p-2 rounded-lg transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <RiSearchLine className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search countries..."
                    value={searchInput}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-accent/10 border-border text-foreground placeholder:text-muted-foreground rounded-xl text-base focus:bg-accent/15 focus:border-blue-400 transition-all"
                    autoFocus
                  />
                </div>

                {/* Sort */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Sort by</label>
                  <select
                    value={sortBy}
                    onChange={(e) => onSortChange(e.target.value as SortOption)}
                    className="w-full px-3 py-3 bg-accent/10 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                  >
                    <option value="random">Random</option>
                    <option value="name">Name</option>
                    <option value="population">Population</option>
                    <option value="gdp">Total GDP</option>
                    <option value="gdpPerCapita">GDP per Capita</option>
                    <option value="tier">Economic Tier</option>
                  </select>
                </div>

                {/* Filter */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Filter by</label>
                  <select
                    value={filterBy}
                    onChange={(e) => onFilterChange(e.target.value as FilterOption)}
                    className="w-full px-3 py-3 bg-accent/10 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                  >
                    <option value="all">All Countries</option>
                    <option value="developed">Developed</option>
                    <option value="developing">Developing</option>
                    <option value="superpower">Superpowers</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={onReshuffle}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent/10 hover:bg-accent/20 border-border rounded-xl transition-colors text-foreground"
                  >
                    <RiCommandLine className="h-4 w-4" />
                    <span>Reshuffle Order</span>
                    <kbd className="px-2 py-1 bg-muted/50 rounded text-xs border-border">R</kbd>
                  </button>
                  
                  <RainbowButton
                    onClick={onImFeelingLucky}
                    className="w-full flex items-center justify-center gap-2 text-white font-medium relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(45deg, rgba(99, 102, 241, 0.8), rgba(168, 85, 247, 0.8), rgba(236, 72, 153, 0.8), rgba(239, 68, 68, 0.8), rgba(245, 158, 11, 0.8), rgba(34, 197, 94, 0.8))',
                      backgroundSize: '300% 300%',
                      animation: 'rainbow-subtle 8s ease-in-out infinite',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                    }}
                    size="lg"
                  >
                    <span className="relative z-10">🍀 I'm Feeling Lucky</span>
                    <kbd className="relative z-10 px-2 py-1 bg-black/30 rounded text-xs border-border border-white/30">Ctrl+Tab</kbd>
                  </RainbowButton>
                </div>

                {/* Results Preview */}
                <div className="pt-4 border-t border">
                  <p className="text-sm text-muted-foreground">
                    Showing {resultsCount} countries
                    {searchInput && ` matching "${searchInput}"`}
                    {filterBy !== 'all' && ` in ${filterBy} category`}
                  </p>
                </div>

                {/* Help Text */}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/50 pt-2">
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-muted rounded border-border">Tab</kbd>
                    <span>to toggle</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-muted rounded border-border">Esc</kbd>
                    <span>to close</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};