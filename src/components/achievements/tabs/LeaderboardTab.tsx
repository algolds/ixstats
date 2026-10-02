"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Trophy,
  Dollar as DollarSign,
  Group as Users,
  Dashboard as Gauge,
  Map,
  StatUp as TrendingUp,
  Suitcase as Briefcase,
  GraduationCap,
  Heart,
  Bank as Landmark,
  Crown,
  Medal,
  Trophy as Award,
} from "iconoir-react";
import { cn, formatPercent, formatYears } from "~/lib/utils";
import { formatCompact } from "~/lib/format/compact";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { Card } from "~/components/ui/card";

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
  if (type === "currency") return `$${formatCompact(val)}`;
  if (type === "percent") return formatPercent(val);
  if (type === "years") return formatYears(val);
  if (type === "number") return formatCompact(val);
  return String(val);
}

function FlagGraphic({ countryName, flag }: { countryName: string; flag?: string | null }) {
  if (flag && (flag.startsWith("/") || flag.startsWith("http"))) {
    return (
      <img
        src={flag}
        alt={`Flag of ${countryName}`}
        className="border-separator h-5 w-7 shrink-0 rounded-xs border object-cover"
      />
    );
  }
  return (
    <UnifiedCountryFlag
      countryName={countryName}
      size="sm"
      className="h-5 w-7 rounded-xs object-cover"
    />
  );
}

const PODIUM = {
  1: { icon: Crown, label: "Gold champion", badge: "warning" },
  2: { icon: Medal, label: "Silver runner-up", badge: "default" },
  3: { icon: Award, label: "Bronze podium", badge: "warning" },
} as const;

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
  const podium = PODIUM[rank];
  const Icon = podium.icon;

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={podium.badge} className="tabular-nums">
            #{rank}
          </Badge>
          <span className="text-label-secondary text-footnote">{podium.label}</span>
        </div>
        <Icon aria-hidden className="text-label-secondary size-5" />
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <FlagGraphic countryName={name} flag={flag} />
          <div className="text-label text-title-3 truncate">{name}</div>
        </div>
        <div className="text-label text-title-1 tabular-nums">{primary}</div>
        <div className="text-label-secondary text-footnote">{secondary}</div>
      </div>
    </Card>
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
    <FacetRow
      leading={
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "text-headline w-7 text-center tabular-nums",
              index < 3 ? "text-label" : "text-label-secondary"
            )}
          >
            {index + 1}
          </span>
          <FlagGraphic countryName={name} flag={flag} />
        </span>
      }
      title={name}
      subtitle={secondary}
      trailing={<span className="text-headline text-label tabular-nums">{primary}</span>}
    />
  );
}

// oxlint-disable-next-line eslint/no-unused-vars
export function LeaderboardTab({ leaderboard, standalone = false }: LeaderboardTabProps) {
  const [filter, setFilter] = useState<FilterId>("achievements");
  const [activeDomain, setActiveDomain] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [limit, setLimit] = useState<number>(25);
  // ?realm=<slug> ranks that realm; without it the server uses the viewer's active nation's realm.
  const realm = useSearchParams().get("realm") ?? undefined;

  const { data: achievementsData } = api.achievements.getLeaderboard.useQuery(
    { limit, realm },
    { enabled: !leaderboard && filter === "achievements" }
  );

  const effectiveAchievements = leaderboard || achievementsData;

  const { data: countryBoard, isLoading } = api.achievements.getCountryLeaderboard.useQuery(
    {
      metric: filter as Exclude<FilterId, "achievements">,
      limit,
      searchQuery: searchQuery.trim() || undefined,
      realm,
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
    <Card padding="lg" className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-label text-title-2">Global world leaderboards</h2>
          <p className="text-label-secondary text-footnote">
            Rankings across {active.label.toLowerCase()} • {limit} nations displayed
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchField
            size="sm"
            placeholder="Search nation..."
            aria-label="Search nation"
            value={searchQuery}
            onValueChange={setSearchQuery}
            containerClassName="w-full sm:w-64"
          />

          <SegmentedControl
            aria-label="Nations displayed"
            size="sm"
            value={String(limit)}
            onValueChange={(value) => setLimit(Number(value))}
            options={[10, 25, 50, 100].map((l) => ({ value: String(l), label: String(l) }))}
          />
        </div>
      </div>

      <div className="border-separator space-y-3 border-b pb-4">
        <SegmentedControl
          aria-label="Category"
          size="sm"
          value={activeDomain}
          onValueChange={setActiveDomain}
          options={CATEGORIES.map((cat) => ({ value: cat.id, label: cat.label }))}
          className="max-w-full overflow-x-auto"
        />

        <ToggleGroup
          type="single"
          aria-label="Metric"
          size="sm"
          variant="pill"
          value={filter}
          onValueChange={(value) => {
            if (value) setFilter(value as FilterId);
          }}
          className="flex-wrap"
        >
          {visibleFilters.map((f) => {
            const Icon = f.icon;
            return (
              <ToggleGroupItem key={f.id} value={f.id} className="gap-2">
                <Icon aria-hidden className="size-3.5" />
                {f.label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      {!isLoading && topThree && topThree.length >= 3 && !searchQuery && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
          <FacetList>
            <FacetListSection
              aria-label="Achievement rankings"
              groupClassName="bg-surface-secondary"
            >
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
            </FacetListSection>
          </FacetList>
        ) : (
          <EmptyState compact title="No achievement data available for search query" />
        )
      ) : isLoading ? (
        <div aria-busy className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="rounded-row h-14" />
          ))}
        </div>
      ) : countryBoard && countryBoard.length > 0 ? (
        <FacetList>
          <FacetListSection
            aria-label={`${active.label} rankings`}
            groupClassName="bg-surface-secondary"
          >
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
          </FacetListSection>
        </FacetList>
      ) : (
        <EmptyState compact title="No nation metrics found matching your criteria" />
      )}
    </Card>
  );

  return mainContent;
}
