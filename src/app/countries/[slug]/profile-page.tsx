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
import { useUser } from "~/context/auth-context";
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
  console.log("Profile page params:", resolvedParams);

  const {
    data: country,
    isLoading,
    error,
  } = api.countries.getByIdWithEconomicData.useQuery(
    { id: resolvedParams.id },
    { enabled: !!resolvedParams.id }
  );
  const { data: systemStatus, isLoading: systemStatusLoading } =
    api.admin.getSystemStatus.useQuery();
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  const currentIxTime =
    typeof systemStatus?.ixTime?.currentIxTime === "number" ? systemStatus.ixTime.currentIxTime : 0;
  const isOwnCountry = Boolean(
    userProfile?.countryId && country?.id && userProfile.countryId === country.id
  );

  if (isLoading || systemStatusLoading) {
    return (
      <div className="min-h-screen">
        {/* Header Skeleton */}
        <Skeleton className="mb-8 h-64 w-full md:h-80 lg:h-96" />

        <div className="container mx-auto px-4">
          <Skeleton className="mb-4 h-8 w-1/2" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <div className="space-y-4">
              <Skeleton className="h-60 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
            <div className="space-y-4 lg:col-span-3">
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
        <div className="mb-6 flex items-center gap-4">
          <Link href={createUrl("/countries")}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Countries
            </Button>
          </Link>
        </div>
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-red-500" />
          <h2 className="mb-2 text-2xl font-semibold">Error Loading Country Data</h2>
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
        <div className="mb-6 flex items-center gap-4">
          <Link href={createUrl("/countries")}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Countries
            </Button>
          </Link>
        </div>
        <Card className="p-8 text-center">
          <h2 className="mb-2 text-2xl font-semibold">Country Not Found</h2>
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
    <div className="country-profile min-h-screen" style={flagThemeCSS}>
      {/* Dynamic Header Image */}
      <DynamicCountryHeader
        country={{
          id: country.id,
          name: country.name,
          economicTier: country.economicTier,
          populationTier: country.populationTier,
          continent: country.continent,
          analytics: { visits: Math.floor(Math.random() * 1000) + 100 },
        }}
        isOwnCountry={isOwnCountry}
      />

      {/* Main Content */}
      <div className="container mx-auto space-y-8 px-4 py-8">
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
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Left Sidebar - Country Info */}
          <div className="lg:col-span-1">
            <CountryProfileInfoBox country={country} />
          </div>

          {/* Main Content Area */}
          <div className="space-y-8 lg:col-span-3">
            {/* Public Executive Overview */}
            <PublicExecutiveOverview country={country} currentIxTime={currentIxTime} />

            {/* Additional Sections */}
            {country.analytics &&
              country.analytics.riskFlags &&
              country.analytics.riskFlags.length > 0 && (
                <Card className="glass-hierarchy-child">
                  <CardContent className="p-6">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Recent Activity
                    </h3>
                    <div className="space-y-3">
                      {country.analytics.riskFlags.slice(0, 3).map((flag: string, i: number) => (
                        <div
                          key={i}
                          className="rounded-lg border-l-4 border-yellow-400 bg-yellow-50 p-4 dark:bg-yellow-950/20"
                        >
                          <p className="text-sm font-medium">{flag.replace(/_/g, " ")}</p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            Economic planning consideration
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Call to Action Cards */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Country Owner CTA */}
              {isOwnCountry ? (
                <Card
                  className="glass-hierarchy-child border-2"
                  style={{ borderColor: flagColors.primary + "40" }}
                >
                  <CardContent className="p-6 text-center">
                    <h3
                      className="mb-2 text-lg font-semibold"
                      style={{ color: flagColors.primary }}
                    >
                      Welcome Back, Leader!
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Access your full country management dashboard with detailed analytics and
                      strategic tools.
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
                    <h3 className="mb-2 text-lg font-semibold">Claim This Country</h3>
                    <p className="text-muted-foreground mb-4">
                      Sign in to claim {country.name} and access the full management dashboard.
                    </p>
                    <Button className="w-full">Sign In to Claim</Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="glass-hierarchy-child">
                  <CardContent className="p-6 text-center">
                    <h3 className="mb-2 text-lg font-semibold">Country Ownership</h3>
                    <p className="text-muted-foreground mb-4">
                      This country is managed by another player. You can still view public
                      information and explore other available countries.
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
                  <h3 className="mb-2 flex items-center justify-center gap-2 text-lg font-semibold">
                    <ExternalLink className="h-5 w-5" />
                    IxWiki Page
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Explore detailed history, culture, and lore about {country.name} on IxWiki.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(`https://ixwiki.com/wiki/${country.name}`, "_blank")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Wiki Page
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Data Notice */}
            <Card className="glass-hierarchy-child border-dashed">
              <CardContent className="p-4">
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Eye className="h-4 w-4" />
                  <span>
                    This is a public profile view showing general performance metrics.
                    {isOwnCountry
                      ? " Access your private dashboard for detailed management tools."
                      : " Detailed strategic data is available to country owners."}
                  </span>
                  {isOwnCountry && (
                    <Link
                      href={createUrl("/mycountry")}
                      className="ml-2 text-blue-500 hover:underline"
                    >
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
