"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";

// Components
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { PlatformActivityFeed } from "~/app/_components/PlatformActivityFeed";
import { DashboardErrorBoundary } from "~/components/shared/feedback/DashboardErrorBoundary";

// Dashboard Tab Components
import { MyCountryTab } from "./MyCountryTab";
import { IntelligenceTab } from "./IntelligenceTab";
import { OperationsTab } from "./OperationsTab";

// UI Components
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// Icons
import {
  Activity,
  Crown,
  Zap,
  Home,
  Globe,
} from "lucide-react";

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
                <TabsContent value="overview">
                  <MyCountryTab
                    userCountry={userCountry}
                    activityRingsData={activityRingsData}
                    allCountries={allCountries}
                    notifications={notifications}
                    economicMilestones={economicMilestones}
                    forecast={forecast}
                  />
                </TabsContent>

                {/* Intelligence Tab */}
                <TabsContent value="systems">
                  <IntelligenceTab
                    userCountry={userCountry}
                    userProfile={userProfile}
                    userId={user?.id}
                  />
                </TabsContent>

                {/* Operations Tab */}
                <TabsContent value="global">
                  <OperationsTab userProfile={userProfile} />
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
    <DashboardErrorBoundary
      title="Command Center Error"
      description="An error occurred while loading the Command Center. Please try refreshing the page."
    >
      <div className="relative min-h-screen bg-background">
        <InteractiveGridPattern
          width={40}
          height={40}
          squares={[50, 40]}
          className="fixed inset-0 opacity-30 dark:opacity-20 z-0"
          squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
        />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 mt-16 relative z-10 max-w-screen-2xl">
          {/* Full Width Main Content */}
          <motion.div
            className="w-full max-w-screen-2xl mx-auto"
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
    </DashboardErrorBoundary>
  );
}
