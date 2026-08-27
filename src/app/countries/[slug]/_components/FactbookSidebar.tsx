"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { FacetCard } from "~/components/ui/facet-container";
import { HealthRing } from "~/components/ui/health-ring";
import type { RingConfig } from "~/components/mycountry/shared/primitives/VitalityRings";
import {
  Building,
  Group as Users,
  Globe,
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
import { getFlagColors, generateFlagThemeCSS } from "~/lib/flags/flag-color-extractor";
import { createUrl } from "~/lib/utils";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { useFactbookMetrics } from "~/components/mycountry/shared/headers/FactbookMetricsProvider";
import { getAppleVitalityColor } from "~/components/mycountry/shared/primitives/tabs/VitalityRingsDisplay";
import type { VitalityData } from "../_types";

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  { ssr: false, loading: () => <div className="bg-muted h-56 animate-pulse rounded-b-xl" /> }
);

interface FactbookSidebarProps {
  vitalityData: VitalityData | null;
  countrySlug: string;
}

/**
 * FactbookSidebar — persistent right-column public briefing shown across all
 * factbook sections: telemetry vitality rings, geography map embed, and the
 * recent-activity feed.
 *
 * Implements Apple Design physical hover/active micro-interactions and depth blur.
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

  const flagColors = React.useMemo(() => getFlagColors(country?.name || ""), [country?.name]);
  const flagThemeCSS = React.useMemo(() => generateFlagThemeCSS(flagColors), [flagColors]);

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

  const vitalityRings: RingConfig[] = React.useMemo(
    () => [
      {
        key: "economicVitality",
        label: "Economic Health",
        subtitle: "GDP & Growth",
        color: getAppleVitalityColor(vitalityData?.economicVitality ?? 0),
        icon: DollarSign,
        value: vitalityData?.economicVitality ?? 0,
      },
      {
        key: "populationWellbeing",
        label: "Population Wellbeing",
        subtitle: "Demographics",
        color: getAppleVitalityColor(vitalityData?.populationWellbeing ?? 0),
        icon: Users,
        value: vitalityData?.populationWellbeing ?? 0,
      },
      {
        key: "diplomaticStanding",
        label: "Diplomatic Standing",
        subtitle: "International",
        color: getAppleVitalityColor(vitalityData?.diplomaticStanding ?? 0),
        icon: Shield,
        value: vitalityData?.diplomaticStanding ?? 0,
      },
      {
        key: "governmentalEfficiency",
        label: "Government Efficiency",
        subtitle: "Administration",
        color: getAppleVitalityColor(vitalityData?.governmentalEfficiency ?? 0),
        icon: Building,
        value: vitalityData?.governmentalEfficiency ?? 0,
      },
    ],
    [vitalityData]
  );

  if (!country) return null;

  return (
    <div className="space-y-6" style={flagThemeCSS}>
      {/* National Vitality Telemetry Card */}
      <FacetCard
        depth={1}
        interactive="none"
        className="group bg-card/30 relative overflow-hidden rounded-2xl border border-white/10 p-4 shadow-sm saturate-180 backdrop-blur-xl"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-[var(--flag-glow-primary)] opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-35" />
          <Activity
            className="absolute -right-3 -bottom-3 h-20 w-20 text-[var(--flag-primary)] opacity-[0.05]"
            strokeWidth={1}
          />
        </div>

        {/* Vitality Rings 2x2 Grid */}
        <div className="relative grid grid-cols-2 gap-3">
          {vitalityRings.map((ring) => (
            <div
              key={ring.key}
              onClick={() => handleRingClick(ring.key)}
              className="flex h-14 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 backdrop-blur-md transition-all duration-150 ease-out hover:scale-[1.02] hover:border-white/20 hover:bg-white/[0.08] active:scale-[0.98]"
            >
              <HealthRing
                value={ring.value}
                size={36}
                color={ring.color}
                label={ring.label}
                tooltip={`${ring.label}: ${Math.round(ring.value)}% - ${ring.subtitle}`}
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-muted-foreground/80 truncate text-[9px] font-extrabold tracking-wider uppercase">
                  {ring.label}
                </div>
                <div className="text-xs leading-tight font-extrabold" style={{ color: ring.color }}>
                  {Math.round(ring.value)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </FacetCard>

      {/* Geography Map */}
      {!mapLoading && hasGeometry && (
        <FacetCard
          depth={1}
          interactive="none"
          className="bg-card/30 overflow-hidden rounded-2xl border border-white/10 shadow-sm saturate-180 backdrop-blur-xl"
        >
          <CardContent className="p-0">
            <CountryMapEmbed
              countryId={country.id}
              height="h-56"
              showNeighbors={true}
              showCities={true}
              boundsPadding={50}
            />
          </CardContent>
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5">
            <span className="text-muted-foreground text-[11px] font-medium">
              {country.currentPopulation
                ? `${Math.round(country.currentPopulation).toLocaleString()} citizens`
                : ""}
            </span>
            <a
              href={createUrl(`/maps?country=${country.id}`)}
              className="text-[11px] font-semibold text-blue-500 transition-colors hover:text-blue-400"
            >
              Open full map →
            </a>
          </div>
        </FacetCard>
      )}

      {/* Recent Activity Feed */}
      <FacetCard
        depth={1}
        interactive="none"
        className="bg-card/30 overflow-hidden rounded-2xl border border-white/10 shadow-sm saturate-180 backdrop-blur-xl"
      >
        <CardHeader className="px-4 py-3 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground/90 flex items-center gap-2 text-xs font-extrabold tracking-wider uppercase">
              <Activity className="h-3.5 w-3.5 text-[var(--flag-primary)]" />
              Recent Activity
            </CardTitle>
            {activityData && activityData.activities.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(createUrl(`/countries/${countrySlug}/activity`))}
                className="h-7 px-2 text-xs font-semibold transition-transform duration-100 active:scale-95"
              >
                View All
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex animate-pulse items-start gap-3">
                  <div className="bg-muted mt-2 h-2 w-2 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="bg-muted h-4 w-3/4 rounded"></div>
                    <div className="bg-muted h-3 w-1/2 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : activityData && activityData.activities.length > 0 ? (
            <div className="space-y-3">
              {activityData.activities.slice(0, 5).map((activity, idx) => {
                const getActivityIcon = () => {
                  switch (activity.type) {
                    case "achievement":
                      return <Trophy className="h-3.5 w-3.5 text-yellow-500" />;
                    case "economic":
                      return <TrendingUp className="h-3.5 w-3.5 text-blue-500" />;
                    case "diplomatic":
                      return <Users className="h-3.5 w-3.5 text-purple-500" />;
                    case "social":
                      return <MessageSquare className="h-3.5 w-3.5 text-green-500" />;
                    default:
                      return <Activity className="text-muted-foreground h-3.5 w-3.5" />;
                  }
                };

                const getActivityColor = () => {
                  switch (activity.type) {
                    case "achievement":
                      return "bg-yellow-400";
                    case "economic":
                      return "bg-blue-400";
                    case "diplomatic":
                      return "bg-purple-400";
                    case "social":
                      return "bg-green-400";
                    default:
                      return "bg-muted-foreground";
                  }
                };

                return (
                  <div
                    key={activity.id}
                    className={`flex items-start gap-2.5 rounded-lg p-1.5 transition-colors duration-150 hover:bg-white/[0.02] ${
                      idx < activityData.activities.length - 1
                        ? "border-border/40 border-b pb-3"
                        : ""
                    }`}
                  >
                    <div
                      className={`h-2 w-2 rounded-full ${getActivityColor()} mt-1.5 shrink-0`}
                    ></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {getActivityIcon()}
                        <p className="truncate text-xs font-semibold">{activity.title}</p>
                      </div>
                      {activity.source === "thinkpages" && (
                        <Badge variant="outline" className="mt-1 h-4 text-[10px] font-bold">
                          ThinkPages
                        </Badge>
                      )}
                      <div className="text-muted-foreground mt-1 flex items-center gap-2 text-[10px]">
                        <div className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDistanceToNow(new Date(activity.timestamp), {
                            addSuffix: true,
                          })}
                        </div>
                        {activity.engagement && (
                          <>
                            {activity.engagement.likes > 0 && (
                              <span className="flex items-center gap-0.5">
                                <MessageSquare className="h-2.5 w-2.5" />
                                {activity.engagement.likes}
                              </span>
                            )}
                            {activity.engagement.comments > 0 && (
                              <span className="flex items-center gap-0.5">
                                <MessageSquare className="h-2.5 w-2.5" />
                                {activity.engagement.comments}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Activity className="text-muted-foreground/40 mb-2 h-6 w-6" />
              <p className="text-muted-foreground text-xs font-medium">No recent public activity</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(createUrl(`/countries/${countrySlug}/activity`))}
                className="mt-2 h-7 px-2 text-xs font-semibold transition-transform duration-100 active:scale-95"
              >
                View Activity Tab
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </FacetCard>
    </div>
  );
}
