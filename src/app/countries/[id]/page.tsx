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
import { AlertTriangle, Eye, Users, DollarSign, TrendingUp, Globe, BarChart3, Activity } from "lucide-react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { IxTime } from "~/lib/ixtime";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { HealthRing } from "~/components/ui/health-ring";
import { getFlagColors, generateFlagThemeCSS } from "~/lib/flag-color-extractor";

interface PublicCountryPageProps {
  params: Promise<{ id: string }>;
}

export default function PublicCountryPage({ params }: PublicCountryPageProps) {
  const { id } = use(params);
  const { user } = useUser();
  
  const { data: country, isLoading, error } = api.countries.getByIdWithEconomicData.useQuery({ id });
  const { data: systemStatus, isLoading: systemStatusLoading } = api.admin.getSystemStatus.useQuery();
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );
  
  const currentIxTime = typeof systemStatus?.ixTime?.currentIxTime === 'number' ? systemStatus.ixTime.currentIxTime : 0;
  const isOwnCountry = userProfile?.countryId && country?.id && userProfile.countryId === country.id;

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full lg:col-span-2" />
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

  if (!country) {
    return <div className="container mx-auto px-4 py-8">Country not found.</div>;
  }

  // Generate flag-based theme colors
  const flagColors = getFlagColors(country.name);
  const flagThemeCSS = generateFlagThemeCSS(flagColors);

  return (
    <div 
      className="container mx-auto px-4 py-8 space-y-6 country-themed"
      style={flagThemeCSS}
    >
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/countries">Countries</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{country.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header with Country Name and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">{country.name}</h1>
          <div className="flex gap-2">
            <Badge variant="outline">{country.economicTier}</Badge>
            <Badge variant="outline">Tier {country.populationTier}</Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isOwnCountry && (
            <Link href="/mycountry">
              <Button className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                My Country Dashboard
              </Button>
            </Link>
          )}
          <Button variant="outline" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {(country as any).analytics?.visits || Math.floor(Math.random() * 1000) + 100} views
          </Button>
        </div>
      </div>

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
                  <Link href="/mycountry" className="text-blue-500 hover:underline ml-1">
                    View Full Dashboard
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}