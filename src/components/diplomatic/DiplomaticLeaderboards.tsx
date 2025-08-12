"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import {
  RiTrophyLine,
  RiMedalLine,
  RiStarLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiArrowRightLine,
  RiEyeLine,
  RiShakeHandsLine,
  RiGlobalLine,
  RiShieldLine,
  RiExchangeLine,
  RiFilterLine,
  RiTimeLine,
  RiBarChartLine,
  RiSearchLine,
  RiRefreshLine
} from "react-icons/ri";

interface DiplomaticLeaderboardsProps {
  viewerCountryId?: string;
  viewerClearanceLevel?: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  compact?: boolean;
  className?: string;
}

interface CountryRanking {
  id: string;
  name: string;
  code: string;
  flag?: string;
  rank: number;
  previousRank?: number;
  score: number;
  previousScore?: number;
  metrics: {
    diplomaticRelations: number;
    tradeAgreements: number;
    culturalExchanges: number;
    achievements: number;
    influenceScore: number;
    stabilityIndex: number;
    cooperationRating: number;
    trustworthiness: number;
  };
  badges: string[];
  tier: 'legendary' | 'platinum' | 'gold' | 'silver' | 'bronze';
  lastActivity: string;
  trend: 'rising' | 'falling' | 'stable';
}

interface LeaderboardCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  dataKey: keyof CountryRanking['metrics'];
  format: (value: number) => string;
}

const LEADERBOARD_CATEGORIES: LeaderboardCategory[] = [
  {
    id: 'overall',
    title: 'Overall Diplomatic Ranking',
    description: 'Comprehensive diplomatic performance across all metrics',
    icon: RiTrophyLine,
    color: 'text-yellow-400',
    dataKey: 'influenceScore',
    format: (value) => `${Math.round(value)}`
  },
  {
    id: 'relations',
    title: 'Diplomatic Relations',
    description: 'Number of active diplomatic relationships',
    icon: RiShakeHandsLine,
    color: 'text-blue-400',
    dataKey: 'diplomaticRelations',
    format: (value) => `${value} nations`
  },
  {
    id: 'trade',
    title: 'Trade Agreements',
    description: 'Active trade partnerships and economic cooperation',
    icon: RiExchangeLine,
    color: 'text-green-400',
    dataKey: 'tradeAgreements',
    format: (value) => `${value} agreements`
  },
  {
    id: 'cultural',
    title: 'Cultural Exchange',
    description: 'International cultural programs and exchanges',
    icon: RiGlobalLine,
    color: 'text-purple-400',
    dataKey: 'culturalExchanges',
    format: (value) => `${value} programs`
  },
  {
    id: 'achievements',
    title: 'Diplomatic Achievements',
    description: 'Unlocked diplomatic milestones and recognitions',
    icon: RiStarLine,
    color: 'text-yellow-300',
    dataKey: 'achievements',
    format: (value) => `${value} unlocked`
  },
  {
    id: 'stability',
    title: 'Regional Stability',
    description: 'Contribution to regional peace and stability',
    icon: RiShieldLine,
    color: 'text-indigo-400',
    dataKey: 'stabilityIndex',
    format: (value) => `${Math.round(value * 100)}%`
  },
  {
    id: 'cooperation',
    title: 'International Cooperation',
    description: 'Participation in multilateral initiatives',
    icon: RiGlobalLine,
    color: 'text-cyan-400',
    dataKey: 'cooperationRating',
    format: (value) => `${Math.round(value * 100)}%`
  },
  {
    id: 'trust',
    title: 'Trustworthiness Index',
    description: 'Reliability in honoring diplomatic commitments',
    icon: RiShieldLine,
    color: 'text-emerald-400',
    dataKey: 'trustworthiness',
    format: (value) => `${Math.round(value * 100)}%`
  }
];

const TIER_CONFIG = {
  legendary: { color: 'from-purple-500 to-pink-500', label: 'Legendary', minRank: 1 },
  platinum: { color: 'from-blue-400 to-purple-500', label: 'Platinum', minRank: 2 },
  gold: { color: 'from-yellow-400 to-orange-500', label: 'Gold', minRank: 6 },
  silver: { color: 'from-gray-300 to-gray-500', label: 'Silver', minRank: 16 },
  bronze: { color: 'from-amber-600 to-amber-800', label: 'Bronze', minRank: 31 }
};

// Mock data - in production this would come from tRPC APIs
const MOCK_RANKINGS: CountryRanking[] = [
  {
    id: '1',
    name: 'Federal Republic of Astoria',
    code: 'AST',
    rank: 1,
    previousRank: 2,
    score: 2847,
    previousScore: 2756,
    metrics: {
      diplomaticRelations: 47,
      tradeAgreements: 23,
      culturalExchanges: 15,
      achievements: 34,
      influenceScore: 2847,
      stabilityIndex: 0.94,
      cooperationRating: 0.91,
      trustworthiness: 0.96
    },
    badges: ['Peace Architect', 'Trade Pioneer', 'Cultural Bridge'],
    tier: 'legendary',
    lastActivity: '2 hours ago',
    trend: 'rising'
  },
  {
    id: '2',
    name: 'Kingdom of Valoria',
    code: 'VAL',
    rank: 2,
    previousRank: 1,
    score: 2743,
    previousScore: 2821,
    metrics: {
      diplomaticRelations: 43,
      tradeAgreements: 28,
      culturalExchanges: 12,
      achievements: 31,
      influenceScore: 2743,
      stabilityIndex: 0.89,
      cooperationRating: 0.87,
      trustworthiness: 0.93
    },
    badges: ['Economic Powerhouse', 'Alliance Architect'],
    tier: 'platinum',
    lastActivity: '5 hours ago',
    trend: 'falling'
  },
  {
    id: '3',
    name: 'United Provinces of Meridia',
    code: 'MER',
    rank: 3,
    previousRank: 4,
    score: 2698,
    previousScore: 2634,
    metrics: {
      diplomaticRelations: 38,
      tradeAgreements: 19,
      culturalExchanges: 22,
      achievements: 28,
      influenceScore: 2698,
      stabilityIndex: 0.92,
      cooperationRating: 0.94,
      trustworthiness: 0.88
    },
    badges: ['Cultural Ambassador', 'Peace Keeper'],
    tier: 'platinum',
    lastActivity: '1 hour ago',
    trend: 'rising'
  }
  // Add more mock data as needed
];

const DiplomaticLeaderboardsComponent: React.FC<DiplomaticLeaderboardsProps> = ({
  viewerCountryId,
  viewerClearanceLevel = 'PUBLIC',
  compact = false,
  className
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('overall');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showTrends, setShowTrends] = useState(true);
  const [filterTier, setFilterTier] = useState<string>('');

  // Get current category configuration
  const currentCategory = LEADERBOARD_CATEGORIES.find(cat => cat.id === activeCategory);

  // Sort and filter rankings
  const sortedRankings = useMemo(() => {
    let filtered = MOCK_RANKINGS;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(country =>
        country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        country.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply tier filter
    if (filterTier) {
      filtered = filtered.filter(country => country.tier === filterTier);
    }

    // Sort by selected metric
    if (currentCategory) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a.metrics[currentCategory.dataKey];
        const bValue = b.metrics[currentCategory.dataKey];
        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
      });
    }

    return filtered;
  }, [searchTerm, filterTier, currentCategory, sortOrder]);

  // Get rank change indicator
  const getRankChange = (current: number, previous?: number) => {
    if (!previous) return null;
    if (current < previous) return { type: 'up', change: previous - current };
    if (current > previous) return { type: 'down', change: current - previous };
    return { type: 'same', change: 0 };
  };

  // Render individual ranking item
  const renderRankingItem = (country: CountryRanking, index: number) => {
    const rankChange = getRankChange(country.rank, country.previousRank);
    const tierConfig = TIER_CONFIG[country.tier];
    const isViewer = country.id === viewerCountryId;
    const metricValue = country.metrics[currentCategory?.dataKey || 'influenceScore'];

    return (
      <motion.div
        key={country.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className={cn(
          "relative p-4 rounded-lg border backdrop-blur-sm transition-all duration-300",
          isViewer
            ? "bg-[--intel-gold]/20 border-[--intel-gold]/50 shadow-lg"
            : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
        )}
      >
        {/* Tier indicator */}
        <div className={cn(
          "absolute top-0 left-0 w-1 h-full rounded-l-lg bg-gradient-to-b",
          tierConfig.color
        )} />

        <div className="flex items-center gap-4">
          {/* Rank */}
          <div className="flex items-center gap-2 min-w-[60px]">
            <div className={cn(
              "text-2xl font-bold",
              country.rank <= 3 ? "text-[--intel-gold]" : "text-white"
            )}>
              #{country.rank}
            </div>
            
            {/* Rank change */}
            {rankChange && showTrends && (
              <div className={cn(
                "flex items-center text-xs",
                rankChange.type === 'up' ? "text-green-400" :
                rankChange.type === 'down' ? "text-red-400" : "text-gray-400"
              )}>
                {rankChange.type === 'up' && <RiArrowUpLine className="w-3 h-3" />}
                {rankChange.type === 'down' && <RiArrowDownLine className="w-3 h-3" />}
                {rankChange.type === 'same' && <RiArrowRightLine className="w-3 h-3" />}
                {rankChange.change > 0 && rankChange.change}
              </div>
            )}
          </div>

          {/* Country info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h4 className="font-semibold text-white truncate">{country.name}</h4>
              <span className="text-xs text-[--intel-silver] bg-white/10 px-2 py-1 rounded">
                {country.code}
              </span>
              {isViewer && (
                <span className="text-xs text-[--intel-gold] bg-[--intel-gold]/20 px-2 py-1 rounded">
                  You
                </span>
              )}
            </div>
            
            {/* Badges */}
            {country.badges.length > 0 && (
              <div className="flex gap-1 mb-2">
                {country.badges.slice(0, compact ? 2 : 3).map((badge, i) => (
                  <span
                    key={i}
                    className="text-xs text-[--intel-gold] bg-[--intel-gold]/20 px-2 py-1 rounded"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}

            {/* Tier and activity */}
            <div className="flex items-center gap-3 text-xs text-[--intel-silver]">
              <span className={cn("font-medium", tierConfig.color)}>
                {tierConfig.label}
              </span>
              <span>•</span>
              <span>Active {country.lastActivity}</span>
            </div>
          </div>

          {/* Metric value */}
          <div className="text-right">
            <div className={cn(
              "text-lg font-bold",
              currentCategory?.color || "text-white"
            )}>
              {currentCategory?.format(metricValue) || metricValue}
            </div>
            {country.previousScore && showTrends && (
              <div className={cn(
                "text-xs",
                country.score > country.previousScore ? "text-green-400" :
                country.score < country.previousScore ? "text-red-400" : "text-gray-400"
              )}>
                {country.score > country.previousScore ? '+' : ''}
                {Math.round(((country.score - country.previousScore) / country.previousScore) * 100)}%
              </div>
            )}
          </div>

          {/* View details */}
          <button className="p-2 text-[--intel-silver] hover:text-white transition-colors rounded">
            <RiEyeLine className="w-4 h-4" />
          </button>
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
            <RiBarChartLine className="w-6 h-6" />
            Diplomatic Leaderboards
          </h3>
          <p className="text-[--intel-silver] mt-1">
            Global diplomatic rankings and performance metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTrends(!showTrends)}
            className={cn(
              "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              showTrends
                ? "bg-[--intel-gold]/20 text-[--intel-gold]"
                : "bg-white/10 text-[--intel-silver] hover:text-white"
            )}
          >
            <RiTimeLine className="w-4 h-4" />
          </button>
          
          <button className="p-2 text-[--intel-silver] hover:text-white transition-colors rounded-lg bg-white/10">
            <RiRefreshLine className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {LEADERBOARD_CATEGORIES.map((category) => {
          const IconComponent = category.icon;
          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
                activeCategory === category.id
                  ? "bg-[--intel-gold]/20 text-[--intel-gold] border border-[--intel-gold]/30"
                  : "bg-white/5 text-[--intel-silver] hover:bg-white/10 hover:text-white border border-transparent"
              )}
            >
              <IconComponent className="w-4 h-4" />
              <span className="hidden sm:inline">{category.title}</span>
            </button>
          );
        })}
      </div>

      {/* Filters and search */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <RiSearchLine className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[--intel-silver]" />
          <input
            type="text"
            placeholder="Search countries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-[--intel-silver] focus:outline-none focus:border-[--intel-gold]/50"
          />
        </div>

        {/* Tier filter */}
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value)}
          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[--intel-gold]/50"
        >
          <option value="">All Tiers</option>
          {Object.entries(TIER_CONFIG).map(([tier, config]) => (
            <option key={tier} value={tier} className="bg-[--intel-navy]">
              {config.label}
            </option>
          ))}
        </select>

        {/* Sort order */}
        <button
          onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
          className="flex items-center gap-2 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-[--intel-silver] hover:text-white transition-colors"
        >
          <RiFilterLine className="w-4 h-4" />
          {sortOrder === 'desc' ? 'Highest' : 'Lowest'} First
        </button>
      </div>

      {/* Current category info */}
      {currentCategory && (
        <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <currentCategory.icon className={cn("w-5 h-5", currentCategory.color)} />
            <h4 className="font-semibold text-white">{currentCategory.title}</h4>
          </div>
          <p className="text-sm text-[--intel-silver]">{currentCategory.description}</p>
        </div>
      )}

      {/* Rankings list */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {sortedRankings.map(renderRankingItem)}
        </AnimatePresence>
      </div>

      {/* No results */}
      {sortedRankings.length === 0 && (
        <div className="text-center py-12 text-[--intel-silver]">
          <RiSearchLine className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p>No countries found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};

DiplomaticLeaderboardsComponent.displayName = 'DiplomaticLeaderboards';

export const DiplomaticLeaderboards = React.memo(DiplomaticLeaderboardsComponent);