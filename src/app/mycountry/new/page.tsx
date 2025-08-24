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
import { MyCountryErrorBoundary } from './components/ErrorBoundary';

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

/**
 * Real-time data integration with MyCountry API
 * All mock data generators have been replaced with live tRPC API calls
 */

/**
 * MyCountry component with full API integration
 * Vitality scores and all data now come from dedicated MyCountry API endpoints
 */

function MyCountryNewContent() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'public' | 'executive'>('public');
  
  // User profile and country data - using real MyCountry API endpoints
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  const { data: country, isLoading: countryLoading } = api.mycountry.getCountryDashboard.useQuery(
    { 
      countryId: userProfile?.countryId || '',
      includeHistory: false 
    },
    { enabled: !!userProfile?.countryId }
  );

  const { data: systemStatus, isLoading: systemStatusLoading } = api.admin.getSystemStatus.useQuery();
  const currentIxTime = typeof systemStatus?.ixTime?.currentIxTime === 'number' ? systemStatus.ixTime.currentIxTime : 0;
  const timeAcceleration = typeof systemStatus?.ixTime?.multiplier === 'number' ? systemStatus.ixTime.multiplier : 4;

  // Check if user is owner
  const isOwner = Boolean(user?.id && userProfile?.countryId === country?.id);

  // Get flag data
  const { flagUrl } = useFlag(country?.name || '');

  // Enhanced country data - vitality scores now come from API
  const enhancedCountryData: CountryData | null = country ? {
    ...country,
    flag: country.flag || undefined,
    region: country.region || '',
    continent: country.continent || '',
    governmentType: country.governmentType || undefined,
    landArea: country.landArea || undefined,
    populationDensity: country.populationDensity || undefined,
    // Ensure number types for growth rates (handle potential null values)
    realGDPGrowthRate: country.realGDPGrowthRate ?? 0,
    populationGrowthRate: country.populationGrowthRate ?? 0,
    adjustedGdpGrowth: country.adjustedGdpGrowth ?? 0,
    // API already returns timestamps as numbers and includes vitality scores
    lastCalculated: country.lastCalculated,
    baselineDate: country.baselineDate,
    economicVitality: country.economicVitality,
    populationWellbeing: country.populationWellbeing,
    diplomaticStanding: country.diplomaticStanding,
    governmentalEfficiency: country.governmentalEfficiency,
  } : null;

  // Real API data for MyCountry system - Intelligence feed only for authenticated country owners
  const { data: intelligenceFeed = [] } = api.mycountry.getIntelligenceFeed.useQuery(
    { countryId: userProfile?.countryId || '', limit: 20 },
    { 
      enabled: !!userProfile?.countryId && isOwner && isSignedIn && !!user?.id && viewMode === 'executive',
      retry: false, // Don't retry auth failures
      refetchOnWindowFocus: false
    }
  );
  
  const { data: achievements = [] } = api.mycountry.getAchievements.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );
  
  const { data: milestones = [] } = api.mycountry.getMilestones.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );
  
  const { data: rankings = [] } = api.mycountry.getRankings.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

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
    <MyCountryErrorBoundary>
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
    </MyCountryErrorBoundary>
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