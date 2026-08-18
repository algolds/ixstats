"use client";

import React from "react";
import { motion } from "motion/react";
import { RainbowButton } from "~/components/ui/magicui/rainbow-button";
import { RiSearchLine, RiCommandLine, RiShuffleLine } from "react-icons/ri";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";

type SortOption = "random" | "name" | "population" | "gdp" | "gdpPerCapita" | "tier";
type FilterOption = "all" | "developed" | "developing" | "superpower";

interface CountriesDIViewProps {
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

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "random", label: "Random" },
  { value: "name", label: "A–Z" },
  { value: "population", label: "Population" },
  { value: "gdp", label: "GDP" },
  { value: "gdpPerCapita", label: "GDP/Cap" },
  { value: "tier", label: "Tier" },
];

const filterOptions: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All" },
  { value: "developed", label: "Developed" },
  { value: "developing", label: "Developing" },
  { value: "superpower", label: "Superpowers" },
];

export function CountriesDIView({
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
}: CountriesDIViewProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // Focus search input on mount without page jump
    const timer = setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="p-4"
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <RiCommandLine className="h-4 w-4 text-purple-400" />
            Filter & Sort Countries
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative flex items-center">
          <RiSearchLine className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search countries..."
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-muted/50 text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-lg border border-transparent py-2 pr-3 pl-10 text-sm transition-all focus:border-purple-400/50 focus:ring-1 focus:outline-none"
            autoComplete="off"
            data-command-palette-search="true"
          />
        </div>

        {/* Sort — pill selector */}
        <div>
          <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wide uppercase">
            Sort by
          </p>
          <div className="flex flex-wrap gap-1">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSortChange(opt.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  sortBy === opt.value
                    ? "bg-purple-600 text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter — pill selector */}
        <div>
          <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wide uppercase">
            Filter
          </p>
          <div className="flex flex-wrap gap-1">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onFilterChange(opt.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filterBy === opt.value
                    ? "bg-purple-600 text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onReshuffle}
            className="bg-muted hover:bg-muted/80 text-foreground flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs transition-colors"
          >
            <RiShuffleLine className="h-3.5 w-3.5" />
            <span>Reshuffle</span>
            <kbd className="text-muted-foreground bg-background rounded px-1 py-0.5 text-[9px]">
              R
            </kbd>
          </button>

          <RainbowButton
            onClick={onImFeelingLucky}
            className="relative flex flex-1 items-center justify-center gap-1.5 overflow-hidden text-xs font-medium text-white"
            style={{
              background:
                "linear-gradient(45deg, rgba(168,85,247,0.8), rgba(236,72,153,0.8), rgba(99,102,241,0.8))",
              backgroundSize: "300% 300%",
              animation: "rainbow-subtle 8s ease-in-out infinite",
            }}
            size="sm"
          >
            <span className="relative z-10">Lucky</span>
            <kbd className="relative z-10 rounded bg-black/30 px-1 py-0.5 text-[9px]">Ctrl+Tab</kbd>
          </RainbowButton>
        </div>

        {/* Results Info */}
        <div className="border-border border-t pt-2 text-center">
          <p className="text-muted-foreground text-xs">
            {resultsCount} countries
            {searchInput && ` matching "${searchInput}"`}
            {filterBy !== "all" && ` · ${filterBy}`}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
