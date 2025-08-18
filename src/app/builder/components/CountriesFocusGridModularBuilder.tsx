"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, useTransform, useMotionValue, MotionValue, animate } from "framer-motion";
import { CountryFocusCardBuilder, type CountryCardData } from "./CountryFocusCardBuilder";
import { ProgressiveBlur } from "~/components/magicui/progressive-blur";
import { BlurFade } from "~/components/magicui/blur-fade";
import { RiGlobalLine } from "react-icons/ri";

interface CountriesFocusGridModularProps {
  countries: CountryCardData[];
  visibleCount: number;
  onCountryClick: (countryId: string) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  searchInput: string;
  filterBy: string;
  onClearFilters: () => void;
  cardSize?: 'default' | 'small';
  onCardHoverChange: (countryId: string | null) => void;
  scrollPosition: number;
  softSelectedCountryId?: string | null;
}

interface CountryCardProps {
  country: CountryCardData;
  index: number;
  scrollY: MotionValue<number>;
  onHoverChange: (countryId: string | null) => void;
  onCountryClick: (countryId: string) => void;
  cardSize?: 'default' | 'small';
  softSelectedCountryId?: string | null;
  autoScrollY: MotionValue<number>;
  isAnimating: boolean;
  columnIndex: number;
}

const CountryCard: React.FC<CountryCardProps> = ({
  country,
  index,
  scrollY,
  onHoverChange,
  onCountryClick,
  cardSize,
  softSelectedCountryId,
  autoScrollY,
  isAnimating,
  columnIndex,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate row index for progressive effects
  const numColumns = 4;
  const rowIndex = Math.floor(index / numColumns);
  
  // Auto-scroll infinite animation ranges (different for each column)
  const autoScrollRanges = [
    { range: [0, 2000], output: [0, -100] }, // Column 0: slow upward
    { range: [0, 2000], output: [0, 120] },  // Column 1: medium downward  
    { range: [0, 2000], output: [0, -80] },  // Column 2: medium upward
    { range: [0, 2000], output: [0, 100] }   // Column 3: fast downward
  ];
  
  // User scroll parallax (subtle, different from auto-scroll)
  const userScrollParallax = useTransform(
    scrollY,
    [0, 1000],
    [0, columnIndex % 2 === 0 ? -15 : 15]
  );
  
  // Auto-scroll infinite animation
  // Guard against undefined autoScrollRanges or out-of-bounds columnIndex
  const safeRange = autoScrollRanges?.[columnIndex]?.range ?? [0, 0];
  const safeOutput = autoScrollRanges?.[columnIndex]?.output ?? [0, 0];
  const autoScrollParallax = useTransform(
    autoScrollY,
    safeRange,
    safeOutput
  );

  // Combined Y transform - auto-scroll only when animating and not paused
  const combinedY = useTransform(
    [userScrollParallax, autoScrollParallax],
    (values) => {
      const [userY, autoY] = values as [number, number];
      if (!isAnimating || isPaused) return userY;
      return userY + autoY;
    }
  );
  
  // Glass physics - subtle depth-based transforms
  const glassRotateX = useTransform(
    isAnimating && !isPaused ? autoScrollY : scrollY,
    [0, 500],
    [0, columnIndex % 2 === 0 ? 0.5 : -0.5]
  );
  
  const glassScale = useTransform(
    scrollY,
    [0, 800],
    [1, 1 + (columnIndex * 0.002)]
  );
  
  // Handle hover interactions with physics-based pause
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    setIsPaused(true);
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    onHoverChange(country.id);
  }, [country.id, onHoverChange]);
  
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    onHoverChange(null);
    
    // Resume animation after a 2-second delay
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 2000);
  }, [onHoverChange]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);
  
  // Progressive blur intensity based on row position
  const blurIntensity = Math.min(rowIndex * 0.5, 2);

  return (
    <BlurFade
      key={country.id}
      delay={index * 0.03}
      duration={0.5}
      offset={6}
      direction="up"
      blur="3px"
    >
      <div className="relative">
        <motion.div
          style={{
            y: combinedY,
            rotateX: glassRotateX,
            scale: glassScale,
          }}
          className="h-full"
          animate={{
            filter: isPaused ? "brightness(1.1) saturate(1.1)" : "brightness(1) saturate(1)",
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
            duration: 0.3
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <CountryFocusCardBuilder
            country={country}
            onHoverChange={() => {}} // Handled by motion.div
            onCountryClick={onCountryClick}
            cardSize={cardSize}
            softSelectedCountryId={softSelectedCountryId}
          />
        </motion.div>
        
        {/* Progressive Blur for individual cards based on row position */}
        {rowIndex > 1 && (
          <ProgressiveBlur
            position="both"
            height="100%"
            blurLevels={[blurIntensity, blurIntensity * 1.5, blurIntensity * 2]}
            className="opacity-30 pointer-events-none"
          />
        )}
      </div>
    </BlurFade>
  );
};

export const CountriesFocusGridModularBuilder: React.FC<CountriesFocusGridModularProps> = ({
  countries,
  visibleCount,
  onCountryClick,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  searchInput,
  filterBy,
  onClearFilters,
  cardSize,
  onCardHoverChange,
  scrollPosition,
  softSelectedCountryId,
}) => {
  const scrollY = useMotionValue(0);
  const autoScrollY = useMotionValue(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const animationRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof scrollPosition === "number") {
      scrollY.set(scrollPosition);
    }
  }, [scrollPosition, scrollY]);
  
  // Automatic infinite scrolling animation
  useEffect(() => {
    if (!isAnimating || isHoverPaused) return;
    
    // Create smooth infinite loop animation
    animationRef.current = animate(autoScrollY, [0, 2000], {
      duration: 30, // 30 seconds for full cycle
      ease: "linear",
      repeat: Infinity,
      repeatType: "loop"
    });
    
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [autoScrollY, isAnimating, isHoverPaused]);
  
  // Handle container hover to pause all animations
  const handleContainerMouseEnter = useCallback(() => {
    setIsHoverPaused(true);
  }, []);
  
  const handleContainerMouseLeave = useCallback(() => {
    // Resume after a brief delay
    setTimeout(() => {
      setIsHoverPaused(false);
    }, 1500);
  }, []);
  
  // Pause animation when user is actively scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    let scrollTimeout: NodeJS.Timeout;
    
    const handleScroll = () => {
      setIsAnimating(false);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsAnimating(true);
      }, 2000); // Resume 2 seconds after scroll stops
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);
  
  const visibleCountries = countries.slice(0, visibleCount);

  const loadMore = () => {
    if (onLoadMore) {
      onLoadMore();
    }
  };

  return (
    <div className="space-y-12" ref={containerRef}>
      {/* Countries Grid with Glass Physics and Auto-scroll */}
      <div 
        className="relative"
        onMouseEnter={handleContainerMouseEnter}
        onMouseLeave={handleContainerMouseLeave}
      >
        {/* Infinite Animation Indicator */}
        <div className="absolute top-0 right-0 z-10 p-2">
          <motion.div 
            className="w-2 h-2 rounded-full bg-emerald-400/60"
            animate={{
              scale: isAnimating && !isHoverPaused ? [1, 1.5, 1] : 1,
              opacity: isAnimating && !isHoverPaused ? [0.6, 1, 0.6] : 0.3
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 glass-surface shadow-xl rounded-lg p-4 backdrop-blur-sm overflow-hidden">
          {visibleCountries.map((country, index) => {
            const columnIndex = index % 4;
            return (
              <CountryCard
                key={country.id}
                country={country}
                index={index}
                scrollY={scrollY}
                onHoverChange={onCardHoverChange}
                onCountryClick={onCountryClick}
                cardSize={cardSize}
                softSelectedCountryId={softSelectedCountryId}
                autoScrollY={autoScrollY}
                isAnimating={isAnimating && !isHoverPaused}
                columnIndex={columnIndex}
              />
            );
          })}
        </div>
      </div>

      {/* Loading State */}
      {(isLoading || visibleCount < countries.length) && (
        <div className="mt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-48 animate-pulse glass-floating glass-refraction"
              >
                <div className="p-6 space-y-4">
                  <div className="h-6 bg-white/10 rounded"></div>
                  <div className="h-4 bg-white/5 rounded w-2/3"></div>
                  <div className="space-y-2 mt-4">
                    <div className="h-3 bg-white/5 rounded"></div>
                    <div className="h-3 bg-white/5 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Infinite scroll - no manual load more button needed */}

      {/* End Message */}
      {!isLoading && !hasMore && visibleCount >= countries.length && countries.length > 0 && (
        <div className="text-center mt-12">
          <div className="inline-block px-6 py-4 glass-floating glass-refraction">
            <p className="text-muted-foreground">
              You've viewed all {countries.length} countries
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {countries.length === 0 && !isLoading && (
        <div className="text-center mt-12">
          <div className="p-12 max-w-md mx-auto glass-floating glass-refraction">
            <RiGlobalLine className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-xl font-semibold mb-2">No Countries Found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filter criteria
            </p>
            <button
              onClick={onClearFilters}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};