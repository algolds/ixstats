"use client";

import React from "react";
import { motion } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";

// Dashboard Components
import { LiveActivityMarquee } from "./LiveActivityMarquee";
import { MyCountryCard } from "./MyCountryCard";
import { GlobalIntelligenceCard } from "./GlobalIntelligenceCard";
import { ECICard } from "./ECICard";
import { SDICard } from "./SDICard";
import { ThinkPagesStatusCard } from "./ThinkPagesStatusCard";
import { StrategicOperationsSuite } from "./StrategicOperationsSuite";

// UI Components
import { Badge } from "~/components/ui/badge";

// Icons
import { 
  Crown, Activity, Star, Target, Globe, MessageSquare
} from "lucide-react";

const DashboardClean = React.memo(function DashboardClean() {
  const { user } = useUser();

  // Fetch all necessary data
  const { data: allData, isLoading: countriesLoading } = api.countries.getAll.useQuery();
  const { data: globalStatsData } = api.countries.getGlobalStats.useQuery();
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );
  const { data: countryData } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );
  const { data: activityRingsData } = api.countries.getActivityRingsData.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );
  const { data: activeCrises } = api.sdi.getActiveCrises.useQuery();
  const { data: intelligenceFeed } = api.sdi.getIntelligenceFeed.useQuery({ limit: 10 });
  const { data: economicIndicators } = api.sdi.getEconomicIndicators.useQuery();

  // Process data
  const processedCountries = allData?.countries ?? [];
  const adaptedGlobalStats = globalStatsData ? {
    totalPopulation: (globalStatsData as any).totalPopulation as number,
    totalGdp: (globalStatsData as any).totalGdp as number,
    averageGdpPerCapita: (globalStatsData as any).averageGdpPerCapita as number,
    countryCount: (globalStatsData as any).totalCountries as number,
    economicTierDistribution: (globalStatsData as any).economicTierDistribution as Record<string, number>,
    populationTierDistribution: (globalStatsData as any).populationTierDistribution as Record<string, number>,
    averagePopulationDensity: ((globalStatsData as any).averagePopulationDensity as number) || 0,
    averageGdpDensity: ((globalStatsData as any).averageGdpDensity as number) || 0,
    globalGrowthRate: (globalStatsData as any).globalGrowthRate as number,
    timestamp: (globalStatsData as any).ixTimeTimestamp as number,
    ixTimeTimestamp: (globalStatsData as any).ixTimeTimestamp as number,
  } : undefined;

  return (
    <div className="relative min-h-screen bg-background">
      {/* Subtle Background */}
      <div className="absolute inset-0 opacity-20 dark:opacity-15">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
      </div>
      
      <div className="relative z-10 space-y-8 max-w-8xl mx-auto px-6 py-8">
        
        {/* Enhanced Live Activity Stream */}
        <motion.section
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl">
                <Activity className="h-6 w-6 text-white" />
              </div>
              Global Activity Stream
            </h1>
            <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 text-sm">
              Live Updates
            </Badge>
          </div>
          
          <LiveActivityMarquee
            countries={processedCountries}
            userCountry={countryData ? {
              id: countryData.id,
              name: countryData.name,
              currentPopulation: countryData.calculatedStats?.currentPopulation || 0,
              currentGdpPerCapita: countryData.calculatedStats?.currentGdpPerCapita || 0,
              currentTotalGdp: countryData.calculatedStats?.currentTotalGdp || 0,
              economicTier: countryData.calculatedStats?.economicTier || 'Unknown',
              populationTier: countryData.calculatedStats?.populationTier || 'Medium',
              adjustedGdpGrowth: countryData.calculatedStats?.adjustedGdpGrowth || 0,
              populationGrowthRate: countryData.calculatedStats?.populationGrowthRate || 0
            } : undefined}
            isLoading={countriesLoading}
          />
        </motion.section>

        {/* Main Dashboard Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid grid-cols-1 xl:grid-cols-3 gap-10"
        >
          
          {/* Primary Column - MyCountry & Intelligence */}
          <div className="xl:col-span-2 space-y-10">
            
            {/* MyCountry Dashboard */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  MyCountry Command Center
                </h2>
                {countryData && (
                  <Badge variant="secondary" className="px-3 py-1 text-sm">
                    {countryData.name} • {countryData.calculatedStats?.economicTier}
                  </Badge>
                )}
              </div>

              <MyCountryCard
                countryData={countryData ? {
                  id: countryData.id,
                  name: countryData.name,
                  currentPopulation: countryData.calculatedStats?.currentPopulation || 0,
                  currentGdpPerCapita: countryData.calculatedStats?.currentGdpPerCapita || 0,
                  currentTotalGdp: countryData.calculatedStats?.currentTotalGdp || 0,
                  economicTier: countryData.calculatedStats?.economicTier || 'Unknown',
                  populationTier: countryData.calculatedStats?.populationTier || 'Medium',
                  adjustedGdpGrowth: countryData.calculatedStats?.adjustedGdpGrowth || 0,
                  populationGrowthRate: countryData.calculatedStats?.populationGrowthRate || 0,
                  populationDensity: countryData.calculatedStats?.populationDensity,
                  continent: countryData.continent,
                  region: countryData.region,
                  governmentType: countryData.governmentType,
                  religion: countryData.religion,
                  leader: countryData.leader
                } : undefined}
                activityRingsData={activityRingsData}
                expandedCards={new Set()}
                setExpandedCards={() => {}}
                setActivityPopoverOpen={() => {}}
                isRippleActive={false}
                isGlobalCardSlid={false}
              />
            </section>

            {/* Intelligence Suite */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                    <Star className="h-4 w-4 text-white" />
                  </div>
                  Intelligence Suite
                </h2>
                <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-3 py-1">
                  Premium
                </Badge>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ECICard
                  countryData={countryData ? {
                    id: countryData.id,
                    name: countryData.name,
                    currentPopulation: countryData.calculatedStats?.currentPopulation || 0,
                    currentGdpPerCapita: countryData.calculatedStats?.currentGdpPerCapita || 0,
                    currentTotalGdp: countryData.calculatedStats?.currentTotalGdp || 0,
                    economicTier: countryData.calculatedStats?.economicTier || 'Unknown',
                    populationTier: countryData.calculatedStats?.populationTier || 'Medium',
                    populationDensity: countryData.calculatedStats?.populationDensity,
                    landArea: countryData.landArea
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
            </section>

          </div>

          {/* Context Sidebar */}
          <div className="space-y-10">
            
            {/* Strategic Operations */}
            <section className="space-y-6">
              <h3 className="text-xl font-semibold text-foreground flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                  <Target className="h-4 w-4 text-white" />
                </div>
                Strategic Operations
              </h3>
              <StrategicOperationsSuite userProfile={userProfile} />
            </section>

            {/* Global Intelligence */}
            <section className="space-y-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                Global Intelligence
              </h3>
              <GlobalIntelligenceCard
                adaptedGlobalStats={adaptedGlobalStats}
                sdiData={{
                  activeCrises,
                  intelligenceFeed,
                  economicIndicators
                }}
                setIsGlobalCardHovered={() => {}}
                collapseGlobalCard={() => {}}
                isGlobalCollapsing={false}
                isGlobalCardSlid={false}
                className="h-full"
              />
            </section>

            {/* Social Hub */}
            <section className="space-y-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-500" />
                Social Hub
              </h3>
              <ThinkPagesStatusCard 
                userProfile={userProfile}
                className="h-full"
              />
            </section>

          </div>

        </motion.div>
      </div>
    </div>
  );
});

export default DashboardClean;