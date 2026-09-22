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
    <div className="bg-background sticky top-0 z-40 mb-6 pt-2 pb-3">
      {/* Solid Opaque Apple Panel */}
      <div className="bg-card text-card-foreground border-border relative overflow-hidden rounded-2xl border p-4 shadow-xl transition-all md:p-5">
        {/* Subtle Micro-Texture Overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.055]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "16px 16px",
          }}
        />

        {/* Header Title */}
        <div className="relative z-10 mb-3">
          <h1 className="text-foreground flex items-center gap-2.5 text-2xl font-bold tracking-tight md:text-3xl">
            <Globe className="h-6 w-6 text-primary" />
            <span>Countries</span>
          </h1>
        </div>

        {/* Prominent Inline Search Bar with Halo / Dynamic Island Pill Feeling Lucky Button */}
        <div className="relative z-10 mb-3">
          <div className="facet-surface facet-interactive group relative flex items-center rounded-xl border border-border/80 bg-background/60 px-3.5 py-2 backdrop-blur-md transition-all focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-focus-within:text-foreground" />
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

            {/* "Feeling Lucky" Random Country Button */}
            {onImFeelingLucky && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onImFeelingLucky();
                }}
                data-cuelume-press="tick"
                className="group relative flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-md transition-colors hover:border-border hover:bg-accent/40 active:scale-95"
                title="Explore a random country"
              >
                <Dices className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-hover:rotate-45 group-hover:text-foreground" />
                <span className="font-medium tracking-wide">Feeling Lucky</span>
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
