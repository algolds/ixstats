"use client";

import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { GlassCard, GlassCardContent } from '../components/glass/GlassCard';

interface SearchFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onClearAll: () => void;
}

export const SearchFilter = forwardRef<HTMLDivElement, SearchFilterProps>(
  function SearchFilter({ searchTerm, onSearchChange, onClearAll }, ref) {
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    const handleClearAll = () => {
      onClearAll();
      searchInputRef.current?.focus();
    };

    return (
      <GlassCard depth="base" blur="light" className="sticky top-56 z-40" ref={ref}>
        <GlassCardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text-muted)] h-5 w-5" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search countries by name, code, or continent..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClearAll}
              className="px-4 py-3 bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]/70 transition-all"
            >
              Clear All
            </motion.button>
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }
);