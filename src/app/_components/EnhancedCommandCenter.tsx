"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";

// Components
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { PlatformActivityFeed } from "./PlatformActivityFeed";
import { SocialUserProfile } from "./SocialUserProfile";
import { TierVisualization } from "./TierVisualization";
import { FeaturedArticle } from "./FeaturedArticle";
import { AdminQuickAccess } from "./AdminQuickAccess";
import { DiscoverMode } from "~/components/dashboard/modes/DiscoverMode";
import { MyCountryMode } from "~/components/dashboard/modes/mycountry/MyCountryMode";
import {
  CountryDataProvider,
  useMyCountryUnifiedData,
  useCountryData,
} from "~/components/mycountry/primitives";

type MyCountryUnifiedData = ReturnType<typeof useMyCountryUnifiedData>;

// Dashboard Components - Only the essential ones for MyCountry

// UI Components
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

// Icons
import { Activity, Trophy, Star, Search, ChevronLeft, ChevronRight } from "lucide-react";

// Utils
import { cn } from "~/lib/utils";
import { usePermissions } from "~/hooks/usePermissions";
import { buildContentModes } from "~/lib/dashboard-content-modes";
import { useDashboardMode } from "~/hooks/useDashboardMode";

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
  economyData,
}: SmartDashboardContentProps) {
  const { contentMode, handleTabChange } = useDashboardMode({ isAdmin, userCountry, userProfile });
  const [myCountryTab, setMyCountryTab] = useState<"overview" | "executive" | "diplomacy">(
    "overview"
  );

  const contentModes = buildContentModes(userCountry, !!isAdmin);

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

  return (
    <Card className="glass-hierarchy-parent">
      <CardHeader>
        <div className="flex items-center justify-between">
          {/* Content Mode Selector */}
          <div className="flex flex-wrap items-center gap-2">
            {contentModes.map((mode) => {
              const Icon = mode.icon;
              const isActive = contentMode === mode.id;

              return (
                <Button
                  key={mode.id}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    handleTabChange(mode.id as "discover" | "mycountry" | "activity" | "admin")
                  }
                  className="flex items-center gap-1.5 text-xs sm:gap-2 sm:text-sm"
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{mode.label}</span>
                  <span className="sm:hidden">{mode.label.substring(0, 4)}</span>
                </Button>
              );
            })}
          </div>

          {/* Mode Description */}
          <div className="text-muted-foreground hidden text-xs sm:block sm:text-sm">
            {contentModes.find((m) => m.id === contentMode)?.description}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <AnimatePresence mode="wait">
          {/* Discover Mode */}
          {contentMode === "discover" && (
            <motion.div
              key="discover"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <DiscoverMode adaptedGlobalStats={adaptedGlobalStats} countries={countries} />
            </motion.div>
          )}

          {/* My Country Mode */}
          {contentMode === "mycountry" && userCountry && (
            <motion.div
              key="mycountry"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <MyCountryMode
                userCountry={userCountry}
                activityRingsData={activityRingsData}
                economyData={economyData}
                myCountryTab={myCountryTab}
                setMyCountryTab={setMyCountryTab}
                executiveIntelligence={executiveIntelligence}
                diplomaticRelations={diplomaticRelations}
                recentDiplomaticActivity={recentDiplomaticActivity}
                upcomingMeetings={upcomingMeetings}
                policies={policies}
              />
            </motion.div>
          )}

          {/* Activity Mode */}
          {contentMode === "activity" && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <PlatformActivityFeed
                userProfile={
                  userProfile
                    ? {
                        id: userProfile.id,
                        countryId: userProfile.countryId,
                        followingCountries: [],
                        friends: [],
                        achievements: 0,
                        influence: 0,
                      }
                    : undefined
                }
              />
            </motion.div>
          )}

          {/* Admin Mode */}
          {contentMode === "admin" && isAdmin && <AdminQuickAccess />}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function SmartDashboardContentWithCountry(
  props: Omit<
    SmartDashboardContentProps,
    "userCountry" | "activityRingsData" | "myCountryData" | "economyData"
  >
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
    if (typeof document !== "undefined") {
      document.title = "IxStats - Worldbuilding Platform";
    }
  }, []);

  // Sidebar collapse state
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);

  // Get user permissions for admin check
  const { user: roleUser } = usePermissions();
  const isAdmin = roleUser?.role?.level !== undefined && roleUser.role.level <= 10;

  // Fetch all necessary data
  // Country/global stats are slow-changing — cache them and don't refetch on every
  // window focus or dashboard return. (audit F2)
  const { data: allData, isLoading: countriesLoading } = api.countries.getAll.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: globalStatsData, isLoading: globalStatsLoading } =
    api.countries.getGlobalStats.useQuery(undefined, {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    });
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });
  const { data: socialData } = api.users.getSocialData.useQuery(
    { userId: user?.id || "placeholder-disabled" },
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
      <div className="bg-background relative min-h-screen">
        <InteractiveGridPattern
          width={40}
          height={40}
          squares={[50, 40]}
          className="opacity-30 dark:opacity-20"
          squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30"
        />
        <div className="container mx-auto mt-16 max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <div className="glass-hierarchy-parent h-20 animate-pulse rounded-xl" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-4">
              <div className="glass-hierarchy-parent h-96 animate-pulse rounded-xl" />
            </div>
            <div className="space-y-6">
              <div className="glass-hierarchy-child h-64 animate-pulse rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background relative min-h-screen">
      <InteractiveGridPattern
        width={40}
        height={40}
        squares={[50, 40]}
        className="fixed inset-0 z-0 opacity-30 dark:opacity-20"
        squaresClassName="fill-slate-200/20 dark:fill-slate-700/20 stroke-slate-300/30 dark:stroke-slate-600/30 [&:nth-child(4n+1):hover]:fill-yellow-600/40 [&:nth-child(4n+1):hover]:stroke-yellow-600/60 [&:nth-child(4n+2):hover]:fill-blue-600/40 [&:nth-child(4n+2):hover]:stroke-blue-600/60 [&:nth-child(4n+3):hover]:fill-indigo-600/40 [&:nth-child(4n+3):hover]:stroke-indigo-600/60 [&:nth-child(4n+4):hover]:fill-red-600/40 [&:nth-child(4n+4):hover]:stroke-red-600/60 transition-all duration-200"
      />

      <div className="relative z-10 container mx-auto mt-16 max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Main Layout - Left Sidebar + Main Content + Right Sidebar */}
        <div
          className={cn(
            "grid grid-cols-1 gap-6 transition-all duration-300 ease-in-out lg:gap-8",
            user
              ? isRightSidebarCollapsed
                ? "lg:grid-cols-[320px_1fr_48px]"
                : "lg:grid-cols-[320px_1fr_350px]"
              : isRightSidebarCollapsed
                ? "lg:grid-cols-[1fr_48px]"
                : "lg:grid-cols-[1fr_350px]"
          )}
        >
          {/* Left Sticky Sidebar - User Profile & Context - Only show when user is logged in */}
          {user && (
            <motion.div
              className="hidden space-y-6 lg:sticky lg:top-24 lg:block lg:self-start"
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
                  lastActive: new Date(),
                }}
              />

              {/* Quick Stats Card */}
              <Card className="glass-hierarchy-child">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="glass-hierarchy-interactive rounded-lg p-3">
                      <div className="text-lg font-bold text-blue-500">
                        {socialData?.influence || 0}
                      </div>
                      <div className="text-muted-foreground text-xs">Influence</div>
                    </div>
                    <div className="glass-hierarchy-interactive rounded-lg p-3">
                      <div className="text-lg font-bold text-green-500">
                        {socialData?.achievements || 0}
                      </div>
                      <div className="text-muted-foreground text-xs">Achievements</div>
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
              "relative order-first lg:sticky lg:top-24 lg:order-last lg:self-start",
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
                  "bg-background/80 hover:bg-background/90 absolute z-10 border shadow-sm backdrop-blur-sm transition-all duration-200",
                  isRightSidebarCollapsed ? "top-4 left-1/2 -translate-x-1/2" : "top-4 right-4"
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
                    countries={countries.map((c) => ({
                      ...c,
                      landArea: c.landArea ?? null,
                      populationDensity: c.populationDensity ?? null,
                      continent: c.continent ?? null,
                      region: c.region ?? null,
                      governmentType: c.governmentType ?? null,
                      religion: c.religion ?? null,
                      leader: c.leader ?? null,
                      areaSqMi: c.areaSqMi ?? null,
                      gdpDensity: c.gdpDensity ?? null,
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
                  <div className="bg-background/80 flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-sm">
                    <Star className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div className="bg-background/80 flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-sm">
                    <Trophy className="text-muted-foreground h-4 w-4" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Floating Actions - Simplified */}
        <div className="fixed right-6 bottom-6 z-50">
          <Button
            size="icon"
            className="glass-hierarchy-interactive h-12 w-12 rounded-full shadow-lg"
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
