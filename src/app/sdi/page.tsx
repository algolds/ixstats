"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

// Force dynamic rendering to avoid SSG issues with Clerk
export const dynamic = 'force-dynamic';

// Check if Clerk is configured
const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_')
);
import { GlassCard } from "~/components/ui/enhanced-card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { createUrl } from "~/lib/url-utils";
import { 
  Shield,
  Settings,
  Satellite,
  Globe,
  AlertTriangle,
  TrendingUp,
  Activity,
  Brain,
  Users,
  FileText,
  Search,
  Eye
} from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";

function SdiLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function SdiContent() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  // Get user profile to check country assignment
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  // Get country data if user has a country
  const { data: countryData, isLoading: countryLoading } = api.countries.getByIdWithEconomicData.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  // Get SDI-specific data
  const { data: intelligenceFeed, isLoading: intelligenceLoading } = api.sdi.getIntelligenceFeed.useQuery(
    { limit: 10 },
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  const { data: activeCrises, isLoading: crisesLoading } = api.sdi.getActiveCrises.useQuery(
    undefined,
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  const { data: economicIndicators, isLoading: economicLoading } = api.sdi.getEconomicIndicators.useQuery(
    undefined,
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  const { data: diplomaticRelations, isLoading: diplomaticLoading } = api.sdi.getDiplomaticRelations.useQuery(
    undefined,
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  const { data: systemStatus, isLoading: statusLoading } = api.sdi.getSystemStatus.useQuery(
    undefined,
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  // Redirect to setup if no country
  if (isLoaded && user && !profileLoading && userProfile && !userProfile.countryId) {
    router.push(createUrl('/setup'));
    return null;
  }

  // Loading state
  if (!isLoaded || profileLoading || countryLoading) {
    return <SdiLoadingSkeleton />;
  }

  // Not signed in
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Please sign in to access the Sovereign Digital Interface.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No country assigned
  if (!userProfile?.countryId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            Complete your country setup to access intelligence features.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-full">
                <Shield className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Sovereign Digital Interface</h1>
                <p className="text-blue-100">
                  Intelligence and diplomatic operations for {countryData?.name || 'your country'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${systemStatus?.systemHealth === 'operational' ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
              <Badge variant="secondary" className="bg-white/20 text-white">
                {statusLoading ? 'Loading...' : systemStatus?.systemHealth || 'Operational'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="intelligence">Intel</TabsTrigger>
            <TabsTrigger value="crisis">Crisis</TabsTrigger>
            <TabsTrigger value="economic">Economic</TabsTrigger>
            <TabsTrigger value="diplomatic">Diplomatic</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* System Status */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <GlassCard>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Crises</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {crisesLoading ? <Skeleton className="h-8 w-12" /> : activeCrises?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Global monitoring
                  </p>
                </CardContent>
              </GlassCard>

              <GlassCard>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Intel Items</CardTitle>
                  <Eye className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {intelligenceLoading ? <Skeleton className="h-8 w-12" /> : intelligenceFeed?.total || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last 7 days
                  </p>
                </CardContent>
              </GlassCard>

              <GlassCard>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Global GDP</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {economicLoading ? <Skeleton className="h-8 w-16" /> : 
                      `$${((economicIndicators?.globalGDP || 0) / 1e12).toFixed(1)}T`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +{economicIndicators?.globalGrowth?.toFixed(1) || 0}% growth
                  </p>
                </CardContent>
              </GlassCard>

              <GlassCard>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Health</CardTitle>
                  <Activity className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statusLoading ? <Skeleton className="h-8 w-16" /> : 
                      `${systemStatus?.uptime?.toFixed(1) || 99.9}%`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Uptime
                  </p>
                </CardContent>
              </GlassCard>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Satellite className="h-5 w-5" />
                    Recent Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {intelligenceLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : intelligenceFeed?.data && intelligenceFeed.data.length > 0 ? (
                    <div className="space-y-3">
                      {intelligenceFeed.data.slice(0, 5).map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(item.timestamp).toLocaleDateString()} • {item.source}
                            </p>
                          </div>
                          <Badge variant={item.priority === 'critical' ? 'destructive' : 'secondary'}>
                            {item.priority}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No recent intelligence</p>
                  )}
                </CardContent>
              </GlassCard>

              <GlassCard>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Active Situations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {crisesLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : activeCrises && activeCrises.length > 0 ? (
                    <div className="space-y-3">
                      {activeCrises.slice(0, 3).map((crisis: any) => (
                        <div key={crisis.id} className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium">{crisis.title}</p>
                            <Badge variant={crisis.severity === 'critical' ? 'destructive' : 'secondary'}>
                              {crisis.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Status: {crisis.status} • {new Date(crisis.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No active situations</p>
                  )}
                </CardContent>
              </GlassCard>
            </div>
          </TabsContent>

          <TabsContent value="intelligence" className="space-y-6">
            <GlassCard>
              <CardHeader>
                <CardTitle>Intelligence Feed</CardTitle>
              </CardHeader>
              <CardContent>
                {intelligenceLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : intelligenceFeed?.data && intelligenceFeed.data.length > 0 ? (
                  <ul className="space-y-2">
                    {intelligenceFeed.data.map((item: any) => (
                      <li key={item.id} className="border-b last:border-b-0 pb-2">
                        <div className="font-semibold">{item.title || item.category}</div>
                        <div className="text-xs text-muted-foreground">{item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}</div>
                        <div>{item.summary || item.content || item.description}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No intelligence items found.</p>
                )}
              </CardContent>
            </GlassCard>
          </TabsContent>

          <TabsContent value="crisis" className="space-y-6">
            <GlassCard>
              <CardHeader>
                <CardTitle>Crisis Management</CardTitle>
              </CardHeader>
              <CardContent>
                {crisesLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : activeCrises && activeCrises.length > 0 ? (
                  <ul className="space-y-2">
                    {activeCrises.map((crisis: any) => (
                      <li key={crisis.id} className="border-b last:border-b-0 pb-2">
                        <div className="font-semibold">{crisis.title || crisis.type}</div>
                        <div className="text-xs text-muted-foreground">{crisis.timestamp ? new Date(crisis.timestamp).toLocaleString() : ''}</div>
                        <div>{crisis.description || crisis.summary}</div>
                        {crisis.affectedCountries && crisis.affectedCountries.length > 0 && (
                          <div className="text-xs text-blue-500">Affected: {crisis.affectedCountries.join(', ')}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No active crises at this time.</p>
                )}
              </CardContent>
            </GlassCard>
          </TabsContent>

          <TabsContent value="economic" className="space-y-6">
            <GlassCard>
              <CardHeader>
                <CardTitle>Economic Intelligence</CardTitle>
              </CardHeader>
              <CardContent>
                {economicLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : economicIndicators && Object.keys(economicIndicators).length > 0 ? (
                  <ul className="space-y-2">
                    {Object.entries(economicIndicators).map(([key, value]) => (
                      <li key={key} className="border-b last:border-b-0 pb-2 flex justify-between">
                        <span className="font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span>{typeof value === 'number' ? value.toLocaleString() : String(value)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No economic indicators available.</p>
                )}
              </CardContent>
            </GlassCard>
          </TabsContent>

          <TabsContent value="diplomatic" className="space-y-6">
            <GlassCard>
              <CardHeader>
                <CardTitle>Diplomatic Relations</CardTitle>
              </CardHeader>
              <CardContent>
                {diplomaticLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : diplomaticRelations && diplomaticRelations.length > 0 ? (
                  <ul className="space-y-2">
                    {diplomaticRelations.map((relation: any) => (
                      <li key={relation.id} className="border-b last:border-b-0 pb-2">
                        <div className="font-semibold">{relation.countryName || relation.partnerName}</div>
                        <div className="text-xs text-muted-foreground">Status: {relation.status || 'Unknown'}</div>
                        <div>{relation.summary || relation.description}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No diplomatic relations data found.</p>
                )}
              </CardContent>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function SovereignDigitalInterface() {
  useEffect(() => {
    document.title = "Strategic Defense Initiative - IxStats";
  }, []);

  // Show message when Clerk is not configured
  if (!isClerkConfigured) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <GlassCard className="p-8 text-center max-w-2xl mx-auto">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-4">Authentication Not Configured</h1>
          <p className="text-muted-foreground mb-6">
            User authentication is not set up for this application. The Sovereign Digital Interface 
            requires authentication to access intelligence features.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild>
              <a href={createUrl("/dashboard")}>View Dashboard</a>
            </Button>
            <Button variant="outline" asChild>
              <a href={createUrl("/countries")}>Browse Countries</a>
            </Button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return <SdiContent />;
}