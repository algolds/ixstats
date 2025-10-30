"use client";

import React, { forwardRef } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { GlassCard, GlassCardContent } from "../components/glass/GlassCard";

interface SearchFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onClearAll: () => void;
}

export const SearchFilter = forwardRef<HTMLDivElement, SearchFilterProps>(function SearchFilter(
  { searchTerm, onSearchChange, onClearAll },
  ref
) {
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const handleClearAll = () => {
    onClearAll();
    searchInputRef.current?.focus();
  };

  return (
    <GlassCard depth="base" blur="light" className="sticky top-56 z-40" ref={ref}>
      <GlassCardContent>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-[var(--color-text-muted)]" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search countries by name, code, or continent..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/50 py-3 pr-4 pl-12 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] transition-all focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/50 focus:outline-none"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleClearAll}
            className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/50 px-4 py-3 text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-bg-secondary)]/70 hover:text-[var(--color-text-primary)]"
          >
            Clear All
          </motion.button>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
});
