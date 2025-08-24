"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "~/trpc/react";
import { useUser } from "@clerk/nextjs";

// Components
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { PlatformActivityFeed } from "./PlatformActivityFeed";
import { SocialUserProfile } from "./SocialUserProfile";
import { LeaderboardsSection } from "./LeaderboardsSection";
import { TierVisualization } from "./TierVisualization";
import { FeaturedArticle } from "./FeaturedArticle";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// Icons
import { 
  Activity, 
  Users, 
  Globe, 
  TrendingUp, 
  Trophy,
  Crown,
  Zap,
  Star,
  Eye,
  Target,
  MessageSquare,
  UserPlus,
  Settings,
  Bell,
  Search,
  Filter,
  LayoutGrid,
  List
} from "lucide-react";

// Utils
import { cn } from "~/lib/utils";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";

interface GlobalStatsDisplayProps {
  stats: {
    totalPopulation: number;
    totalGdp: number;
    averageGdpPerCapita: number;
    totalCountries: number;
    globalGrowthRate: number;
  };
}

function GlobalStatsDisplay({ stats }: GlobalStatsDisplayProps) {
  return (
    <Card className="glass-hierarchy-parent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" />
          Global Overview
          <Badge variant="secondary" className="ml-auto">Live</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="text-center p-4 glass-hierarchy-child rounded-lg">
            <div className="text-2xl font-bold text-foreground mb-1">
              {stats.totalCountries}
            </div>
            <div className="text-sm text-muted-foreground">Nations</div>
          </div>
          <div className="text-center p-4 glass-hierarchy-child rounded-lg">
            <div className="text-2xl font-bold text-foreground mb-1">
              {formatPopulation(stats.totalPopulation)}
            </div>
            <div className="text-sm text-muted-foreground">Total Pop.</div>
          </div>
          <div className="text-center p-4 glass-hierarchy-child rounded-lg">
            <div className="text-2xl font-bold text-foreground mb-1">
              {formatCurrency(stats.totalGdp)}
            </div>
            <div className="text-sm text-muted-foreground">World GDP</div>
          </div>
          <div className="text-center p-4 glass-hierarchy-child rounded-lg">
            <div className="text-2xl font-bold text-foreground mb-1">
              {formatCurrency(stats.averageGdpPerCapita)}
            </div>
            <div className="text-sm text-muted-foreground">Avg Per Capita</div>
          </div>
          <div className="text-center p-4 glass-hierarchy-child rounded-lg">
            <div className="text-2xl font-bold text-green-500 mb-1">
              {(stats.globalGrowthRate * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Global Growth</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickActionsProps {
  user?: any;
  userProfile?: any;
}

function QuickActions({ user, userProfile }: QuickActionsProps) {
  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="flex flex-col items-center gap-2 h-auto p-4">
            <UserPlus className="h-5 w-5" />
            <span className="text-sm">Find Friends</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center gap-2 h-auto p-4">
            <MessageSquare className="h-5 w-5" />
            <span className="text-sm">Messages</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center gap-2 h-auto p-4">
            <Trophy className="h-5 w-5" />
            <span className="text-sm">Achievements</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center gap-2 h-auto p-4">
            <Settings className="h-5 w-5" />
            <span className="text-sm">Settings</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


export function EnhancedCommandCenter() {
  const { user } = useUser();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeMainTab, setActiveMainTab] = useState<'feed' | 'discover' | 'leaderboards'>('feed');

  // Fetch all necessary data
  const { data: allData, isLoading: countriesLoading } = api.countries.getAll.useQuery();
  const { data: globalStatsData, isLoading: globalStatsLoading } = api.countries.getGlobalStats.useQuery();
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );
  const { data: socialData } = api.users.getSocialData.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  // Process data
  const countries = allData?.countries ?? [];
  const isLoading = countriesLoading || globalStatsLoading;

  const processedCountries = countries.map((country) => ({
    id: country.id,
    name: country.name,
    currentPopulation: country.currentPopulation ?? 0,
    currentGdpPerCapita: country.currentGdpPerCapita ?? 0,
    currentTotalGdp: country.currentTotalGdp ?? 0,
    economicTier: country.economicTier ?? "Unknown",
    populationTier: country.populationTier ?? "Unknown", 
    landArea: country.landArea ?? null,
    populationDensity: country.populationDensity ?? null,
    gdpDensity: country.gdpDensity ?? null,
    adjustedGdpGrowth: country.adjustedGdpGrowth ?? 0,
    populationGrowthRate: country.populationGrowthRate ?? 0,
  }));

  // Adapt global stats
  const adaptedGlobalStats = useMemo(() => {
    if (!globalStatsData) return undefined;
    return {
      totalPopulation: (globalStatsData as any).totalPopulation as number,
      totalGdp: (globalStatsData as any).totalGdp as number,
      averageGdpPerCapita: (globalStatsData as any).averageGdpPerCapita as number,
      totalCountries: (globalStatsData as any).totalCountries as number,
      globalGrowthRate: (globalStatsData as any).globalGrowthRate as number,
    };
  }, [globalStatsData]);

  if (isLoading || !adaptedGlobalStats) {
    return (
      <div className="relative min-h-screen bg-background">
        <InteractiveGridPattern
          width={40}
          height={40}
          squares={[50, 40]}
          className="opacity-30 dark:opacity-20"
          squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30"
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 mt-16">
          {/* Loading skeletons */}
          <div className="h-32 glass-hierarchy-parent rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-6">
              <div className="h-96 glass-hierarchy-child rounded-xl animate-pulse" />
            </div>
            <div className="space-y-6">
              <div className="h-64 glass-hierarchy-child rounded-xl animate-pulse" />
              <div className="h-48 glass-hierarchy-child rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <InteractiveGridPattern
        width={40}
        height={40}
        squares={[50, 40]}
        className="opacity-30 dark:opacity-20"
        squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
      />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 mt-16 relative z-10">
        {/* Header with Global Stats */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <GlobalStatsDisplay stats={adaptedGlobalStats} />
        </motion.div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - User Profile */}
          <motion.div 
            className="lg:col-span-1 space-y-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {user && (
              <SocialUserProfile 
                userProfile={{
                  id: user.id,
                  countryId: userProfile?.countryId || undefined,
                  displayName: `${user.firstName} ${user.lastName}`,
                  joinedAt: user.createdAt ? new Date(user.createdAt) : new Date(),
                  lastActive: new Date()
                }}
              />
            )}
            
            {/* Quick Actions */}
            <QuickActions user={user} userProfile={userProfile} />
          </motion.div>

          {/* Main Content Area */}
          <motion.div 
            className="lg:col-span-3 space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Main Navigation Tabs */}
            <Card className="glass-hierarchy-parent">
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as any)}>
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="feed" className="flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Activity Feed
                        </TabsTrigger>
                        <TabsTrigger value="discover" className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Discover
                        </TabsTrigger>
                        <TabsTrigger value="leaderboards" className="flex items-center gap-2">
                          <Trophy className="h-4 w-4" />
                          Leaderboards
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeMainTab === 'feed' && (
                <motion.div
                  key="feed"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <PlatformActivityFeed
                    userProfile={userProfile ? {
                      id: user?.id || '',
                      countryId: userProfile.countryId || undefined,
                      followingCountries: socialData?.followingCountries || [],
                      friends: socialData?.friends || [],
                      achievements: socialData?.achievements || 0,
                      influence: socialData?.influence || 0
                    } : undefined}
                  />
                </motion.div>
              )}

              {activeMainTab === 'discover' && (
                <motion.div
                  key="discover"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "grid gap-6",
                    viewMode === 'grid' ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
                  )}
                >
                  <TierVisualization
                    countries={processedCountries}
                    isLoading={countriesLoading}
                  />
                  <FeaturedArticle />
                </motion.div>
              )}

              {activeMainTab === 'leaderboards' && (
                <motion.div
                  key="leaderboards"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <LeaderboardsSection
                    countries={processedCountries}
                    isLoading={countriesLoading}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Floating Action Buttons */}
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
          <Button size="icon" className="rounded-full w-12 h-12 glass-hierarchy-interactive">
            <Bell className="h-5 w-5" />
          </Button>
          <Button size="icon" className="rounded-full w-12 h-12 glass-hierarchy-interactive">
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}