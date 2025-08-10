"use client";

import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { 
  AlertTriangle, 
  Crown, 
  BarChart3, 
  TrendingUp, 
  Briefcase, 
  Building, 
  PieChart, 
  Eye, 
  Edit,
  Brain,
  Target,
  Shield,
  Sparkles
} from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";

// Force dynamic rendering to avoid SSG issues with Clerk
export const dynamic = 'force-dynamic';

// Check if Clerk is configured
const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_')
);

function MyCountryContent() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<'standard' | 'executive' | null>(null);

  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  const { data: country, isLoading: countryLoading } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  useEffect(() => {
    if (isLoaded && !user) {
      const returnUrl = encodeURIComponent(createUrl('/mycountry'));
      window.location.href = `https://accounts.ixwiki.com/sign-in?redirect_url=${returnUrl}`;
    }
  }, [isLoaded, user, router]);

  // Auto-redirect logic - check for saved preference
  useEffect(() => {
    if (country && user && !selectedTier) {
      const savedTier = localStorage.getItem(`mycountry-tier-${user.id}`) as 'standard' | 'executive';
      if (savedTier === 'standard') {
        router.push(createUrl('/mycountry/standard'));
      } else if (savedTier === 'executive') {
        router.push(createUrl('/mycountry/executive'));
      }
      // If no saved preference, show tier selection
    }
  }, [country, user, selectedTier, router]);

  const handleTierSelect = (tier: 'standard' | 'executive') => {
    if (user) {
      localStorage.setItem(`mycountry-tier-${user.id}`, tier);
    }
    setSelectedTier(tier);
    router.push(createUrl(`/mycountry/${tier}`));
  };

  if (!isLoaded || profileLoading || countryLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-4 w-1/4 mb-8" />
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!userProfile?.countryId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
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
              <Link href={createUrl("/countries")}>
                <Button variant="outline">Browse Countries</Button>
              </Link>
              <Link href={createUrl("/admin")}>
                <Button>Contact Admin</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!country) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Country not found or access denied. Please contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show tier selection interface
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-4">
          <Crown className="h-12 w-12 text-yellow-500" />
          <div>
            <h1 className="text-4xl font-bold">MyCountry: {country.name}</h1>
            <p className="text-xl text-muted-foreground">Choose Your Experience</p>
          </div>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Select between our Standard dashboard with essential country management tools, 
          or upgrade to Executive for advanced intelligence and command center features.
        </p>
      </div>

      {/* Tier Selection Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
        {/* Standard Tier */}
        <Card className="relative overflow-hidden border-2 hover:border-blue-300 transition-all duration-300 hover:shadow-lg cursor-pointer group"
              onClick={() => handleTierSelect('standard')}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent group-hover:from-blue-100/70" />
          <CardHeader className="relative pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/50">
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                STANDARD
              </Badge>
            </div>
            <CardTitle className="text-2xl">MyCountry Standard</CardTitle>
            <CardDescription className="text-base">
              Essential country management with comprehensive economic analytics
            </CardDescription>
          </CardHeader>
          <CardContent className="relative space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Economic Dashboard</div>
                  <div className="text-sm text-muted-foreground">Complete economic indicators, labor statistics, and fiscal data</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Data Management</div>
                  <div className="text-sm text-muted-foreground">Edit and manage your country's economic data</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <PieChart className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Core Analytics</div>
                  <div className="text-sm text-muted-foreground">Demographics, government spending, and growth tracking</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Edit className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Country Editor</div>
                  <div className="text-sm text-muted-foreground">Professional data editing interface</div>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handleTierSelect('standard')}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Enter Standard Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Executive Tier */}
        <Card className="relative overflow-hidden border-2 border-gradient-to-r from-purple-300 to-blue-300 hover:shadow-xl transition-all duration-300 cursor-pointer group bg-gradient-to-br from-purple-50/20 to-blue-50/20"
              onClick={() => handleTierSelect('executive')}>
          <div className="absolute inset-0 bg-gradient-to-br from-purple-100/30 via-blue-100/20 to-transparent group-hover:from-purple-200/50 group-hover:via-blue-200/30" />
          <CardHeader className="relative pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-full bg-gradient-to-r from-purple-500 to-blue-500">
                <Crown className="h-8 w-8 text-white" />
              </div>
              <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                <Sparkles className="h-3 w-3 mr-1" />
                EXECUTIVE
              </Badge>
            </div>
            <CardTitle className="text-2xl bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              MyCountry Executive
            </CardTitle>
            <CardDescription className="text-base">
              Advanced command center with AI-powered intelligence and decision support
            </CardDescription>
          </CardHeader>
          <CardContent className="relative space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Crown className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Executive Command Center</div>
                  <div className="text-sm text-muted-foreground">Real-time crisis monitoring and strategic decision support</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Intelligence Briefings</div>
                  <div className="text-sm text-muted-foreground">AI-powered insights and predictive analytics</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Advanced Analytics</div>
                  <div className="text-sm text-muted-foreground">Deep economic modeling and scenario planning</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Risk Assessment</div>
                  <div className="text-sm text-muted-foreground">National security and economic threat analysis</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Forward Intelligence</div>
                  <div className="text-sm text-muted-foreground">Performance forecasting and strategic recommendations</div>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <Button className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white" 
                     onClick={() => handleTierSelect('executive')}>
                <Crown className="h-4 w-4 mr-2" />
                Enter Executive Suite
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Options */}
      <div className="flex items-center justify-center gap-4 pt-6 border-t">
        <Link href={createUrl(`/countries/${country.id}`)}>
          <Button variant="outline" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            View Public Page
          </Button>
        </Link>
        <Link href={createUrl("/mycountry/editor")}>
          <Button variant="outline" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Quick Edit Data
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function MyCountryPage() {
  useEffect(() => {
    document.title = "MyCountry - IxStats";
  }, []);

  if (!isClerkConfigured) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
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
              <Link href={createUrl("/countries")}>
                <Button variant="outline">Browse Countries</Button>
              </Link>
              <Link href={createUrl("/dashboard")}>
                <Button>View Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <MyCountryContent />;
}