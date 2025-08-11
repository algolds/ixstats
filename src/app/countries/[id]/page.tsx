"use client";

import { use } from "react";
import { api } from "~/trpc/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { CountryAtGlance } from "~/app/countries/_components/detail";
import { AlertTriangle, Eye, Users, DollarSign, TrendingUp, Globe, BarChart3, Activity, Sparkles, Layout } from "lucide-react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { IxTime } from "~/lib/ixtime";
import { createUrl } from "~/lib/url-utils";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { HealthRing } from "~/components/ui/health-ring";
import { getFlagColors, generateFlagThemeCSS } from "~/lib/flag-color-extractor";
import { DiplomaticIntelligenceProfile } from "~/components/countries/DiplomaticIntelligenceProfile";
import { SocialProfileTransformer } from "~/lib/social-profile-transformer";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { unsplashService } from "~/lib/unsplash-service";
import type { EnhancedCountryProfileData, SocialActionType } from "~/types/social-profile";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";

interface PublicCountryPageProps {
  params: Promise<{ id: string }>;
}

export default function PublicCountryPage({ params }: PublicCountryPageProps) {
  const { id } = use(params);
  const { user } = useUser();
  
  // View state management
  const [viewMode, setViewMode] = useState<'traditional' | 'enhanced'>('traditional');
  const [isEnhancedLoading, setIsEnhancedLoading] = useState(false);
  const [unsplashImageUrl, setUnsplashImageUrl] = useState<string | undefined>();
  
  const { data: country, isLoading, error } = api.countries.getByIdWithEconomicData.useQuery({ id });
  const { data: systemStatus, isLoading: systemStatusLoading } = api.admin.getSystemStatus.useQuery();
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );
  
  // Flag loading for enhanced profile
  const { flagUrl, isLoading: flagLoading } = useFlag(country?.name || "");
  
  // Load Unsplash image for enhanced profile
  useEffect(() => {
    if (country && viewMode === 'enhanced' && !unsplashImageUrl) {
      setIsEnhancedLoading(true);
      unsplashService.getCountryHeaderImage(
        country.economicTier, 
        country.populationTier,
        country.name,
        country.continent
      )
        .then(imageData => {
          setUnsplashImageUrl(imageData.url);
          // Track download as required by Unsplash API terms
          if (imageData.downloadUrl) {
            void unsplashService.trackDownload(imageData.downloadUrl);
          }
        })
        .catch(error => {
          console.warn('Failed to load Unsplash image:', error);
          setUnsplashImageUrl(undefined);
        })
        .finally(() => {
          setIsEnhancedLoading(false);
        });
    }
  }, [country, viewMode, unsplashImageUrl]);
  
  const currentIxTime = typeof systemStatus?.ixTime?.currentIxTime === 'number' ? systemStatus.ixTime.currentIxTime : 0;
  const isOwnCountry = userProfile?.countryId && country?.id && userProfile.countryId === country.id;
  
  // Enhanced profile data transformation
  const enhancedCountryData: EnhancedCountryProfileData | null = useMemo(() => {
    if (!country || viewMode !== 'enhanced') return null;
    
    try {
      return SocialProfileTransformer.transformCountryData(
        country,
        flagUrl,
        unsplashImageUrl
      );
    } catch (error) {
      console.error('Error transforming country data for enhanced profile:', error);
      return null;
    }
  }, [country, flagUrl, unsplashImageUrl, viewMode]);
  
  // Handle social actions for enhanced profile
  const handleSocialAction = useCallback(async (action: SocialActionType, targetId: string) => {
    console.log(`Social action: ${action} for ${targetId}`);
    // TODO: Implement actual social action APIs
    
    // Simulate API delay for now
    await new Promise(resolve => setTimeout(resolve, 500));
  }, []);
  
  // View mode toggle handler
  const handleViewModeToggle = useCallback(() => {
    const newMode = viewMode === 'traditional' ? 'enhanced' : 'traditional';
    setViewMode(newMode);
    
    // Save preference to localStorage
    localStorage.setItem('country-profile-view-mode', newMode);
  }, [viewMode]);
  
  // Load saved view preference on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('country-profile-view-mode') as 'traditional' | 'enhanced';
    if (savedMode && (savedMode === 'traditional' || savedMode === 'enhanced')) {
      setViewMode(savedMode);
    }
  }, []);

  // Activity rings data
  const activityData = [
    {
      label: "Economic Health",
      value: country ? Math.min(100, (country.currentGdpPerCapita / 50000) * 100) : 0,
      color: "#22c55e",
      icon: DollarSign,
    },
    {
      label: "Population Growth",
      value: country ? Math.min(100, Math.max(0, (country.populationGrowthRate * 100 + 2) * 25)) : 0,
      color: "#3b82f6", 
      icon: Users,
    },
    {
      label: "Development Index",
      value: country ? (country.economicTier === "Extravagant" ? 100 : 
                       country.economicTier === "Very Strong" ? 85 :
                       country.economicTier === "Strong" ? 70 :
                       country.economicTier === "Healthy" ? 55 :
                       country.economicTier === "Developed" ? 40 :
                       country.economicTier === "Developing" ? 25 : 10) : 0,
      color: "#8b5cf6",
      icon: TrendingUp,
    },
  ];

  if (isLoading || systemStatusLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-1/2 mb-4" />
        <Skeleton className="h-4 w-1/4 mb-8" />
        {viewMode === 'enhanced' ? (
          <div className="space-y-6">
            <Skeleton className="h-12 w-full mb-4" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-80 w-full lg:col-span-2" />
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-red-500">
        <AlertTriangle className="inline-block mr-2" />
        Error loading country data: {error.message}
      </div>
    );
  }

  if (!country) {
    return <div className="container mx-auto px-4 py-8">Country not found.</div>;
  }

  // Generate flag-based theme colors
  const flagColors = getFlagColors(country.name);
  const flagThemeCSS = generateFlagThemeCSS(flagColors);

  return (
    <div 
      className={cn(
        "container mx-auto px-4 py-8 space-y-6",
        viewMode === 'traditional' && "country-themed"
      )}
      style={viewMode === 'traditional' ? flagThemeCSS : undefined}
    >
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={createUrl("/countries")}>Countries</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{country.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header with Country Name, Actions, and View Toggle */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">{country.name}</h1>
          <div className="flex gap-2">
            <Badge variant="outline">{country.economicTier}</Badge>
            <Badge variant="outline">Tier {country.populationTier}</Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
            <Button
              variant={viewMode === 'traditional' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => viewMode !== 'traditional' && handleViewModeToggle()}
              className="flex items-center gap-2 h-8"
            >
              <Layout className="h-4 w-4" />
              <span className="hidden sm:inline">Traditional</span>
            </Button>
            <Button
              variant={viewMode === 'enhanced' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => viewMode !== 'enhanced' && handleViewModeToggle()}
              className="flex items-center gap-2 h-8"
              disabled={isEnhancedLoading || flagLoading}
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Intelligence</span>
              {(isEnhancedLoading || flagLoading) && (
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              )}
            </Button>
          </div>
          
          {isOwnCountry && (
            <Link href={createUrl("/mycountry")}>
              <Button className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">My Country Dashboard</span>
                <span className="sm:hidden">Dashboard</span>
              </Button>
            </Link>
          )}
          <Button variant="outline" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">
              {(country as any).analytics?.visits || Math.floor(Math.random() * 1000) + 100} views
            </span>
            <span className="sm:hidden">
              {Math.floor(((country as any).analytics?.visits || Math.floor(Math.random() * 1000) + 100) / 1000)}k
            </span>
          </Button>
        </div>
      </div>

      {/* Main Content with View Mode Toggle */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {viewMode === 'enhanced' ? (
            /* Diplomatic Intelligence Profile View */
            <div className="space-y-6">
              {enhancedCountryData ? (
                <Suspense fallback={
                  <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-muted-foreground">Loading diplomatic intelligence profile...</p>
                    </div>
                  </div>
                }>
                  <DiplomaticIntelligenceProfile
                    country={enhancedCountryData}
                    viewerCountryId={userProfile?.countryId || undefined}
                    viewerClearanceLevel={userProfile?.countryId === country.id ? 'CONFIDENTIAL' : 'PUBLIC'}
                    onSocialAction={handleSocialAction}
                  />
                </Suspense>
              ) : (
                <Card className="p-8 text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
                  <h3 className="text-xl font-semibold mb-2">Diplomatic Intelligence Unavailable</h3>
                  <p className="text-muted-foreground mb-4">
                    Unable to load diplomatic intelligence profile. Please try again later.
                  </p>
                  <Button onClick={() => setViewMode('traditional')} variant="outline">
                    Switch to Traditional View
                  </Button>
                </Card>
              )}
            </div>
          ) : (
            /* Traditional Country Profile View */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Activity Rings and Key Metrics */}
              <div className="space-y-6">
                {/* Activity Rings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" style={{ color: flagColors.primary }} />
                      National Vitality
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {activityData.map((ring, index) => (
                        <div key={index} className="flex items-center gap-4">
                          <HealthRing
                            value={Number(ring.value)}
                            size={80}
                            color={ring.color}
                            className="flex-shrink-0"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <ring.icon className="h-4 w-4" style={{ color: ring.color }} />
                              <span className="font-medium">{ring.label}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {ring.value.toFixed(1)}% performance
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Key Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" style={{ color: flagColors.secondary }} />
                      Key Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Population</span>
                        <span className="font-semibold">{formatPopulation(country.currentPopulation)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total GDP</span>
                        <span className="font-semibold">{formatCurrency(country.currentTotalGdp)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">GDP per Capita</span>
                        <span className="font-semibold">{formatCurrency(country.currentGdpPerCapita)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Growth Rate</span>
                        <span className="font-semibold">{(country.adjustedGdpGrowth * 100).toFixed(2)}%</span>
                      </div>
                      {country.populationDensity && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Pop. Density</span>
                          <span className="font-semibold">{country.populationDensity.toFixed(1)}/km²</span>
                        </div>
                      )}
                      {country.landArea && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Land Area</span>
                          <span className="font-semibold">{country.landArea.toLocaleString()} km²</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Country Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" style={{ color: flagColors.accent }} />
                      Country Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {country.continent && (
                        <div>
                          <span className="text-sm text-muted-foreground">Location:</span>
                          <p className="font-medium">
                            {country.region ? `${country.region}, ${country.continent}` : country.continent}
                          </p>
                        </div>
                      )}
                      {country.governmentType && (
                        <div>
                          <span className="text-sm text-muted-foreground">Government:</span>
                          <p className="font-medium">{country.governmentType}</p>
                        </div>
                      )}
                      {country.leader && (
                        <div>
                          <span className="text-sm text-muted-foreground">Leader:</span>
                          <p className="font-medium">{country.leader}</p>
                        </div>
                      )}
                      {country.religion && (
                        <div>
                          <span className="text-sm text-muted-foreground">Primary Religion:</span>
                          <p className="font-medium">{country.religion}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Enhanced View Promotion */}
                <Card className="border-dashed border-2 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-4 text-center">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                    <h3 className="font-medium mb-2">Try Intelligence Profile</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Experience diplomatic intelligence, classification levels, and strategic analysis
                    </p>
                    <Button 
                      onClick={handleViewModeToggle}
                      variant="outline"
                      size="sm"
                      className="border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950/20"
                      disabled={isEnhancedLoading || flagLoading}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Switch to Intelligence View
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Main Content Area */}
              <div className="lg:col-span-2">
                <CountryAtGlance 
                  country={{
                    ...country,
                    lastCalculated: typeof country.lastCalculated === 'number' ? country.lastCalculated : 
                                    (country.lastCalculated instanceof Date ? country.lastCalculated.getTime() : 0),
                    baselineDate: typeof country.baselineDate === 'number' ? country.baselineDate : 
                                 (country.baselineDate instanceof Date ? country.baselineDate.getTime() : 0)
                  }} 
                  currentIxTime={currentIxTime} 
                  isLoading={isLoading} 
                />

                {/* Recent Activity/Updates */}
                {country.analytics && country.analytics.riskFlags?.length > 0 && (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        Recent Developments
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {country.analytics.riskFlags.slice(0, 3).map((flag: string, i: number) => (
                          <div key={i} className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded border-l-4 border-yellow-400">
                            <p className="text-sm">{flag.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {IxTime.formatIxTime(currentIxTime, true)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Call to Action for Country Owner */}
                {!user && (
                  <Card className="mt-6">
                    <CardContent className="p-6 text-center">
                      <h3 className="text-lg font-semibold mb-2">Claim This Country</h3>
                      <p className="text-muted-foreground mb-4">
                        Sign in to claim this country and access the full management dashboard
                      </p>
                      <Button>Sign In to Claim</Button>
                    </CardContent>
                  </Card>
                )}

                {/* Limited Data Notice */}
                <Card className="mt-6">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Eye className="h-4 w-4" />
                      <span>
                        This is the public view. {isOwnCountry ? 'Access your' : 'Country owners can access the'} full dashboard 
                        {isOwnCountry ? ' here' : ' with detailed analytics and management tools'}.
                      </span>
                      {isOwnCountry && (
                        <Link href={createUrl("/mycountry")} className="text-blue-500 hover:underline ml-1">
                          View Full Dashboard
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}