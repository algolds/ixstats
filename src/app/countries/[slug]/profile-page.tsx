/**
 * Country Profile Page - Refactored Design
 * Modern country profile with dynamic header, vitality rings, and public executive overview
 */

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
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertTriangle, Eye, ExternalLink, ArrowLeft } from "lucide-react";
import { createUrl } from "~/lib/url-utils";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { getFlagColors, generateFlagThemeCSS } from "~/lib/flag-color-extractor";

// Import our new components
import { DynamicCountryHeader } from "~/components/countries/DynamicCountryHeader";
import { PublicVitalityRings } from "~/components/countries/PublicVitalityRings";
import { CountryProfileInfoBox } from "~/components/countries/CountryProfileInfoBox";
import { PublicExecutiveOverview } from "~/components/countries/PublicExecutiveOverview";

interface CountryProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function CountryProfilePage({ params }: CountryProfilePageProps) {
  const resolvedParams = use(params);
  const { user } = useUser();
  
  // Debug logging
  console.log('Profile page params:', resolvedParams);
  
  const { data: country, isLoading, error } = api.countries.getByIdWithEconomicData.useQuery(
    { id: resolvedParams.id },
    { enabled: !!resolvedParams.id }
  );
  const { data: systemStatus, isLoading: systemStatusLoading } = api.admin.getSystemStatus.useQuery();
  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );
  
  const currentIxTime = typeof systemStatus?.ixTime?.currentIxTime === 'number' ? systemStatus.ixTime.currentIxTime : 0;
  const isOwnCountry = Boolean(userProfile?.countryId && country?.id && userProfile.countryId === country.id);

  if (isLoading || systemStatusLoading) {
    return (
      <div className="min-h-screen">
        {/* Header Skeleton */}
        <Skeleton className="w-full h-64 md:h-80 lg:h-96 mb-8" />
        
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-1/2 mb-4" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="space-y-4">
              <Skeleton className="h-60 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
            <div className="lg:col-span-3 space-y-4">
              <Skeleton className="h-80 w-full" />
              <Skeleton className="h-60 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href={createUrl("/countries")}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Countries
            </Button>
          </Link>
        </div>
        <Card className="p-8 text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Error Loading Country Data</h2>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <Link href={createUrl("/countries")}>
            <Button>Browse All Countries</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (!country) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href={createUrl("/countries")}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Countries
            </Button>
          </Link>
        </div>
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-semibold mb-2">Country Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The requested country could not be found or may have been removed.
          </p>
          <Link href={createUrl("/countries")}>
            <Button>Browse All Countries</Button>
          </Link>
        </Card>
      </div>
    );
  }

  // Generate flag-based theme colors
  const flagColors = getFlagColors(country.name);
  const flagThemeCSS = generateFlagThemeCSS(flagColors);

  return (
    <div className="min-h-screen country-profile" style={flagThemeCSS}>
      {/* Dynamic Header Image */}
      <DynamicCountryHeader
        country={{
          id: country.id,
          name: country.name,
          economicTier: country.economicTier,
          populationTier: country.populationTier,
          continent: country.continent,
          analytics: { visits: Math.floor(Math.random() * 1000) + 100 }
        }}
        isOwnCountry={isOwnCountry}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Breadcrumb Navigation */}
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

        {/* Vitality Rings Section - Full Width */}
        <PublicVitalityRings country={country} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar - Country Info */}
          <div className="lg:col-span-1">
            <CountryProfileInfoBox country={country} />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-8">
            {/* Public Executive Overview */}
            <PublicExecutiveOverview 
              country={country}
              currentIxTime={currentIxTime}
            />

            {/* Additional Sections */}
            {country.analytics && country.analytics.riskFlags && country.analytics.riskFlags.length > 0 && (
              <Card className="glass-hierarchy-child">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Recent Activity
                  </h3>
                  <div className="space-y-3">
                    {country.analytics.riskFlags.slice(0, 3).map((flag: string, i: number) => (
                      <div key={i} className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border-l-4 border-yellow-400">
                        <p className="text-sm font-medium">{flag.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Economic planning consideration
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Call to Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Country Owner CTA */}
              {isOwnCountry ? (
                <Card className="glass-hierarchy-child border-2" style={{ borderColor: flagColors.primary + '40' }}>
                  <CardContent className="p-6 text-center">
                    <h3 className="text-lg font-semibold mb-2" style={{ color: flagColors.primary }}>
                      Welcome Back, Leader!
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Access your full country management dashboard with detailed analytics and strategic tools.
                    </p>
                    <Link href={createUrl("/mycountry")}>
                      <Button className="w-full" style={{ backgroundColor: flagColors.primary }}>
                        Access Full Dashboard
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : !user ? (
                <Card className="glass-hierarchy-child">
                  <CardContent className="p-6 text-center">
                    <h3 className="text-lg font-semibold mb-2">Claim This Country</h3>
                    <p className="text-muted-foreground mb-4">
                      Sign in to claim {country.name} and access the full management dashboard.
                    </p>
                    <Button className="w-full">Sign In to Claim</Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="glass-hierarchy-child">
                  <CardContent className="p-6 text-center">
                    <h3 className="text-lg font-semibold mb-2">Country Ownership</h3>
                    <p className="text-muted-foreground mb-4">
                      This country is managed by another player. You can still view public information and explore other available countries.
                    </p>
                    <Link href={createUrl("/countries")}>
                      <Button variant="outline" className="w-full">
                        Browse Countries
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}

              {/* Wiki Integration CTA */}
              <Card className="glass-hierarchy-child">
                <CardContent className="p-6 text-center">
                  <h3 className="text-lg font-semibold mb-2 flex items-center justify-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    IxWiki Page
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Explore detailed history, culture, and lore about {country.name} on IxWiki.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => window.open(`https://ixwiki.com/wiki/${country.name}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Wiki Page
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Data Notice */}
            <Card className="glass-hierarchy-child border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  <span>
                    This is a public profile view showing general performance metrics. 
                    {isOwnCountry ? ' Access your private dashboard for detailed management tools.' : ' Detailed strategic data is available to country owners.'}
                  </span>
                  {isOwnCountry && (
                    <Link href={createUrl("/mycountry")} className="text-blue-500 hover:underline ml-2">
                      Go to Dashboard →
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}