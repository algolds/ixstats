"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Trophy, TrendingUp, Users, Globe, Crown, Medal, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { cn } from "~/lib/utils";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";
import { VaultSidebarLayout } from "~/components/vault/VaultSidebarLayout";
import { GradientHeading } from "~/components/ui/gradient-heading";
import {
  CutoutCard,
  CutoutCardContent,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { TextureCard, TextureCardContent } from "~/components/ui/texture-card";

export default function LeaderboardsPage() {
  useEffect(() => {
    document.title = "Leaderboards - IxStats";
  }, []);

  const { user } = useUser();
  const [selectedMetric, setSelectedMetric] = useState<string>("gdp");

  // Get user profile
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  // Get all countries for leaderboards
  const { data: allCountries, isLoading: countriesLoading } = api.countries.getAll.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 }
  );

  // Get achievements leaderboard
  const { data: achievementsLeaderboard, isLoading: achievementsLoading } =
    api.achievements.getLeaderboard.useQuery({ limit: 20 });

  // Get diplomatic influence leaderboard
  const { data: diplomaticLeaderboard, isLoading: diplomaticLoading } =
    api.diplomaticCore.getInfluenceLeaderboard.useQuery();

  const metrics = [
    { id: "gdp", name: "Total GDP", icon: TrendingUp, format: formatCurrency },
    { id: "gdpPerCapita", name: "GDP Per Capita", icon: TrendingUp, format: formatCurrency },
    { id: "population", name: "Population", icon: Users, format: formatPopulation },
    { id: "achievements", name: "Achievements", icon: Trophy },
    { id: "diplomatic", name: "Diplomatic Influence", icon: Globe },
  ];

  // Safely extract the list of countries (handling { countries, total } structure)
  const countriesList = useMemo(() => {
    if (!allCountries) return [];
    if (
      allCountries &&
      typeof allCountries === "object" &&
      "countries" in allCountries &&
      Array.isArray(allCountries.countries)
    ) {
      return allCountries.countries;
    }
    if (Array.isArray(allCountries)) {
      return allCountries;
    }
    return [];
  }, [allCountries]);

  const leaderboardData = useMemo(() => {
    if (countriesList.length === 0) return [];

    switch (selectedMetric) {
      case "gdp":
        return [...countriesList]
          .sort((a, b) => (b.currentTotalGdp || 0) - (a.currentTotalGdp || 0))
          .map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            flagUrl: c.flagUrl || "",
            value: c.currentTotalGdp,
            formatted: formatCurrency(c.currentTotalGdp || 0),
          }));
      case "gdpPerCapita":
        return [...countriesList]
          .sort((a, b) => (b.currentGdpPerCapita || 0) - (a.currentGdpPerCapita || 0))
          .map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            flagUrl: c.flagUrl || "",
            value: c.currentGdpPerCapita,
            formatted: formatCurrency(c.currentGdpPerCapita || 0),
          }));
      case "population":
        return [...countriesList]
          .sort((a, b) => (b.currentPopulation || 0) - (a.currentPopulation || 0))
          .map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            flagUrl: c.flagUrl || "",
            value: c.currentPopulation,
            formatted: formatPopulation(c.currentPopulation || 0),
          }));
      case "achievements":
        return (
          achievementsLeaderboard?.map(
            (a: {
              countryId: string;
              countryName: string;
              totalPoints: number;
              achievementCount: number;
            }) => {
              const matchingCountry = countriesList.find((c) => c.id === a.countryId);
              return {
                id: a.countryId,
                name: a.countryName,
                slug: matchingCountry?.slug || "",
                flagUrl: matchingCountry?.flagUrl || "",
                value: a.totalPoints,
                formatted: `${a.totalPoints} pts`,
                extra: `${a.achievementCount} achievements`,
              };
            }
          ) || []
        );
      case "diplomatic":
        return (
          diplomaticLeaderboard?.map((d) => {
            const matchingCountry = countriesList.find((c) => c.id === d.countryId);
            return {
              id: d.countryId,
              name: d.countryName,
              slug: matchingCountry?.slug || "",
              flagUrl: matchingCountry?.flagUrl || "",
              value: d.totalInfluence,
              formatted: `${d.totalInfluence} influence`,
              extra: `${d.activeEmbassies} embassies`,
            };
          }) || []
        );
      default:
        return [];
    }
  }, [selectedMetric, countriesList, achievementsLeaderboard, diplomaticLeaderboard]);

  const getUserRankForMetric = (metricId: string) => {
    if (!userProfile?.countryId || countriesList.length === 0) return 0;

    switch (metricId) {
      case "gdp": {
        const sorted = [...countriesList].sort(
          (a, b) => (b.currentTotalGdp || 0) - (a.currentTotalGdp || 0)
        );
        return sorted.findIndex((c) => c.id === userProfile.countryId) + 1;
      }
      case "gdpPerCapita": {
        const sorted = [...countriesList].sort(
          (a, b) => (b.currentGdpPerCapita || 0) - (a.currentGdpPerCapita || 0)
        );
        return sorted.findIndex((c) => c.id === userProfile.countryId) + 1;
      }
      case "population": {
        const sorted = [...countriesList].sort(
          (a, b) => (b.currentPopulation || 0) - (a.currentPopulation || 0)
        );
        return sorted.findIndex((c) => c.id === userProfile.countryId) + 1;
      }
      case "achievements": {
        if (!achievementsLeaderboard) return 0;
        return (
          achievementsLeaderboard.findIndex((a: any) => a.countryId === userProfile.countryId) + 1
        );
      }
      case "diplomatic": {
        if (!diplomaticLeaderboard) return 0;
        return (
          diplomaticLeaderboard.findIndex((d: any) => d.countryId === userProfile.countryId) + 1
        );
      }
      default:
        return 0;
    }
  };

  const isLoading =
    selectedMetric === "gdp" || selectedMetric === "gdpPerCapita" || selectedMetric === "population"
      ? countriesLoading
      : selectedMetric === "achievements"
        ? achievementsLoading
        : diplomaticLoading;

  return (
    <VaultSidebarLayout activeSection="achievements">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <GradientHeading
              variant="default"
              size="sm"
              weight="black"
              className="flex items-center gap-3"
            >
              <Medal className="h-8 w-8 shrink-0 text-amber-500" />
              Global Leaderboards
            </GradientHeading>
            <p className="text-muted-foreground mt-1 text-sm">
              Compare nations across economic, diplomatic, and cultural metrics.
            </p>
          </div>
          <Link href="/achievements">
            <Button
              variant="outline"
              size="sm"
              className="border-border/50 hover:bg-muted text-muted-foreground hover:text-foreground h-9"
            >
              <Trophy className="mr-2 h-4 w-4 text-[--intel-gold]" />
              View Achievements
            </Button>
          </Link>
        </div>

        {/* 2-Column Grid Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column (Leaderboard Table) */}
          <div className="space-y-6 lg:col-span-2">
            {/* Metric Selector Buttons */}
            <div className="flex flex-wrap gap-2">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                const isSelected = selectedMetric === metric.id;
                return (
                  <Button
                    key={metric.id}
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => setSelectedMetric(metric.id)}
                    className={cn(
                      "h-9 text-xs transition-all duration-200",
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold shadow-md"
                        : "border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {metric.name}
                  </Button>
                );
              })}
            </div>

            {/* Leaderboard list container */}
            <TextureCard className="border-border/50 bg-black/5 dark:bg-black/25">
              <TextureCardContent className="p-6">
                <div className="mb-4">
                  <h3 className="text-foreground flex items-center gap-2 text-lg font-bold">
                    {metrics.find((m) => m.id === selectedMetric)?.icon &&
                      React.createElement(metrics.find((m) => m.id === selectedMetric)!.icon, {
                        className: "h-5 w-5 text-amber-500",
                      })}
                    {metrics.find((m) => m.id === selectedMetric)?.name} Leaderboard
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    Top 20 nations ranked by{" "}
                    {metrics.find((m) => m.id === selectedMetric)?.name.toLowerCase()}
                  </p>
                </div>

                {isLoading ? (
                  <div className="py-12 text-center">
                    <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-amber-500" />
                    <p className="text-muted-foreground text-sm">Loading leaderboard data...</p>
                  </div>
                ) : leaderboardData.length > 0 ? (
                  <div className="space-y-2">
                    {leaderboardData.slice(0, 20).map(
                      (
                        entry: {
                          [x: string]: any;
                          id: string;
                          name: string;
                          formatted: string;
                          extra?: string;
                          slug?: string;
                        },
                        index: number
                      ) => {
                        const isUserCountry = entry.id === userProfile?.countryId;

                        return (
                          <Link key={entry.id} href={createUrl(`/countries/${entry.slug || ""}`)}>
                            <div
                              className={cn(
                                "group/row relative flex items-center justify-between overflow-hidden rounded-xl border p-3.5 backdrop-blur-md transition-all duration-300",
                                index < 3
                                  ? "border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent dark:from-amber-500/5 dark:to-transparent"
                                  : isUserCountry
                                    ? "border-blue-500/20 bg-blue-500/10 dark:bg-blue-500/5"
                                    : "border-border/50 bg-card/45 hover:border-border hover:bg-card/75 dark:border-white/5 dark:bg-black/20"
                              )}
                            >
                              {/* Subtle background flag image */}
                              {entry.flagUrl && (
                                <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-0 w-1/2 overflow-hidden select-none">
                                  <div className="from-card via-card/70 absolute inset-0 z-10 bg-gradient-to-l to-transparent dark:from-black/40 dark:via-black/20 dark:to-transparent" />
                                  <img
                                    src={entry.flagUrl}
                                    alt=""
                                    className="h-full w-full scale-110 transform object-cover object-right opacity-[0.08] blur-[1px] transition-transform duration-500 group-hover/row:scale-120 dark:opacity-[0.04]"
                                  />
                                </div>
                              )}

                              <div className="relative z-10 flex flex-1 items-center gap-3">
                                {/* Rank */}
                                <div
                                  className={cn(
                                    "w-10 shrink-0 text-center text-2xl font-black",
                                    index === 0
                                      ? "text-amber-500"
                                      : index === 1
                                        ? "text-slate-400"
                                        : index === 2
                                          ? "text-amber-700 dark:text-amber-600"
                                          : "text-muted-foreground"
                                  )}
                                >
                                  {index === 0 ? (
                                    <Crown className="text-amber-550 mx-auto h-7 w-7 animate-pulse" />
                                  ) : (
                                    index + 1
                                  )}
                                </div>

                                {/* Country Name */}
                                <div className="min-w-0 flex-1">
                                  <div className="text-foreground flex items-center gap-2 font-bold">
                                    {entry.flagUrl && (
                                      <img
                                        src={entry.flagUrl}
                                        alt=""
                                        className="border-border/30 h-3.5 w-5 shrink-0 rounded border object-cover shadow-sm"
                                      />
                                    )}
                                    <span className="truncate">{entry.name}</span>
                                    {isUserCountry && (
                                      <Badge
                                        variant="default"
                                        className="px-1.5 py-0 text-[9px] leading-none"
                                      >
                                        You
                                      </Badge>
                                    )}
                                  </div>
                                  {entry.extra && (
                                    <div className="text-muted-foreground mt-0.5 text-xs">
                                      {entry.extra}
                                    </div>
                                  )}
                                </div>

                                {/* Value */}
                                <div className="ml-4 shrink-0 text-right">
                                  <div className="text-foreground text-lg font-black">
                                    {entry.formatted}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground py-12 text-center text-sm">
                    <Trophy className="mx-auto mb-4 h-12 w-12 opacity-30" />
                    <p>No leaderboard data available</p>
                  </div>
                )}
              </TextureCardContent>
            </TextureCard>
          </div>

          {/* Right Column (Sidebar Widgets) */}
          <div className="space-y-6">
            {/* User Position Card */}
            {userProfile && (
              <CutoutCard
                className={cn(
                  cutoutCardSurfaceClassName,
                  "border-border/50 bg-card/65 relative overflow-hidden rounded-2xl shadow-lg backdrop-blur-md"
                )}
                texture="chevron"
                textureOpacity={0.04}
                trackPointerHover={false}
              >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20 dark:bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] dark:opacity-25" />
                <CutoutCardContent className="relative z-10 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-foreground text-sm font-bold tracking-wider uppercase">
                        Your Standings
                      </h2>
                      <p className="text-muted-foreground text-xs">{userProfile.country?.name}</p>
                    </div>
                    <Badge className="border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[9px] font-bold tracking-wider text-blue-600 uppercase dark:text-blue-400">
                      Rankings
                    </Badge>
                  </div>

                  <div className="border-border/50 space-y-4 border-t pt-4 dark:border-white/5">
                    {metrics.map((metric) => {
                      const rank = getUserRankForMetric(metric.id);
                      const Icon = metric.icon;

                      return (
                        <div key={metric.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="rounded-lg bg-blue-500/10 p-1.5 text-blue-600 dark:text-blue-400">
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="text-muted-foreground text-xs font-semibold">
                              {metric.name}
                            </span>
                          </div>
                          <div className="text-blue-650 text-sm font-black dark:text-blue-400">
                            {rank > 0 ? `#${rank}` : "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CutoutCardContent>
              </CutoutCard>
            )}

            {/* Additional Info */}
            <TextureCard className="border-border/50 bg-black/5 dark:bg-black/25">
              <TextureCardContent className="p-6">
                <h3 className="text-foreground mb-3 text-sm font-bold tracking-wider uppercase">
                  About Leaderboards
                </h3>
                <div className="text-muted-foreground space-y-4 text-xs leading-relaxed">
                  <p>
                    <strong>Economic Metrics:</strong> Total GDP and GDP per capita reflect your
                    nation's economic power and citizen prosperity.
                  </p>
                  <p>
                    <strong>Achievements:</strong> Points earned through gameplay milestones and
                    accomplishments.
                  </p>
                  <p>
                    <strong>Diplomatic Influence:</strong> Based on embassy network strength,
                    relationship quality, and cultural exchange programs.
                  </p>
                  <p className="border-border/45 mt-3 border-t pt-2.5 text-[10px] italic dark:border-white/5">
                    Rankings update in real-time based on your nation's performance and activities.
                  </p>
                </div>
              </TextureCardContent>
            </TextureCard>
          </div>
        </div>
      </div>
    </VaultSidebarLayout>
  );
}
