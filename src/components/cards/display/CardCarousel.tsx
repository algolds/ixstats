/**
 * CardCarousel Component
 * Apple-style horizontal carousel for featured cards
 * Phase 1: Card Display Components
 */

"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { CardDisplay } from "./CardDisplay";
import type { CardInstance, CardDisplaySize } from "~/types/cards-display";

/**
 * CardCarousel component props
 */
export interface CardCarouselProps {
  /** Array of card instances to display */
  cards: CardInstance[];
  /** Card size */
  cardSize?: CardDisplaySize;
  /** Auto-play interval in milliseconds (0 to disable) */
  autoPlay?: boolean;
  /** Auto-play interval in ms */
  interval?: number;
  /** Card click handler */
  onCardClick?: (card: CardInstance) => void;
  /** Additional CSS classes */
  className?: string;
  /** Show navigation arrows */
  showNavigation?: boolean;
}

/**
 * CardCarousel - Smooth horizontal carousel with momentum scrolling
 *
 * Features:
 * - Smooth momentum scrolling
 * - Auto-play option
 * - Navigation arrows
 * - Featured cards showcase
 * - Responsive spacing
 * - Staggered entrance animations
 *
 * @example
 * ```tsx
 * <CardCarousel
 *   cards={featuredCards}
 *   autoPlay
 *   interval={5000}
 *   onCardClick={handleCardClick}
 * />
 * ```
 */
export const CardCarousel = React.memo<CardCarouselProps>(
  ({
    cards,
    cardSize = "medium",
    autoPlay = false,
    interval = 5000,
    onCardClick,
    className,
    showNavigation = true,
  }) => {
    const carouselRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Check if carousel can scroll in either direction
     */
    const checkScrollability = () => {
      if (carouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10); // 10px threshold
      }
    };

    /**
     * Scroll carousel left
     */
    const scrollLeft = () => {
      if (carouselRef.current) {
        const scrollAmount = carouselRef.current.clientWidth * 0.8;
        carouselRef.current.scrollBy({
          left: -scrollAmount,
          behavior: "smooth",
        });
      }
    };

    /**
     * Scroll carousel right
     */
    const scrollRight = () => {
      if (carouselRef.current) {
        const scrollAmount = carouselRef.current.clientWidth * 0.8;
        carouselRef.current.scrollBy({
          left: scrollAmount,
          behavior: "smooth",
        });
      }
    };

    /**
     * Auto-play functionality
     */
    useEffect(() => {
      if (!autoPlay || cards.length === 0) return;

      autoPlayTimerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const nextIndex = (prev + 1) % cards.length;

          // Scroll to next card
          if (carouselRef.current) {
            const cardWidth =
              cardSize === "small" ? 144 : cardSize === "medium" ? 208 : 272;
            const gap = 16;
            const scrollPosition = nextIndex * (cardWidth + gap);

            carouselRef.current.scrollTo({
              left: scrollPosition,
              behavior: "smooth",
            });
          }

          return nextIndex;
        });
      }, interval);

      return () => {
        if (autoPlayTimerRef.current) {
          clearInterval(autoPlayTimerRef.current);
        }
      };
    }, [autoPlay, interval, cards.length, cardSize]);

    /**
     * Pause auto-play on hover
     */
    const handleMouseEnter = () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };

    /**
     * Resume auto-play on mouse leave
     */
    const handleMouseLeave = () => {
      if (autoPlay && cards.length > 0) {
        autoPlayTimerRef.current = setInterval(() => {
          scrollRight();
        }, interval);
      }
    };

    /**
     * Initial scroll check
     */
    useEffect(() => {
      checkScrollability();
    }, [cards]);

    if (cards.length === 0) {
      return null;
    }

    return (
      <div
        className={cn("relative w-full", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Carousel container */}
        <div
          ref={carouselRef}
          className={cn(
            "flex gap-3 sm:gap-4 overflow-x-auto scroll-smooth py-2 sm:py-4 px-2 sm:px-0",
            // Hide scrollbar
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            // Better mobile touch scrolling
            "overscroll-x-contain snap-x snap-mandatory"
          )}
          onScroll={checkScrollability}
        >
          <AnimatePresence initial={false}>
            {cards.map((card, index) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: "easeOut",
                }}
                className="flex-shrink-0 snap-center"
              >
                <CardDisplay
                  card={card}
                  size={cardSize}
                  onClick={onCardClick}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Padding at the end */}
          <div className="flex-shrink-0 w-2 sm:w-4" />
        </div>

        {/* Navigation arrows */}
        {showNavigation && (
          <>
            {/* Left arrow - hidden on mobile for better touch scrolling */}
            <AnimatePresence>
              {canScrollLeft && (
                <motion.button
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onClick={scrollLeft}
                  className={cn(
                    "absolute left-1 sm:left-2 top-1/2 z-10 -translate-y-1/2",
                    "glass-hierarchy-interactive",
                    "flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full",
                    "transition-all hover:scale-110 active:scale-95",
                    "shadow-lg",
                    "hidden sm:flex"
                  )}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Right arrow - hidden on mobile for better touch scrolling */}
            <AnimatePresence>
              {canScrollRight && (
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={scrollRight}
                  className={cn(
                    "absolute right-1 sm:right-2 top-1/2 z-10 -translate-y-1/2",
                    "glass-hierarchy-interactive",
                    "flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full",
                    "transition-all hover:scale-110 active:scale-95",
                    "shadow-lg",
                    "hidden sm:flex"
                  )}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </motion.button>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Auto-play indicator dots */}
        {autoPlay && cards.length > 1 && (
          <div className="mt-3 sm:mt-4 flex justify-center gap-1.5 sm:gap-2">
            {cards.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  if (carouselRef.current) {
                    const cardWidth =
                      cardSize === "small" ? 144 : cardSize === "medium" ? 208 : 272;
                    const gap = 16;
                    const scrollPosition = index * (cardWidth + gap);

                    carouselRef.current.scrollTo({
                      left: scrollPosition,
                      behavior: "smooth",
                    });
                  }
                }}
                className={cn(
                  "h-1.5 sm:h-2 rounded-full transition-all duration-300 touch-manipulation",
                  currentIndex === index
                    ? "w-6 sm:w-8 bg-white"
                    : "w-1.5 sm:w-2 bg-white/30 hover:bg-white/50 active:bg-white/60"
                )}
                aria-label={`Go to card ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Gradient fade on edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/20 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/20 to-transparent" />
      </div>
    );
  }
);

CardCarousel.displayName = "CardCarousel";
