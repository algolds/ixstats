/**
 * CardGrid Component
 * Responsive grid layout with infinite scroll pagination
 * Phase 1: Card Display Components
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "~/lib/utils";
import { CardDisplay } from "./CardDisplay";
import type { CardInstance, CardFilters, CardSort, CardDisplaySize } from "~/types/cards-display";

/**
 * CardGrid component props
 */
export interface CardGridProps {
  /** Array of card instances to display */
  cards: CardInstance[];
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: string | null;
  /** Load more handler for infinite scroll */
  onLoadMore?: () => void;
  /** Has more cards to load */
  hasMore?: boolean;
  /** Filter options */
  filters?: CardFilters;
  /** Sort option */
  sort?: CardSort;
  /** Card size */
  cardSize?: CardDisplaySize;
  /** Card click handler */
  onCardClick?: (card: CardInstance) => void;
  /** Additional CSS classes */
  className?: string;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * Loading skeleton component
 */
const CardSkeleton = React.memo(() => (
  <div className="glass-hierarchy-child aspect-[2.5/3.5] w-full animate-pulse rounded-2xl">
    <div className="h-full w-full rounded-2xl bg-gradient-to-br from-white/10 to-white/5" />
  </div>
));
CardSkeleton.displayName = "CardSkeleton";

/**
 * CardGrid - Responsive masonry grid with infinite scroll
 *
 * Features:
 * - Responsive CSS grid layout
 * - Infinite scroll with intersection observer
 * - Loading skeletons with glass effect
 * - Filter/sort integration
 * - Staggered animations
 * - Empty state handling
 * - Error handling
 *
 * @example
 * ```tsx
 * <CardGrid
 *   cards={cardData}
 *   loading={isLoading}
 *   hasMore={hasMore}
 *   onLoadMore={fetchMoreCards}
 *   onCardClick={handleCardClick}
 * />
 * ```
 */
export const CardGrid = React.memo<CardGridProps>(
  ({
    cards,
    loading = false,
    error = null,
    onLoadMore,
    hasMore = false,
    filters,
    sort,
    cardSize = "medium",
    onCardClick,
    className,
    emptyMessage = "No cards found",
  }) => {
    const observerTarget = useRef<HTMLDivElement>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    /**
     * Intersection observer for infinite scroll
     */
    useEffect(() => {
      const target = observerTarget.current;
      if (!target || !onLoadMore || !hasMore || loading) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && !isLoadingMore) {
            setIsLoadingMore(true);
            onLoadMore();
            // Reset loading state after a delay
            setTimeout(() => setIsLoadingMore(false), 1000);
          }
        },
        {
          threshold: 0.1,
          rootMargin: "200px", // Start loading 200px before reaching the end
        }
      );

      observer.observe(target);

      return () => {
        observer.disconnect();
      };
    }, [onLoadMore, hasMore, loading, isLoadingMore]);

    /**
     * Grid column classes based on card size
     * Responsive: xs (1-2 cols) -> sm (2-3 cols) -> md (3-4 cols) -> lg (4-5 cols) -> xl (5-6 cols)
     */
    const gridCols = {
      small: "grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
      sm: "grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
      medium: "grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
      md: "grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
      large: "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    };

    /**
     * Gap classes based on card size
     * Responsive gaps: smaller on mobile, larger on desktop
     */
    const gapClass = {
      small: "gap-2 sm:gap-3 md:gap-4",
      sm: "gap-2 sm:gap-3 md:gap-4",
      medium: "gap-3 sm:gap-4 md:gap-6",
      md: "gap-3 sm:gap-4 md:gap-6",
      large: "gap-4 sm:gap-6 md:gap-8",
    };

    // Error state
    if (error) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
          <AlertCircle className="h-12 w-12 text-red-400" />
          <p className="text-lg font-medium text-white/80">{error}</p>
        </div>
      );
    }

    // Initial loading state
    if (loading && cards.length === 0) {
      return (
        <div className={cn("grid", gridCols[cardSize], gapClass[cardSize], className)}>
          {Array.from({ length: 12 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      );
    }

    // Empty state
    if (!loading && cards.length === 0) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
          <div className="glass-hierarchy-child rounded-full p-6">
            <svg
              className="h-16 w-16 text-white/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <p className="text-lg font-medium text-white/60">{emptyMessage}</p>
          {filters && Object.keys(filters).length > 0 && (
            <p className="text-sm text-white/40">Try adjusting your filters</p>
          )}
        </div>
      );
    }

    return (
      <div className={cn("space-y-6", className)}>
        {/* Cards grid */}
        <div className={cn("grid", gridCols[cardSize], gapClass[cardSize])}>
          <AnimatePresence mode="popLayout">
            {cards.map((card, index) => (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.03, // Stagger animation
                  layout: { duration: 0.3 },
                }}
              >
                <CardDisplay
                  card={card}
                  size={cardSize}
                  onClick={onCardClick}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Load more trigger */}
        {hasMore && (
          <div ref={observerTarget} className="flex justify-center py-8">
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-white/60">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading more cards...</span>
              </div>
            )}
          </div>
        )}

        {/* Loading more skeletons */}
        {isLoadingMore && (
          <div className={cn("grid", gridCols[cardSize], gapClass[cardSize])}>
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={`skeleton-${i}`} />
            ))}
          </div>
        )}

        {/* End of list indicator */}
        {!hasMore && cards.length > 0 && (
          <div className="flex justify-center py-8">
            <p className="text-sm text-white/40">
              You've reached the end of the collection
            </p>
          </div>
        )}
      </div>
    );
  }
);

CardGrid.displayName = "CardGrid";
