"use client";

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Globe, ChevronUp, ChevronDown } from 'lucide-react';
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
  onScroll
}: CountryGridProps) {
  const INITIAL_LOAD_COUNT = 20;
  const BATCH_SIZE = 10;
  const SCROLL_STEP = 120;
  const AUTO_SCROLL_SPEED = 0.5; // Pixels per frame for smooth auto-scroll
  const INTERACTION_TIMEOUT = 2000; // ms before resuming auto-scroll after interaction
  
  // Core state
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD_COUNT);
  const [isGridAtTop, setIsGridAtTop] = useState(true);
  const [isPageAtBottom, setIsPageAtBottom] = useState(false);
  
  // Auto-scroll state
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false);
  const [autoScrollDirection, setAutoScrollDirection] = useState<'down' | 'up'>('down');
  
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

  // Interaction detection - mark user interaction
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
      // Resume auto-scroll after interaction timeout
      setTimeout(() => setIsAutoScrolling(true), 300);
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

  // Auto-scroll with parallax column effects
  const runAutoScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || !isAutoScrolling || isInteracting) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;
    
    if (maxScroll <= 0) return; // Not enough content to scroll

    // Calculate next scroll position with optimized logic
    let nextScrollTop = scrollTop;
    
    if (autoScrollDirection === 'down') {
      nextScrollTop = Math.min(scrollTop + AUTO_SCROLL_SPEED, maxScroll - 50);
      
      // Reverse direction at bottom
      if (nextScrollTop >= maxScroll - 50) {
        setAutoScrollDirection('up');
        
        // Batch load more content for smoother experience
        if (visibleCount < filteredCountries.length) {
          setVisibleCount(prevCount => Math.min(prevCount + BATCH_SIZE, filteredCountries.length));
        }
      }
    } else {
      nextScrollTop = Math.max(scrollTop - AUTO_SCROLL_SPEED, 0);
      
      // Reverse direction at top
      if (nextScrollTop <= 0) {
        setAutoScrollDirection('down');
      }
    }

    // Update parallax offsets for each column
    const newOffsets = parallaxFactors.map((factor, index) => {
      return nextScrollTop * factor * 0.1; // Subtle parallax effect
    });
    setParallaxOffsets(newOffsets);

    // Use direct property assignment for better performance than scrollTo
    container.scrollTop = nextScrollTop;
    
    // Schedule next frame with optimized callback
    autoScrollAnimationRef.current = requestAnimationFrame(runAutoScroll);
  }, [isAutoScrolling, isInteracting, autoScrollDirection, visibleCount, filteredCountries.length, parallaxFactors]);

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
      
      // Add interaction detection for mouse/touch events
      const handleMouseEnter = () => handleUserInteraction();
      const handleMouseMove = () => handleUserInteraction();
      const handleTouchStart = () => handleUserInteraction();
      const handleTouchMove = () => handleUserInteraction();
      
      current.addEventListener('mouseenter', handleMouseEnter);
      current.addEventListener('mousemove', handleMouseMove);
      current.addEventListener('touchstart', handleTouchStart, { passive: true });
      current.addEventListener('touchmove', handleTouchMove, { passive: true });
      
      // Initialize scroll state
      updateScrollState(current);
      
      return () => {
        current.removeEventListener('scroll', handleScroll);
        current.removeEventListener('mouseenter', handleMouseEnter);
        current.removeEventListener('mousemove', handleMouseMove);
        current.removeEventListener('touchstart', handleTouchStart);
        current.removeEventListener('touchmove', handleTouchMove);
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
    setAutoScrollDirection('down');
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
      {/* Enhanced Recessed Container with Better Depth */}
      <div className="relative">
        {/* Outer shadow ring for embedding effect */}
        <div className="absolute -inset-2 bg-gradient-to-br from-black/20 via-black/10 to-black/5 rounded-2xl blur-xl" />
        
        {/* Inner shadow for recessed appearance */}
        <div className="absolute -inset-1 bg-gradient-to-br from-black/15 via-transparent to-white/5 rounded-xl" />
        
        <GlassCard depth="modal" ref={countriesListRef} className="relative overflow-hidden">
          {/* No blur overlay - removed as requested */}

          <GlassCardContent 
            ref={scrollContainerRef} 
            className="relative max-h-[80vh] overflow-y-auto scrollbar-none"
          >
            <div className="space-y-1 relative">
              {/* Subtle gradient fades for infinite scroll */}
              <div className="absolute top-0 left-0 right-0 h-6 pointer-events-none z-20 bg-gradient-to-b from-[var(--color-bg-primary)]/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none z-20 bg-gradient-to-t from-[var(--color-bg-primary)]/80 via-[var(--color-bg-primary)]/20 to-transparent" />
              
              {/* Content - No animations for performance */}
              {filteredCountries.length === 0 ? (
                <div className="text-center py-12">
                  <Globe className="h-12 w-12 text-[var(--color-text-muted)]/50 mx-auto mb-4" />
                  <p className="text-[var(--color-text-muted)]">No countries match your criteria</p>
                </div>
              ) : (
                <CountriesFocusGridModularBuilder
                  countries={filteredCountries.map(mapToCountryCardData)}
                  visibleCount={visibleCount}
                  onCardHoverChange={(countryId: string | null) => {
                    handleUserInteraction(); // Detect interaction
                    if (countryId) {
                      const hovered = countries.find(c => c.countryCode === countryId);
                      onCountryHover(hovered || null);
                    } else {
                      onCountryHover(null);
                    }
                  }}
                  onCountryClick={(countryId: string) => {
                    handleUserInteraction(); // Detect interaction
                    const selected = filteredCountries.find(c => c.countryCode === countryId);
                    if (selected) {
                      onCountryClick(selected);
                    }
                  }}
                  isLoading={false}
                  hasMore={visibleCount < filteredCountries.length}
                  onLoadMore={() => setVisibleCount(prevCount => Math.min(prevCount + BATCH_SIZE, filteredCountries.length))}
                  searchInput={searchTerm}
                  filterBy={selectedArchetype}
                  onClearFilters={onClearFilters}
                  cardSize="small"
                  scrollPosition={scrollPosition}
                  softSelectedCountryId={softSelectedCountryId}
                  parallaxOffsets={parallaxOffsets}
                />
              )}
            </div>
          </GlassCardContent>
        </GlassCard>
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
