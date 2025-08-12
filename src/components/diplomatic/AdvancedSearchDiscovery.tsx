"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import {
  RiSearchLine,
  RiFilterLine,
  RiCloseLine,
  RiEqualLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiCalendarLine,
  RiMapPinLine,
  RiStarLine,
  RiTrophyLine,
  RiGlobalLine,
  RiShakeHandsLine,
  RiExchangeLine,
  RiUserLine,
  RiHistoryLine,
  RiBookmarkLine,
  RiEyeLine,
  RiShareLine,
  RiRefreshLine,
  RiSettings3Line,
  RiBarChartLine,
  RiFireLine,
  RiScanLine
} from "react-icons/ri";

interface AdvancedSearchDiscoveryProps {
  viewerCountryId?: string;
  viewerClearanceLevel?: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  onResultSelect?: (result: SearchResult) => void;
  className?: string;
}

interface SearchFilters {
  query: string;
  dateRange: {
    start?: string;
    end?: string;
  };
  types: string[];
  regions: string[];
  tiers: string[];
  achievements: string[];
  metrics: {
    minInfluence?: number;
    maxInfluence?: number;
    minTrade?: number;
    maxTrade?: number;
  };
  sorting: 'relevance' | 'recent' | 'influence' | 'alphabetical';
  clearanceLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
}

interface SearchResult {
  id: string;
  type: 'country' | 'achievement' | 'agreement' | 'event' | 'person' | 'organization';
  title: string;
  subtitle?: string;
  description: string;
  relevanceScore: number;
  metadata: {
    country?: string;
    region?: string;
    date?: string;
    participants?: string[];
    tags?: string[];
    clearanceLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  };
  metrics?: {
    influence?: number;
    popularity?: number;
    activity?: number;
  };
  url?: string;
}

const SEARCH_TYPES = [
  { id: 'country', label: 'Countries', icon: RiGlobalLine, color: 'text-blue-400' },
  { id: 'achievement', label: 'Achievements', icon: RiStarLine, color: 'text-yellow-400' },
  { id: 'agreement', label: 'Agreements', icon: RiShakeHandsLine, color: 'text-green-400' },
  { id: 'event', label: 'Events', icon: RiCalendarLine, color: 'text-purple-400' },
  { id: 'person', label: 'Diplomats', icon: RiUserLine, color: 'text-orange-400' },
  { id: 'organization', label: 'Organizations', icon: RiGlobalLine, color: 'text-cyan-400' }
];

const REGIONS = [
  'Northern Continent',
  'Southern Archipelago', 
  'Eastern Federation',
  'Western Alliance',
  'Central Union',
  'Polar Territories'
];

const TIERS = [
  'Legendary',
  'Platinum', 
  'Gold',
  'Silver',
  'Bronze'
];

// Mock search results - in production this would come from tRPC APIs
const MOCK_RESULTS: SearchResult[] = [
  {
    id: '1',
    type: 'country',
    title: 'Federal Republic of Astoria',
    subtitle: 'Leading Diplomatic Power',
    description: 'Premier nation in international relations with extensive embassy network and trade agreements.',
    relevanceScore: 0.95,
    metadata: {
      country: 'Federal Republic of Astoria',
      region: 'Northern Continent',
      date: '2024-01-15',
      tags: ['diplomatic', 'trade', 'influential'],
      clearanceLevel: 'PUBLIC'
    },
    metrics: {
      influence: 2847,
      popularity: 89,
      activity: 76
    }
  },
  {
    id: '2',
    type: 'achievement',
    title: 'Peace Architect',
    subtitle: 'Diplomatic Excellence Award',
    description: 'Prestigious recognition for outstanding contribution to international peace and stability.',
    relevanceScore: 0.87,
    metadata: {
      date: '2024-01-10',
      tags: ['peace', 'diplomacy', 'achievement'],
      clearanceLevel: 'PUBLIC'
    },
    metrics: {
      popularity: 94,
      activity: 45
    }
  },
  {
    id: '3',
    type: 'agreement',
    title: 'Astoria-Valoria Trade Pact',
    subtitle: 'Comprehensive Economic Partnership',
    description: 'Major bilateral trade agreement covering energy, technology, and cultural exchange sectors.',
    relevanceScore: 0.82,
    metadata: {
      date: '2024-01-08',
      participants: ['Federal Republic of Astoria', 'Kingdom of Valoria'],
      tags: ['trade', 'bilateral', 'energy'],
      clearanceLevel: 'PUBLIC'
    },
    metrics: {
      influence: 1250,
      popularity: 67,
      activity: 89
    }
  }
];

const AdvancedSearchDiscoveryComponent: React.FC<AdvancedSearchDiscoveryProps> = ({
  viewerCountryId,
  viewerClearanceLevel = 'PUBLIC',
  onResultSelect,
  className
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    dateRange: {},
    types: [],
    regions: [],
    tiers: [],
    achievements: [],
    metrics: {},
    sorting: 'relevance',
    clearanceLevel: viewerClearanceLevel
  });

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Update filters based on viewer clearance level
  useEffect(() => {
    setFilters(prev => ({ ...prev, clearanceLevel: viewerClearanceLevel }));
  }, [viewerClearanceLevel]);

  // Filter and sort results
  const filteredResults = useMemo(() => {
    let results = MOCK_RESULTS;

    // Apply query filter
    if (filters.query.trim()) {
      const query = filters.query.toLowerCase();
      results = results.filter(result =>
        result.title.toLowerCase().includes(query) ||
        result.description.toLowerCase().includes(query) ||
        result.subtitle?.toLowerCase().includes(query) ||
        result.metadata.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply type filter
    if (filters.types.length > 0) {
      results = results.filter(result => filters.types.includes(result.type));
    }

    // Apply region filter
    if (filters.regions.length > 0) {
      results = results.filter(result => 
        !result.metadata.region || filters.regions.includes(result.metadata.region)
      );
    }

    // Apply clearance level filter
    results = results.filter(result => {
      const resultClearance = result.metadata.clearanceLevel;
      const viewerClearance = filters.clearanceLevel;
      
      if (viewerClearance === 'CONFIDENTIAL') return true;
      if (viewerClearance === 'RESTRICTED') return resultClearance !== 'CONFIDENTIAL';
      return resultClearance === 'PUBLIC';
    });

    // Apply date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      results = results.filter(result => {
        if (!result.metadata.date) return false;
        const resultDate = new Date(result.metadata.date);
        if (filters.dateRange.start && resultDate < new Date(filters.dateRange.start)) return false;
        if (filters.dateRange.end && resultDate > new Date(filters.dateRange.end)) return false;
        return true;
      });
    }

    // Apply metrics filters
    if (filters.metrics.minInfluence !== undefined) {
      results = results.filter(result => 
        (result.metrics?.influence || 0) >= filters.metrics.minInfluence!
      );
    }
    if (filters.metrics.maxInfluence !== undefined) {
      results = results.filter(result => 
        (result.metrics?.influence || 0) <= filters.metrics.maxInfluence!
      );
    }

    // Sort results
    results = [...results].sort((a, b) => {
      switch (filters.sorting) {
        case 'recent':
          return new Date(b.metadata.date || 0).getTime() - new Date(a.metadata.date || 0).getTime();
        case 'influence':
          return (b.metrics?.influence || 0) - (a.metrics?.influence || 0);
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'relevance':
        default:
          return b.relevanceScore - a.relevanceScore;
      }
    });

    return results;
  }, [filters]);

  // Handle search execution
  const executeSearch = useCallback(() => {
    if (!filters.query.trim()) return;
    
    setIsSearching(true);
    
    // Add to recent searches
    setRecentSearches(prev => {
      const updated = [filters.query, ...prev.filter(q => q !== filters.query)];
      return updated.slice(0, 5);
    });

    // Simulate search delay
    setTimeout(() => setIsSearching(false), 500);
  }, [filters.query]);

  // Handle filter changes
  const updateFilter = useCallback(<K extends keyof SearchFilters>(
    key: K, 
    value: SearchFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Toggle filter array values
  const toggleFilterArray = useCallback(<K extends keyof SearchFilters>(
    key: K,
    value: string,
    array: SearchFilters[K] extends string[] ? SearchFilters[K] : never
  ) => {
    const currentArray = array as string[];
    const updated = currentArray.includes(value)
      ? currentArray.filter(v => v !== value)
      : [...currentArray, value];
    updateFilter(key, updated as SearchFilters[K]);
  }, [updateFilter]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      query: '',
      dateRange: {},
      types: [],
      regions: [],
      tiers: [],
      achievements: [],
      metrics: {},
      sorting: 'relevance',
      clearanceLevel: viewerClearanceLevel
    });
  }, [viewerClearanceLevel]);

  // Get result type configuration
  const getTypeConfig = (type: string) => {
    return SEARCH_TYPES.find(t => t.id === type) || SEARCH_TYPES[0];
  };

  // Render search result
  const renderResult = (result: SearchResult, index: number) => {
    const typeConfig = getTypeConfig(result.type);
    const IconComponent = typeConfig.icon;

    return (
      <motion.div
        key={result.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className="group p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer"
        onClick={() => onResultSelect?.(result)}
      >
        <div className="flex items-start gap-4">
          {/* Type icon */}
          <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
            "bg-white/10 group-hover:bg-white/20 transition-colors"
          )}>
            <IconComponent className={cn("w-5 h-5", typeConfig.color)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-white group-hover:text-[--intel-gold] transition-colors truncate">
                  {result.title}
                </h4>
                {result.subtitle && (
                  <p className="text-sm text-[--intel-gold] font-medium">
                    {result.subtitle}
                  </p>
                )}
              </div>
              
              {/* Relevance score */}
              <div className="flex-shrink-0 text-xs text-[--intel-silver]">
                {Math.round(result.relevanceScore * 100)}% match
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-[--intel-silver] leading-relaxed mb-3 line-clamp-2">
              {result.description}
            </p>

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-[--intel-silver] mb-2">
              {result.metadata.region && (
                <div className="flex items-center gap-1">
                  <RiMapPinLine className="w-3 h-3" />
                  <span>{result.metadata.region}</span>
                </div>
              )}
              {result.metadata.date && (
                <div className="flex items-center gap-1">
                  <RiCalendarLine className="w-3 h-3" />
                  <span>{new Date(result.metadata.date).toLocaleDateString()}</span>
                </div>
              )}
              {result.metadata.clearanceLevel !== 'PUBLIC' && (
                <div className={cn(
                  "px-2 py-1 rounded-full font-medium",
                  result.metadata.clearanceLevel === 'CONFIDENTIAL' 
                    ? "bg-red-500/20 text-red-400"
                    : "bg-yellow-500/20 text-yellow-400"
                )}>
                  {result.metadata.clearanceLevel}
                </div>
              )}
            </div>

            {/* Tags */}
            {result.metadata.tags && result.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {result.metadata.tags.slice(0, 3).map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-white/10 text-[--intel-silver] text-xs rounded"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Metrics */}
            {result.metrics && (
              <div className="flex items-center gap-4 text-xs">
                {result.metrics.influence !== undefined && (
                  <div className="flex items-center gap-1">
                    <RiBarChartLine className="w-3 h-3 text-blue-400" />
                    <span className="text-blue-400">{result.metrics.influence}</span>
                  </div>
                )}
                {result.metrics.popularity !== undefined && (
                  <div className="flex items-center gap-1">
                    <RiFireLine className="w-3 h-3 text-orange-400" />
                    <span className="text-orange-400">{result.metrics.popularity}%</span>
                  </div>
                )}
                {result.metrics.activity !== undefined && (
                  <div className="flex items-center gap-1">
                    <RiHistoryLine className="w-3 h-3 text-green-400" />
                    <span className="text-green-400">{result.metrics.activity}%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="p-1 text-[--intel-silver] hover:text-white transition-colors rounded">
              <RiBookmarkLine className="w-4 h-4" />
            </button>
            <button className="p-1 text-[--intel-silver] hover:text-white transition-colors rounded">
              <RiShareLine className="w-4 h-4" />
            </button>
            <button className="p-1 text-[--intel-silver] hover:text-white transition-colors rounded">
              <RiEyeLine className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-[--intel-gold] flex items-center gap-3">
            <RiScanLine className="w-6 h-6" />
            Advanced Search & Discovery
          </h3>
          <p className="text-[--intel-silver] mt-1">
            Comprehensive intelligence search across all diplomatic systems
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={cn(
              "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              showAdvancedFilters
                ? "bg-[--intel-gold]/20 text-[--intel-gold]"
                : "bg-white/10 text-[--intel-silver] hover:text-white"
            )}
          >
            <RiSettings3Line className="w-4 h-4" />
          </button>
          
          <button 
            onClick={clearFilters}
            className="p-2 text-[--intel-silver] hover:text-white transition-colors rounded-lg bg-white/10"
          >
            <RiRefreshLine className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main search */}
      <div className="relative">
        <RiSearchLine className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[--intel-silver]" />
        <input
          type="text"
          placeholder="Search countries, achievements, agreements, events..."
          value={filters.query}
          onChange={(e) => updateFilter('query', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
          className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-[--intel-silver] focus:outline-none focus:border-[--intel-gold]/50 text-lg"
        />
        
        {isSearching && (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-[--intel-gold]/30 border-t-[--intel-gold] rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap gap-2">
        {SEARCH_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => toggleFilterArray('types', type.id, filters.types)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              filters.types.includes(type.id)
                ? "bg-[--intel-gold]/20 text-[--intel-gold] border border-[--intel-gold]/30"
                : "bg-white/5 text-[--intel-silver] hover:bg-white/10 hover:text-white border border-transparent"
            )}
          >
            <type.icon className="w-4 h-4" />
            {type.label}
            {filters.types.includes(type.id) && (
              <RiCloseLine className="w-3 h-3 ml-1" />
            )}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-lg"
          >
            <h4 className="font-semibold text-white">Advanced Filters</h4>
            
            {/* Date range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[--intel-silver] mb-2">Start Date</label>
                <input
                  type="date"
                  value={filters.dateRange.start || ''}
                  onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, start: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[--intel-gold]/50"
                />
              </div>
              <div>
                <label className="block text-sm text-[--intel-silver] mb-2">End Date</label>
                <input
                  type="date"
                  value={filters.dateRange.end || ''}
                  onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, end: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[--intel-gold]/50"
                />
              </div>
            </div>

            {/* Regions */}
            <div>
              <label className="block text-sm text-[--intel-silver] mb-2">Regions</label>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((region) => (
                  <button
                    key={region}
                    onClick={() => toggleFilterArray('regions', region, filters.regions)}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm transition-colors",
                      filters.regions.includes(region)
                        ? "bg-[--intel-gold]/20 text-[--intel-gold]"
                        : "bg-white/10 text-[--intel-silver] hover:text-white"
                    )}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>

            {/* Sorting */}
            <div>
              <label className="block text-sm text-[--intel-silver] mb-2">Sort By</label>
              <select
                value={filters.sorting}
                onChange={(e) => updateFilter('sorting', e.target.value as any)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[--intel-gold]/50"
              >
                <option value="relevance" className="bg-[--intel-navy]">Relevance</option>
                <option value="recent" className="bg-[--intel-navy]">Most Recent</option>
                <option value="influence" className="bg-[--intel-navy]">Highest Influence</option>
                <option value="alphabetical" className="bg-[--intel-navy]">Alphabetical</option>
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent searches */}
      {recentSearches.length > 0 && !filters.query && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[--intel-silver]">Recent Searches</h4>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search, index) => (
              <button
                key={index}
                onClick={() => updateFilter('query', search)}
                className="px-3 py-1 bg-white/10 text-[--intel-silver] hover:text-white text-sm rounded-lg transition-colors"
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="space-y-4">
        {/* Results header */}
        {filteredResults.length > 0 && (
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-white">
              Search Results ({filteredResults.length})
            </h4>
            
            <div className="flex items-center gap-2 text-sm text-[--intel-silver]">
              <RiScanLine className="w-4 h-4" />
              <span>Clearance: {filters.clearanceLevel}</span>
            </div>
          </div>
        )}

        {/* Results list */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredResults.map(renderResult)}
          </AnimatePresence>
        </div>

        {/* No results */}
        {filteredResults.length === 0 && filters.query && (
          <div className="text-center py-12 text-[--intel-silver]">
            <RiSearchLine className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium mb-2">No results found</p>
            <p className="text-sm">Try adjusting your search criteria or clearing some filters.</p>
          </div>
        )}

        {/* Empty state */}
        {filteredResults.length === 0 && !filters.query && (
          <div className="text-center py-12 text-[--intel-silver]">
            <RiScanLine className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium mb-2">Advanced Intelligence Search</p>
            <p className="text-sm">Search across countries, achievements, agreements, and more.</p>
          </div>
        )}
      </div>
    </div>
  );
};

AdvancedSearchDiscoveryComponent.displayName = 'AdvancedSearchDiscovery';

export const AdvancedSearchDiscovery = React.memo(AdvancedSearchDiscoveryComponent);