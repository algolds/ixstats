"use client";

import React from "react";
import { motion } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";

// UI Components
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

// Icons - Simplified icon usage
import {
  Crown, Globe, Target, Brain, TrendingUp,
  Users, DollarSign, BarChart3, Settings
} from "lucide-react";

// Utils
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";

const DashboardStreamlined = React.memo(function DashboardStreamlined() {
  const { user } = useUser();

  // Consolidated data fetching
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );
  const { data: countryData } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );
  const { data: globalStatsData } = api.countries.getGlobalStats.useQuery();
  const { data: activeCrises } = api.sdi.getActiveCrises.useQuery();

  return (
    <div className="min-h-screen bg-background">
      {/* Simplified Header - Replaces Activity Stream */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-8xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">IxStats Dashboard</h1>
              {countryData && (
                <Badge variant="outline" className="text-sm">
                  {countryData.name} • {countryData.calculatedStats?.economicTier}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-8xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Primary Column - MyCountry */}
          <div className="lg:col-span-5 space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Crown className="h-5 w-5 text-blue-500" />
                My Country
              </h2>

              {countryData ? (
                <Card className="glass-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{countryData.name}</span>
                      <Badge variant="secondary">{countryData.calculatedStats?.economicTier}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Essential Metrics Only */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatPopulation(countryData.calculatedStats?.currentPopulation || 0)}
                        </div>
                        <div className="text-sm text-muted-foreground">Population</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(countryData.calculatedStats?.currentGdpPerCapita || 0)}
                        </div>
                        <div className="text-sm text-muted-foreground">GDP per Capita</div>
                      </div>
                    </div>

                    {/* Single Action Button */}
                    <Button className="w-full" asChild>
                      <a href="/mycountry/new">Manage Country</a>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="glass-hierarchy-child">
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No country selected</p>
                    <Button className="mt-4">Create Country</Button>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>

          {/* Intelligence Column */}
          <div className="lg:col-span-4 space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                Intelligence
              </h2>

              {/* Consolidated Intelligence Card */}
              <Card className="glass-hierarchy-child">
                <CardHeader>
                  <CardTitle className="text-lg">Intelligence Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* ECI Summary */}
                  <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
                    <div>
                      <div className="font-medium">Economic Intelligence</div>
                      <div className="text-sm text-muted-foreground">Market analysis available</div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* SDI Summary */}
                  <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <div>
                      <div className="font-medium">Strategic Intelligence</div>
                      <div className="text-sm text-muted-foreground">
                        {activeCrises?.length || 0} active situations
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Target className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>

          {/* Context Column */}
          <div className="lg:col-span-3 space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5 text-green-500" />
                Global
              </h2>

              {/* Simplified Global Stats */}
              <Card className="glass-hierarchy-child">
                <CardHeader>
                  <CardTitle className="text-lg">World Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {globalStatsData && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Countries</span>
                        <span className="font-medium">{(globalStatsData as any).totalCountries}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Global GDP</span>
                        <span className="font-medium">
                          {formatCurrency((globalStatsData as any).totalGdp)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Growth Rate</span>
                        <span className="font-medium text-green-600 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {((globalStatsData as any).globalGrowthRate * 100).toFixed(1)}%
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Simplified Operations */}
              <Card className="glass-hierarchy-child">
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="ghost" className="w-full justify-start" size="sm">
                    <Users className="h-4 w-4 mr-2" />
                    Diplomatic Hub
                  </Button>
                  <Button variant="ghost" className="w-full justify-start" size="sm">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Economic Tools
                  </Button>
                  <Button variant="ghost" className="w-full justify-start" size="sm">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Analytics
                  </Button>
                </CardContent>
              </Card>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
});

export default DashboardStreamlined;