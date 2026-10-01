"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { FacetCard } from "~/components/ui/facet-container";
import { HealthRing } from "~/components/ui/health-ring";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import {
  Building,
  Group as Users,
  StatUp as TrendingUp,
  Activity,
  Trophy,
  ChatBubble as MessageSquare,
  ArrowRight,
  Clock,
  Dollar as DollarSign,
  Shield,
} from "iconoir-react";
import { formatDistanceToNow } from "date-fns";
import { api } from "~/trpc/react";
import { cn, createUrl } from "~/lib/utils";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { useFactbookMetrics } from "~/components/mycountry/shared/headers/FactbookMetricsProvider";
import type { VitalityData } from "../_types";

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full rounded-none" /> }
);

/** Vitality score → status colour role (optimal ≥80, strong ≥65, moderate ≥45, strained). */
function vitalityColor(score: number | null): string {
  if (score === null) return "var(--color-fill)";
  if (score >= 80) return "var(--color-green)";
  if (score >= 65) return "var(--color-cyan)";
  if (score >= 45) return "var(--color-yellow)";
  return "var(--color-red)";
}

interface VitalityRing {
  key: keyof VitalityData;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Null = no data (shown as "—"). */
  value: number | null;
}

/** Activity type → system colour (icon) and dot. */
const ACTIVITY_TONE: Record<string, { icon: React.ReactNode; dot: string }> = {
  achievement: { icon: <Trophy aria-hidden className="text-yellow size-3.5" />, dot: "bg-yellow" },
  economic: { icon: <TrendingUp aria-hidden className="text-blue size-3.5" />, dot: "bg-blue" },
  diplomatic: { icon: <Users aria-hidden className="text-purple size-3.5" />, dot: "bg-purple" },
  social: { icon: <MessageSquare aria-hidden className="text-green size-3.5" />, dot: "bg-green" },
};
const DEFAULT_ACTIVITY_TONE = {
  icon: <Activity aria-hidden className="text-label-secondary size-3.5" />,
  dot: "bg-label-tertiary",
};

interface FactbookSidebarProps {
  vitalityData: VitalityData | null;
  countrySlug: string;
}

/**
 * FactbookSidebar — persistent right-column public briefing shown across all
 * factbook sections: vitality rings, geography map embed, and the recent-activity feed.
 */
export function FactbookSidebar({ vitalityData, countrySlug }: FactbookSidebarProps) {
  const { country } = useCountryData();
  const { openMetricModal } = useFactbookMetrics();
  const router = useRouter();

  const { hasGeometry, isLoading: mapLoading } = useCountryMapEmbed(country?.id ?? null);

  const { data: activityData, isLoading: activityLoading } =
    api.activities.getCountryActivity.useQuery(
      {
        countryId: country?.id ?? "",
        limit: 10,
        timeRange: "90d",
      },
      { enabled: !!country?.id }
    );

  const handleRingClick = (key: string) => {
    if (!country?.id) return;
    switch (key) {
      case "economicVitality":
        openMetricModal("gdp", country.id);
        break;
      case "populationWellbeing":
        openMetricModal("population", country.id);
        break;
      case "diplomaticStanding":
        openMetricModal("demographics-health", country.id);
        break;
      case "governmentalEfficiency":
        openMetricModal("government-spending", country.id);
        break;
    }
  };

  const vitalityRings: VitalityRing[] = React.useMemo(
    () => [
      {
        key: "economicVitality",
        label: "Economic health",
        subtitle: "GDP & growth",
        icon: DollarSign,
        value: vitalityData?.economicVitality ?? 0,
      },
      {
        key: "populationWellbeing",
        label: "Population wellbeing",
        subtitle: "Demographics",
        icon: Users,
        value: vitalityData?.populationWellbeing ?? 0,
      },
      {
        key: "diplomaticStanding",
        label: "Diplomatic standing",
        subtitle: "Relations, embassies, treaties",
        icon: Shield,
        value: vitalityData?.diplomaticStanding ?? null,
      },
      {
        key: "governmentalEfficiency",
        label: "Government efficiency",
        subtitle: "Administration",
        icon: Building,
        value: vitalityData?.governmentalEfficiency ?? 0,
      },
    ],
    [vitalityData]
  );

  if (!country) return null;

  const viewActivity = () => router.push(createUrl(`/countries/${countrySlug}/activity`));

  return (
    <div className="space-y-6">
      {/* National vitality */}
      <FacetCard padding="sm" aria-label="National vitality">
        <div className="grid grid-cols-2 gap-2">
          {vitalityRings.map((ring) => {
            const known = ring.value !== null;
            const shown = known ? `${Math.round(ring.value ?? 0)}%` : "—";
            return (
              <button
                key={ring.key}
                type="button"
                onClick={() => handleRingClick(ring.key)}
                aria-label={`${ring.label}: ${known ? shown : "no record yet"}`}
                className={cn(
                  "bg-surface-secondary rounded-row flex min-h-14 cursor-pointer items-center gap-3 p-2 text-left",
                  "hover:bg-fill-3 duration-fast ease-out-facet transition-colors",
                  "focus-visible:outline-tint outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                )}
              >
                <HealthRing
                  value={ring.value ?? 0}
                  size={36}
                  color={vitalityColor(ring.value)}
                  label={ring.label}
                  tooltip={
                    known
                      ? `${ring.label}: ${shown} – ${ring.subtitle}`
                      : `${ring.label}: no diplomatic record yet`
                  }
                  className="shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="text-caption text-label-secondary block truncate">
                    {ring.label}
                  </span>
                  <span className="text-headline text-label block tabular-nums">{shown}</span>
                </span>
              </button>
            );
          })}
        </div>
      </FacetCard>

      {/* Geography map */}
      {!mapLoading && hasGeometry && (
        <FacetCard className="overflow-hidden">
          <CountryMapEmbed
            countryId={country.id}
            height="h-56"
            showNeighbors={true}
            showCities={true}
            boundsPadding={50}
          />
          <div className="border-separator flex items-center justify-between border-t px-4 py-2">
            <span className="text-footnote text-label-secondary tabular-nums">
              {country.currentPopulation
                ? `${Math.round(country.currentPopulation).toLocaleString()} citizens`
                : ""}
            </span>
            <a
              href={createUrl(`/maps?country=${country.id}`)}
              className="text-footnote text-tint font-medium hover:underline"
            >
              Open full map →
            </a>
          </div>
        </FacetCard>
      )}

      {/* Recent activity */}
      <FacetCard>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-headline text-label flex items-center gap-2">
            <Activity aria-hidden className="text-label-secondary size-4" />
            Recent activity
          </h3>
          {activityData && activityData.activities.length > 0 && (
            <Button variant="plain" size="sm" onClick={viewActivity}>
              View all
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
        <div className="px-4 pb-4">
          {activityLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading activity">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="mt-2 size-2 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activityData && activityData.activities.length > 0 ? (
            <ul className="divide-separator divide-y">
              {activityData.activities.slice(0, 5).map((activity) => {
                const tone = ACTIVITY_TONE[activity.type] ?? DEFAULT_ACTIVITY_TONE;
                return (
                  <li
                    key={activity.id}
                    className="flex items-start gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <span
                      aria-hidden
                      className={cn("mt-2 size-2 shrink-0 rounded-full", tone.dot)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        {tone.icon}
                        <p className="text-headline text-label truncate">{activity.title}</p>
                      </div>
                      {activity.source === "thinkpages" && (
                        <Badge variant="outline" className="mt-1">
                          ThinkPages
                        </Badge>
                      )}
                      <div className="text-footnote text-label-secondary mt-1 flex items-center gap-2 tabular-nums">
                        <span className="flex items-center gap-1">
                          <Clock aria-hidden className="size-3" />
                          {formatDistanceToNow(new Date(activity.timestamp), {
                            addSuffix: true,
                          })}
                        </span>
                        {activity.engagement && (
                          <>
                            {activity.engagement.likes > 0 && (
                              <span className="flex items-center gap-0.5">
                                <MessageSquare aria-hidden className="size-3" />
                                {activity.engagement.likes}
                              </span>
                            )}
                            {activity.engagement.comments > 0 && (
                              <span className="flex items-center gap-0.5">
                                <MessageSquare aria-hidden className="size-3" />
                                {activity.engagement.comments}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              compact
              icon={<Activity />}
              title="No recent public activity"
              action={
                <Button variant="plain" size="sm" onClick={viewActivity}>
                  View activity tab
                  <ArrowRight aria-hidden />
                </Button>
              }
            />
          )}
        </div>
      </FacetCard>
    </div>
  );
}
