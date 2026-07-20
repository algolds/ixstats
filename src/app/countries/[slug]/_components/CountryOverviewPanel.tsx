"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { VitalityRings } from "~/components/mycountry/primitives/VitalityRings";
import { GdpDetailsModal } from "~/components/modals/GdpDetailsModal";
import { GdpPerCapitaDetailsModal } from "~/components/modals/GdpPerCapitaDetailsModal";
import { PopulationDetailsModal } from "~/components/modals/PopulationDetailsModal";
import {
  BookOpen,
  // eslint-disable-next-line unused-imports/no-unused-imports
  ExternalLink,
  Building,
  Crown,
  Users,
  MapPin,
  Heart,
  Globe,
  TrendingUp,
  Activity,
  Trophy,
  MessageSquare,
  ArrowRight,
  Clock,
  DollarSign,
} from "lucide-react";
import type { CountryInfobox } from "~/lib/mediawiki-service";
import { sanitizeWikiContent } from "~/lib/sanitize-html";
import { WikiHtmlContent, WikiLinkPreview } from "~/components/wiki/WikiLinkPreview";
import {
  formatCompactCurrency,
  formatPercentWithNormalization as formatPercent,
} from "~/lib/format-utils";
import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";
import { createUrl } from "~/lib/url-utils";
import Link from "next/link";
import { CountryDataProvider } from "~/components/mycountry/primitives";
import { MyCountryTabSystem } from "~/components/mycountry/MyCountryTabSystem";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  { ssr: false, loading: () => <div className="bg-muted h-56 animate-pulse rounded-b-xl" /> }
);

interface CountryOverviewPanelProps {
  country: {
    id: string;
    name: string;
    currentPopulation: number;
    currentTotalGdp: number;
    currentGdpPerCapita: number;
    adjustedGdpGrowth?: number | null;
    lastCalculated?: Date | number;
    governmentType?: string | null;
    leader?: string | null;
    religion?: string | null;
    nationalIdentity?: {
      officialName?: string | null;
      governmentType?: string | null;
      capitalCity?: string | null;
      currency?: string | null;
      currencySymbol?: string | null;
      motto?: string | null;
    } | null;
  };
  wikiIntro: string[];
  wikiInfobox: CountryInfobox | null;
  vitalityData: {
    economicVitality: number;
    populationWellbeing: number;
    diplomaticStanding: number;
    governmentalEfficiency: number;
  };
  governmentStructure?: {
    governmentName?: string | null;
    governmentType?: string | null;
    headOfState?: string | null;
    headOfGovernment?: string | null;
    legislatureName?: string | null;
    executiveName?: string | null;
    judicialName?: string | null;
    totalBudget?: number;
    budgetCurrency?: string;
  } | null;
  onTabChange: (tab: string) => void;
}

export function CountryOverviewPanel({
  country,
  wikiIntro,
  wikiInfobox,
  vitalityData,
  governmentStructure,
  onTabChange,
}: CountryOverviewPanelProps) {
  const { hasGeometry, isLoading: mapLoading } = useCountryMapEmbed(country.id);

  const { data: activityData, isLoading: activityLoading } =
    api.activities.getCountryActivity.useQuery({
      countryId: country.id,
      limit: 10,
      timeRange: "90d",
    });

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            <CountryDataProvider userId="" countryId={country.id} isPublicReadOnly={true}>
              <MyCountryTabSystem variant="unified" />
            </CountryDataProvider>
          </div>

          {/* Sidebar - Geography + Vitality Rings + Recent Activity */}
          <div className="space-y-6">
            {/* Geography Map */}
            {!mapLoading && hasGeometry && (
              <Card className="bg-card/50 overflow-hidden backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Globe className="h-4 w-4" />
                    Geography
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <CountryMapEmbed
                    countryId={country.id}
                    height="h-56"
                    showNeighbors={true}
                    showCities={true}
                    boundsPadding={50}
                  />
                </CardContent>
                <div className="border-border/50 flex items-center justify-between border-t px-4 py-2">
                  <span className="text-muted-foreground text-xs">
                    {country.currentPopulation
                      ? `${Math.round(country.currentPopulation).toLocaleString()} citizens`
                      : ""}
                  </span>
                  <a
                    href={createUrl(`/maps?country=${country.id}`)}
                    className="text-xs text-blue-500 hover:text-blue-600"
                  >
                    Open full map
                  </a>
                </div>
              </Card>
            )}

            <VitalityRings data={vitalityData} variant="sidebar" />

            {/* Recent Activity Feed (moved to sidebar) */}
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" />
                    Recent Activity
                  </CardTitle>
                  {activityData && activityData.activities.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onTabChange("activity")}
                      className="h-7 px-2 text-xs"
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
                          className={`flex items-start gap-2.5 ${
                            idx < activityData.activities.length - 1
                              ? "border-border/50 border-b pb-3"
                              : ""
                          }`}
                        >
                          <div
                            className={`h-2 w-2 rounded-full ${getActivityColor()} mt-1.5 shrink-0`}
                          ></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-1.5">
                              {getActivityIcon()}
                              <p className="truncate text-xs font-medium">{activity.title}</p>
                            </div>
                            {activity.source === "thinkpages" && (
                              <Badge variant="outline" className="mt-1 h-4 text-[10px]">
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
                                      <Heart className="h-2.5 w-2.5" />
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
                    <p className="text-muted-foreground text-xs">No recent public activity</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onTabChange("activity")}
                      className="mt-2 h-7 px-2 text-xs"
                    >
                      View Activity Tab
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
