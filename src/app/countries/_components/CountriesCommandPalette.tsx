"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { RainbowButton } from "~/components/ui/magicui/rainbow-button";
import { RiSearchLine, RiCommandLine, RiShuffleLine } from "react-icons/ri";
import { cn } from "~/lib/utils";

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
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);
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
            className="fixed inset-0 z-[10001] bg-black/50"
          />

          {/* Command Palette */}
          <motion.div
            initial={{ x: "-50%", y: "-60%", opacity: 0 }}
            animate={{ x: "-50%", y: "-50%", opacity: 1 }}
            exit={{ x: "-50%", y: "-60%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="bg-popover border-border fixed top-1/2 left-1/2 z-[10002] w-80 rounded-xl border shadow-xl md:w-96"
          >
            <div className="p-5">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="text-foreground flex items-center gap-2.5 text-base font-semibold">
                    <RiCommandLine className="h-5 w-5 text-blue-400" />
                    Filter & Sort
                  </div>
                  <button
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5 transition-colors"
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
                <div className="relative flex items-center">
                  <RiSearchLine className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search countries..."
                    value={searchInput}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="bg-muted/50 text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-lg border border-transparent py-2.5 pr-3 pl-10 text-sm transition-all focus:border-blue-400/50 focus:ring-1 focus:outline-none"
                    autoComplete="off"
                  />
                </div>

                {/* Sort — pill selector */}
                <div>
                  <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
                    Sort by
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => onSortChange(opt.value)}
                        className={cn(
                          "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                          sortBy === opt.value
                            ? "bg-primary text-primary-foreground"
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
                  <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
                    Filter
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {filterOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => onFilterChange(opt.value)}
                        className={cn(
                          "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                          filterBy === opt.value
                            ? "bg-primary text-primary-foreground"
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
                    className="bg-muted hover:bg-muted/80 text-foreground flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors"
                  >
                    <RiShuffleLine className="h-4 w-4" />
                    <span>Reshuffle</span>
                    <kbd className="text-muted-foreground bg-background rounded px-1.5 py-0.5 text-[10px]">
                      R
                    </kbd>
                  </button>

                  <RainbowButton
                    onClick={onImFeelingLucky}
                    className="relative flex flex-1 items-center justify-center gap-2 overflow-hidden text-sm font-medium text-white"
                    style={{
                      background:
                        "linear-gradient(45deg, rgba(99,102,241,0.8), rgba(168,85,247,0.8), rgba(236,72,153,0.8), rgba(239,68,68,0.8), rgba(245,158,11,0.8), rgba(34,197,94,0.8))",
                      backgroundSize: "300% 300%",
                      animation: "rainbow-subtle 8s ease-in-out infinite",
                    }}
                    size="lg"
                  >
                    <span className="relative z-10">Lucky</span>
                    <kbd className="relative z-10 rounded bg-black/30 px-1.5 py-0.5 text-[10px]">
                      Ctrl+Tab
                    </kbd>
                  </RainbowButton>
                </div>

                {/* Results + Help */}
                <div className="border-border border-t pt-3">
                  <p className="text-muted-foreground text-xs">
                    {resultsCount} countries
                    {searchInput && ` matching "${searchInput}"`}
                    {filterBy !== "all" && ` · ${filterBy}`}
                  </p>
                  <div className="text-muted-foreground/50 mt-2 flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1">
                      <kbd className="bg-muted rounded px-1.5 py-0.5">Tab</kbd> toggle
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="bg-muted rounded px-1.5 py-0.5">Esc</kbd> close
                    </span>
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
