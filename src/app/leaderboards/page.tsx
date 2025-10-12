"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Trophy,
  TrendingUp,
  Users,
  Globe,
  Building2,
  Heart,
  Crown,
  Medal,
  Star
} from "lucide-react";
import { api } from "~/trpc/react";
import { useUser } from "@clerk/nextjs";
import { cn } from "~/lib/utils";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";



export default function LeaderboardsPage() {
  useEffect(() => {
    document.title = "Leaderboards - IxStats";
  }, []);

  const { user } = useUser();
  const [selectedMetric, setSelectedMetric] = useState<string>("gdp");

  // Get user profile
  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  // Get all countries for leaderboards
  const { data: allCountries, isLoading: countriesLoading } = api.countries.getAll.useQuery();

  // Get achievements leaderboard
  const { data: achievementsLeaderboard, isLoading: achievementsLoading } = api.achievements.getLeaderboard.useQuery({ limit: 20 });

  // Get diplomatic influence leaderboard
  const { data: diplomaticLeaderboard, isLoading: diplomaticLoading } = api.diplomatic.getInfluenceLeaderboard.useQuery();

  const metrics = [
    { id: "gdp", name: "Total GDP", icon: TrendingUp, format: formatCurrency },
    { id: "gdpPerCapita", name: "GDP Per Capita", icon: TrendingUp, format: formatCurrency },
    { id: "population", name: "Population", icon: Users, format: formatPopulation },
    { id: "achievements", name: "Achievements", icon: Trophy },
    { id: "diplomatic", name: "Diplomatic Influence", icon: Globe }
  ];

  const getLeaderboardData = () => {
    if (!allCountries || !Array.isArray(allCountries)) return [];

    switch (selectedMetric) {
      case "gdp":
        return [...allCountries]
          .sort((a, b) => (b.currentTotalGdp || 0) - (a.currentTotalGdp || 0))
          .map(c => ({
            id: c.id,
            name: c.name,
            value: c.currentTotalGdp,
            formatted: formatCurrency(c.currentTotalGdp || 0)
          }));
      case "gdpPerCapita":
        return [...allCountries]
          .sort((a, b) => (b.currentGdpPerCapita || 0) - (a.currentGdpPerCapita || 0))
          .map(c => ({
            id: c.id,
            name: c.name,
            value: c.currentGdpPerCapita,
            formatted: formatCurrency(c.currentGdpPerCapita || 0)
          }));
      case "population":
        return [...allCountries]
          .sort((a, b) => (b.currentPopulation || 0) - (a.currentPopulation || 0))
          .map(c => ({
            id: c.id,
            name: c.name,
            value: c.currentPopulation,
            formatted: formatPopulation(c.currentPopulation || 0)
          }));
      case "achievements":
        return achievementsLeaderboard?.map((a: { countryId: string; countryName: string; totalPoints: number; achievementCount: number }) => ({
          id: a.countryId,
          name: a.countryName,
          value: a.totalPoints,
          formatted: `${a.totalPoints} pts`,
          extra: `${a.achievementCount} achievements`
        })) || [];
      case "diplomatic":
        return diplomaticLeaderboard?.map(d => ({
          id: d.countryId,
          name: d.countryName,
          value: d.totalInfluence,
          formatted: `${d.totalInfluence} influence`,
          extra: `${d.activeEmbassies} embassies`
        })) || [];
      default:
        return [];
    }
  };

  const leaderboardData = getLeaderboardData();
  const userRank = leaderboardData.findIndex((item: { id: string }) => item.id === userProfile?.countryId) + 1;

  const isLoading = selectedMetric === "gdp" || selectedMetric === "gdpPerCapita" || selectedMetric === "population"
    ? countriesLoading
    : selectedMetric === "achievements"
      ? achievementsLoading
      : diplomaticLoading;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Medal className="h-8 w-8 text-amber-500" />
            Global Leaderboards
          </h1>
          <p className="text-muted-foreground mt-1">
            Compare nations across economic, diplomatic, and cultural metrics
          </p>
        </div>
        <Link href={createUrl("/achievements")}>
          <Button variant="outline">
            <Trophy className="h-4 w-4 mr-2" />
            View Achievements
          </Button>
        </Link>
      </div>

      {/* User Position Card */}
      {userProfile && userRank > 0 && (
        <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <CardHeader>
            <CardTitle>Your Position</CardTitle>
            <CardDescription>{userProfile.country?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {metrics.map(metric => {
                const metricData = getLeaderboardData();
                const rank = metricData.findIndex((item: { id: string }) => item.id === userProfile.countryId) + 1;
                const Icon = metric.icon;

                return (
                  <div key={metric.id} className="space-y-1 text-center">
                    <Icon className="h-5 w-5 mx-auto text-muted-foreground" />
                    <div className="text-2xl font-bold text-blue-600">#{rank || "—"}</div>
                    <div className="text-xs text-muted-foreground">{metric.name}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metric Selector */}
      <div className="flex gap-2 flex-wrap">
        {metrics.map(metric => {
          const Icon = metric.icon;
          return (
            <Button
              key={metric.id}
              variant={selectedMetric === metric.id ? "default" : "outline"}
              onClick={() => setSelectedMetric(metric.id)}
            >
              <Icon className="h-4 w-4 mr-2" />
              {metric.name}
            </Button>
          );
        })}
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {metrics.find(m => m.id === selectedMetric)?.icon &&
              React.createElement(metrics.find(m => m.id === selectedMetric)!.icon, { className: "h-5 w-5" })}
            {metrics.find(m => m.id === selectedMetric)?.name} Leaderboard
          </CardTitle>
          <CardDescription>
            Top 20 nations ranked by {metrics.find(m => m.id === selectedMetric)?.name.toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading leaderboard data...</p>
            </div>
          ) : leaderboardData.length > 0 ? (
            <div className="space-y-2">
              {leaderboardData.slice(0, 20).map((entry: { id: string; name: string; formatted: string; extra?: string }, index: number) => {
                const isUserCountry = entry.id === userProfile?.countryId;

                return (
                  <Link
                    key={entry.id}
                    href={createUrl(`/countries/${entry.id}`)}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-md",
                        index < 3
                          ? "bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/20"
                          : isUserCountry
                            ? "bg-blue-500/10 border-blue-500/20"
                            : "bg-muted/30 hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {/* Rank */}
                        <div className={cn(
                          "text-2xl font-bold w-10 text-center",
                          index === 0 ? "text-amber-500" :
                          index === 1 ? "text-gray-400" :
                          index === 2 ? "text-amber-700" :
                          "text-muted-foreground"
                        )}>
                          {index === 0 && <Crown className="h-8 w-8 mx-auto" />}
                          {index > 0 && (index + 1)}
                        </div>

                        {/* Country Name */}
                        <div className="flex-1">
                          <div className="font-semibold flex items-center gap-2">
                            {entry.name}
                            {isUserCountry && <Badge variant="default">You</Badge>}
                          </div>
                          {entry.extra && (
                            <div className="text-xs text-muted-foreground">{entry.extra}</div>
                          )}
                        </div>

                        {/* Value */}
                        <div className="text-right">
                          <div className="text-xl font-bold">{entry.formatted}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>No leaderboard data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle>About Leaderboards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Economic Metrics:</strong> Total GDP and GDP per capita reflect your nation's economic
            power and citizen prosperity.
          </p>
          <p>
            <strong>Achievements:</strong> Points earned through gameplay milestones and accomplishments.
          </p>
          <p>
            <strong>Diplomatic Influence:</strong> Based on embassy network strength, relationship quality,
            and cultural exchange programs.
          </p>
          <p className="text-xs italic">
            Rankings update in real-time based on your nation's performance and activities.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
