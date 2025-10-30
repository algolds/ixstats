"use client";

import React, { useState, useMemo, useEffect } from "react";
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
import { CountryDataProvider, useMyCountryUnifiedData, useCountryData } from "~/components/mycountry/primitives";
import { ExecutiveCommandCenter } from "~/app/mycountry/components/ExecutiveCommandCenter";
import { DiplomaticOperationsHub } from "~/app/mycountry/intelligence/_components/DiplomaticOperationsHub";

type MyCountryUnifiedData = ReturnType<typeof useMyCountryUnifiedData>;

// Dashboard Components - Only the essential ones for MyCountry
import { StrategicOperationsSuite } from "~/app/dashboard/_components/StrategicOperationsSuite";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Progress } from "~/components/ui/progress";

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
  Map,
  FileText,
  Building2
} from "lucide-react";

// Utils
import { cn } from "~/lib/utils";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { createUrl } from "~/lib/url-utils";
import { getCountryPath } from "~/lib/slug-utils";
import { usePermissions } from "~/hooks/usePermissions";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { unifiedFlagService } from "~/lib/unified-flag-service";
import { SectionHelpIcon } from "~/components/ui/help-icon";

// Country Card Component - separate to handle hooks properly
interface CountryCardProps {
  country: {
    id: string;
    name: string;
    currentTotalGdp: number;
    currentPopulation: number;
    currentGdpPerCapita: number;
    economicTier: string;
    slug?: string | null;
  };
  index: number;
}

function CountryCard({ country, index }: CountryCardProps) {
  const { flagUrl } = useFlag(country.name);
  const countryPath = getCountryPath({
    id: country.id,
    name: country.name,
    slug: country.slug
  });
  
  return (
    <Link href={createUrl(countryPath)} className="block">
      <Card key={country.id} className="glass-hierarchy-interactive hover:scale-[1.02] transition-all duration-200 overflow-hidden relative cursor-pointer">
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
    </Link>
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
  myCountryData?: MyCountryUnifiedData | null;
  economyData?: any;
}

function SmartDashboardContent({
  userProfile,
  userCountry,
  isAdmin,
  countries,
  adaptedGlobalStats,
  activityRingsData,
  user,
  myCountryData,
  economyData
}: SmartDashboardContentProps) {
  const [contentMode, setContentMode] = useState<'discover' | 'mycountry' | 'activity' | 'admin'>('discover');
  const [hasUserSelectedTab, setHasUserSelectedTab] = useState(false);
  const [myCountryTab, setMyCountryTab] = useState<'overview' | 'executive' | 'diplomacy'>('overview');
  const [diplomacySubTab, setDiplomacySubTab] = useState<'overview' | 'network' | 'activity'>('overview');
  const [executiveSubTab, setExecutiveSubTab] = useState<'meetings' | 'policies' | 'security' | 'agenda'>('meetings');

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

  const unifiedMyCountry = myCountryData ?? null;
  const executiveIntelligence = unifiedMyCountry?.executiveIntelligence;
  const diplomaticRelations: any[] = Array.isArray(unifiedMyCountry?.diplomaticRelations)
    ? unifiedMyCountry!.diplomaticRelations
    : [];
  const recentDiplomaticActivity: any[] = Array.isArray(unifiedMyCountry?.recentDiplomaticActivity)
    ? unifiedMyCountry!.recentDiplomaticActivity
    : [];
  const upcomingMeetings: any[] = Array.isArray(unifiedMyCountry?.quickActionMeetings)
    ? unifiedMyCountry!.quickActionMeetings
    : [];
  const policies: any[] = Array.isArray(unifiedMyCountry?.quickActionPolicies)
    ? unifiedMyCountry!.quickActionPolicies
    : [];

  useEffect(() => {
    if (myCountryTab === 'diplomacy') {
      setDiplomacySubTab('overview');
    } else if (myCountryTab === 'executive') {
      setExecutiveSubTab('meetings');
    }
  }, [myCountryTab]);

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
                  <SectionHelpIcon
                    title="Global Overview"
                    content="View aggregate statistics across all nations in IxStats, including total population, combined GDP, and global economic growth rates."
                  />
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
                  <SectionHelpIcon
                    title="Top Nations"
                    content="Rankings of the highest-performing countries by total GDP. Click on any country to view detailed economic data and statistics."
                  />
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
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  MyCountry Command Center
                </h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="px-3 py-1 text-sm bg-yellow-500/20 text-yellow-800 dark:text-yellow-200 border-yellow-400/50">
                    {userCountry.name.replace(/_/g, ' ')}
                  </Badge>
                  <Badge variant="secondary" className="px-3 py-1 text-sm">
                    {userCountry.economicTier || userCountry.calculatedStats?.economicTier}
                  </Badge>
                </div>
              </div>

              {/* MyCountry Sub-Tabs */}
              <Tabs value={myCountryTab} onValueChange={(value) => setMyCountryTab(value as 'overview' | 'executive' | 'diplomacy')} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-muted/50 dark:bg-muted/20">
                  <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Home className="h-4 w-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="executive" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Crown className="h-4 w-4" />
                    Executive
                  </TabsTrigger>
                  <TabsTrigger value="diplomacy" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                    <Globe className="h-4 w-4" />
                    Diplomacy
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6 mt-6">
                  {/* National Performance Dashboard */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <BarChart3 className="h-4 w-4 text-white" />
                      </div>
                      National Performance Overview
                    </h3>

                    <MyCountryCard
                      countryData={userCountry ? {
                        id: userCountry.id,
                        name: userCountry.name,
                        currentPopulation: userCountry.currentPopulation || userCountry.calculatedStats?.currentPopulation || 0,
                        currentGdpPerCapita: userCountry.currentGdpPerCapita || userCountry.calculatedStats?.currentGdpPerCapita || 0,
                        currentTotalGdp: userCountry.currentTotalGdp || userCountry.calculatedStats?.currentTotalGdp || 0,
                        economicTier: userCountry.economicTier || userCountry.calculatedStats?.economicTier || 'Unknown',
                        populationTier: userCountry.populationTier || userCountry.calculatedStats?.populationTier || 'Medium',
                        adjustedGdpGrowth: userCountry.adjustedGdpGrowth || userCountry.calculatedStats?.adjustedGdpGrowth || 0,
                        populationGrowthRate: userCountry.populationGrowthRate || userCountry.calculatedStats?.populationGrowthRate || 0,
                        populationDensity: userCountry.populationDensity || userCountry.calculatedStats?.populationDensity,
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
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-4 hidden md:block">
                    <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Zap className="h-4 w-4 text-white" />
                      </div>
                      Quick Actions
                    </h3>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                      <button
                        onClick={() => setMyCountryTab('diplomacy')}
                        className="glass-hierarchy-child hover:glass-hierarchy-interactive h-32 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] group cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Globe className="h-6 w-6 text-white" />
                        </div>
                        <span className="font-semibold text-foreground">Diplomacy</span>
                      </button>
                      <button
                        onClick={() => setMyCountryTab('executive')}
                        className="glass-hierarchy-child hover:glass-hierarchy-interactive h-32 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] group cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Crown className="h-6 w-6 text-white" />
                        </div>
                        <span className="font-semibold text-foreground">Executive</span>
                      </button>
                      <Link href="/mycountry#economy">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-32 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <TrendingUp className="h-6 w-6 text-white" />
                          </div>
                          <span className="font-semibold text-foreground">Economics</span>
                        </div>
                      </Link>
                      <Link href="/mycountry#diplomacy">
                        <div className="glass-hierarchy-child hover:glass-hierarchy-interactive h-32 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] group cursor-pointer">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Globe className="h-6 w-6 text-white" />
                          </div>
                          <span className="font-semibold text-foreground">Diplomacy</span>
                        </div>
                      </Link>
                      <Link href="/leaderboards">
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

                {/* Diplomacy Tab */}
                <TabsContent value="diplomacy" className="space-y-8 mt-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                          <Globe className="h-4 w-4 text-white" />
                        </div>
                        Diplomatic Overview
                      </h3>
                      <Link href="/sdi/diplomatic">
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          View Full Network
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>

                    {/* Quick Diplomatic Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="glass-hierarchy-child">
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-blue-500 mb-1">
                            {activityRingsData?.diplomaticStanding.toFixed(0) || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">Diplomatic Score</div>
                        </CardContent>
                      </Card>
                      <Card className="glass-hierarchy-child">
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-purple-500 mb-1">
                            {diplomaticRelations?.filter(r => r.relationship === 'alliance' || r.relationship === 'friendly').length || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">Active Allies</div>
                        </CardContent>
                      </Card>
                      <Card className="glass-hierarchy-child">
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-green-500 mb-1">
                            {diplomaticRelations?.reduce((sum, r) => sum + (r.treaties?.length || 0), 0) || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">Active Treaties</div>
                        </CardContent>
                      </Card>
                      <Card className="glass-hierarchy-child">
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-amber-500 mb-1">
                            {activityRingsData?.diplomaticStanding >= 75 ? 'Excellent' :
                             activityRingsData?.diplomaticStanding >= 60 ? 'Good' :
                             activityRingsData?.diplomaticStanding >= 40 ? 'Neutral' : 'Declining'}
                          </div>
                          <div className="text-xs text-muted-foreground">Reputation</div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Diplomatic Actions */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Users className="h-5 w-5 text-purple-400" />
                        Diplomatic Actions
                      </h4>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <Link href="/sdi/diplomatic#embassies">
                          <Card className="glass-hierarchy-interactive hover:scale-[1.02] transition-all cursor-pointer">
                            <CardContent className="p-4 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <div className="font-semibold text-foreground">Embassy Network</div>
                                <div className="text-xs text-muted-foreground">Manage embassies</div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                        <Link href="/sdi/diplomatic#missions">
                          <Card className="glass-hierarchy-interactive hover:scale-[1.02] transition-all cursor-pointer">
                            <CardContent className="p-4 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                <Target className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <div className="font-semibold text-foreground">Missions</div>
                                <div className="text-xs text-muted-foreground">Diplomatic missions</div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                        <Link href="/sdi/diplomatic#cultural">
                          <Card className="glass-hierarchy-interactive hover:scale-[1.02] transition-all cursor-pointer">
                            <CardContent className="p-4 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                                <Star className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <div className="font-semibold text-foreground">Cultural Exchange</div>
                                <div className="text-xs text-muted-foreground">Programs & events</div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      </div>
                    </div>

                    <Card className="glass-hierarchy-child">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Globe className="h-4 w-4 text-blue-500" />
                          Operational Network
                        </CardTitle>
                        <CardDescription>
                          Live diplomatic missions, embassies, and cultural exchanges from the unified data core
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <DiplomaticOperationsHub countryId={userCountry.id} countryName={userCountry.name} />
                      </CardContent>
                    </Card>

                    {/* Recent Diplomatic Activity */}
                    <Card className="glass-hierarchy-child">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Recent Diplomatic Activity
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {recentDiplomaticActivity && recentDiplomaticActivity.length > 0 ? (
                          <div className="space-y-3">
                            {recentDiplomaticActivity.map((activity) => {
                              const isUpgrade = activity.changeType === 'status_upgrade';
                              const color = isUpgrade ? 'green' : activity.changeType === 'status_downgrade' ? 'red' : 'blue';
                              const timeDiff = Date.now() - new Date(activity.updatedAt).getTime();
                              const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
                              const timeText = hoursAgo < 1 ? 'Less than an hour ago' :
                                              hoursAgo < 24 ? `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago` :
                                              `${Math.floor(hoursAgo / 24)} day${Math.floor(hoursAgo / 24) > 1 ? 's' : ''} ago`;

                              return (
                                <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                  <div className={`w-2 h-2 rounded-full bg-${color}-500`} />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">
                                      {activity.changeType === 'status_upgrade' && `Relations improved with ${activity.targetCountry}`}
                                      {activity.changeType === 'status_downgrade' && `Tensions rising with ${activity.targetCountry}`}
                                      {activity.changeType === 'new_treaty' && `Treaty signed with ${activity.targetCountry}`}
                                      {activity.changeType === 'embassy_opened' && `Embassy established in ${activity.targetCountry}`}
                                      {!['status_upgrade', 'status_downgrade', 'new_treaty', 'embassy_opened'].includes(activity.changeType) && `Diplomatic activity with ${activity.targetCountry}`}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{timeText}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No recent diplomatic activity</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Executive Tab */}
                <TabsContent value="executive" className="space-y-8 mt-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                          <Crown className="h-4 w-4 text-white" />
                        </div>
                        Executive Brief
                      </h3>
                      <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-3 py-1">
                        Leadership
                      </Badge>
                    </div>

                    {executiveIntelligence && (
                      <Card className="glass-hierarchy-child">
                        <CardContent className="p-0">
                          <ExecutiveCommandCenter
                            intelligence={executiveIntelligence}
                            country={{
                              name: userCountry.name,
                              flag: unifiedFlagService.getCachedFlagUrl(userCountry.name) || userCountry.flagUrl || null,
                              leader: userCountry.leader || "Unknown"
                            }}
                            isOwner
                            countryStats={userCountry}
                            economyData={economyData ?? userCountry}
                            onNavigateToIntelligence={() => setMyCountryTab('overview')}
                            onNavigateToMeetings={() => setMyCountryTab('executive')}
                            onNavigateToPolicy={() => setMyCountryTab('executive')}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {/* Executive Summary Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Scheduler & Meetings */}
                      <Card className="glass-hierarchy-child">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            Upcoming Meetings
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {upcomingMeetings && upcomingMeetings.length > 0 ? (
                            <>
                              {upcomingMeetings
                                .filter((m: any) => m.status !== 'completed' && m.status !== 'cancelled')
                                .slice(0, 3)
                                .map((meeting: any, idx: number) => {
                                  const colors = ['blue', 'purple', 'green'];
                                  const color = colors[idx % colors.length];
                                  const meetingDate = new Date(meeting.scheduledDate);
                                  const timeStr = meetingDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

                                  return (
                                    <div key={meeting.id} className={`flex items-start gap-3 p-3 rounded-lg bg-${color}-500/10 border border-${color}-500/20`}>
                                      <div className={`text-sm font-medium text-${color}-600 dark:text-${color}-400 min-w-[60px]`}>{timeStr}</div>
                                      <div className="flex-1">
                                        <div className="text-sm font-semibold">{meeting.title}</div>
                                        {meeting.description && (
                                          <div className="text-xs text-muted-foreground truncate">{meeting.description}</div>
                                        )}
                                      </div>
                                      <Link href="/mycountry/meetings">
                                        <Button size="sm" variant="ghost" className="h-6 px-2">
                                          <ChevronRight className="h-3 w-3" />
                                        </Button>
                                      </Link>
                                    </div>
                                  );
                                })}
                              <Link href="/mycountry/meetings">
                                <Button variant="outline" size="sm" className="w-full mt-2">
                                  View Full Calendar
                                </Button>
                              </Link>
                            </>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No upcoming meetings scheduled</p>
                              <Link href="/mycountry/meetings">
                                <Button variant="outline" size="sm" className="mt-3">
                                  Schedule Meeting
                                </Button>
                              </Link>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Policy Status */}
                      <Card className="glass-hierarchy-child">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="h-4 w-4 text-green-500" />
                            Policy Status
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {policies ? (
                            <>
                              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-semibold">Active Policies</div>
                                  <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-300">
                                    {policies.filter((p: any) => p.status === 'active').length} Active
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {policies.filter((p: any) => p.status === 'active').length > 0
                                    ? `Latest: ${policies.filter((p: any) => p.status === 'active')[0]?.name || 'Policy active'}`
                                    : 'No active policies'}
                                </div>
                                <Link href="/mycountry#government">
                                  <Button size="sm" variant="ghost" className="w-full mt-2 text-xs">
                                    Review Policies
                                  </Button>
                                </Link>
                              </div>
                              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-semibold">Pending Approval</div>
                                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                    {policies.filter((p: any) => p.status === 'draft').length} Pending
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {policies.filter((p: any) => p.status === 'draft').length > 0
                                    ? `Awaiting: ${policies.filter((p: any) => p.status === 'draft')[0]?.name || 'Policy draft'}`
                                    : 'No pending policies'}
                                </div>
                                <Link href="/mycountry#government">
                                  <Button size="sm" variant="ghost" className="w-full mt-2 text-xs">
                                    Review Pending
                                  </Button>
                                </Link>
                              </div>
                              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-semibold">All Policies</div>
                                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-300">
                                    {policies.length} Total
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Across all categories and statuses
                                </div>
                                <Link href="/mycountry#government">
                                  <Button size="sm" variant="ghost" className="w-full mt-2 text-xs">
                                    View All
                                  </Button>
                                </Link>
                              </div>
                            </>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No policies found</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Security Status */}
                      <Card className="glass-hierarchy-child">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Shield className="h-4 w-4 text-red-500" />
                            Security Overview
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </div>
                              <div>
                                <div className="text-sm font-semibold">Threat Level</div>
                                <div className="text-xs text-muted-foreground">Low - All Clear</div>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-300">
                              Safe
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <div className="text-sm font-semibold">Border Security</div>
                                <div className="text-xs text-muted-foreground">Normal operations</div>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-300">
                              Nominal
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div>
                                <div className="text-sm font-semibold">Intelligence</div>
                                <div className="text-xs text-muted-foreground">Monitoring active</div>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-purple-500/20 text-purple-700 dark:text-purple-300">
                              Active
                            </Badge>
                          </div>
                          <Link href="/mycountry#defense">
                            <Button variant="outline" size="sm" className="w-full mt-2">
                              Full Security Report
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>

                      {/* National Agenda */}
                      <Card className="glass-hierarchy-child">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Target className="h-4 w-4 text-orange-500" />
                            National Agenda
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-semibold">Economic Growth</div>
                              <div className="text-xs text-orange-600 dark:text-orange-400">85% Complete</div>
                            </div>
                            <Progress value={85} className="h-1.5 mb-2" />
                            <div className="text-xs text-muted-foreground">Q4 targets on track</div>
                          </div>
                          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-semibold">Infrastructure Development</div>
                              <div className="text-xs text-blue-600 dark:text-blue-400">62% Complete</div>
                            </div>
                            <Progress value={62} className="h-1.5 mb-2" />
                            <div className="text-xs text-muted-foreground">Highway project Phase 2</div>
                          </div>
                          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-semibold">Education Reform</div>
                              <div className="text-xs text-purple-600 dark:text-purple-400">40% Complete</div>
                            </div>
                            <Progress value={40} className="h-1.5 mb-2" />
                            <div className="text-xs text-muted-foreground">Curriculum updates rollout</div>
                          </div>
                          <Link href="/mycountry#government">
                            <Button variant="outline" size="sm" className="w-full mt-2">
                              View Full Agenda
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Quick Executive Actions */}
                    <Card className="glass-hierarchy-child bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          Quick Executive Actions
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <Link href="/mycountry/meetings">
                            <Button variant="outline" className="w-full flex items-center gap-2 justify-start">
                              <Clock className="h-4 w-4" />
                              Schedule
                            </Button>
                          </Link>
                          <Link href="/mycountry#government">
                            <Button variant="outline" className="w-full flex items-center gap-2 justify-start">
                              <FileText className="h-4 w-4" />
                              Policies
                            </Button>
                          </Link>
                          <Link href="/mycountry#defense">
                            <Button variant="outline" className="w-full flex items-center gap-2 justify-start">
                              <Shield className="h-4 w-4" />
                              Security
                            </Button>
                          </Link>
                          <Link href="/mycountry#intelligence">
                            <Button variant="outline" className="w-full flex items-center gap-2 justify-start">
                              <Activity className="h-4 w-4" />
                              Intelligence
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
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

function SmartDashboardContentWithCountry(
  props: Omit<SmartDashboardContentProps, 'userCountry' | 'activityRingsData' | 'myCountryData' | 'economyData'>
) {
  const { country, activityRingsData, economyData } = useCountryData();
  const myCountryData = useMyCountryUnifiedData();

  return (
    <SmartDashboardContent
      {...props}
      userCountry={country}
      activityRingsData={activityRingsData}
      economyData={economyData}
      myCountryData={myCountryData}
    />
  );
}


export function EnhancedCommandCenter() {
  const { user } = useUser();

  // Set page title (notification badge will auto-update)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = "IxStats - Worldbuilding Platform";
    }
  }, []);

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
  // Process data
  const countries = allData?.countries ?? [];
  const isLoading = countriesLoading || globalStatsLoading;

  const processedCountries = countries.map((country) => ({
    id: country.id,
    name: country.name,
    slug: country.slug,
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
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 mt-16 max-w-screen-2xl">
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
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 mt-16 relative z-10 max-w-screen-2xl">
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
            {user?.id && userProfile?.countryId ? (
              <CountryDataProvider userId={user.id}>
                <SmartDashboardContentWithCountry
                  userProfile={userProfile}
                  isAdmin={isAdmin}
                  countries={countries}
                  adaptedGlobalStats={adaptedGlobalStats}
                  user={user}
                />
              </CountryDataProvider>
            ) : (
              <SmartDashboardContent
                userProfile={userProfile}
                isAdmin={isAdmin}
                countries={countries}
                adaptedGlobalStats={adaptedGlobalStats}
                user={user}
                myCountryData={null}
                economyData={undefined}
              />
            )}
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
                      areaSqMi: c.areaSqMi ?? null,
                      gdpDensity: c.gdpDensity ?? null
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
