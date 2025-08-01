"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { 
  Crown,
  Shield,
  AlertTriangle,
  Users,
  Globe,
  TrendingUp,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";
import { useFlag } from '~/hooks/useFlag';
import { GlobalNotificationProvider } from './components/GlobalNotificationSystem';
import { MyCountryDataWrapper } from './components/MyCountryDataWrapper';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface CountryData {
  id: string;
  name: string;
  region: string;
  continent: string;
  capital?: string;
  governmentType?: string;
  founded?: string;
  flag?: string;
  
  // Core metrics
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  
  // Calculated vitality scores
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number;
  governmentalEfficiency: number;
  
  // Growth rates
  populationGrowthRate: number;
  realGDPGrowthRate: number;
  adjustedGdpGrowth: number;
  
  // Geographic
  landArea?: number;
  populationDensity?: number;
  
  // Timestamps
  lastCalculated: number;
  baselineDate: number;
}

// Mock data generators for development
function generateMockIntelligenceFeed() {
  return [
    {
      id: '1',
      type: 'alert' as const,
      severity: 'critical' as const,
      title: 'Economic Growth Slowdown Detected',
      description: 'GDP growth rate has decreased by 0.3% this quarter, requiring immediate policy attention.',
      category: 'economic' as const,
      timestamp: Date.now() - 3600000,
      actionable: true,
      source: 'Economic Intelligence Unit',
    },
    {
      id: '2',
      type: 'opportunity' as const,
      severity: 'high' as const,
      title: 'New Trade Agreement Opportunity',
      description: 'Regional bloc is seeking new trade partners for agricultural exports.',
      category: 'diplomatic' as const,
      timestamp: Date.now() - 7200000,
      actionable: true,
      source: 'Diplomatic Intelligence',
    },
    {
      id: '3',
      type: 'update' as const,
      severity: 'medium' as const,
      title: 'Population Growth Milestone Reached',
      description: 'National population has crossed the 50 million threshold.',
      category: 'social' as const,
      timestamp: Date.now() - 86400000,
      actionable: false,
      source: 'Demographics Bureau',
    },
    {
      id: '4',
      type: 'update' as const,
      severity: 'low' as const,
      title: 'Projected Infrastructure Needs',
      description: 'Analysis suggests 15% increase in transportation infrastructure by 2030.',
      category: 'governance' as const,
      timestamp: Date.now() - 172800000,
      actionable: false,
      source: 'Strategic Planning Division',
    },
  ];
}


function generateMockAchievements() {
  return [
    {
      id: '1',
      title: 'Economic Powerhouse',
      description: 'Achieved top 10% global GDP per capita ranking',
      icon: TrendingUp,
      category: 'economic' as const,
      rarity: 'epic' as const,
      achievedAt: Date.now() - 2592000000, // 30 days ago
    },
    {
      id: '2',
      title: 'Diplomatic Excellence',
      description: 'Established 25+ international trade agreements',
      icon: Globe,
      category: 'diplomatic' as const,
      rarity: 'rare' as const,
      achievedAt: Date.now() - 5184000000, // 60 days ago
    },
    {
      id: '3',
      title: 'Population Milestone',
      description: 'Successfully managed 50M+ population growth',
      icon: Users,
      category: 'social' as const,
      rarity: 'rare' as const,
      achievedAt: Date.now() - 7776000000, // 90 days ago
    },
  ];
}

function generateMockMilestones() {
  return [
    {
      id: '1',
      title: 'Economic Tier Advancement',
      description: 'Successfully transitioned from Developing to Emerging economy status',
      achievedAt: Date.now() - 7776000000,
      impact: '+25% international investment',
      category: 'economic' as const,
    },
    {
      id: '2',
      title: 'Population Growth Management',
      description: 'Implemented sustainable population policies while maintaining growth',
      achievedAt: Date.now() - 15552000000,
      impact: 'Optimal demographic balance',
      category: 'population' as const,
    },
  ];
}

function generateMockRankings() {
  return [
    {
      global: { position: 23, total: 195, category: 'GDP' as const },
      regional: { position: 3, total: 15, region: 'Southeast Asia' },
      tier: { position: 5, total: 45, tier: 'Emerging Economy' },
    },
    {
      global: { position: 15, total: 195, category: 'Quality of Life' as const },
      regional: { position: 2, total: 15, region: 'Southeast Asia' },
      tier: { position: 3, total: 45, tier: 'Emerging Economy' },
    },
  ];
}

function calculateVitalityScores(country: any) {
  // Calculate vitality scores based on country data
  const economicVitality = Math.min(100, Math.max(0, 
    (country.adjustedGdpGrowth * 100 * 10) + 
    (country.currentGdpPerCapita / 1000) + 
    30
  ));
  
  const populationWellbeing = Math.min(100, Math.max(0,
    (country.populationGrowthRate * 100 * 20) + 
    Math.min(80, country.populationTier * 10) + 
    20
  ));
  
  const diplomaticStanding = Math.min(100, Math.max(40, 60 + Math.random() * 30));
  const governmentalEfficiency = Math.min(100, Math.max(50, 65 + Math.random() * 25));
  
  return {
    economicVitality: Math.round(economicVitality),
    populationWellbeing: Math.round(populationWellbeing),
    diplomaticStanding: Math.round(diplomaticStanding),
    governmentalEfficiency: Math.round(governmentalEfficiency),
  };
}

function MyCountryNewContent() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'public' | 'executive'>('public');
  
  // User profile and country data
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  const { data: country, isLoading: countryLoading } = api.countries.getByIdWithEconomicData.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  const { data: systemStatus, isLoading: systemStatusLoading } = api.admin.getSystemStatus.useQuery();
  const currentIxTime = typeof systemStatus?.ixTime?.currentIxTime === 'number' ? systemStatus.ixTime.currentIxTime : 0;
  const timeAcceleration = typeof systemStatus?.ixTime?.multiplier === 'number' ? systemStatus.ixTime.multiplier : 4;

  // Check if user is owner
  const isOwner = Boolean(user?.id && userProfile?.countryId === country?.id);

  // Get flag data
  const { flagUrl } = useFlag(country?.name || '');

  // Enhanced country data with vitality scores
  const enhancedCountryData: CountryData | null = country ? {
    ...country,
    region: country.region || '',
    continent: country.continent || '',
    governmentType: country.governmentType || undefined,
    landArea: country.landArea || undefined,
    populationDensity: country.populationDensity || undefined,
    lastCalculated: typeof country.lastCalculated === 'number' ? country.lastCalculated : 
                    (country.lastCalculated instanceof Date ? country.lastCalculated.getTime() : Date.now()),
    baselineDate: typeof country.baselineDate === 'number' ? country.baselineDate : 
                  (country.baselineDate instanceof Date ? country.baselineDate.getTime() : Date.now()),
    ...calculateVitalityScores(country),
  } : null;

  // Mock data for development - memoized to prevent infinite re-renders
  const intelligenceFeed = useMemo(() => 
    enhancedCountryData ? generateMockIntelligenceFeed() : [], 
    [enhancedCountryData?.id]
  );
  const achievements = useMemo(() => generateMockAchievements(), []);
  const milestones = useMemo(() => generateMockMilestones(), []);
  const rankings = useMemo(() => generateMockRankings(), []);

  // Handle authentication redirect
  useEffect(() => {
    if (isLoaded && !user) {
      const returnUrl = encodeURIComponent(createUrl('/mycountry/new'));
      window.location.href = `https://accounts.ixwiki.com/sign-in?redirect_url=${returnUrl}`;
    }
  }, [isLoaded, user, router]);

  // Event handlers
  const handleActionClick = (actionId: string) => {
    console.log('Action clicked:', actionId);
    // Implement action handling logic
  };

  const handleFocusAreaClick = (areaId: string) => {
    console.log('Focus area clicked:', areaId);
    // Navigate to specific focus area or expand details
  };

  const handleSettingsClick = () => {
    router.push(createUrl('/mycountry/new/settings'));
  };

  const handlePrivateAccess = () => {
    setViewMode('executive');
  };

  // Loading state
  if (!isLoaded || profileLoading || countryLoading || systemStatusLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-12 rounded" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="glass-hierarchy-child">
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-6 mx-auto mb-2" />
                  <Skeleton className="h-6 w-16 mx-auto mb-1" />
                  <Skeleton className="h-4 w-12 mx-auto mb-2" />
                  <Skeleton className="h-6 w-20 mx-auto" />
                </CardContent>
              </Card>
            ))}
          </div>
          
          <Card className="glass-hierarchy-parent">
            <CardHeader>
              <Skeleton className="h-6 w-48 mx-auto" />
              <Skeleton className="h-4 w-64 mx-auto" />
            </CardHeader>
            <CardContent className="py-8">
              <div className="flex justify-center gap-8">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-32 w-32 rounded-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // No country assigned
  if (!userProfile?.countryId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto glass-hierarchy-parent">
          <CardHeader className="text-center">
            <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle className="text-2xl font-bold">No Country Assigned</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              You don't have a country assigned to your account yet. Contact an administrator to claim a country 
              or browse available countries to request ownership.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => router.push(createUrl("/countries"))}>
                <Globe className="h-4 w-4 mr-2" />
                Browse Countries
              </Button>
              <Button variant="outline" onClick={() => router.push(createUrl("/admin"))}>
                <Shield className="h-4 w-4 mr-2" />
                Contact Admin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Country not found
  if (!enhancedCountryData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert className="max-w-2xl mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Country not found or access denied. Please contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <GlobalNotificationProvider>
      <MyCountryDataWrapper
        user={user}
        userProfile={userProfile}
        country={enhancedCountryData}
        isOwner={isOwner}
        currentIxTime={currentIxTime}
        timeAcceleration={timeAcceleration}
        achievements={achievements}
        milestones={milestones}
        rankings={rankings}
        intelligenceFeed={intelligenceFeed}
        flagUrl={flagUrl}
        viewMode={viewMode}
        onModeToggle={(mode) => setViewMode(mode)}
        onActionClick={handleActionClick}
        onFocusAreaClick={handleFocusAreaClick}
        onSettingsClick={handleSettingsClick}
        onPrivateAccess={handlePrivateAccess}
        />
    </GlobalNotificationProvider>
  );
}

export default function MyCountryNewPage() {
  // Check if Clerk is configured
  const isClerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_')
  );

  if (!isClerkConfigured) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto glass-hierarchy-parent">
          <CardHeader className="text-center">
            <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle className="text-2xl font-bold">Authentication Not Configured</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              User authentication is not set up for this application. Please contact an administrator 
              to configure authentication or browse countries without signing in.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => window.location.href = createUrl("/countries")}>
                <Globe className="h-4 w-4 mr-2" />
                Browse Countries
              </Button>
              <Button variant="outline" onClick={() => window.location.href = createUrl("/dashboard")}>
                <Activity className="h-4 w-4 mr-2" />
                View Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <MyCountryNewContent />;
}