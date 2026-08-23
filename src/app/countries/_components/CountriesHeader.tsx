"use client";

import React from "react";
import { Search, Xmark as X, DiceSix as Dices, Globe } from "iconoir-react";

interface CountriesHeaderProps {
  searchInput?: string;
  onSearchChange?: (value: string) => void;
  onImFeelingLucky?: () => void;
  children?: React.ReactNode;
}

export const CountriesHeader: React.FC<CountriesHeaderProps> = ({
  searchInput = "",
  onSearchChange,
  onImFeelingLucky,
  children,
}) => {
  return (
    <div className="bg-background sticky top-16 z-30 mb-2 pt-2 pb-2">
      {/* Solid Opaque Apple Panel */}
      <div className="bg-card text-card-foreground border-border relative overflow-hidden rounded-2xl border p-4 shadow-xl transition-all md:p-5">
        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        {/* Header Title */}
        <div className="relative z-10 mb-3">
          <h1 className="text-foreground flex items-center gap-2.5 text-2xl font-bold tracking-tight md:text-3xl">
            <Globe className="h-6 w-6 text-purple-400" />
            <span>Countries</span>
          </h1>
        </div>

        {/* Prominent Inline Search Bar with Halo / Dynamic Island Pill Feeling Lucky Button */}
        <div className="relative z-10 mb-3">
          <div className="facet-surface facet-interactive group relative flex items-center rounded-xl border border-white/10 bg-black/20 px-3.5 py-2 backdrop-blur-md transition-all focus-within:border-purple-400/50 focus-within:ring-2 focus-within:ring-purple-500/30">
            <Search className="h-4 w-4 shrink-0 text-purple-400 transition-colors group-focus-within:text-purple-300" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search by country name, economic tier, region, or continent..."
              className="text-foreground placeholder:text-muted-foreground/60 w-full bg-transparent px-3 text-sm font-medium focus:outline-none"
            />

            {/* Clear Button */}
            {searchInput && (
              <button
                type="button"
                onClick={() => onSearchChange?.("")}
                className="text-muted-foreground hover:text-foreground mr-2 rounded-md p-1 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Dynamic Island / Halo Effect "Feeling Lucky" Button */}
            {onImFeelingLucky && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onImFeelingLucky();
                }}
                className="group relative flex shrink-0 items-center gap-2 overflow-hidden rounded-full border border-purple-500/40 bg-black/80 px-3.5 py-1.5 text-xs font-semibold text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.3)] backdrop-blur-xl transition-all hover:border-purple-400 hover:bg-black/90 hover:shadow-[0_0_22px_rgba(168,85,247,0.5)] active:scale-95"
                title="Explore a random country"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-indigo-500/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <Dices className="relative z-10 h-3.5 w-3.5 text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.8)] transition-transform duration-300 group-hover:rotate-45" />
                <span className="relative z-10 font-medium tracking-wide text-purple-100">
                  Feeling Lucky
                </span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Stat Cards rendered inside the unified sticky container */}
        {children && <div className="relative z-10">{children}</div>}
      </div>
    </div>
  );
};
