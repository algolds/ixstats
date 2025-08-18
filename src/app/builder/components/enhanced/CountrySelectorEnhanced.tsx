"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Globe,
  DollarSign,
  Users,
  TrendingUp,
  Download,
  ExternalLink,
  Map,
  Crown,
  BarChart3,
  Zap,
  Eye,
  Sparkles,
  Activity,
  BarChart
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '~/lib/utils';
import { createUrl } from '~/lib/url-utils';
import { EnhancedCountryFlag } from '~/components/ui/enhanced-country-flag';
import { MyCountryLogo } from '~/components/ui/mycountry-logo';
import { SectionHeader, EmphasisText } from '~/components/ui/text-hierarchy';
import { ImportButton } from '~/components/ui/glass-button';
import { EnhancedTooltip, InfoIcon } from '~/components/ui/enhanced-tooltip';
import { BlurFade } from '~/components/magicui/blur-fade';
import { InteractiveGridPattern } from '~/components/magicui/interactive-grid-pattern';
import { HealthRing } from '~/components/ui/health-ring'; // This seems to be used in the preview panel
import { useCountryFlags, useCountryFlag } from '~/hooks/useCountryFlags';
import { GlassCard, GlassCardContent, GlassCardHeader } from '../glass/GlassCard';
import { CountriesFocusGridModularBuilder } from '../CountriesFocusGridModularBuilder';
import type { CountryCardData } from '../CountryFocusCardBuilder';
import type { RealCountryData } from '../../lib/economy-data-service';
import { getEconomicTier } from '../../lib/economy-data-service';

interface CountrySelectorEnhancedProps {
  countries: RealCountryData[];
  onCountrySelect: (country: RealCountryData) => void;
  onCardHoverChange: (countryId: string | null) => void;
}

interface CountryPreview {
  country: RealCountryData;
  economicScore: number;
  stabilityScore: number;
  potentialScore: number;
}

const archetypes = [
  {
    id: 'economic-powerhouse',
    name: 'Economic Powerhouse',
    description: 'High GDP per capita, strong financial systems',
    icon: DollarSign,
    color: 'text-[var(--color-success)]',
    filter: (country: RealCountryData) => country.gdpPerCapita > 40000,
    gradient: 'from-emerald-500/20 to-green-500/10'
  },
  {
    id: 'developing-giant',
    name: 'Developing Giant',
    description: 'Large population, growing economy',
    icon: TrendingUp,
    color: 'text-[var(--color-brand-primary)]',
    filter: (country: RealCountryData) => country.population > 50000000 && country.gdpPerCapita < 15000,
    gradient: 'from-blue-500/20 to-indigo-500/10'
  },
  {
    id: 'balanced-nation',
    name: 'Balanced Nation',
    description: 'Moderate size and development',
    icon: BarChart3,
    color: 'text-[var(--color-purple)]',
    filter: (country: RealCountryData) => 
      country.gdpPerCapita > 15000 && country.gdpPerCapita < 40000 && 
      country.population > 5000000 && country.population < 100000000,
    gradient: 'from-purple-500/20 to-pink-500/10'
  },
  {
    id: 'small-prosperous',
    name: 'Small & Prosperous',
    description: 'High living standards, compact size',
    icon: Crown,
    color: 'text-[var(--color-warning)]',
    filter: (country: RealCountryData) => country.population < 10000000 && country.gdpPerCapita > 25000,
    gradient: 'from-amber-500/20 to-yellow-500/10'
  }
];

export function CountrySelectorEnhanced({
  countries,
  onCountrySelect
}: CountrySelectorEnhancedProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArchetype, setSelectedArchetype] = useState<string>("all");
  const [hoveredCountry, setHoveredCountry] = useState<RealCountryData | null>(null);
  const [focusedCountry, setFocusedCountry] = useState<RealCountryData | null>(null);
  const [softSelectedCountry, setSoftSelectedCountry] = useState<RealCountryData | null>(null);
  const [softSelectedFlagUrl, setSoftSelectedFlagUrl] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<CountryPreview | null>(null);
  const [newCountryName, setNewCountryName] = useState("");
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  // const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null); // Removed
  // const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(null); // Removed

  const INITIAL_LOAD_COUNT = 20;
  const BATCH_SIZE = 10;
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD_COUNT);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const countriesListRef = useRef<HTMLDivElement>(null); // Added countriesListRef
  const searchCardRef = useRef<HTMLDivElement>(null); // New ref for search card
  const gridContainerRef = useRef<HTMLDivElement>(null); // New ref for main grid container
  const [scrollPosition, setScrollPosition] = useState(0);
  const [livePreviewTop, setLivePreviewTop] = useState(96);
  const [isSearchStickyAndInView, setIsSearchStickyAndInView] = useState(false);
  const [isMouseOverGrid, setIsMouseOverGrid] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTime = useRef<number>(Date.now());
  const animationFrameRef = useRef<number | null>(null);

  const isLivePreviewVisible = useMemo(() => {
    return isSearchStickyAndInView && previewData !== null;
  }, [isSearchStickyAndInView, previewData]);

  const { flag: fetchedFlag } = useCountryFlag(softSelectedCountry?.name ?? '');

  useEffect(() => {
    if (fetchedFlag?.flagUrl) {
      setSoftSelectedFlagUrl(fetchedFlag.flagUrl);
    } else if (!softSelectedCountry) {
      setSoftSelectedFlagUrl(null);
    }
  }, [fetchedFlag, softSelectedCountry]);

  const mapToCountryCardData = useCallback((country: RealCountryData): CountryCardData => {
    return {
      id: country.countryCode,
      name: country.name,
    };
  }, []);
  
  // Preload flags for all countries
  const countryNames = useMemo(() => countries.map(c => c.name), [countries]);
  useCountryFlags({
    countries: countryNames,
    preload: true
  });
  const filteredCountries = useMemo(() => {
    let filtered = countries.filter(country => country.name !== "World");

    if (searchTerm) {
      filtered = filtered.filter(country =>
        country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        country.countryCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (country.continent || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedArchetype !== "all") {
      const archetype = archetypes.find(a => a.id === selectedArchetype);
      if (archetype) {
        filtered = filtered.filter(archetype.filter);
      }
    }

    

    // Ensure unique country codes
    const uniqueCountryCodes = new Set<string>();
    const uniqueFiltered = filtered.filter(country => {
      if (uniqueCountryCodes.has(country.countryCode)) {
        return false;
      }
      uniqueCountryCodes.add(country.countryCode);
      return true;
    });

    // Randomize sort on each filter change, but keep it stable during the session
    const shuffled = [...uniqueFiltered]; // Use uniqueFiltered here
    
    // Use a deterministic shuffle based on search term and archetype to maintain consistency
    const seed = (searchTerm + selectedArchetype).split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    // Fisher-Yates shuffle with seed
    for (let i = shuffled.length - 1; i > 0; i--) {
      // Deterministically generate a pseudo-random index j for swapping
      const rand = (((seed + i) * 9301 + 49297) % 233280) / 233280;
      const j = Math.floor(rand * (i + 1));
      // Ensure j is a valid index and not equal to i to avoid unnecessary swap
      if (j >= 0 && j < shuffled.length && j !== i) {
        // Type assertion to satisfy TypeScript that both are RealCountryData
        [shuffled[i], shuffled[j]] = [shuffled[j] as RealCountryData, shuffled[i] as RealCountryData];
      }
    }

    return shuffled as RealCountryData[];
  }, [countries, searchTerm, selectedArchetype]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleScroll = useCallback(() => {
    const { current } = scrollContainerRef;
    if (current) {
      setScrollPosition(current.scrollTop);
      const { scrollTop, scrollHeight, clientHeight } = current;
      // Infinite scroll - load more when near bottom
      if (scrollTop + clientHeight >= scrollHeight - 100 && visibleCount < filteredCountries.length) {
        setVisibleCount(prevCount => Math.min(prevCount + BATCH_SIZE, filteredCountries.length));
      }
    }
  }, [visibleCount, filteredCountries.length]);

  // Handle wheel events for smart scroll coordination
  const handleWheel = useCallback((e: WheelEvent) => {
    const gridContainer = scrollContainerRef.current;
    if (!gridContainer) return;

    // If mouse is over grid, let grid handle the scroll
    if (isMouseOverGrid) {
      e.preventDefault();
      gridContainer.scrollTop += e.deltaY * 0.8;
      return;
    }

    // If scrolling down and page is at bottom, start scrolling grid
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const atBottom = scrollY + windowHeight >= documentHeight - 20;
    
    if (e.deltaY > 0 && atBottom) {
      const gridScrollTop = gridContainer.scrollTop;
      const gridScrollHeight = gridContainer.scrollHeight;
      const gridClientHeight = gridContainer.clientHeight;
      
      // If grid has more content to scroll, prevent page scroll and scroll grid
      if (gridScrollTop + gridClientHeight < gridScrollHeight - 10) {
        e.preventDefault();
        gridContainer.scrollTop += e.deltaY * 0.8;
      }
    }
  }, [isMouseOverGrid]);

  useEffect(() => {
    const { current } = scrollContainerRef;
    if (current) {
      current.addEventListener('scroll', handleScroll, { passive: true });
      return () => current.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Global wheel event listener for smart scroll coordination
  useEffect(() => {
    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    setVisibleCount(INITIAL_LOAD_COUNT);
  }, [searchTerm, selectedArchetype, filteredCountries]);

  // Effect to measure countries list height and update livePreviewTop
  useEffect(() => {
        const updateLivePreviewTop = () => {
      if (countriesListRef.current && gridContainerRef.current) {
        const countriesListRect = countriesListRef.current.getBoundingClientRect();
        const gridContainerRect = gridContainerRef.current.getBoundingClientRect();

        // Calculate newTop to align with the top of the countries list
        const newTop = (countriesListRect.top - gridContainerRect.top);
        setLivePreviewTop(newTop);
      }
    };

    // Initial calculation
    updateLivePreviewTop();

    // Recalculate on window resize (for responsive changes)
    window.addEventListener('resize', updateLivePreviewTop);

    return () => {
      window.removeEventListener('resize', updateLivePreviewTop);
    };
  }, [filteredCountries]); // Recalculate when filteredCountries changes

  // Effect to observe search card sticky state
  useEffect(() => {
    const searchCardElement = searchCardRef.current;
    if (!searchCardElement) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Check if the element is intersecting and its top is at or above the sticky point (56px)
        // This indicates it's either sticky or has passed the sticky point
        if (entry) {
          setIsSearchStickyAndInView(entry.isIntersecting && entry.boundingClientRect.top <= 56);
        }
      },
      {
        root: null, // viewport
        rootMargin: '0px',
        threshold: 0 // Trigger as soon as any part of the target is visible
      }
    );

    observer.observe(searchCardElement);

    return () => {
      if (searchCardElement) {
        observer.unobserve(searchCardElement);
      }
    };
  }, []); // Empty dependency array to run once on mount

  // Generate preview data when hovering or soft-selected
  useEffect(() => {
    const countryToPreview = softSelectedCountry || hoveredCountry;
    if (countryToPreview) {
      const economicScore = Math.min(100, ((countryToPreview.gdpPerCapita || 0) / 80000) * 100);
      const stabilityScore = Math.max(20, 100 - (countryToPreview.unemploymentRate || 0) * 5 - Math.abs((countryToPreview.inflationRate || 2) - 2) * 10);
      const potentialScore = Math.min(100, (countryToPreview.growthRate || 0) * 20 + 60);

      setPreviewData({
        country: countryToPreview,
        economicScore,
        stabilityScore,
        potentialScore
      });
    } else {
      setPreviewData(null);
    }
  }, [hoveredCountry, softSelectedCountry]);

  const formatNumber = (num: number | undefined, isCurrency = true, precision = 1): string => {
    if (num === undefined || num === null || isNaN(num)) return isCurrency ? '$0' : '0';
    const prefix = isCurrency ? '$' : '';
    if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(precision)}B`;
    if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(isCurrency ? precision : 0)}`;
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 relative overflow-hidden rounded-lg p-6"
          style={
            softSelectedCountry
              ? {
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          {softSelectedCountry && (
            <div className="absolute inset-0 backdrop-filter backdrop-blur-md bg-black/50 z-0"></div>
          )}
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-4 mb-6">
              {softSelectedCountry ? (
                <EnhancedCountryFlag
                  countryName={softSelectedCountry.name}
                  size="lg"
                  hoverBlur={false}
                  priority={true}
                />
              ) : (
                <MyCountryLogo size="xl" animated />
              )}
            </div>
            
            <div className="space-y-3 mb-6">
              {softSelectedCountry ? (
                <h2 className="text-4xl font-bold text-[var(--color-text-primary)]">
                  Foundation: {softSelectedCountry.name}
                </h2>
              ) : (
                <SectionHeader 
                  words={[
                    "Choose Your Foundation",
                    "Select Your Base Country", 
                    "Pick Your Starting Point"
                  ]}
                />
              )}
              <p className="text-[var(--color-text-secondary)] text-lg">
                Select a real-world country as the foundation for your nation, or{' '}
                <EmphasisText>import your existing country</EmphasisText> to get started.
              </p>
            </div>

            {/* Import Button */}
            <ImportButton
              onClick={() => router.push(createUrl('/builder/import'))}
              size="lg"
              depth="deep"
              className="inline-flex items-center gap-3"
            >
              <Download className="h-5 w-5" />
              <span>Import from Wiki</span>
              <ExternalLink className="h-4 w-4 opacity-70" />
            </ImportButton>
          </div>
        </motion.div>

        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8 z-20" ref={gridContainerRef}>
          {/* Main Selection Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Archetypes */}
            <GlassCard depth="elevated" motionPreset="slide" className="sticky top-0 z-30">
              <GlassCardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-300" />
                  <h3 className="font-semibold text-[var(--color-text-primary)]">Foundation Archetypes</h3>
                  <EnhancedTooltip
                    content="Pre-defined categories to help you find countries that match your vision"
                    position="top"
                  >
                    <InfoIcon />
                  </EnhancedTooltip>
                </div>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* All Countries */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedArchetype("all")}
                    className={cn(
                      'p-4 rounded-lg border transition-all duration-300',
                      'bg-gradient-to-br from-[var(--color-bg-secondary)]/20 to-[var(--color-bg-tertiary)]/20',
                      selectedArchetype === "all"
                        ? 'border-blue-400/50 bg-blue-500/20 shadow-lg'
                        : 'border-[var(--color-border-primary)] hover:border-[var(--color-border-secondary)]'
                    )}
                  >
                    <Globe className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                    <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {countries.filter(c => c.name !== "World").length}
                    </div>
                    <div className="text-sm text-[var(--color-text-secondary)]">All Countries</div>
                  </motion.button>

                  {/* Archetype Cards */}
                  {archetypes.map((archetype) => {
                    const Icon = archetype.icon;
                    const count = countries.filter(c => c.name !== "World" && archetype.filter(c)).length;
                    const isSelected = selectedArchetype === archetype.id;

                    return (
                      <motion.button
                        key={archetype.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedArchetype(archetype.id)}
                        className={cn(
                          'p-4 rounded-lg border transition-all duration-300',
                          `bg-gradient-to-br ${archetype.gradient}`,
                          isSelected
                            ? 'border-current shadow-lg bg-opacity-30'
                            : 'border-[var(--color-border-primary)] hover:border-[var(--color-border-secondary)]'
                        )}
                      >
                        <Icon className={cn('h-6 w-6 mx-auto mb-2', archetype.color)} />
                        <div className={cn('text-lg font-semibold', archetype.color)}>
                          {count}
                        </div>
                        <div className="text-sm text-[var(--color-text-secondary)] leading-tight">
                          {archetype.name}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Search and Filters */}
            <GlassCard depth="base" blur="light" className="sticky top-56 z-40" ref={searchCardRef}>
              <GlassCardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text-muted)] h-5 w-5" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search countries by name, code, or continent..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all"
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedArchetype("all");
                      searchInputRef.current?.focus();
                    }}
                    className="px-4 py-3 bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]/70 transition-all"
                  >
                    Clear All
                  </motion.button>
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Countries List */}
            <div 
              className="relative z-50"
              onMouseEnter={() => setIsMouseOverGrid(true)}
              onMouseLeave={() => setIsMouseOverGrid(false)}
            >
              <GlassCard depth="elevated" ref={countriesListRef}>
                <GlassCardContent ref={scrollContainerRef} className="relative max-h-[70vh] overflow-y-auto scrollbar-none">
                
                <div className="space-y-1 relative">
                  {/* Subtle gradient fade at bottom for infinite scroll */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none z-20 bg-gradient-to-t from-[var(--color-bg-primary)]/90 via-[var(--color-bg-primary)]/30 to-transparent"
                  />
                  
                  <AnimatePresence mode="popLayout">
                    {filteredCountries.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-12"
                      >
                        <Globe className="h-12 w-12 text-[var(--color-text-muted)]/50 mx-auto mb-4" />
                        <p className="text-[var(--color-text-muted)]">No countries match your criteria</p>
                      </motion.div>
                    ) : (
                      <CountriesFocusGridModularBuilder
                        countries={filteredCountries.map(mapToCountryCardData)}
                        visibleCount={visibleCount}
                        onCardHoverChange={(countryId: string | null) => {
                          if (countryId) {
                            const hovered = countries.find(c => c.countryCode === countryId);
                            setHoveredCountry(hovered || null);
                          } else {
                            setHoveredCountry(null);
                          }
                        }}
                        onCountryClick={(countryId: string) => {
                          const selected = filteredCountries.find(c => c.countryCode === countryId);
                          if (selected) {
                            setSoftSelectedCountry(selected);
                            setHoveredCountry(null); // Clear hovered country
                          }
                        }}
                        isLoading={false} // You might want to add a loading state here if fetching more data
                        hasMore={visibleCount < filteredCountries.length}
                        onLoadMore={() => setVisibleCount(prevCount => Math.min(prevCount + BATCH_SIZE, filteredCountries.length))}
                        searchInput={searchTerm}
                        filterBy={selectedArchetype}
                        onClearFilters={() => {
                          setSearchTerm("");
                          setSelectedArchetype("all");
                          searchInputRef.current?.focus();
                        }}
                        cardSize="small"
                        scrollPosition={scrollPosition}
                        softSelectedCountryId={softSelectedCountry?.countryCode || null} // Pass soft-selected country ID
                      />
                    )}
                  </AnimatePresence>
                </div>
                </GlassCardContent>
              </GlassCard>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="space-y-6" style={{ paddingTop: livePreviewTop }}>
            <BlurFade delay={0.25} inView={isLivePreviewVisible} inViewMargin="-50px">
              <motion.div layout>
                <GlassCard depth="modal" blur="heavy" theme="gold" className="z-60 p-4">
                  <GlassCardHeader>
                    <div className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-amber-300" />
                      <h3 className="font-semibold text-[var(--color-text-primary)]">Live Preview</h3>
                    </div>
                  </GlassCardHeader>
                  <GlassCardContent>
                    <AnimatePresence mode="wait">
                      {softSelectedCountry ? (
                        <motion.div
                          key={softSelectedCountry.name + "-soft-selected"} // Unique key for animation
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          className="space-y-4"
                        >
                          {/* Display soft-selected country details */}
                          <div className="text-center mb-6">
                            <div className="flex justify-center mb-3 w-full h-auto">
                              <EnhancedCountryFlag
                                countryName={softSelectedCountry.name}
                                size="xl"
                                hoverBlur={false}
                                priority={true}
                              />
                            </div>
                            <h4 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
                              {softSelectedCountry.name}
                            </h4>
                            <p className="text-[var(--color-text-muted)]">{softSelectedCountry.continent}</p>
                          </div>

                          {/* Live Activity Rings */}
                          <div className="grid grid-cols-3 gap-4 mb-6">
                            {previewData && [
                              {
                                label: 'Economic Health',
                                value: Math.min(100, (softSelectedCountry.gdpPerCapita / 50000) * 100),
                                color: '#22d3ee',
                                icon: DollarSign,
                                tooltip: `Economic strength based on GDP per capita (${formatNumber(softSelectedCountry.gdpPerCapita)}). Higher values indicate stronger economic performance.`
                              },
                              {
                                label: 'Market Activity',
                                value: Math.min(100, Math.max(20, ((softSelectedCountry.growthRate || 2) + 2) * 20)),
                                color: '#10b981',
                                icon: Activity,
                                tooltip: `Market dynamism based on GDP growth rate (${((softSelectedCountry.growthRate || 0) * 100).toFixed(1)}%). Measures economic momentum and business activity.`
                              },
                              {
                                label: 'Development Index',
                                value: (() => {
                                  const tier = getEconomicTier(softSelectedCountry.gdpPerCapita);
                                  return tier === "Advanced" ? 95 :
                                         tier === "Developed" ? 75 :
                                         tier === "Emerging" ? 55 :
                                         tier === "Developing" ? 35 : 20;
                                })(),
                                color: '#8b5cf6',
                                icon: BarChart,
                                tooltip: `Overall development level (${getEconomicTier(softSelectedCountry.gdpPerCapita)}). Composite indicator of infrastructure, education, and institutional quality.`
                              }
                            ].map((metric) => (
                              <div key={metric.label} className="text-center">
                                <HealthRing
                                  value={metric.value}
                                  size={70}
                                  color={metric.color}
                                  label={metric.label}
                                  tooltip={metric.tooltip}
                                />
                                <div className="text-white/90 text-xs mt-2 font-medium">
                                  {metric.label}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Quick Stats */}
                          <div className="mb-6 p-4 bg-[var(--color-bg-secondary)]/30 rounded-lg border border-[var(--color-border-primary)]">
                            <h5 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Quick Stats</h5>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-[var(--color-text-muted)]">GDP Total:</span>
                                <div className="text-[var(--color-text-primary)] font-medium">
                                  {formatNumber(softSelectedCountry.gdp)}
                                </div>
                              </div>
                              <div>
                                <span className="text-[var(--color-text-muted)]">Tax Revenue:</span>
                                <div className="text-[var(--color-text-primary)] font-medium">
                                  {(softSelectedCountry.taxRevenuePercent || 0).toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Name Input and Buttons */}
                          <div className="space-y-4">
                            <label htmlFor="countryName" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                              Choose a name for your nation:
                            </label>
                            <input
                              id="countryName"
                              type="text"
                              placeholder="e.g., Absurrania"
                              value={newCountryName}
                              onChange={(e) => setNewCountryName(e.target.value)}
                              className="w-full px-4 py-2 bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all"
                            />
                            <div className="flex gap-2">
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  if (softSelectedCountry && newCountryName.trim()) {
                                    const finalCountry = { ...softSelectedCountry, name: newCountryName.trim() };
                                    onCountrySelect(finalCountry);
                                  } else {
                                    alert("Please enter a name for your nation.");
                                  }
                                }}
                                className="flex-1 px-4 py-3 bg-[var(--color-brand-primary)]/80 hover:bg-[var(--color-brand-primary)] rounded-lg text-white font-semibold transition-all"
                              >
                                Continue
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  setSoftSelectedCountry(null);
                                  setNewCountryName(""); // Clear the input field
                                }}
                                className="flex-1 px-4 py-3 bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]/70 transition-all"
                              >
                                Cancel
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      ) : previewData ? (
                        <motion.div
                          key={previewData.country.name}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          className="space-y-4"
                        >
                          <div className="text-center mb-6">
                            <div className="flex justify-center mb-3">
                              <EnhancedCountryFlag
                                countryName={previewData.country.name}
                                size="xl"
                                hoverBlur={false}
                                priority={true}
                              />
                            </div>
                            <h4 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
                              {previewData.country.name}
                            </h4>
                            <p className="text-[var(--color-text-muted)]">{previewData.country.continent}</p>
                          </div>

                          {/* Live Activity Rings for Hover Preview */}
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              {
                                label: 'Economic Health',
                                value: Math.min(100, (previewData.country.gdpPerCapita / 50000) * 100),
                                color: '#22d3ee',
                                tooltip: `Economic strength based on GDP per capita (${formatNumber(previewData.country.gdpPerCapita)})`
                              },
                              {
                                label: 'Market Activity',
                                value: Math.min(100, Math.max(20, ((previewData.country.growthRate || 2) + 2) * 20)),
                                color: '#10b981',
                                tooltip: `Market dynamism based on GDP growth rate (${((previewData.country.growthRate || 0) * 100).toFixed(1)}%)`
                              },
                              {
                                label: 'Development Index',
                                value: (() => {
                                  const tier = getEconomicTier(previewData.country.gdpPerCapita);
                                  return tier === "Advanced" ? 95 :
                                         tier === "Developed" ? 75 :
                                         tier === "Emerging" ? 55 :
                                         tier === "Developing" ? 35 : 20;
                                })(),
                                color: '#8b5cf6',
                                tooltip: `Development level (${getEconomicTier(previewData.country.gdpPerCapita)})`
                              }
                            ].map((metric) => (
                              <div key={metric.label} className="text-center">
                                <HealthRing
                                  value={metric.value}
                                  size={60}
                                  color={metric.color}
                                  label={metric.label}
                                  tooltip={metric.tooltip}
                                />
                                <div className="text-white/90 text-xs mt-1 font-medium">
                                  {metric.label.split(' ')[0]}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-6 p-4 bg-[var(--color-bg-secondary)]/30 rounded-lg border border-[var(--color-border-primary)]">
                            <h5 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Quick Stats</h5>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-[var(--color-text-muted)]">GDP Total:</span>
                                <div className="text-[var(--color-text-primary)] font-medium">
                                  {formatNumber(previewData.country.gdp)}
                                </div>
                              </div>
                              <div>
                                <span className="text-[var(--color-text-muted)]">Tax Revenue:</span>
                                <div className="text-[var(--color-text-primary)] font-medium">
                                  {(previewData.country.taxRevenuePercent || 0).toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-center py-8"
                        >
                          <Zap className="h-12 w-12 text-[var(--color-text-muted)]/50 mx-auto mb-4" />
                          <p className="text-[var(--color-text-muted)]">Hover over a country to see detailed preview</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </GlassCardContent>
                </GlassCard>
              </motion.div>
            </BlurFade>

            

          
           
          </div>
        </div>
      </div>
    </div>
  );
}