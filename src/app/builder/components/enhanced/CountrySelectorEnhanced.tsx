"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { InteractiveGridPattern } from '~/components/magicui/interactive-grid-pattern';
import { useBulkFlags } from '~/hooks/useUnifiedFlags';
import { CountrySelectorHeader } from '../../primitives/CountrySelectorHeader';
import { FoundationArchetypeSelector } from '../../primitives/FoundationArchetypeSelector';
import { SearchFilter } from '../../primitives/SearchFilter';
import { CountryGrid } from '../../primitives/CountryGrid';
import { LivePreview } from '../../primitives/LivePreview';
import { filterCountries, generateCountryPreview } from '../../utils/country-selector-utils';
import { archetypes } from '../../utils/country-archetypes';
import type { CountryCardData } from '../CountryFocusCardBuilder';
import type { RealCountryData } from '../../lib/economy-data-service';

interface CountrySelectorEnhancedProps {
  countries: RealCountryData[];
  onCountrySelect: (country: RealCountryData) => void;
  onCardHoverChange: (countryId: string | null) => void;
  onBackToIntro?: () => void;
}

export function CountrySelectorEnhanced({
  countries,
  onCountrySelect,
  onBackToIntro
}: CountrySelectorEnhancedProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArchetypes, setSelectedArchetypes] = useState<string[]>([]);
  const [hoveredCountry, setHoveredCountry] = useState<RealCountryData | null>(null);
  const [softSelectedCountry, setSoftSelectedCountry] = useState<RealCountryData | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [livePreviewTop, setLivePreviewTop] = useState(96);
  const [isSearchStickyAndInView, setIsSearchStickyAndInView] = useState(false);
  const [isMouseOverGrid, setIsMouseOverGrid] = useState(false);
  
  const searchCardRef = useRef<HTMLDivElement>(null);
  const countriesListRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const isLivePreviewVisible = useMemo(() => {
    return isSearchStickyAndInView && (hoveredCountry !== null || softSelectedCountry !== null);
  }, [isSearchStickyAndInView, hoveredCountry, softSelectedCountry]);

  // Preload flags for all countries
  const countryNames = useMemo(() => countries?.map(c => c.name) || [], [countries]);
  const { flagUrls } = useBulkFlags(countryNames, 'irl');
  const filteredCountries = useMemo(() => {
    return filterCountries(countries || [], searchTerm, selectedArchetypes, archetypes);
  }, [countries, searchTerm, selectedArchetypes]);

  // Handle wheel events for smart scroll coordination
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!isMouseOverGrid) return;

    // If scrolling down and page is at bottom, start scrolling grid
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const atBottom = scrollY + windowHeight >= documentHeight - 20;
    
    if (e.deltaY > 0 && atBottom) {
      e.preventDefault();
    }
  }, [isMouseOverGrid]);

  // Global wheel event listener for smart scroll coordination
  useEffect(() => {
    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Effect to measure countries list height and update livePreviewTop
  useEffect(() => {
    const updateLivePreviewTop = () => {
      if (countriesListRef.current && gridContainerRef.current) {
        const countriesListRect = countriesListRef.current.getBoundingClientRect();
        const gridContainerRect = gridContainerRef.current.getBoundingClientRect();
        const newTop = (countriesListRect.top - gridContainerRect.top);
        setLivePreviewTop(newTop);
      }
    };

    updateLivePreviewTop();
    window.addEventListener('resize', updateLivePreviewTop);
    return () => window.removeEventListener('resize', updateLivePreviewTop);
  }, [filteredCountries]);

  // Effect to observe search card sticky state
  useEffect(() => {
    const searchCardElement = searchCardRef.current;
    if (!searchCardElement) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsSearchStickyAndInView(entry.isIntersecting && entry.boundingClientRect.top <= 56);
        }
      },
      { root: null, rootMargin: '0px', threshold: 0 }
    );

    observer.observe(searchCardElement);
    return () => {
      if (searchCardElement) observer.unobserve(searchCardElement);
    };
  }, []);


  const handleCountrySelect = (country: RealCountryData, customName: string) => {
    const finalCountry = { 
      ...country, 
      name: customName,
      foundationCountryName: country.name
    };
    onCountrySelect(finalCountry);
  };

  const handleClearAll = () => {
    setSearchTerm("");
    setSelectedArchetypes([]);
  };

  const handleCancel = () => {
    setSoftSelectedCountry(null);
  };


  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[var(--color-bg-primary)] via-[var(--color-bg-secondary)] to-[var(--color-bg-primary)]">
      {/* Interactive Background */}
      <InteractiveGridPattern
        width={60}
        height={60}
        squares={[40, 30]}
        className="absolute inset-0 opacity-20 dark:opacity-10 -z-10"
        squaresClassName="fill-[var(--color-brand-primary)]/10 stroke-[var(--color-brand-primary)]/20 [&:nth-child(4n+1):hover]:fill-amber-500/30 [&:nth-child(4n+1):hover]:stroke-amber-500/50 [&:nth-child(4n+2):hover]:fill-blue-500/30 [&:nth-child(4n+2):hover]:stroke-blue-500/50 [&:nth-child(4n+3):hover]:fill-emerald-500/30 [&:nth-child(4n+3):hover]:stroke-emerald-500/50 [&:nth-child(4n+4):hover]:fill-purple-500/30 [&:nth-child(4n+4):hover]:stroke-purple-500/50 transition-all duration-300"
      />
      
      {/* Left Sidebar - Foundation Archetypes */}
      <FoundationArchetypeSelector
        countries={countries || []}
        selectedArchetypes={selectedArchetypes}
        onArchetypeSelect={setSelectedArchetypes}
        onArchetypeComposer={() => {
          // TODO: Implement archetype composer functionality
          console.log('Archetype Composer clicked');
        }}
      />
      
      {/* Header - Full Width Centered */}
      <div className="relative z-10 p-6">
        <CountrySelectorHeader softSelectedCountry={softSelectedCountry} onBackToIntro={onBackToIntro} />
      </div>

      {/* Main Content Area - Center 60% + Right Sidebar */}
      {/* Main Content Area - Center 60% + Right Sidebar */}
      {/* Main Content Area - Center 60% + Right Sidebar */}
      <div className="pl-92 pr-6">
        <div className="relative max-w-7xl z-10 p-6 pt-0">
          {/* Main Content: Center Panel (Search/Countries) + Right Preview */}
          <div className="relative flex gap-8 z-20" ref={gridContainerRef}>
            {/* Center Panel - 60% of remaining space */}
            <div className="flex-1 space-y-6">
              {/* Search and Filters */}
              <SearchFilter
                ref={searchCardRef}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onClearAll={handleClearAll}
              />

              {/* Countries Grid */}
              <CountryGrid
                countries={countries || []}
                filteredCountries={filteredCountries}
                searchTerm={searchTerm}
                selectedArchetype={selectedArchetypes.join(',')} // Convert array to string for backward compatibility
                onCountryHover={setHoveredCountry}
                onCountryClick={(country) => {
                  setSoftSelectedCountry(country);
                  setHoveredCountry(null);
                }}
                onClearFilters={handleClearAll}
                softSelectedCountryId={softSelectedCountry?.countryCode || null}
                onMouseEnter={() => setIsMouseOverGrid(true)}
                onMouseLeave={() => setIsMouseOverGrid(false)}
                scrollPosition={scrollPosition}
                onScroll={setScrollPosition}
                flagUrls={flagUrls}
              />
            </div>

            {/* Right Sidebar - Live Preview Panel - 40% of remaining space */}
            <div className="w-80 flex-shrink-0">
              <LivePreview
                softSelectedCountry={softSelectedCountry}
                hoveredCountry={hoveredCountry}
                isVisible={isLivePreviewVisible}
                onCountrySelect={handleCountrySelect}
                onCancel={handleCancel}
                style={{ paddingTop: livePreviewTop }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
  );
}