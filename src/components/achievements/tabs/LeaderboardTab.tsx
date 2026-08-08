"use client";

import React, { useState } from "react";
import { TabsContent } from "~/components/ui/tabs";
import { TextureCard, TextureCardContent } from "~/components/ui/texture-card";
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
  Activity,
  ShieldCheck,
  Building2,
  ThumbsUp,
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
  { id: "gdpPerCapita", label: "GDP per Capita", icon: DollarSign, fmt: "currency", domain: "economy" },
  { id: "population", label: "Population", icon: Users, fmt: "number", domain: "demographics" },
  { id: "populationDensity", label: "Pop. Density", icon: Gauge, fmt: "number", domain: "demographics" },
  { id: "landArea", label: "Land Area", icon: Map, fmt: "number", domain: "demographics" },
  { id: "gdpGrowth", label: "GDP Growth", icon: TrendingUp, fmt: "percent", domain: "economy" },
  { id: "avgIncome", label: "Avg Income", icon: DollarSign, fmt: "currency", domain: "economy" },
  { id: "workforce", label: "Workforce", icon: Users, fmt: "number", domain: "demographics" },
  { id: "employmentRate", label: "Employment", icon: Briefcase, fmt: "percent", domain: "demographics" },
  { id: "literacyRate", label: "Literacy", icon: GraduationCap, fmt: "percent", domain: "governance" },
  { id: "lifeExpectancy", label: "Life Expectancy", icon: Heart, fmt: "years", domain: "governance" },
  { id: "govRevenue", label: "Gov. Revenue", icon: Landmark, fmt: "currency", domain: "economy" },
  { id: "govSpending", label: "Gov. Spending", icon: Landmark, fmt: "currency", domain: "economy" },
  { id: "economicVitality", label: "Economic Vitality", icon: Activity, fmt: "score", domain: "governance" },
  { id: "wellbeing", label: "Wellbeing", icon: Heart, fmt: "score", domain: "governance" },
  { id: "nationalHealth", label: "National Health", icon: ShieldCheck, fmt: "score", domain: "governance" },
  { id: "infrastructure", label: "Infrastructure", icon: Building2, fmt: "score", domain: "governance" },
  { id: "urbanization", label: "Urbanization", icon: Building2, fmt: "percent", domain: "demographics" },
  { id: "approval", label: "Public Approval", icon: ThumbsUp, fmt: "percent", domain: "governance" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];
type FmtKind = (typeof FILTERS)[number]["fmt"];

const abbr = (n: number) =>
  n >= 1e12
    ? `${(n / 1e12).toFixed(2)}T`
    : n >= 1e9
      ? `${(n / 1e9).toFixed(2)}B`
      : n >= 1e6
        ? `${(n / 1e6).toFixed(2)}M`
        : Math.round(n).toLocaleString();

const fmt = (kind: FmtKind, n: number) => {
  switch (kind) {
    case "currency":
      return n >= 1e6 ? `$${abbr(n)}` : `$${Math.round(n).toLocaleString()}`;
    case "percent":
      return `${n.toFixed(1)}%`;
    case "years":
      return `${n.toFixed(1)} yrs`;
    case "score":
      return n.toFixed(1);
    default:
      return abbr(n);
  }
};

function FlagGraphic({ countryName, flag }: { countryName: string; flag?: string | null }) {
  const [hasError, setHasError] = useState(false);

  if (flag && !hasError && (flag.startsWith("/") || flag.startsWith("http"))) {
    return (
      <img
        src={flag}
        alt={`Flag of ${countryName}`}
        className="h-4 w-6 shrink-0 rounded border border-border/40 object-cover shadow-sm"
        onError={() => setHasError(true)}
      />
    );
  }

  return <EnhancedCountryFlag countryName={countryName} size="sm" />;
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
      badgeBg: "bg-amber-500/20 text-amber-500 border-amber-500/30",
      cardBg: "from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/30",
      icon: Crown,
      iconColor: "text-amber-400",
      label: "Gold Champion",
    },
    2: {
      badgeBg: "bg-slate-400/20 text-slate-300 border-slate-400/30",
      cardBg: "from-slate-400/15 via-slate-400/5 to-transparent border-slate-400/30",
      icon: Medal,
      iconColor: "text-slate-300",
      label: "Silver Runner-Up",
    },
    3: {
      badgeBg: "bg-amber-700/20 text-amber-600 border-amber-700/30 dark:text-amber-500",
      cardBg: "from-amber-700/15 via-amber-700/5 to-transparent border-amber-700/30",
      icon: Award,
      iconColor: "text-amber-600 dark:text-amber-500",
      label: "Bronze Podium",
    },
  }[rank];

  const Icon = styles.icon;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-b p-5 backdrop-blur-md transition-all duration-300 hover:scale-[1.02]",
        styles.cardBg
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-black",
              styles.badgeBg
            )}
          >
            #{rank}
          </span>
          <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
            {styles.label}
          </span>
        </div>
        <Icon className={cn("h-5 w-5", styles.iconColor)} />
      </div>

      <div className="mt-4 space-y-1">
        <div className="flex items-center gap-2">
          <FlagGraphic countryName={name} flag={flag} />
          <div className="truncate text-base font-bold text-foreground">{name}</div>
        </div>
        <div className="text-2xl font-black text-foreground">{primary}</div>
        <div className="text-xs text-muted-foreground">{secondary}</div>
      </div>
    </div>
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
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border p-4 backdrop-blur-md transition-all duration-300 hover:border-amber-500/30",
        index < 3
          ? "border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent dark:from-amber-500/5 dark:to-transparent"
          : "border-border/50 bg-card/45 dark:border-white/5 dark:bg-black/20"
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "w-8 text-center text-2xl font-black",
            index === 0
              ? "text-amber-500"
              : index === 1
                ? "text-slate-400"
                : index === 2
                  ? "text-amber-700 dark:text-amber-600"
                  : "text-muted-foreground"
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
        <Star className="h-5 w-5 fill-amber-500/20 text-amber-500" />
        <span className="text-xl font-black text-foreground">{primary}</span>
      </div>
    </div>
  );
}

export function LeaderboardTab({ leaderboard, standalone = false }: LeaderboardTabProps) {
  const [filter, setFilter] = useState<FilterId>("achievements");
  const [activeDomain, setActiveDomain] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [limit, setLimit] = useState<number>(25);

  // Get achievements leaderboard if not passed via props
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

  // Filter achievements locally if search query is provided
  const filteredAchievements = effectiveAchievements?.filter((entry) =>
    searchQuery
      ? entry.countryName.toLowerCase().includes(searchQuery.toLowerCase())
      : true
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
    <TextureCard className="border-border/50 bg-black/5 dark:bg-black/25">
      <TextureCardContent className="p-6 space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-bold text-foreground">Global World Leaderboards</h3>
            <p className="text-xs text-muted-foreground">
              Rankings across {active.label.toLowerCase()} • {limit} nations displayed
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search nation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs bg-card/60 border-border/50 h-9"
              />
            </div>

            {/* Limit Selector */}
            <div className="flex items-center gap-1 bg-black/10 dark:bg-black/40 border border-border/50 rounded-lg p-1 text-xs">
              {[10, 25, 50, 100].map((l) => (
                <button
                  key={l}
                  onClick={() => setLimit(l)}
                  className={cn(
                    "px-2.5 py-1 rounded font-bold transition-all",
                    limit === l
                      ? "bg-amber-500/20 text-amber-500 dark:text-amber-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Domain Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveDomain(cat.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                activeDomain === cat.id
                  ? "bg-foreground text-background"
                  : "bg-card/40 text-muted-foreground hover:text-foreground border border-border/50"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {visibleFilters.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                  filter === f.id
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "border-border/50 text-muted-foreground hover:text-foreground bg-card/40"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            );
          })}
        </div>

        {/* 
          EDUCATIONAL NOTE (Kistan Tour - File 2):
          1. tRPC Query: api.achievements.getCountryLeaderboard.useQuery() fetches live 145-nation data.
          2. Array Destructuring & Mapping: topThree uses .slice(0, 3) and .map() to extract top nations.
          3. Podium Rendering: topThree[0] (Gold), topThree[1] (Silver), topThree[2] (Bronze) render into Podium Cards!
        */}
        {!isLoading && topThree && topThree.length >= 3 && !searchQuery && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
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

        {/* Leaderboard Table / List */}
        {filter === "achievements" ? (
          filteredAchievements && filteredAchievements.length > 0 ? (
            <div className="space-y-2">
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
            <div className="text-muted-foreground py-12 text-center text-sm">
              No achievement data available for search query
            </div>
          )
        ) : isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : countryBoard && countryBoard.length > 0 ? (
          <div className="space-y-2">
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
          <div className="text-muted-foreground py-12 text-center text-sm">
            No nation metrics found matching your criteria
          </div>
        )}
      </TextureCardContent>
    </TextureCard>
  );

  if (standalone) {
    return mainContent;
  }

  return <TabsContent value="leaderboard">{mainContent}</TabsContent>;
}
