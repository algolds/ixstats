"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
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
  RiRefreshLine,
} from "react-icons/ri";

interface DiplomaticLeaderboardsProps {
  viewerCountryId?: string;
  viewerClearanceLevel?: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
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
  tier: "legendary" | "platinum" | "gold" | "silver" | "bronze";
  lastActivity: string;
  trend: "rising" | "falling" | "stable";
}

interface LeaderboardCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  dataKey: keyof CountryRanking["metrics"];
  format: (value: number) => string;
}

const LEADERBOARD_CATEGORIES: LeaderboardCategory[] = [
  {
    id: "overall",
    title: "Overall Diplomatic Ranking",
    description: "Comprehensive diplomatic performance across all metrics",
    icon: RiTrophyLine,
    color: "text-yellow-400",
    dataKey: "influenceScore",
    format: (value) => `${Math.round(value)}`,
  },
  {
    id: "relations",
    title: "Diplomatic Relations",
    description: "Number of active diplomatic relationships",
    icon: RiShakeHandsLine,
    color: "text-blue-400",
    dataKey: "diplomaticRelations",
    format: (value) => `${value} nations`,
  },
  {
    id: "trade",
    title: "Trade Agreements",
    description: "Active trade partnerships and economic cooperation",
    icon: RiExchangeLine,
    color: "text-green-400",
    dataKey: "tradeAgreements",
    format: (value) => `${value} agreements`,
  },
  {
    id: "cultural",
    title: "Cultural Exchange",
    description: "International cultural programs and exchanges",
    icon: RiGlobalLine,
    color: "text-purple-400",
    dataKey: "culturalExchanges",
    format: (value) => `${value} programs`,
  },
  {
    id: "achievements",
    title: "Diplomatic Achievements",
    description: "Unlocked diplomatic milestones and recognitions",
    icon: RiStarLine,
    color: "text-yellow-300",
    dataKey: "achievements",
    format: (value) => `${value} unlocked`,
  },
  {
    id: "stability",
    title: "Regional Stability",
    description: "Contribution to regional peace and stability",
    icon: RiShieldLine,
    color: "text-indigo-400",
    dataKey: "stabilityIndex",
    format: (value) => `${Math.round(value * 100)}%`,
  },
  {
    id: "cooperation",
    title: "International Cooperation",
    description: "Participation in multilateral initiatives",
    icon: RiGlobalLine,
    color: "text-cyan-400",
    dataKey: "cooperationRating",
    format: (value) => `${Math.round(value * 100)}%`,
  },
  {
    id: "trust",
    title: "Trustworthiness Index",
    description: "Reliability in honoring diplomatic commitments",
    icon: RiShieldLine,
    color: "text-emerald-400",
    dataKey: "trustworthiness",
    format: (value) => `${Math.round(value * 100)}%`,
  },
];

const TIER_CONFIG = {
  legendary: { color: "from-purple-500 to-pink-500", label: "Legendary", minRank: 1 },
  platinum: { color: "from-blue-400 to-purple-500", label: "Platinum", minRank: 2 },
  gold: { color: "from-yellow-400 to-orange-500", label: "Gold", minRank: 6 },
  silver: { color: "from-gray-300 to-gray-500", label: "Silver", minRank: 16 },
  bronze: { color: "from-amber-600 to-amber-800", label: "Bronze", minRank: 31 },
};

// All data now comes from live tRPC APIs - no mock data fallbacks

const DiplomaticLeaderboardsComponent: React.FC<DiplomaticLeaderboardsProps> = ({
  viewerCountryId,
  viewerClearanceLevel = "PUBLIC",
  compact = false,
  className,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>("overall");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [showTrends, setShowTrends] = useState(true);
  const [filterTier, setFilterTier] = useState<string>("");

  // Fetch country rankings from API
  const { data: countriesData, isLoading } = api.countries.getAll.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
  });

  // Transform API data to ranking format
  const apiRankings = useMemo(() => {
    if (!countriesData || !("countries" in countriesData)) return [];

    return countriesData.countries
      .map((country: any, index: number) => ({
        id: country.id,
        name: country.name,
        code: country.id.substring(0, 3).toUpperCase(),
        rank: index + 1,
        previousRank: index + 2, // Would need historical data for real previous rank
        score: country.diplomaticStanding * 30 + country.economicVitality * 10,
        previousScore: country.diplomaticStanding * 30 + country.economicVitality * 10 - 50,
        metrics: {
          diplomaticRelations: Math.floor(country.diplomaticStanding * 0.5),
          tradeAgreements: Math.floor(country.economicVitality * 0.3),
          culturalExchanges: Math.floor(country.populationWellbeing * 0.2),
          achievements: Math.floor((country.diplomaticStanding + country.economicVitality) * 0.2),
          influenceScore: country.diplomaticStanding * 30 + country.economicVitality * 10,
          stabilityIndex: country.governmentalEfficiency / 100,
          cooperationRating: country.diplomaticStanding / 100,
          trustworthiness: (country.governmentalEfficiency + country.diplomaticStanding) / 200,
        },
        badges:
          country.diplomaticStanding > 80
            ? ["Peace Architect", "Trade Pioneer"]
            : country.diplomaticStanding > 60
              ? ["Alliance Builder"]
              : [],
        tier:
          country.diplomaticStanding > 85
            ? "legendary"
            : country.diplomaticStanding > 75
              ? "platinum"
              : country.diplomaticStanding > 65
                ? "gold"
                : country.diplomaticStanding > 55
                  ? "silver"
                  : "bronze",
        lastActivity: "1 hour ago", // Would need real activity data
        trend:
          country.diplomaticStanding > 70
            ? "rising"
            : country.diplomaticStanding < 50
              ? "falling"
              : "stable",
      }))
      .sort((a: any, b: any) => b.score - a.score)
      .map((country: any, index: number) => ({ ...country, rank: index + 1 }));
  }, [countriesData]);

  // Get current category configuration
  const currentCategory = LEADERBOARD_CATEGORIES.find((cat) => cat.id === activeCategory);

  // Sort and filter rankings
  const sortedRankings = useMemo(() => {
    let filtered = apiRankings;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (country: any) =>
          country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          country.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply tier filter
    if (filterTier) {
      filtered = filtered.filter((country: any) => country.tier === filterTier);
    }

    // Sort by selected metric
    if (currentCategory) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a.metrics[currentCategory.dataKey];
        const bValue = b.metrics[currentCategory.dataKey];
        return sortOrder === "desc" ? bValue - aValue : aValue - bValue;
      });
    }

    return filtered;
  }, [searchTerm, filterTier, currentCategory, sortOrder]);

  // Get rank change indicator
  const getRankChange = (current: number, previous?: number) => {
    if (!previous) return null;
    if (current < previous) return { type: "up", change: previous - current };
    if (current > previous) return { type: "down", change: current - previous };
    return { type: "same", change: 0 };
  };

  // Render individual ranking item
  const renderRankingItem = (country: CountryRanking, index: number) => {
    const rankChange = getRankChange(country.rank, country.previousRank);
    const tierConfig = TIER_CONFIG[country.tier];
    const isViewer = country.id === viewerCountryId;
    const metricValue = country.metrics[currentCategory?.dataKey || "influenceScore"];

    return (
      <motion.div
        key={country.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className={cn(
          "relative rounded-lg border p-4 backdrop-blur-sm transition-all duration-300",
          isViewer
            ? "border-[--intel-gold]/50 bg-[--intel-gold]/20 shadow-lg"
            : "bg-card border-border hover:bg-muted/50 hover:border-border"
        )}
      >
        {/* Tier indicator */}
        <div
          className={cn(
            "absolute top-0 left-0 h-full w-1 rounded-l-lg bg-gradient-to-b",
            tierConfig.color
          )}
        />

        <div className="flex items-center gap-4">
          {/* Rank */}
          <div className="flex min-w-[60px] items-center gap-2">
            <div
              className={cn(
                "text-2xl font-bold",
                country.rank <= 3 ? "text-[--intel-gold]" : "text-foreground"
              )}
            >
              #{country.rank}
            </div>

            {/* Rank change */}
            {rankChange && showTrends && (
              <div
                className={cn(
                  "flex items-center text-xs",
                  rankChange.type === "up"
                    ? "text-green-400"
                    : rankChange.type === "down"
                      ? "text-red-400"
                      : "text-gray-400"
                )}
              >
                {rankChange.type === "up" && <RiArrowUpLine className="h-3 w-3" />}
                {rankChange.type === "down" && <RiArrowDownLine className="h-3 w-3" />}
                {rankChange.type === "same" && <RiArrowRightLine className="h-3 w-3" />}
                {rankChange.change > 0 && rankChange.change}
              </div>
            )}
          </div>

          {/* Country info */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-3">
              <h4 className="text-foreground truncate font-semibold">{country.name}</h4>
              <span className="rounded bg-white/10 px-2 py-1 text-xs text-[--intel-silver]">
                {country.code}
              </span>
              {isViewer && (
                <span className="rounded bg-[--intel-gold]/20 px-2 py-1 text-xs text-[--intel-gold]">
                  You
                </span>
              )}
            </div>

            {/* Badges */}
            {country.badges.length > 0 && (
              <div className="mb-2 flex gap-1">
                {country.badges.slice(0, compact ? 2 : 3).map((badge, i) => (
                  <span
                    key={i}
                    className="rounded bg-[--intel-gold]/20 px-2 py-1 text-xs text-[--intel-gold]"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}

            {/* Tier and activity */}
            <div className="flex items-center gap-3 text-xs text-[--intel-silver]">
              <span className={cn("font-medium", tierConfig.color)}>{tierConfig.label}</span>
              <span>•</span>
              <span>Active {country.lastActivity}</span>
            </div>
          </div>

          {/* Metric value */}
          <div className="text-right">
            <div className={cn("text-lg font-bold", currentCategory?.color || "text-foreground")}>
              {currentCategory?.format(metricValue) || metricValue}
            </div>
            {country.previousScore && showTrends && (
              <div
                className={cn(
                  "text-xs",
                  country.score > country.previousScore
                    ? "text-green-400"
                    : country.score < country.previousScore
                      ? "text-red-400"
                      : "text-gray-400"
                )}
              >
                {country.score > country.previousScore ? "+" : ""}
                {Math.round(
                  ((country.score - country.previousScore) / country.previousScore) * 100
                )}
                %
              </div>
            )}
          </div>

          {/* View details */}
          <button className="hover:text-foreground rounded p-2 text-[--intel-silver] transition-colors">
            <RiEyeLine className="h-4 w-4" />
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
          <h3 className="flex items-center gap-3 text-2xl font-bold text-[--intel-gold]">
            <RiBarChartLine className="h-6 w-6" />
            Diplomatic Leaderboards
          </h3>
          <p className="mt-1 text-[--intel-silver]">
            Global diplomatic rankings and performance metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTrends(!showTrends)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              showTrends
                ? "bg-[--intel-gold]/20 text-[--intel-gold]"
                : "bg-muted/50 hover:text-foreground text-[--intel-silver]"
            )}
          >
            <RiTimeLine className="h-4 w-4" />
          </button>

          <button className="hover:text-foreground bg-muted/50 rounded-lg p-2 text-[--intel-silver] transition-colors">
            <RiRefreshLine className="h-4 w-4" />
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
                "flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-all duration-200",
                activeCategory === category.id
                  ? "border border-[--intel-gold]/30 bg-[--intel-gold]/20 text-[--intel-gold]"
                  : "bg-muted/50 hover:bg-muted hover:text-foreground border border-transparent text-[--intel-silver]"
              )}
            >
              <IconComponent className="h-4 w-4" />
              <span className="hidden sm:inline">{category.title}</span>
            </button>
          );
        })}
      </div>

      {/* Filters and search */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <RiSearchLine className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-[--intel-silver]" />
          <input
            type="text"
            placeholder="Search countries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-input border-border text-foreground placeholder-muted-foreground focus:border-ring w-full rounded-lg border py-2 pr-4 pl-10 focus:outline-none"
          />
        </div>

        {/* Tier filter */}
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value)}
          className="bg-input border-border text-foreground focus:border-ring rounded-lg border px-3 py-2 focus:outline-none"
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
          onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
          className="bg-input border-border hover:text-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-[--intel-silver] transition-colors"
        >
          <RiFilterLine className="h-4 w-4" />
          {sortOrder === "desc" ? "Highest" : "Lowest"} First
        </button>
      </div>

      {/* Current category info */}
      {currentCategory && (
        <div className="bg-card border-border rounded-lg border p-4">
          <div className="mb-2 flex items-center gap-3">
            <currentCategory.icon className={cn("h-5 w-5", currentCategory.color)} />
            <h4 className="text-foreground font-semibold">{currentCategory.title}</h4>
          </div>
          <p className="text-sm text-[--intel-silver]">{currentCategory.description}</p>
        </div>
      )}

      {/* Rankings list */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">{sortedRankings.map(renderRankingItem)}</AnimatePresence>
      </div>

      {/* No results */}
      {sortedRankings.length === 0 && (
        <div className="py-12 text-center text-[--intel-silver]">
          <RiSearchLine className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p>No countries found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};

DiplomaticLeaderboardsComponent.displayName = "DiplomaticLeaderboards";

export const DiplomaticLeaderboards = React.memo(DiplomaticLeaderboardsComponent);
