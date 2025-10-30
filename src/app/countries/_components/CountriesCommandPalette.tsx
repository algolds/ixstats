"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RainbowButton } from "~/components/magicui/rainbow-button";
import { RiSearchLine, RiCommandLine } from "react-icons/ri";

type SortOption = "random" | "name" | "population" | "gdp" | "gdpPerCapita" | "tier";
type FilterOption = "all" | "developed" | "developing" | "superpower";

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
  resultsCount,
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
            className="fixed inset-0 z-[10001] bg-black/40 backdrop-blur-md"
          />

          {/* Command Palette */}
          <motion.div
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-1/2 left-4 z-[10002] w-96 -translate-y-1/2"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.15) 100%)",
              backdropFilter: "blur(32px) saturate(200%)",
              WebkitBackdropFilter: "blur(32px) saturate(200%)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: "16px",
              boxShadow:
                "0 24px 96px rgba(0, 0, 0, 0.25), 0 16px 48px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
            }}
          >
            {/* Refraction border effects */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl">
              <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-white/40 to-transparent" />
              <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/30 to-transparent" />
            </div>

            <div className="relative z-10 p-6">
              <div className="space-y-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-foreground flex items-center gap-3 text-xl font-bold">
                    <RiCommandLine className="h-6 w-6 text-blue-400" />
                    Countries Filter
                  </div>
                  <button
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent/10 rounded-lg p-2 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <RiSearchLine className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 transform" />
                  <input
                    type="text"
                    placeholder="Search countries..."
                    value={searchInput}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="bg-accent/10 border-border text-foreground placeholder:text-muted-foreground focus:bg-accent/15 w-full rounded-xl py-3 pr-4 pl-12 text-base transition-all focus:border-blue-400"
                    autoFocus
                  />
                </div>

                {/* Sort */}
                <div>
                  <label className="text-muted-foreground mb-2 block text-sm font-medium">
                    Sort by
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => onSortChange(e.target.value as SortOption)}
                    className="bg-accent/10 border-border focus:ring-primary/50 text-foreground w-full rounded-xl px-3 py-3 focus:ring-2 focus:outline-none"
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
                  <label className="text-muted-foreground mb-2 block text-sm font-medium">
                    Filter by
                  </label>
                  <select
                    value={filterBy}
                    onChange={(e) => onFilterChange(e.target.value as FilterOption)}
                    className="bg-accent/10 border-border focus:ring-primary/50 text-foreground w-full rounded-xl px-3 py-3 focus:ring-2 focus:outline-none"
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
                    className="bg-accent/10 hover:bg-accent/20 border-border text-foreground flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 transition-colors"
                  >
                    <RiCommandLine className="h-4 w-4" />
                    <span>Reshuffle Order</span>
                    <kbd className="bg-muted/50 border-border rounded px-2 py-1 text-xs">R</kbd>
                  </button>

                  <RainbowButton
                    onClick={onImFeelingLucky}
                    className="relative flex w-full items-center justify-center gap-2 overflow-hidden font-medium text-white"
                    style={{
                      background:
                        "linear-gradient(45deg, rgba(99, 102, 241, 0.8), rgba(168, 85, 247, 0.8), rgba(236, 72, 153, 0.8), rgba(239, 68, 68, 0.8), rgba(245, 158, 11, 0.8), rgba(34, 197, 94, 0.8))",
                      backgroundSize: "300% 300%",
                      animation: "rainbow-subtle 8s ease-in-out infinite",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      boxShadow:
                        "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                    }}
                    size="lg"
                  >
                    <span className="relative z-10">🍀 I'm Feeling Lucky</span>
                    <kbd className="border-border relative z-10 rounded bg-black/30 px-2 py-1 text-xs">
                      Ctrl+Tab
                    </kbd>
                  </RainbowButton>
                </div>

                {/* Results Preview */}
                <div className="border border-t pt-4">
                  <p className="text-muted-foreground text-sm">
                    Showing {resultsCount} countries
                    {searchInput && ` matching "${searchInput}"`}
                    {filterBy !== "all" && ` in ${filterBy} category`}
                  </p>
                </div>

                {/* Help Text */}
                <div className="text-muted-foreground/50 flex items-center justify-center gap-2 pt-2 text-xs">
                  <div className="flex items-center gap-1">
                    <kbd className="bg-muted border-border rounded px-2 py-1">Tab</kbd>
                    <span>to toggle</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <kbd className="bg-muted border-border rounded px-2 py-1">Esc</kbd>
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
