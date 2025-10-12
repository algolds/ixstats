"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import Link from "next/link";

// Components
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { PlatformActivityFeed } from "~/app/_components/PlatformActivityFeed";
import { MyCountryCard } from "./MyCountryCard";

// Dashboard Components
import { ECICard } from "./ECICard";
import { SDICard } from "./SDICard";
import { StrategicOperationsSuite } from "./StrategicOperationsSuite";

// UI Components
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// Icons
import {
  Activity,
  Users,
  TrendingUp,
  Crown,
  Zap,
  Star,
  Target,
  Home,
  BarChart3,
  Trophy,
  ArrowUp,
  ArrowDown,
  Minus,
  Globe,
  Bell,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

// Utils
import { cn } from "~/lib/utils";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";

// Context-aware main content component
interface DashboardContentProps {
  userProfile?: any;
  userCountry?: any;
  activityRingsData?: any;
  user?: any;
  globalStats?: any;
  allCountries?: any[];
  notifications?: any[];
  economicMilestones?: any[];
  forecast?: any;
}

function DashboardContent({
  userProfile,
  userCountry,
  activityRingsData,
  user,
  globalStats,
  allCountries = [],
  notifications = [],
  economicMilestones = [],
  forecast
}: DashboardContentProps) {
  const [contentMode, setContentMode] = useState<'mycountry' | 'activity'>(userCountry ? 'mycountry' : 'activity');
  const [myCountryTab, setMyCountryTab] = useState<'overview' | 'systems' | 'global'>('overview');
  const [expandedOverview, setExpandedOverview] = useState(false);

  const contentModes = [
    ...(userCountry ? [{ id: 'mycountry' as const, label: 'My Country', icon: Home, description: 'Your nation\'s command center' }] : []),
    { id: 'activity' as const, label: 'Activity', icon: Activity, description: 'Social feed & updates' },
  ];

  return (
    <Card className="glass-hierarchy-parent">
      <CardHeader>
        <div className="flex items-center justify-between">
          {/* Content Mode Selector */}
          <div className="flex items-center gap-2">
            {contentModes.map((mode) => {
              const Icon = mode.icon;
              const isActive = contentMode === mode.id;

              return (
                <Button
                  key={mode.id}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setContentMode(mode.id as 'mycountry' | 'activity')}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {mode.label}
                </Button>
              );
            })}
          </div>

          {/* Mode Description */}
          <div className="text-sm text-muted-foreground">
            {contentModes.find(m => m.id === contentMode)?.description}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <AnimatePresence mode="wait">
          {/* My Country Mode */}
          {contentMode === 'mycountry' && userCountry && (
            <motion.div
              key="mycountry"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Command Center Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  MyCountry Command Center
                </h2>
                <Badge variant="secondary" className="px-3 py-1 text-sm">
                  {userCountry.name} • {userCountry.calculatedStats?.economicTier}
                </Badge>
              </div>

              {/* Reimagined Tab Navigation */}
              <Tabs value={myCountryTab} onValueChange={(value) => setMyCountryTab(value as 'overview' | 'systems' | 'global')} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-muted/50 dark:bg-muted/20">
                  <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Home className="h-4 w-4" />
                    <span className="hidden sm:inline">Nation Overview</span>
                    <span className="sm:hidden">Overview</span>
                  </TabsTrigger>
                  <TabsTrigger value="systems" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Zap className="h-4 w-4" />
                    <span className="hidden sm:inline">Core Systems</span>
                    <span className="sm:hidden">Systems</span>
                  </TabsTrigger>
                  <TabsTrigger value="global" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Globe className="h-4 w-4" />
                    <span className="hidden sm:inline">Global Stage</span>
                    <span className="sm:hidden">Global</span>
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-8 mt-6">
                  <MyCountryCard
                    countryData={userCountry ? {
                      id: userCountry.id,
                      name: userCountry.name,
                      currentPopulation: userCountry.calculatedStats?.currentPopulation || 0,
                      currentGdpPerCapita: userCountry.calculatedStats?.currentGdpPerCapita || 0,
                      currentTotalGdp: userCountry.calculatedStats?.currentTotalGdp || 0,
                      economicTier: userCountry.calculatedStats?.economicTier || 'Unknown',
                      populationTier: userCountry.calculatedStats?.populationTier || 'Medium',
                      adjustedGdpGrowth: userCountry.calculatedStats?.adjustedGdpGrowth || 0,
                      populationGrowthRate: userCountry.calculatedStats?.populationGrowthRate || 0,
                      populationDensity: userCountry.calculatedStats?.populationDensity,
                      continent: userCountry.continent,
                      region: userCountry.region,
                      governmentType: userCountry.governmentType,
                      religion: userCountry.religion,
                      leader: userCountry.leader
                    } : undefined}
                    activityRingsData={activityRingsData}
                    expandedCards={new Set()}
                    setExpandedCards={() => {}}
                    setActivityPopoverOpen={() => {}}
                    isRippleActive={false}
                    isGlobalCardSlid={false}
                  />

                  {/* Critical Stats Grid */}
                  {userCountry && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Global Rankings */}
                      <Card className="glass-hierarchy-child">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                              <Trophy className="h-4 w-4 text-amber-500" />
                              Global Rankings
                            </h4>
                          </div>
                          <div className="space-y-3">
                            {(() => {
                              const sortedByGdp = [...allCountries].sort((a, b) => (b.currentTotalGdp || 0) - (a.currentTotalGdp || 0));
                              const gdpRank = sortedByGdp.findIndex(c => c.id === userCountry.id) + 1;
                              const sortedByGdpPerCapita = [...allCountries].sort((a, b) => (b.currentGdpPerCapita || 0) - (a.currentGdpPerCapita || 0));
                              const gdpPerCapitaRank = sortedByGdpPerCapita.findIndex(c => c.id === userCountry.id) + 1;
                              const sortedByPop = [...allCountries].sort((a, b) => (b.currentPopulation || 0) - (a.currentPopulation || 0));
                              const popRank = sortedByPop.findIndex(c => c.id === userCountry.id) + 1;

                              return (
                                <>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">GDP Rank</span>
                                    <Badge variant={gdpRank <= 3 ? "default" : "secondary"} className="font-bold">
                                      #{gdpRank} / {allCountries.length}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">GDP/Capita Rank</span>
                                    <Badge variant={gdpPerCapitaRank <= 3 ? "default" : "secondary"} className="font-bold">
                                      #{gdpPerCapitaRank} / {allCountries.length}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Population Rank</span>
                                    <Badge variant={popRank <= 3 ? "default" : "secondary"} className="font-bold">
                                      #{popRank} / {allCountries.length}
                                    </Badge>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Economic Trends */}
                      <Card className="glass-hierarchy-child">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-blue-500" />
                              Economic Trends
                            </h4>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">GDP Growth</span>
                              <div className="flex items-center gap-2">
                                {(userCountry.calculatedStats?.adjustedGdpGrowth || 0) > 0 ? (
                                  <ArrowUp className="h-4 w-4 text-green-500" />
                                ) : (userCountry.calculatedStats?.adjustedGdpGrowth || 0) < 0 ? (
                                  <ArrowDown className="h-4 w-4 text-red-500" />
                                ) : (
                                  <Minus className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className={cn(
                                  "font-semibold",
                                  (userCountry.calculatedStats?.adjustedGdpGrowth || 0) > 0 ? "text-green-500" :
                                  (userCountry.calculatedStats?.adjustedGdpGrowth || 0) < 0 ? "text-red-500" :
                                  "text-muted-foreground"
                                )}>
                                  {((userCountry.calculatedStats?.adjustedGdpGrowth || 0) * 100).toFixed(3)}%
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Pop. Growth</span>
                              <div className="flex items-center gap-2">
                                {(userCountry.calculatedStats?.populationGrowthRate || 0) > 0 ? (
                                  <ArrowUp className="h-4 w-4 text-green-500" />
                                ) : (userCountry.calculatedStats?.populationGrowthRate || 0) < 0 ? (
                                  <ArrowDown className="h-4 w-4 text-red-500" />
                                ) : (
                                  <Minus className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className={cn(
                                  "font-semibold",
                                  (userCountry.calculatedStats?.populationGrowthRate || 0) > 0 ? "text-green-500" :
                                  (userCountry.calculatedStats?.populationGrowthRate || 0) < 0 ? "text-red-500" :
                                  "text-muted-foreground"
                                )}>
                                  {((userCountry.calculatedStats?.populationGrowthRate || 0) * 100).toFixed(3)}%
                                </span>
                              </div>
                            </div>
                            {forecast && forecast.forecast && forecast.forecast.length > 0 && (
                              <div className="flex items-center justify-between pt-2 border-t border-border">
                                <span className="text-sm text-muted-foreground">Forecast GDP</span>
                                <span className="font-semibold text-blue-500">
                                  {formatCurrency(forecast.forecast[forecast.forecast.length - 1]?.totalGdp || 0)}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Recent Activity & Alerts */}
                      <Card className="glass-hierarchy-child">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                              <Bell className="h-4 w-4 text-purple-500" />
                              Recent Activity
                            </h4>
                          </div>
                          <div className="space-y-3">
                            {notifications.length > 0 ? (
                              notifications.slice(0, 3).map((notif, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  {notif.type === 'warning' ? (
                                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                                  ) : notif.type === 'success' ? (
                                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                                  ) : (
                                    <Bell className="h-4 w-4 text-blue-500 mt-0.5" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {notif.message || notif.title}
                                    </p>
                                  </div>
                                </div>
                              ))
                            ) : economicMilestones.length > 0 ? (
                              economicMilestones.slice(0, 3).map((milestone, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <Star className="h-4 w-4 text-yellow-500 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {milestone.description}
                                    </p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-2">
                                <p className="text-xs text-muted-foreground">No recent activity</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* MyCountry Sections */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
                        <Crown className="h-4 w-4 text-white" />
                      </div>
                      MyCountry Sections
                    </h3>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <Link href="/mycountry#executive">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Crown className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Executive</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">Command</Badge>
                        </div>
                      </Link>

                      <Link href="/mycountry#intelligence">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Activity className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Intelligence</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">ECI/SDI</Badge>
                        </div>
                      </Link>

                      <Link href="/mycountry#overview">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-gray-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <BarChart3 className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Overview</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">At Glance</Badge>
                        </div>
                      </Link>

                      <Link href="/mycountry#economy">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <TrendingUp className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Economy</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">Tier-Based</Badge>
                        </div>
                      </Link>

                      <Link href="/mycountry#labor">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Users className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Labor</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">Employment</Badge>
                        </div>
                      </Link>

                      <Link href="/mycountry#government">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Star className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Government</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">Structure</Badge>
                        </div>
                      </Link>

                      <Link href="/mycountry#demographics">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Users className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Demographics</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">Population</Badge>
                        </div>
                      </Link>

                      <Link href="/mycountry#analytics">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Target className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Analytics</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">Forecasts</Badge>
                        </div>
                      </Link>
                    </div>
                  </div>

                  {/* Management & Systems */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Zap className="h-4 w-4 text-white" />
                      </div>
                      Management & Systems
                    </h3>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <Link href="/builder">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Star className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Builder</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">Atomic Gov</Badge>
                        </div>
                      </Link>

                      <Link href="/mycountry/editor">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Activity className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Editor</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">Data Entry</Badge>
                        </div>
                      </Link>

                      <Link href="/mycountry/defense">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Target className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Defense</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">Military</Badge>
                        </div>
                      </Link>

                      <Link href="/sdi/diplomatic">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Users className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Diplomacy</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">Embassies</Badge>
                        </div>
                      </Link>
                    </div>
                  </div>

                  {/* Global Engagement */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                        <Globe className="h-4 w-4 text-white" />
                      </div>
                      Global Engagement
                    </h3>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <Link href="/thinkpages">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Users className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">ThinkPages</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">Social</Badge>
                        </div>
                      </Link>

                      <Link href="/countries">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <BarChart3 className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Countries</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">Rankings</Badge>
                        </div>
                      </Link>

                      <Link href="/leaderboards">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Trophy className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Leaderboards</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">Compete</Badge>
                        </div>
                      </Link>

                      <Link href="/achievements">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-28 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Star className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">Achievements</span>
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">Unlocks</Badge>
                        </div>
                      </Link>
                    </div>
                  </div>
                </TabsContent>

                {/* Intelligence Tab */}
                <TabsContent value="intelligence" className="space-y-8 mt-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                          <Star className="h-4 w-4 text-white" />
                        </div>
                        Intelligence Suite
                      </h3>
                      <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-3 py-1">
                        Premium
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <ECICard
                        countryData={userCountry ? {
                          id: userCountry.id,
                          name: userCountry.name,
                          currentPopulation: userCountry.calculatedStats?.currentPopulation || 0,
                          currentGdpPerCapita: userCountry.calculatedStats?.currentGdpPerCapita || 0,
                          currentTotalGdp: userCountry.calculatedStats?.currentTotalGdp || 0,
                          economicTier: userCountry.calculatedStats?.economicTier || 'Unknown',
                          populationTier: userCountry.calculatedStats?.populationTier || 'Medium',
                          populationDensity: userCountry.calculatedStats?.populationDensity,
                          landArea: userCountry.landArea
                        } : undefined}
                        userProfile={userProfile}
                        userId={user?.id}
                        isEciExpanded={false}
                        toggleEciExpansion={() => {}}
                        focusedCard={null}
                        setFocusedCard={() => {}}
                      />

                      <SDICard
                        userProfile={userProfile}
                        isSdiExpanded={false}
                        toggleSdiExpansion={() => {}}
                        focusedCard={null}
                        setFocusedCard={() => {}}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Operations Tab */}
                <TabsContent value="operations" className="space-y-8 mt-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                          <Target className="h-4 w-4 text-white" />
                        </div>
                        Strategic Operations
                      </h3>
                      <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs px-3 py-1">
                        Advanced
                      </Badge>
                    </div>

                    <StrategicOperationsSuite userProfile={userProfile} />
                  </div>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}

          {/* Activity Mode */}
          {contentMode === 'activity' && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <PlatformActivityFeed
                userProfile={userProfile ? {
                  id: userProfile.id,
                  countryId: userProfile.countryId,
                  followingCountries: [],
                  friends: [],
                  achievements: 0,
                  influence: 0
                } : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

export function DashboardCommandCenter() {
  const { user } = useUser();

  // Set page title (notification badge will auto-update)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = "Dashboard - IxStats";
    }
  }, []);

  // Fetch necessary data
  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  // Get user's country data
  const { data: userCountry } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );
  const { data: activityRingsData } = api.countries.getActivityRingsData.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  // Fetch additional critical data
  const { data: globalStats } = api.countries.getGlobalStats.useQuery();
  const { data: allCountriesData } = api.countries.getAll.useQuery();
  const { data: notifications } = api.countries.getNotifications.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );
  const { data: economicMilestones } = api.countries.getEconomicMilestones.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  // Get forecast data - use current time + 1 period for next forecast
  const currentTime = Date.now();
  const { data: forecast } = api.countries.getForecast.useQuery(
    {
      id: userProfile?.countryId || '',
      startTime: currentTime,
      endTime: currentTime + (1000 * 60 * 60 * 24), // 24 hours ahead
      points: 2
    },
    { enabled: !!userProfile?.countryId }
  );

  return (
    <div className="relative min-h-screen bg-background">
      <InteractiveGridPattern
        width={40}
        height={40}
        squares={[50, 40]}
        className="fixed inset-0 opacity-30 dark:opacity-20 z-0"
        squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 mt-16 relative z-10">
        {/* Full Width Main Content */}
        <motion.div
          className="w-full max-w-7xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <DashboardContent
            userProfile={userProfile}
            userCountry={userCountry}
            activityRingsData={activityRingsData}
            user={user}
            globalStats={globalStats}
            allCountries={allCountriesData?.countries || []}
            notifications={notifications?.notifications || []}
            economicMilestones={economicMilestones || []}
            forecast={forecast}
          />
        </motion.div>
      </div>
    </div>
  );
}
