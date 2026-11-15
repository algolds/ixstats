"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Dashboard as Gauge,
  Dollar as DollarSign,
  Group as Users,
  StatUp as TrendingUp,
  Trophy,
} from "iconoir-react";
import { formatPercent } from "~/lib/utils";
import { formatCompact } from "~/lib/format/compact";
import { api } from "~/trpc/react";
import { ActionPill } from "~/components/ui/action-pill";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { SearchField } from "~/components/ui/search-field";
import { Skeleton } from "~/components/ui/skeleton";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { assetUrl } from "~/lib/base-path";
import { isUnlistedRankingRealm } from "~/lib/realms/realm-scope-select";
import { LeaderboardRealmSelect } from "./LeaderboardRealmSelect";
import { LeaderboardRankPill, LeaderboardTab } from "./LeaderboardTab";

const METRIC_PILLS = [
  { id: "totalGdp", label: "Total GDP", icon: DollarSign, fmt: "currency" },
  { id: "gdpPerCapita", label: "GDP per capita", icon: DollarSign, fmt: "currency" },
  { id: "population", label: "Population", icon: Users, fmt: "number" },
  { id: "populationDensity", label: "Density", icon: Gauge, fmt: "density" },
  { id: "gdpGrowth", label: "Growth", icon: TrendingUp, fmt: "percent" },
  { id: "collectors", label: "Collectors", icon: Trophy, fmt: "points" },
] as const;

type MetricId = (typeof METRIC_PILLS)[number]["id"];
type NationMetricId = Exclude<MetricId, "collectors">;

function formatMetricFigure(fmtType: string, val?: number | null): string {
  if (val === undefined || val === null) return "–";
  if (fmtType === "currency") return `$${formatCompact(val)}`;
  if (fmtType === "percent") return formatPercent(val);
  if (fmtType === "density") return `${formatCompact(val)}/km²`;
  if (fmtType === "number") return formatCompact(val);
  return val.toLocaleString();
}

function FlagGraphic({ countryName, flag }: { countryName: string; flag?: string | null }) {
  if (flag && (flag.startsWith("/") || flag.startsWith("http"))) {
    return (
      <img
        src={assetUrl(flag) ?? undefined}
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

export function CountryLeaderboards() {
  const [metric, setMetric] = useState<MetricId>("totalGdp");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const realm = useSearchParams()?.get("realm") ?? undefined;
  const { data: realms } = api.realms.directory.useQuery(undefined, { staleTime: 5 * 60_000 });
  const unlisted = isUnlistedRankingRealm(realms, realm);

  const isCollectors = metric === "collectors";
  const nationMetric: NationMetricId = isCollectors ? "totalGdp" : metric;

  const { data: collectorRealmBoard } = api.achievements.getLeaderboard.useQuery(
    { limit: 50, realm },
    { enabled: isCollectors && !unlisted }
  );

  const { data: countryBoard, isLoading } = api.achievements.getCountryLeaderboard.useQuery(
    {
      metric: nationMetric,
      limit: 50,
      searchQuery: searchQuery.trim() || undefined,
      realm,
    },
    { enabled: !isCollectors && !unlisted }
  );

  const activeMetric = METRIC_PILLS.find((m) => m.id === metric) ?? METRIC_PILLS[0];
  const secondaryStatHeader = metric === "population" ? "Scale" : "Population";

  return (
    <section aria-labelledby="leaderboards-table-heading" className="space-y-4">
      <h2 id="leaderboards-table-heading" className="sr-only">
        Standings
      </h2>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="group"
          aria-label="Leaderboard metric"
          className="flex flex-wrap items-center gap-1.5"
        >
          {METRIC_PILLS.map((pill) => {
            const Icon = pill.icon;
            return (
              <ActionPill
                key={pill.id}
                size="md"
                pressed={metric === pill.id}
                icon={<Icon />}
                onClick={() => setMetric(pill.id)}
              >
                {pill.label}
              </ActionPill>
            );
          })}
        </div>

        {!isCollectors && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchField
              size="sm"
              placeholder="Search nations"
              aria-label="Search nations"
              value={searchQuery}
              onValueChange={setSearchQuery}
              containerClassName="w-full sm:w-56"
            />
            <LeaderboardRealmSelect realmParam={realm} />
          </div>
        )}
      </div>

      {isCollectors ? (
        <LeaderboardTab fallbackEntries={collectorRealmBoard} />
      ) : unlisted ? (
        <Card>
          <EmptyState
            compact
            title="This realm isn't ranked"
            message="Only listed realms have leaderboards. Pick one from the realm menu."
          />
        </Card>
      ) : isLoading ? (
        <Card content="data" padding="md" aria-busy className="space-y-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="rounded-control-sm h-10" />
          ))}
        </Card>
      ) : countryBoard && countryBoard.length > 0 ? (
        <Card content="data" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-separator text-caption text-label-secondary border-b">
                  <th scope="col" className="w-16 px-4 py-2.5 font-medium">
                    Rank
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Nation
                  </th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">
                    Tier
                  </th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">
                    {secondaryStatHeader}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    {activeMetric.label}
                  </th>
                </tr>
              </thead>
              <tbody>
                {countryBoard.map((entry, index) => (
                  <tr
                    key={entry.countryId}
                    className="border-separator duration-fast hover:bg-fill-4 border-b transition-colors last:border-b-0"
                  >
                    <td className="px-4 py-2.5 align-middle">
                      <LeaderboardRankPill rank={index + 1} />
                    </td>
                    <td className="px-4 py-2.5 align-middle">
                      <div className="flex items-center gap-2.5">
                        <FlagGraphic countryName={entry.countryName} flag={entry.flag} />
                        <span className="text-callout text-label truncate font-medium">
                          {entry.countryName}
                        </span>
                      </div>
                    </td>
                    <td className="text-footnote text-label-secondary hidden px-4 py-2.5 align-middle sm:table-cell">
                      {entry.economicTier || "–"}
                    </td>
                    <td className="text-footnote text-label-secondary hidden px-4 py-2.5 align-middle md:table-cell">
                      {entry.populationTier || "–"}
                    </td>
                    <td className="text-callout text-label px-4 py-2.5 text-right align-middle font-semibold tabular-nums">
                      {formatMetricFigure(activeMetric.fmt, entry.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState
            compact
            title="No nations match your search"
            message="Try another search term or pick a different realm."
          />
        </Card>
      )}
    </section>
  );
}
