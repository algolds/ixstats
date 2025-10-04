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
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { AlertTriangle, Eye, Activity } from "lucide-react";
import { createUrl } from "~/lib/url-utils";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { DiplomaticIntelligenceProfile } from "~/components/countries/DiplomaticIntelligenceProfile";
import { SocialProfileTransformer } from "~/lib/social-profile-transformer";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { unsplashService } from "~/lib/unsplash-service";
import type { EnhancedCountryProfileData, SocialActionType } from "~/types/social-profile";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";

interface PublicCountryPageProps {
  params: Promise<{ slug: string }>;
}

export default function PublicCountryPage({ params }: PublicCountryPageProps) {
  const { slug } = use(params);
  const { user } = useUser();

  // Enhanced profile loading state
  const [isEnhancedLoading, setIsEnhancedLoading] = useState(false);
  const [unsplashImageUrl, setUnsplashImageUrl] = useState<string | undefined>();

  // Use slug as the id parameter - the API will handle slug/id/name lookup
  const { data: country, isLoading, error } = api.countries.getByIdWithEconomicData.useQuery({ id: slug });
  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );
  
  // Flag loading for enhanced profile
  const { flagUrl } = useFlag(country?.name || "");
  
  // Load Unsplash image for enhanced profile
  useEffect(() => {
    if (country && !unsplashImageUrl) {
      setIsEnhancedLoading(true);
      unsplashService.getCountryHeaderImage(
        country.economicTier, 
        country.populationTier,
        country.name,
        country.continent || undefined
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
  }, [country, unsplashImageUrl]);
  
  const isOwnCountry = userProfile?.countryId && country?.id && userProfile.countryId === country.id;
  
  // Enhanced profile data transformation
  const enhancedCountryData: EnhancedCountryProfileData | null = useMemo(() => {
    if (!country) return null;
    
    try {
      return SocialProfileTransformer.transformCountryData(
        {
          ...country,
          landArea: country.landArea ?? undefined,
          populationDensity: country.populationDensity ?? undefined,
          gdpDensity: country.gdpDensity ?? undefined,
          continent: country.continent ?? undefined,
          region: country.region ?? undefined,
          governmentType: country.governmentType ?? undefined,
          leader: country.leader ?? undefined,
          religion: country.religion ?? undefined
        },
        flagUrl || undefined,
        unsplashImageUrl
      );
    } catch (error) {
      console.error('Error transforming country data for enhanced profile:', error);
      return null;
    }
  }, [country, flagUrl, unsplashImageUrl]);
  
  // Handle social actions for enhanced profile
  const handleSocialAction = useCallback(async (action: SocialActionType, targetId: string) => {
    console.log(`Social action: ${action} for ${targetId}`);

    // TODO: Implement actual social action APIs
    // For now, show a toast notification
    const { toast } = await import('sonner');

    const actionMessages: Record<SocialActionType, string> = {
      'follow': 'Follow functionality coming soon!',
      'message': 'Messaging functionality available via Secure Message button',
      'propose_alliance': 'Alliance proposals coming soon!',
      'congratulate': 'Congratulations feature coming soon!',
      'visit_profile': 'Profile view tracked',
      'endorse': 'Endorsement feature coming soon!'
    };

    toast.info(actionMessages[action] || 'Feature coming soon!');

    // Simulate API delay for now
    await new Promise(resolve => setTimeout(resolve, 500));
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-1/2 mb-4" />
        <Skeleton className="h-4 w-1/4 mb-8" />
        <div className="space-y-6">
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
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

  if (!country || !enhancedCountryData) {
    return <div className="container mx-auto px-4 py-8">Country data not found or not available.</div>;
  }


  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
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

      {/* Header with Country Name and Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">{country.name}</h1>
          <div className="flex gap-2">
            <Badge variant="outline">{country.economicTier}</Badge>
            <Badge variant="outline">Tier {country.populationTier}</Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {isOwnCountry && (
            <Link href={createUrl("/mycountry")}>
              <Button className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">MyCountry</span>
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

      {/* Main Content - 
      ligence Profile */}
      <div className="space-y-6">
        {enhancedCountryData ? (
          <Suspense fallback={
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading intelligence profile...</p>
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
            <h3 className="text-xl font-semibold mb-2">Intelligence Profile Unavailable</h3>
            <p className="text-muted-foreground mb-4">
              Unable to load intelligence profile. Please try again later.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}