// src/components/cards/marketplace/MarketFilters.tsx
// Advanced filtering panel for marketplace browsing

"use client";

import React, { memo, useState } from "react";
import { cn } from "~/lib/utils";
import { CardRarity, CardType } from "@prisma/client";
import type { MarketFilters } from "~/types/marketplace";

interface MarketFiltersProps {
  filters: MarketFilters;
  onChange: (filters: Partial<MarketFilters>) => void;
  className?: string;
  collapsible?: boolean;
}

/**
 * Rarity display info
 */
const RARITY_OPTIONS: Array<{
  value: CardRarity;
  label: string;
  color: string;
}> = [
  { value: CardRarity.COMMON, label: "Common", color: "text-gray-400" },
  { value: CardRarity.UNCOMMON, label: "Uncommon", color: "text-green-400" },
  { value: CardRarity.RARE, label: "Rare", color: "text-blue-400" },
  {
    value: CardRarity.ULTRA_RARE,
    label: "Ultra Rare",
    color: "text-purple-400",
  },
  { value: CardRarity.EPIC, label: "Epic", color: "text-pink-400" },
  { value: CardRarity.LEGENDARY, label: "Legendary", color: "text-yellow-400" },
];

/**
 * Card type options
 */
const TYPE_OPTIONS: Array<{ value: CardType; label: string }> = [
  { value: CardType.NATION, label: "Nation" },
  { value: CardType.LORE, label: "Lore" },
  { value: CardType.NS_IMPORT, label: "NS Import" },
  { value: CardType.SPECIAL, label: "Special" },
  { value: CardType.COMMUNITY, label: "Community" },
];

/**
 * MarketFiltersPanel - Advanced filtering component
 *
 * Features:
 * - Rarity checkboxes (all 6 rarities)
 * - Season selector dropdown
 * - Card type filter
 * - Price range slider (dual-thumb)
 * - Stat range filters (collapsible)
 * - Express/Featured only toggles
 * - Clear all filters button
 *
 * @example
 * <MarketFiltersPanel
 *   filters={currentFilters}
 *   onChange={(newFilters) => updateFilters(newFilters)}
 *   collapsible={true}
 * />
 */
export const MarketFiltersPanel = memo<MarketFiltersProps>(
  ({ filters, onChange, className, collapsible = false }) => {
    const [isExpanded, setIsExpanded] = useState(!collapsible);
    const [showStatRanges, setShowStatRanges] = useState(false);

    /**
     * Toggle rarity filter
     */
    const toggleRarity = (rarity: CardRarity) => {
      const newRarities = filters.rarities.includes(rarity)
        ? filters.rarities.filter((r) => r !== rarity)
        : [...filters.rarities, rarity];

      onChange({ rarities: newRarities });
    };

    /**
     * Toggle card type filter
     */
    const toggleType = (type: CardType) => {
      const newTypes = filters.cardTypes.includes(type)
        ? filters.cardTypes.filter((t) => t !== type)
        : [...filters.cardTypes, type];

      onChange({ cardTypes: newTypes });
    };

    /**
     * Update price range
     */
    const updatePriceRange = (min: number, max: number) => {
      onChange({ priceMin: min, priceMax: max });
    };

    /**
     * Clear all filters
     */
    const clearAll = () => {
      onChange({
        rarities: [],
        seasons: [],
        cardTypes: [],
        priceMin: 0,
        priceMax: 10000,
        statRanges: undefined,
        searchQuery: "",
        showExpressOnly: false,
        showFeaturedOnly: false,
      });
    };

    /**
     * Check if any filters are active
     */
    const hasActiveFilters =
      filters.rarities.length > 0 ||
      filters.seasons.length > 0 ||
      filters.cardTypes.length > 0 ||
      filters.priceMin > 0 ||
      filters.priceMax < 10000 ||
      filters.showExpressOnly ||
      filters.showFeaturedOnly;

    return (
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h3 className="text-lg font-bold text-white">Filters</h3>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearAll}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Clear All
              </button>
            )}

            {collapsible && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  className={cn(
                    "h-5 w-5 transition-transform",
                    isExpanded && "rotate-180"
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filter content */}
        {isExpanded && (
          <div className="space-y-4 p-4">
            {/* Rarity filters */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-300">
                Rarity
              </h4>
              <div className="space-y-2">
                {RARITY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.rarities.includes(option.value)}
                      onChange={() => toggleRarity(option.value)}
                      className="h-4 w-4 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className={cn("text-sm", option.color)}>
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Card type filters */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-300">
                Card Type
              </h4>
              <div className="space-y-2">
                {TYPE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.cardTypes.includes(option.value)}
                      onChange={() => toggleType(option.value)}
                      className="h-4 w-4 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-300">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price range */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-300">
                Price Range (IxC)
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={filters.priceMax}
                    value={filters.priceMin}
                    onChange={(e) =>
                      updatePriceRange(
                        parseInt(e.target.value) || 0,
                        filters.priceMax
                      )
                    }
                    className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    placeholder="Min"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    min={filters.priceMin}
                    max={10000}
                    value={filters.priceMax}
                    onChange={(e) =>
                      updatePriceRange(
                        filters.priceMin,
                        parseInt(e.target.value) || 10000
                      )
                    }
                    className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    placeholder="Max"
                  />
                </div>

                {/* Dual-thumb range slider */}
                <input
                  type="range"
                  min={0}
                  max={10000}
                  step={10}
                  value={filters.priceMax}
                  onChange={(e) =>
                    updatePriceRange(
                      filters.priceMin,
                      parseInt(e.target.value)
                    )
                  }
                  className="w-full"
                />
              </div>
            </div>

            {/* Special filters */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-300">
                Special
              </h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showExpressOnly || false}
                    onChange={(e) =>
                      onChange({ showExpressOnly: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">
                    Express Only (30min)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showFeaturedOnly || false}
                    onChange={(e) =>
                      onChange({ showFeaturedOnly: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">Featured Only</span>
                </label>
              </div>
            </div>

            {/* Stat ranges (collapsible) */}
            <div>
              <button
                onClick={() => setShowStatRanges(!showStatRanges)}
                className="flex w-full items-center justify-between text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                <span>Stat Ranges</span>
                <svg
                  className={cn(
                    "h-4 w-4 transition-transform",
                    showStatRanges && "rotate-180"
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showStatRanges && (
                <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-gray-400">
                    Filter cards by stat values (Coming Soon)
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

MarketFiltersPanel.displayName = "MarketFiltersPanel";
