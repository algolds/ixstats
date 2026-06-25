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
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

interface AchievementEntry {
  countryId: string;
  countryName: string;
  achievementCount: number;
  rareAchievements: number;
  totalPoints: number;
}

interface LeaderboardTabProps {
  // Achievement leaderboard, still fetched by the parent page.
  leaderboard: Array<AchievementEntry> | undefined;
}

// Country-metric filters share one generic endpoint; achievements stays separate
// because it aggregates per-user data rather than a single country column.
// `fmt`: currency/number → abbreviated, percent → "x.x%", years/score → "x.x".
const FILTERS = [
  { id: "achievements", label: "Achievements", icon: Trophy, fmt: "achievements" },
  { id: "totalGdp", label: "Total GDP", icon: DollarSign, fmt: "currency" },
  { id: "gdpPerCapita", label: "GDP per Capita", icon: DollarSign, fmt: "currency" },
  { id: "population", label: "Population", icon: Users, fmt: "number" },
  { id: "populationDensity", label: "Pop. Density", icon: Gauge, fmt: "number" },
  { id: "landArea", label: "Land Area", icon: Map, fmt: "number" },
  { id: "gdpGrowth", label: "GDP Growth", icon: TrendingUp, fmt: "percent" },
  { id: "avgIncome", label: "Avg Income", icon: DollarSign, fmt: "currency" },
  { id: "workforce", label: "Workforce", icon: Users, fmt: "number" },
  { id: "employmentRate", label: "Employment", icon: Briefcase, fmt: "percent" },
  { id: "literacyRate", label: "Literacy", icon: GraduationCap, fmt: "percent" },
  { id: "lifeExpectancy", label: "Life Expectancy", icon: Heart, fmt: "years" },
  { id: "govRevenue", label: "Gov. Revenue", icon: Landmark, fmt: "currency" },
  { id: "govSpending", label: "Gov. Spending", icon: Landmark, fmt: "currency" },
  { id: "economicVitality", label: "Economic Vitality", icon: Activity, fmt: "score" },
  { id: "wellbeing", label: "Wellbeing", icon: Heart, fmt: "score" },
  { id: "nationalHealth", label: "National Health", icon: ShieldCheck, fmt: "score" },
  { id: "infrastructure", label: "Infrastructure", icon: Building2, fmt: "score" },
  { id: "urbanization", label: "Urbanization", icon: Building2, fmt: "percent" },
  { id: "approval", label: "Public Approval", icon: ThumbsUp, fmt: "percent" },
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
      return `$${abbr(n)}`;
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

function Row({
  index,
  name,
  primary,
  secondary,
}: {
  index: number;
  name: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border p-4 backdrop-blur-md transition-all duration-300",
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
          <div className="text-foreground font-bold">{name}</div>
          <div className="text-muted-foreground text-xs">{secondary}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Star className="text-amber-550 h-5 w-5 fill-amber-500/20" />
        <span className="text-foreground text-xl font-black">{primary}</span>
      </div>
    </div>
  );
}

export function LeaderboardTab({ leaderboard }: LeaderboardTabProps) {
  const [filter, setFilter] = useState<FilterId>("achievements");

  const { data: countryBoard, isLoading } = api.achievements.getCountryLeaderboard.useQuery(
    { metric: filter as Exclude<FilterId, "achievements">, limit: 20 },
    { enabled: filter !== "achievements" }
  );

  const active = FILTERS.find((f) => f.id === filter)!;

  return (
    <TabsContent value="leaderboard">
      <TextureCard className="border-border/50 bg-black/5 dark:bg-black/25">
        <TextureCardContent className="p-6">
          <div className="mb-4">
            <h3 className="text-foreground text-lg font-bold">Global Leaderboard</h3>
            <p className="text-muted-foreground text-xs">
              Top nations ranked by {active.label.toLowerCase()}
            </p>
          </div>

          {/* Filter chips */}
          <div className="mb-5 flex flex-wrap gap-2">
            {FILTERS.map((f) => {
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

          {filter === "achievements" ? (
            leaderboard && leaderboard.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.map((entry, index) => (
                  <Row
                    key={entry.countryId}
                    index={index}
                    name={entry.countryName}
                    primary={`${entry.totalPoints} pts`}
                    secondary={`${entry.achievementCount} achievements • ${entry.rareAchievements} rare+`}
                  />
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-12 text-center text-sm">
                No achievement data available yet
              </div>
            )
          ) : isLoading ? (
            <div className="text-muted-foreground py-12 text-center text-sm">Loading…</div>
          ) : countryBoard && countryBoard.length > 0 ? (
            <div className="space-y-2">
              {countryBoard.map((entry, index) => (
                <Row
                  key={entry.countryId}
                  index={index}
                  name={entry.countryName}
                  primary={fmt(active.fmt, entry.value)}
                  secondary={`${entry.economicTier} • ${entry.populationTier}`}
                />
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground py-12 text-center text-sm">No data available</div>
          )}
        </TextureCardContent>
      </TextureCard>
    </TabsContent>
  );
}
