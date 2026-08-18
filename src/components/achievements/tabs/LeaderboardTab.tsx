"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Star,
  Trophy,
  DollarSign,
  Users,
  Gauge,
  Map,
  TrendingUp,
  Briefcase,
  GraduationCap,
  Heart,
  Landmark,
  Search,
  Crown,
  Medal,
  Award,
  Loader2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { EnhancedCountryFlag } from "~/components/ui/enhanced-country-flag";
import { TextureOverlay } from "~/components/ui/texture-overlay";

interface AchievementEntry {
  countryId: string;
  countryName: string;
  achievementCount: number;
  rareAchievements: number;
  totalPoints: number;
  flag?: string | null;
  economicTier?: string;
  populationTier?: string;
}

interface LeaderboardTabProps {
  leaderboard?: Array<AchievementEntry>;
  standalone?: boolean;
}

const CATEGORIES = [
  { id: "all", label: "All Categories" },
  { id: "economy", label: "Economy & Wealth" },
  { id: "demographics", label: "Demographics & Labor" },
  { id: "governance", label: "Quality & Governance" },
] as const;

const FILTERS = [
  { id: "achievements", label: "Achievements", icon: Trophy, fmt: "achievements", domain: "all" },
  { id: "totalGdp", label: "Total GDP", icon: DollarSign, fmt: "currency", domain: "economy" },
  {
    id: "gdpPerCapita",
    label: "GDP per Capita",
    icon: DollarSign,
    fmt: "currency",
    domain: "economy",
  },
  { id: "population", label: "Population", icon: Users, fmt: "number", domain: "demographics" },
  {
    id: "populationDensity",
    label: "Pop. Density",
    icon: Gauge,
    fmt: "number",
    domain: "demographics",
  },
  { id: "landArea", label: "Land Area", icon: Map, fmt: "number", domain: "demographics" },
  { id: "gdpGrowth", label: "GDP Growth", icon: TrendingUp, fmt: "percent", domain: "economy" },
  { id: "avgIncome", label: "Avg Income", icon: DollarSign, fmt: "currency", domain: "economy" },
  { id: "workforce", label: "Workforce", icon: Users, fmt: "number", domain: "demographics" },
  {
    id: "employmentRate",
    label: "Employment",
    icon: Briefcase,
    fmt: "percent",
    domain: "demographics",
  },
  {
    id: "literacyRate",
    label: "Literacy",
    icon: GraduationCap,
    fmt: "percent",
    domain: "governance",
  },
  {
    id: "lifeExpectancy",
    label: "Life Expectancy",
    icon: Heart,
    fmt: "years",
    domain: "governance",
  },
  { id: "govRevenue", label: "Gov. Revenue", icon: Landmark, fmt: "currency", domain: "economy" },
  { id: "govSpending", label: "Gov. Spending", icon: Landmark, fmt: "currency", domain: "economy" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function fmt(type: string, val?: number | null) {
  if (val === undefined || val === null) return "—";
  if (type === "currency") {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  }
  if (type === "percent") return `${val.toFixed(1)}%`;
  if (type === "years") return `${val.toFixed(1)} yrs`;
  if (type === "number") {
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
    return val.toLocaleString();
  }
  return String(val);
}

function FlagGraphic({ countryName, flag }: { countryName: string; flag?: string | null }) {
  if (flag && (flag.startsWith("/") || flag.startsWith("http"))) {
    return (
      <img
        src={flag}
        alt={`Flag of ${countryName}`}
        className="h-5 w-7 shrink-0 rounded border border-border/60 object-cover shadow-sm"
      />
    );
  }
  return (
    <EnhancedCountryFlag
      countryName={countryName}
      size="sm"
      className="h-5 w-7 rounded object-cover shadow-sm"
    />
  );
}

function PodiumCard({
  rank,
  name,
  primary,
  secondary,
  flag,
}: {
  rank: 1 | 2 | 3;
  name: string;
  primary: string;
  secondary: string;
  flag?: string | null;
}) {
  const styles = {
    1: {
      badgeBg:
        "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40 shadow-sm",
      cardBg: "from-amber-500/15 via-amber-500/5 to-card border-amber-500/30",
      icon: Crown,
      iconColor: "text-amber-500 dark:text-amber-400 drop-shadow-sm",
      label: "Gold Champion",
    },
    2: {
      badgeBg: "bg-muted/80 text-foreground border-border/60 shadow-sm",
      cardBg: "from-muted/60 via-muted/20 to-card border-border/60",
      icon: Medal,
      iconColor: "text-muted-foreground",
      label: "Silver Runner-Up",
    },
    3: {
      badgeBg: "bg-amber-700/15 text-amber-700 dark:text-amber-400 border-amber-700/30 shadow-sm",
      cardBg: "from-amber-700/15 via-amber-700/5 to-card border-amber-700/30",
      icon: Award,
      iconColor: "text-amber-600 dark:text-amber-500",
      label: "Bronze Podium",
    },
  }[rank];

  const Icon = styles.icon;

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-t-white/15 bg-gradient-to-b p-5 shadow-xl backdrop-blur-2xl transition-all",
        styles.cardBg
      )}
    >
      <TextureOverlay texture="dots" opacity={0.03} />
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold tabular-nums backdrop-blur-md",
              styles.badgeBg
            )}
          >
            #{rank}
          </span>
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            {styles.label}
          </span>
        </div>
        <Icon className={cn("h-5 w-5", styles.iconColor)} />
      </div>

      <div className="relative z-10 mt-4 space-y-1">
        <div className="flex items-center gap-2">
          <FlagGraphic countryName={name} flag={flag} />
          <div className="truncate text-base font-bold text-foreground">{name}</div>
        </div>
        <div className="font-mono text-2xl font-bold text-foreground tabular-nums">{primary}</div>
        <div className="text-xs text-muted-foreground">{secondary}</div>
      </div>
    </motion.div>
  );
}

function Row({
  index,
  name,
  primary,
  secondary,
  flag,
}: {
  index: number;
  name: string;
  primary: string;
  secondary: string;
  flag?: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.2,
        delay: Math.min(index * 0.02, 0.2),
        ease: [0.23, 1, 0.32, 1],
      }}
      whileHover={{ y: -2, scale: 1.004 }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        "flex items-center justify-between rounded-2xl border border-border/60 border-t-white/10 p-4 backdrop-blur-2xl transition-all hover:border-border hover:shadow-lg",
        index < 3
          ? "border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-card/75 to-card/75"
          : "bg-card/70 dark:bg-card/50"
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "w-8 text-center font-mono text-xl font-bold tabular-nums",
            index === 0
              ? "text-amber-500 drop-shadow-sm dark:text-amber-400"
              : index === 1
                ? "text-muted-foreground"
                : index === 2
                  ? "text-amber-700 dark:text-amber-500"
                  : "text-muted-foreground/60"
          )}
        >
          {index + 1}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <FlagGraphic countryName={name} flag={flag} />
            <div className="font-bold text-foreground">{name}</div>
          </div>
          <div className="text-xs text-muted-foreground">{secondary}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Star className="h-4.5 w-4.5 fill-amber-400/20 text-amber-500 dark:text-amber-400" />
        <span className="font-mono text-lg font-bold text-foreground tabular-nums">{primary}</span>
      </div>
    </motion.div>
  );
}

export function LeaderboardTab({ leaderboard, standalone = false }: LeaderboardTabProps) {
  const [filter, setFilter] = useState<FilterId>("achievements");
  const [activeDomain, setActiveDomain] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [limit, setLimit] = useState<number>(25);

  const { data: achievementsData } = api.achievements.getLeaderboard.useQuery(
    { limit },
    { enabled: !leaderboard && filter === "achievements" }
  );

  const effectiveAchievements = leaderboard || achievementsData;

  const { data: countryBoard, isLoading } = api.achievements.getCountryLeaderboard.useQuery(
    {
      metric: filter as Exclude<FilterId, "achievements">,
      limit,
      searchQuery: searchQuery.trim() || undefined,
    },
    { enabled: filter !== "achievements" }
  );

  const active = FILTERS.find((f) => f.id === filter)!;
  const visibleFilters = FILTERS.filter(
    (f) => activeDomain === "all" || f.domain === activeDomain || f.id === "achievements"
  );

  const filteredAchievements = effectiveAchievements?.filter((entry) =>
    searchQuery ? entry.countryName.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  const topThree =
    filter === "achievements"
      ? filteredAchievements?.slice(0, 3).map((e) => ({
          countryId: e.countryId,
          countryName: e.countryName,
          primary: `${e.totalPoints} pts`,
          secondary: `${e.achievementCount} unlocked • ${e.rareAchievements} rare+`,
          flag: e.flag,
        }))
      : countryBoard?.slice(0, 3).map((e) => ({
          countryId: e.countryId,
          countryName: e.countryName,
          primary: fmt(active.fmt, e.value),
          secondary: `${e.economicTier} • ${e.populationTier}`,
          flag: e.flag,
        }));

  const mainContent = (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 border-t-white/20 bg-card/75 p-6 shadow-xl backdrop-blur-2xl transition-all dark:border-border/40 dark:border-t-white/10 dark:bg-card/60">
      <TextureOverlay texture="dots" opacity={0.03} />

      <div className="relative z-10 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              Global World Leaderboards
            </h3>
            <p className="text-xs font-medium text-muted-foreground">
              Rankings across {active.label.toLowerCase()} • {limit} nations displayed
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search nation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 rounded-full border-border/60 bg-background/60 pl-9 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:border-amber-500/50"
              />
            </div>

            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1 text-xs backdrop-blur-md">
              {[10, 25, 50, 100].map((l) => (
                <button
                  key={l}
                  onClick={() => setLimit(l)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 font-bold transition-all active:scale-95",
                    limit === l
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveDomain(cat.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold transition-all active:scale-95",
                activeDomain === cat.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {visibleFilters.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-all active:scale-95",
                  filter === f.id
                    ? "border-amber-500/30 bg-amber-500/15 text-amber-600 shadow-sm dark:text-amber-300"
                    : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            );
          })}
        </div>

        {!isLoading && topThree && topThree.length >= 3 && !searchQuery && (
          <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3">
            <PodiumCard
              rank={1}
              name={topThree[0].countryName}
              primary={topThree[0].primary}
              secondary={topThree[0].secondary}
              flag={topThree[0].flag}
            />
            <PodiumCard
              rank={2}
              name={topThree[1].countryName}
              primary={topThree[1].primary}
              secondary={topThree[1].secondary}
              flag={topThree[1].flag}
            />
            <PodiumCard
              rank={3}
              name={topThree[2].countryName}
              primary={topThree[2].primary}
              secondary={topThree[2].secondary}
              flag={topThree[2].flag}
            />
          </div>
        )}

        {filter === "achievements" ? (
          filteredAchievements && filteredAchievements.length > 0 ? (
            <div className="space-y-2.5">
              {filteredAchievements.map((entry, index) => (
                <Row
                  key={entry.countryId}
                  index={index}
                  name={entry.countryName}
                  flag={entry.flag}
                  primary={`${entry.totalPoints} pts`}
                  secondary={`${entry.achievementCount} achievements • ${entry.rareAchievements} rare+`}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No achievement data available for search query
            </div>
          )
        ) : isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500 dark:text-amber-400" />
          </div>
        ) : countryBoard && countryBoard.length > 0 ? (
          <div className="space-y-2.5">
            {countryBoard.map((entry, index) => (
              <Row
                key={entry.countryId}
                index={index}
                name={entry.countryName}
                flag={entry.flag}
                primary={fmt(active.fmt, entry.value)}
                secondary={`${entry.economicTier} • ${entry.populationTier}`}
              />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No nation metrics found matching your criteria
          </div>
        )}
      </div>
    </div>
  );

  return mainContent;
}
