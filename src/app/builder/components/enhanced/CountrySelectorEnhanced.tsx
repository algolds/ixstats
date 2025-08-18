"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { InteractiveGridPattern } from '~/components/magicui/interactive-grid-pattern';
import { useCountryFlags, useCountryFlag } from '~/hooks/useCountryFlags';
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
}

export function CountrySelectorEnhanced({
  countries,
  onCountrySelect
}: CountrySelectorEnhancedProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArchetype, setSelectedArchetype] = useState<string>("all");
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
  const countryNames = useMemo(() => countries.map(c => c.name), [countries]);
  useCountryFlags({
    countries: countryNames,
    preload: true
  });
  const filteredCountries = useMemo(() => {
    return filterCountries(countries, searchTerm, selectedArchetype, archetypes);
  }, [countries, searchTerm, selectedArchetype]);

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
    setSelectedArchetype("all");
  };

  const handleCancel = () => {
    setSoftSelectedCountry(null);
  };


  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[var(--color-bg-primary)] via-[var(--color-bg-secondary)] to-[var(--color-bg-primary)] p-6">
      {/* Interactive Background */}
      <InteractiveGridPattern
        width={60}
        height={60}
        squares={[40, 30]}
        className="absolute inset-0 opacity-20 dark:opacity-10 -z-10"
        squaresClassName="fill-[var(--color-brand-primary)]/10 stroke-[var(--color-brand-primary)]/20 [&:nth-child(4n+1):hover]:fill-amber-500/30 [&:nth-child(4n+1):hover]:stroke-amber-500/50 [&:nth-child(4n+2):hover]:fill-blue-500/30 [&:nth-child(4n+2):hover]:stroke-blue-500/50 [&:nth-child(4n+3):hover]:fill-emerald-500/30 [&:nth-child(4n+3):hover]:stroke-emerald-500/50 [&:nth-child(4n+4):hover]:fill-purple-500/30 [&:nth-child(4n+4):hover]:stroke-purple-500/50 transition-all duration-300"
      />
      
      <div className="relative max-w-7xl mx-auto z-10">
        {/* Header */}
        <CountrySelectorHeader softSelectedCountry={softSelectedCountry} />

        {/* Foundation Archetypes */}
        <FoundationArchetypeSelector
          countries={countries}
          selectedArchetype={selectedArchetype}
          onArchetypeSelect={setSelectedArchetype}
        />

        {/* Main Content: Search/Filter/Countries + Live Preview */}
        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8 z-20" ref={gridContainerRef}>
          {/* Main Selection Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search and Filters */}
            <SearchFilter
              ref={searchCardRef}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onClearAll={handleClearAll}
            />

            {/* Countries Grid */}
            <CountryGrid
              countries={countries}
              filteredCountries={filteredCountries}
              searchTerm={searchTerm}
              selectedArchetype={selectedArchetype}
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
            />
          </div>

          {/* Live Preview Panel */}
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
  );
}