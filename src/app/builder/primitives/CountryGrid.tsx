"use client";

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Globe, ChevronUp, ChevronDown } from 'lucide-react';
import { ScrollVelocityContainer } from '~/components/magicui/scroll-based-velocity';
import { GlassCard, GlassCardContent } from '../components/glass/GlassCard';
import { CountriesFocusGridModularBuilder } from '../components/CountriesFocusGridModularBuilder';
import type { RealCountryData } from '../lib/economy-data-service';
import type { CountryCardData } from '../components/CountryFocusCardBuilder';

interface CountryGridProps {
  countries: RealCountryData[];
  filteredCountries: RealCountryData[];
  searchTerm: string;
  selectedArchetype: string;
  onCountryHover: (country: RealCountryData | null) => void;
  onCountryClick: (country: RealCountryData) => void;
  onClearFilters: () => void;
  softSelectedCountryId: string | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  scrollPosition: number;
  onScroll: (position: number) => void;
  flagUrls?: Record<string, string | null>;
}

export function CountryGrid({
  countries,
  filteredCountries,
  searchTerm,
  selectedArchetype,
  onCountryHover,
  onCountryClick,
  onClearFilters,
  softSelectedCountryId,
  onMouseEnter,
  onMouseLeave,
  scrollPosition,
  onScroll,
  flagUrls = {}
}: CountryGridProps) {
  const INITIAL_LOAD_COUNT = 20;
  const BATCH_SIZE = 10;
  const SCROLL_STEP = 120;
  const AUTO_SCROLL_SPEED = 0.8; // Pixels per frame for smooth auto-scroll
  const INTERACTION_TIMEOUT = 3000; // ms before resuming auto-scroll after interaction
  
  // Core state
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD_COUNT);
  const [isGridAtTop, setIsGridAtTop] = useState(true);
  const [isPageAtBottom, setIsPageAtBottom] = useState(false);
  
  // Auto-scroll state
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false);
  
  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const countriesListRef = useRef<HTMLDivElement>(null);
  const autoScrollAnimationRef = useRef<number | null>(null);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollUpdate = useRef<number>(0);
  const lastPageScrollUpdate = useRef<number>(0);
  const lastUserInteraction = useRef<number>(0);

  const mapToCountryCardData = useCallback((country: RealCountryData): CountryCardData => {
    return {
      id: country.countryCode,
      name: country.name,
    };
  }, []);

  // Create infinite loop data - duplicate countries for seamless scrolling with unique keys
  const infiniteCountries = useMemo(() => {
    if (filteredCountries.length === 0) return [];
    
    // Use a smaller subset for better performance (limit to reasonable number)
    const maxCountries = Math.min(16, filteredCountries.length); // Max 16 countries for performance
    const baseCountries = filteredCountries.slice(0, maxCountries);
    const duplicatedSet: CountryCardData[] = [];
    
    // Create only 2 sets for better performance
    for (let setIndex = 0; setIndex < 2; setIndex++) {
      baseCountries.forEach((country, countryIndex) => {
        duplicatedSet.push({
          id: `${country.countryCode}-set${setIndex}-${countryIndex}`, // Unique key for each duplicate
          name: country.name,
          originalId: country.countryCode, // Keep original ID for lookups
        });
      });
    }
    
    return duplicatedSet;
  }, [filteredCountries]);

  // Interaction detection - mark user interaction and pause auto-scroll
  const handleUserInteraction = useCallback(() => {
    lastUserInteraction.current = performance.now();
    
    if (!isInteracting) {
      setIsInteracting(true);
      setIsAutoScrolling(false);
    }

    // Clear existing timeout and set new one
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
      // Resume auto-scroll after interaction timeout with smooth transition
      setTimeout(() => setIsAutoScrolling(true), 500);
    }, INTERACTION_TIMEOUT);
  }, [isInteracting]);

  // Check if page is at bottom
  const updatePageScrollState = useCallback(() => {
    const now = performance.now();
    if (now - lastPageScrollUpdate.current < 16) return;
    lastPageScrollUpdate.current = now;

    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    const atBottom = scrollTop + windowHeight >= documentHeight - 100;
    setIsPageAtBottom(atBottom);
  }, []);

  const [parallaxOffsets, setParallaxOffsets] = useState<number[]>([]);
  const parallaxFactors = [1, 0.85, 1.15, 0.9, 1.1]; // Different speeds for each column

  // Infinite auto-scroll with seamless looping
  const runAutoScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || !isAutoScrolling || isInteracting || infiniteCountries.length === 0) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;
    
    if (maxScroll <= 0) return; // Not enough content to scroll

    // Calculate section size (one copy of the content)
    const sectionHeight = scrollHeight / 2; // Since we have 2 copies
    
    // Continuous downward scrolling
    let nextScrollTop = scrollTop + AUTO_SCROLL_SPEED;
    
    // Check if we need to reset for infinite loop
    if (nextScrollTop >= sectionHeight) {
      // Reset to beginning seamlessly
      nextScrollTop = 0;
    }
    
    // Ensure we don't exceed scroll bounds
    if (nextScrollTop > maxScroll) {
      nextScrollTop = 0;
    }

    // Update parallax offsets for each column  
    const newOffsets = parallaxFactors.map((factor) => {
      return nextScrollTop * factor * 0.1; // Subtle parallax effect
    });
    setParallaxOffsets(newOffsets);

    // Use direct property assignment for better performance
    container.scrollTop = nextScrollTop;
    
    // Schedule next frame
    autoScrollAnimationRef.current = requestAnimationFrame(runAutoScroll);
  }, [isAutoScrolling, isInteracting, infiniteCountries.length, parallaxFactors]);

  // Optimized scroll state updates with reduced DOM reads
  const updateScrollState = useCallback((container: HTMLDivElement) => {
    const now = performance.now();
    if (now - lastScrollUpdate.current < 16) return; // 60fps throttle
    lastScrollUpdate.current = now;

    // Single DOM read for performance
    const scrollMetrics = {
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight
    };
    
    // Batch state updates to prevent multiple re-renders
    const atTop = scrollMetrics.scrollTop <= 5;
    if (isGridAtTop !== atTop) {
      setIsGridAtTop(atTop);
    }
    
    // Update parent scroll position with throttling
    onScroll(scrollMetrics.scrollTop);
    
    // Optimized infinite scroll - only during interaction
    if (isInteracting && 
        scrollMetrics.scrollTop + scrollMetrics.clientHeight >= scrollMetrics.scrollHeight - 100 && 
        visibleCount < filteredCountries.length) {
      setVisibleCount(prevCount => Math.min(prevCount + BATCH_SIZE, filteredCountries.length));
    }
  }, [visibleCount, filteredCountries.length, onScroll, isInteracting, isGridAtTop]);

  const handleScroll = useCallback(() => {
    const { current } = scrollContainerRef;
    if (current) {
      // Mark as user interaction if not auto-scrolling
      if (!isAutoScrolling) {
        handleUserInteraction();
      }
      updateScrollState(current);
    }
  }, [updateScrollState, isAutoScrolling, handleUserInteraction]);

  // Handle wheel events with page-first priority + interaction detection
  const handleGlobalWheel = useCallback((e: WheelEvent) => {
    const { current } = scrollContainerRef;
    if (current && filteredCountries.length > 0) {
      // Check if wheel event is over archetype selector or other scrollable UI elements
      const target = e.target as Element;
      const isOverArchetypeSelector = target?.closest('.fixed.left-6.top-6.bottom-6.w-80'); // Specific archetype selector
      const isOverScrollableElement = target?.closest('[data-scrollable="true"]');
      const isOverCountryGrid = target?.closest('[data-country-grid="true"]');
      
      // If scrolling over archetype selector or other marked scrollable elements, let them handle it
      // But still allow country grid to handle its own scrolling
      if ((isOverArchetypeSelector || isOverScrollableElement) && !isOverCountryGrid) {
        return; // Let the element handle its own scrolling
      }
      
      // Always mark as user interaction on wheel
      handleUserInteraction();
      
      const scrollingUp = e.deltaY < 0;
      const scrollingDown = e.deltaY > 0;
      
      if (scrollingDown && !isPageAtBottom) {
        return; // Let default page scroll happen
      } else if (scrollingUp && !isPageAtBottom) {
        return; // Let default page scroll happen
      } else if (scrollingDown && isPageAtBottom) {
        // Page at bottom, scroll grid
        current.scrollTop += e.deltaY * 0.5;
        e.preventDefault();
      } else if (scrollingUp && isPageAtBottom && !isGridAtTop) {
        // Page at bottom, scroll grid up
        current.scrollTop += e.deltaY * 0.5;
        e.preventDefault();
      } else if (scrollingUp && isPageAtBottom && isGridAtTop) {
        // Both at top, scroll page up
        window.scrollBy(0, e.deltaY * 0.8);
        e.preventDefault();
      }
    }
  }, [filteredCountries.length, isGridAtTop, isPageAtBottom, handleUserInteraction]);

  // Arrow scroll functions with page-first priority + interaction detection
  const scrollUp = useCallback(() => {
    handleUserInteraction(); // Mark as user interaction
    
    const { current } = scrollContainerRef;
    if (current) {
      if (!isPageAtBottom) {
        window.scrollBy(0, -SCROLL_STEP);
      } else if (isPageAtBottom && !isGridAtTop) {
        current.scrollTop = Math.max(0, current.scrollTop - SCROLL_STEP);
      } else if (isPageAtBottom && isGridAtTop) {
        window.scrollBy(0, -SCROLL_STEP);
      }
    }
  }, [isGridAtTop, isPageAtBottom, handleUserInteraction]);

  const scrollDown = useCallback(() => {
    handleUserInteraction(); // Mark as user interaction
    
    const { current } = scrollContainerRef;
    if (current) {
      if (!isPageAtBottom) {
        window.scrollBy(0, SCROLL_STEP);
      } else if (isPageAtBottom) {
        current.scrollTop = Math.min(
          current.scrollHeight - current.clientHeight,
          current.scrollTop + SCROLL_STEP
        );
      }
    }
  }, [isPageAtBottom, handleUserInteraction]);

  // Auto-scroll management effect
  useEffect(() => {
    if (isAutoScrolling && !isInteracting) {
      autoScrollAnimationRef.current = requestAnimationFrame(runAutoScroll);
    } else {
      if (autoScrollAnimationRef.current) {
        cancelAnimationFrame(autoScrollAnimationRef.current);
        autoScrollAnimationRef.current = null;
      }
    }

    return () => {
      if (autoScrollAnimationRef.current) {
        cancelAnimationFrame(autoScrollAnimationRef.current);
      }
    };
  }, [isAutoScrolling, isInteracting, runAutoScroll]);

  // Scroll container event listeners
  useEffect(() => {
    const { current } = scrollContainerRef;
    if (current) {
      current.addEventListener('scroll', handleScroll, { passive: true });
      
      // Add comprehensive interaction detection
      const handleMouseEnter = () => handleUserInteraction();
      const handleMouseMove = () => handleUserInteraction();
      const handleMouseDown = () => handleUserInteraction();
      const handleTouchStart = () => handleUserInteraction();
      const handleTouchMove = () => handleUserInteraction();
      const handleFocus = () => handleUserInteraction();
      const handleKeyDown = () => handleUserInteraction();
      
      // Mouse and touch events
      current.addEventListener('mouseenter', handleMouseEnter);
      current.addEventListener('mousemove', handleMouseMove);
      current.addEventListener('mousedown', handleMouseDown);
      current.addEventListener('touchstart', handleTouchStart, { passive: true });
      current.addEventListener('touchmove', handleTouchMove, { passive: true });
      
      // Focus and keyboard events
      current.addEventListener('focusin', handleFocus);
      current.addEventListener('keydown', handleKeyDown);
      
      // Initialize scroll state
      updateScrollState(current);
      
      return () => {
        current.removeEventListener('scroll', handleScroll);
        current.removeEventListener('mouseenter', handleMouseEnter);
        current.removeEventListener('mousemove', handleMouseMove);
        current.removeEventListener('mousedown', handleMouseDown);
        current.removeEventListener('touchstart', handleTouchStart);
        current.removeEventListener('touchmove', handleTouchMove);
        current.removeEventListener('focusin', handleFocus);
        current.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleScroll, updateScrollState, handleUserInteraction]);

  // Global wheel event listener
  useEffect(() => {
    document.addEventListener('wheel', handleGlobalWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleGlobalWheel);
  }, [handleGlobalWheel]);

  // Page scroll listener
  useEffect(() => {
    const handlePageScroll = () => updatePageScrollState();
    
    window.addEventListener('scroll', handlePageScroll, { passive: true });
    updatePageScrollState(); // Initialize
    
    return () => window.removeEventListener('scroll', handlePageScroll);
  }, [updatePageScrollState]);

  // Reset on filter/search changes
  useEffect(() => {
    setVisibleCount(INITIAL_LOAD_COUNT);
    // Reset scroll position to top when filters change
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [searchTerm, selectedArchetype, filteredCountries]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
      if (autoScrollAnimationRef.current) {
        cancelAnimationFrame(autoScrollAnimationRef.current);
      }
    };
  }, []);

  return (
    <div 
      className="relative z-50"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Main Countries Grid Container - Matching Main Grid Styling */}
      <div 
        ref={scrollContainerRef}
        className="relative max-h-[80vh] overflow-y-auto scrollbar-none"
        data-country-grid="true"
        onScroll={handleScroll}
      >
        {/* Subtle gradient fades for infinite scroll */}
        <div className="absolute top-0 left-0 right-0 h-6 pointer-events-none z-20 bg-gradient-to-b from-[var(--color-bg-primary)]/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none z-20 bg-gradient-to-t from-[var(--color-bg-primary)]/80 via-[var(--color-bg-primary)]/20 to-transparent" />
        
        {/* Background Effects - Matching Main Grid */}
        {isAutoScrolling && filteredCountries.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-yellow-500/5"
              animate={{
                backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>
        )}

        {/* Content */}
        {filteredCountries.length === 0 ? (
          <div className="text-center py-12 glass-surface shadow-xl rounded-lg p-4 backdrop-blur-sm">
            <Globe className="h-12 w-12 text-[var(--color-text-muted)]/50 mx-auto mb-4" />
            <p className="text-[var(--color-text-muted)]">No countries match your criteria</p>
          </div>
        ) : (
          <ScrollVelocityContainer>
            <div ref={countriesListRef}>
              <CountriesFocusGridModularBuilder
                countries={infiniteCountries}
                visibleCount={infiniteCountries.length} // Show all infinite countries
                onCardHoverChange={(countryId: string | null) => {
                  handleUserInteraction(); // Detect interaction
                  if (countryId) {
                    // Extract original ID from infinite scroll duplicate if needed
                    const originalId = infiniteCountries.find(c => c.id === countryId)?.originalId || countryId;
                    const hovered = countries.find(c => c.countryCode === originalId);
                    onCountryHover(hovered || null);
                  } else {
                    onCountryHover(null);
                  }
                }}
                onCountryClick={(countryId: string) => {
                  handleUserInteraction(); // Detect interaction
                  // Extract original ID from infinite scroll duplicate if needed
                  const originalId = infiniteCountries.find(c => c.id === countryId)?.originalId || countryId;
                  const selected = filteredCountries.find(c => c.countryCode === originalId);
                  if (selected) {
                    onCountryClick(selected);
                  }
                }}
                isLoading={false}
                hasMore={false} // No more loading needed for infinite scroll
                onLoadMore={() => {}} // No-op for infinite scroll
                searchInput={searchTerm}
                filterBy={selectedArchetype}
                onClearFilters={onClearFilters}
                cardSize="small"
                scrollPosition={scrollPosition}
                softSelectedCountryId={softSelectedCountryId}
                parallaxOffsets={parallaxOffsets}
                isAutoScrolling={isAutoScrolling}
              />
            </div>
          </ScrollVelocityContainer>
        )}
      </div>

      {/* Refined Scroll Navigation - Apple-like */}
      {filteredCountries.length > 0 && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40">
          {/* Scroll Up Button - Refined */}
          <button
            onClick={scrollUp}
            className="group relative w-10 h-10 rounded-lg backdrop-blur-md transition-all duration-300 ease-out bg-gradient-to-br from-amber-400/20 to-yellow-600/30 border border-amber-400/30 shadow-lg shadow-amber-400/10 hover:shadow-amber-400/20 hover:from-amber-400/30 hover:to-yellow-600/40 hover:border-amber-400/50 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            title={!isPageAtBottom ? "Scroll page up" : (!isGridAtTop ? "Scroll grid up" : "Scroll page up")}
          >
            <ChevronUp className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-400 transition-transform duration-200 group-hover:-translate-y-[1px]" />
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </button>

          {/* Scroll Down Button - Refined */}
          <button
            onClick={scrollDown}
            className="group relative w-10 h-10 rounded-lg backdrop-blur-md transition-all duration-300 ease-out bg-gradient-to-br from-amber-400/20 to-yellow-600/30 border border-amber-400/30 shadow-lg shadow-amber-400/10 hover:shadow-amber-400/20 hover:from-amber-400/30 hover:to-yellow-600/40 hover:border-amber-400/50 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            title={!isPageAtBottom ? "Scroll page down" : "Scroll grid down"}
          >
            <ChevronDown className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-400 transition-transform duration-200 group-hover:translate-y-[1px]" />
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </button>
        </div>
      )}
    </div>
  );
}
