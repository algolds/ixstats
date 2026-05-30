"use client";

import React, { forwardRef } from "react";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import { GlassCard, GlassCardContent } from "../components/glass/GlassCard";
import { Input } from "~/components/ui/input";

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
    <GlassCard depth="base" blur="light" className="sticky top-14 z-20" ref={ref}>
      <GlassCardContent>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-[var(--color-text-muted)] dark:text-zinc-300" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search countries by name, code, or continent..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-12 border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]/50 py-3 pl-12 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-blue-400/50 focus:ring-blue-400/50 dark:text-white dark:placeholder-zinc-300"
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
