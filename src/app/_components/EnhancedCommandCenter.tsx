"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import Link from "next/link";

// Components
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { PlatformActivityFeed } from "./PlatformActivityFeed";
import { SocialUserProfile } from "./SocialUserProfile";
import { LeaderboardsSection } from "./LeaderboardsSection";
import { TierVisualization } from "./TierVisualization";
import { FeaturedArticle } from "./FeaturedArticle";
import { MyCountryCard } from "~/app/dashboard/_components/MyCountryCard";
import { AdminQuickAccess } from "./AdminQuickAccess";

// Dashboard Components - Only the essential ones for MyCountry
import { ECICard } from "~/app/dashboard/_components/ECICard";
import { SDICard } from "~/app/dashboard/_components/SDICard";
import { StrategicOperationsSuite } from "~/app/dashboard/_components/StrategicOperationsSuite";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";

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
  List,
  Clock,
  Bot,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  BarChart3,
  Shield,
  Map
} from "lucide-react";

// Utils
import { cn } from "~/lib/utils";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { createUrl } from "~/lib/url-utils";
import { usePermissions } from "~/hooks/usePermissions";
import { useFlag } from "~/hooks/useUnifiedFlags";

// Country Card Component - separate to handle hooks properly
interface CountryCardProps {
  country: {
    id: string;
    name: string;
    currentTotalGdp: number;
    currentPopulation: number;
    currentGdpPerCapita: number;
    economicTier: string;
  };
  index: number;
}

function CountryCard({ country, index }: CountryCardProps) {
  const { flagUrl } = useFlag(country.name);
  
  return (
    <Card key={country.id} className="glass-hierarchy-interactive hover:scale-[1.02] transition-all duration-200 overflow-hidden relative">
      {/* Flag Background */}
      {flagUrl && (
        <div className="absolute inset-0 opacity-10">
          <img 
            src={flagUrl} 
            alt={`${country.name} flag`}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardContent className="p-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm",
            index < 3 ? "bg-gradient-to-br from-yellow-400 to-yellow-600" : "bg-gradient-to-br from-gray-400 to-gray-600"
          )}>
            #{index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {country.name.replace(/_/g, ' ')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {country.economicTier}
            </p>
          </div>
        </div>
        
        <div className="mt-3 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">GDP</span>
            <span className="font-medium text-foreground">
              {formatCurrency(country.currentTotalGdp)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Pop.</span>
            <span className="font-medium text-foreground">
              {formatPopulation(country.currentPopulation)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Per Capita</span>
            <span className="font-medium text-green-600">
              {formatCurrency(country.currentGdpPerCapita)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


// Context-aware main content component
interface SmartDashboardContentProps {
  userProfile?: any;
  userCountry?: any;
  isAdmin?: boolean;
  countries: any[];
  adaptedGlobalStats?: {
    totalPopulation: number;
    totalGdp: number;
    averageGdpPerCapita: number;
    totalCountries: number;
    globalGrowthRate: number;
  };
  activityRingsData?: any;
  user?: any;
}

function SmartDashboardContent({ userProfile, userCountry, isAdmin, countries, adaptedGlobalStats, activityRingsData, user }: SmartDashboardContentProps) {
  const [contentMode, setContentMode] = useState<'discover' | 'mycountry' | 'activity' | 'admin'>('discover');
  const [hasUserSelectedTab, setHasUserSelectedTab] = useState(false);
  const [myCountryTab, setMyCountryTab] = useState<'overview' | 'intelligence' | 'operations'>('overview');

  // Auto-select content mode based on user context (only on initial load, not after user selection)
  React.useEffect(() => {
    if (!hasUserSelectedTab) {
      if (isAdmin) {
        setContentMode('admin');
      } else if (userCountry) {
        setContentMode('mycountry');
      } else if (userProfile) {
        setContentMode('activity');
      } else {
        setContentMode('discover');
      }
    }
    // If user was on mycountry tab but no longer has a country, switch to discover
    if (contentMode === 'mycountry' && !userCountry) {
      setContentMode('discover');
    }
  }, [isAdmin, userCountry, userProfile, hasUserSelectedTab, contentMode]);

  // Handle manual tab selection
  const handleTabChange = (mode: 'discover' | 'mycountry' | 'activity' | 'admin') => {
    setContentMode(mode);
    setHasUserSelectedTab(true);
  };

  const contentModes = [
    { id: 'discover', label: 'Discover', icon: Globe, description: 'Explore nations & trends' },
    ...(userCountry ? [{ id: 'mycountry' as const, label: 'My Country', icon: Home, description: 'Your nation\'s dashboard' }] : []),
    { id: 'activity', label: 'Activity', icon: Activity, description: 'Social feed & updates' },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin', icon: Shield, description: 'System administration' }] : [])
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
                  onClick={() => handleTabChange(mode.id as 'discover' | 'mycountry' | 'activity' | 'admin')}
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
          {/* Discover Mode */}
          {contentMode === 'discover' && (
            <motion.div
              key="discover"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Global Stats Overview */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-white" />
                  </div>
                  Global Statistics
                </h3>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 glass-hierarchy-child rounded-lg">
                    <div className="text-2xl font-bold text-foreground mb-1">
                      {adaptedGlobalStats?.totalCountries || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Nations</div>
                  </div>
                  <div className="text-center p-4 glass-hierarchy-child rounded-lg">
                    <div className="text-2xl font-bold text-foreground mb-1">
                      {formatPopulation(adaptedGlobalStats?.totalPopulation || 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Population</div>
                  </div>
                  <div className="text-center p-4 glass-hierarchy-child rounded-lg">
                    <div className="text-2xl font-bold text-foreground mb-1">
                      {formatCurrency(adaptedGlobalStats?.totalGdp || 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">World GDP</div>
                  </div>
                  <div className="text-center p-4 glass-hierarchy-child rounded-lg">
                    <div className="text-2xl font-bold text-green-500 mb-1">
                      {adaptedGlobalStats?.globalGrowthRate ? (adaptedGlobalStats.globalGrowthRate * 100).toFixed(3) : '0.000'}%
                    </div>
                    <div className="text-sm text-muted-foreground">Global Growth</div>
                  </div>
                </div>
              </div>

              {/* Top Nations Section */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                    <Trophy className="h-4 w-4 text-white" />
                  </div>
                  Global Leaderboard
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {countries
                    .sort((a, b) => b.currentTotalGdp - a.currentTotalGdp)
                    .slice(0, 9)
                    .map((country, index) => (
                      <CountryCard key={country.id} country={country} index={index} />
                    ))}
                </div>
                
                <div className="text-center">
                  <Link href="/countries">
                    <Button variant="outline" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      View Complete Leaderboards
                    </Button>
                  </Link>
                </div>
              </div>

            </motion.div>
          )}

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

              {/* MyCountry Sub-Tabs */}
              <Tabs value={myCountryTab} onValueChange={(value) => setMyCountryTab(value as 'overview' | 'intelligence' | 'operations')} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-muted/50 dark:bg-muted/20">
                  <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Home className="h-4 w-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="intelligence" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Star className="h-4 w-4" />
                    Intelligence
                  </TabsTrigger>
                  <TabsTrigger value="operations" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Target className="h-4 w-4" />
                    Operations
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

                  {/* Quick Actions */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Zap className="h-4 w-4 text-white" />
                      </div>
                      Quick Actions
                    </h3>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                      <button
                        onClick={() => setMyCountryTab('intelligence')}
                        className="glass-hierarchy-child hover:glass-hierarchy-interactive h-32 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] group cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Activity className="h-6 w-6 text-white" />
                        </div>
                        <span className="font-semibold text-foreground">Intelligence</span>
                      </button>
                      <button
                        onClick={() => setMyCountryTab('operations')}
                        className="glass-hierarchy-child hover:glass-hierarchy-interactive h-32 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] group cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Target className="h-6 w-6 text-white" />
                        </div>
                        <span className="font-semibold text-foreground">Operations</span>
                      </button>
                      <Link href="/mycountry#economy">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-32 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <TrendingUp className="h-6 w-6 text-white" />
                          </div>
                          <span className="font-semibold text-foreground">Economics</span>
                        </div>
                      </Link>
                      <Link href="/sdi/diplomatic">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-32 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Users className="h-6 w-6 text-white" />
                          </div>
                          <span className="font-semibold text-foreground">Diplomacy</span>
                        </div>
                      </Link>
                      <Link href="/countries">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-32 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <BarChart3 className="h-6 w-6 text-white" />
                          </div>
                          <span className="font-semibold text-foreground">Rankings</span>
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

          {/* Admin Mode */}
          {contentMode === 'admin' && isAdmin && (
            <AdminQuickAccess />
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}


export function EnhancedCommandCenter() {
  const { user } = useUser();

  // Sidebar collapse state
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);

  // Get user permissions for admin check
  const { user: roleUser } = usePermissions();
  const isAdmin = roleUser?.role?.level !== undefined && roleUser.role.level <= 10;

  // Fetch all necessary data
  const { data: allData, isLoading: countriesLoading } = api.countries.getAll.useQuery();
  const { data: globalStatsData, isLoading: globalStatsLoading } = api.countries.getGlobalStats.useQuery();
  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );
  const { data: socialData } = api.users.getSocialData.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
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
          <div className="h-20 glass-hierarchy-parent rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-4 space-y-6">
              <div className="h-96 glass-hierarchy-parent rounded-xl animate-pulse" />
            </div>
            <div className="space-y-6">
              <div className="h-64 glass-hierarchy-child rounded-xl animate-pulse" />
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
        className="fixed inset-0 opacity-30 dark:opacity-20 z-0"
        squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
      />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 mt-16 relative z-10">
        {/* Main Layout - Left Sidebar + Main Content + Right Sidebar */}
        <div className={cn(
          "grid grid-cols-1 gap-6 lg:gap-8 transition-all duration-300 ease-in-out",
          user ? (
            isRightSidebarCollapsed
              ? "lg:grid-cols-[320px_1fr_48px]"
              : "lg:grid-cols-[320px_1fr_350px]"
          ) : (
            isRightSidebarCollapsed
              ? "lg:grid-cols-[1fr_48px]"
              : "lg:grid-cols-[1fr_350px]"
          )
        )}>
          
          {/* Left Sticky Sidebar - User Profile & Context - Only show when user is logged in */}
          {user && (
            <motion.div
              className="lg:sticky lg:top-24 lg:self-start space-y-6"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
            >
              <SocialUserProfile
                userProfile={{
                  id: user.id,
                  countryId: userProfile?.countryId || undefined,
                  displayName: `${user.firstName} ${user.lastName}`,
                  joinedAt: user.createdAt ? new Date(user.createdAt) : new Date(),
                  lastActive: new Date()
                }}
              />

              {/* Quick Stats Card */}
              <Card className="glass-hierarchy-child">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 glass-hierarchy-interactive rounded-lg">
                      <div className="text-lg font-bold text-blue-500">{socialData?.influence || 0}</div>
                      <div className="text-xs text-muted-foreground">Influence</div>
                    </div>
                    <div className="p-3 glass-hierarchy-interactive rounded-lg">
                      <div className="text-lg font-bold text-green-500">{socialData?.achievements || 0}</div>
                      <div className="text-xs text-muted-foreground">Achievements</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Main Content Area */}
          <motion.div
            className="min-h-screen"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <SmartDashboardContent
              userProfile={userProfile}
              userCountry={userCountry}
              isAdmin={isAdmin}
              countries={countries}
              adaptedGlobalStats={adaptedGlobalStats}
              activityRingsData={activityRingsData}
              user={user}
            />
          </motion.div>

          {/* Right Sidebar - Featured Article & Tier Overview */}
          <motion.div
            className={cn(
              "lg:sticky lg:top-24 lg:self-start order-first lg:order-last relative",
              isRightSidebarCollapsed ? "w-12" : "space-y-6"
            )}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            {/* Collapse/Expand Toggle Button - Only show for logged in users */}
            {user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
                className={cn(
                  "absolute z-10 bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-background/90 transition-all duration-200",
                  isRightSidebarCollapsed
                    ? "top-4 left-1/2 -translate-x-1/2"
                    : "top-4 right-4"
                )}
                title={isRightSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isRightSidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Sidebar Content */}
            <AnimatePresence mode="wait">
              {!isRightSidebarCollapsed ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="space-y-6"
                >
                  <FeaturedArticle />
                  <TierVisualization
                    countries={countries.map(c => ({
                      ...c,
                      landArea: c.landArea ?? null,
                      populationDensity: c.populationDensity ?? null,
                      continent: c.continent ?? null,
                      region: c.region ?? null,
                      governmentType: c.governmentType ?? null,
                      religion: c.religion ?? null,
                      leader: c.leader ?? null,
                      areaSqMi: c.areaSqMi ?? null
                    }))}
                    isLoading={false}
                  />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-2 pt-16"
                >
                  <div className="w-8 h-8 rounded-lg bg-background/80 backdrop-blur-sm border flex items-center justify-center">
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-background/80 backdrop-blur-sm border flex items-center justify-center">
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </div>

        {/* Floating Actions - Simplified */}
        <div className="fixed bottom-6 right-6 z-50">
          <Button size="icon" className="rounded-full w-12 h-12 glass-hierarchy-interactive shadow-lg">
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}