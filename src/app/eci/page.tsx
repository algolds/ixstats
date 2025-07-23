"use client";
export const dynamic = 'force-dynamic';

import { useState, Suspense } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { 
  Crown,
  Settings,
  BarChart3,
  Users,
  Shield,
  Calendar,
  FileText,
  TrendingUp,
  Brain,
  Activity,
  Building
} from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";

function EciLoadingSkeleton() {
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

export default function ExecutiveCommandInterface() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  // Get user profile to check country assignment
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  // Get country data if user has a country
  const { data: countryData, isLoading: countryLoading } = api.countries.getByIdWithEconomicData.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  // Get ECI-specific data
  const { data: realTimeMetrics, isLoading: metricsLoading } = api.eci.getRealTimeMetrics.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  const { data: cabinetMeetings, isLoading: meetingsLoading } = api.eci.getCabinetMeetings.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  const { data: economicPolicies, isLoading: policiesLoading } = api.eci.getEconomicPolicies.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  const { data: securityThreats, isLoading: threatsLoading } = api.eci.getSecurityThreats.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  const { data: aiRecommendations, isLoading: aiLoading } = api.eci.getAIRecommendations.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  // Redirect to setup if no country
  if (isLoaded && user && !profileLoading && userProfile && !userProfile.countryId) {
    router.push('/setup');
    return null;
  }

  // Loading state
  if (!isLoaded || profileLoading || countryLoading) {
    return <EciLoadingSkeleton />;
  }

  // Not signed in
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Please sign in to access the Executive Command Interface.
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
            Complete your country setup to access executive features.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-full">
                <Building className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Executive Command Interface</h1>
                <p className="text-blue-100">
                  Strategic governance tools for {countryData?.name || 'your country'}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white">
              ECI v2.0
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cabinet">Cabinet</TabsTrigger>
            <TabsTrigger value="policies">Policies</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="ai">AI Advisor</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <GlassCard>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Social Stability</CardTitle>
                  <Users className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metricsLoading ? <Skeleton className="h-8 w-16" /> : `${realTimeMetrics?.social || 75}%`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +2% from last month
                  </p>
                </CardContent>
              </GlassCard>

              <GlassCard>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Security Index</CardTitle>
                  <Shield className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metricsLoading ? <Skeleton className="h-8 w-16" /> : `${realTimeMetrics?.security || 82}%`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Stable
                  </p>
                </CardContent>
              </GlassCard>

              <GlassCard>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Political Stability</CardTitle>
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metricsLoading ? <Skeleton className="h-8 w-16" /> : `${realTimeMetrics?.political || 78}%`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +5% from last month
                  </p>
                </CardContent>
              </GlassCard>
            </div>

            {/* Recent Activities */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Recent Cabinet Meetings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {meetingsLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : cabinetMeetings && cabinetMeetings.length > 0 ? (
                    <div className="space-y-3">
                      {cabinetMeetings.slice(0, 3).map((meeting: any) => (
                        <div key={meeting.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">{meeting.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(meeting.scheduledDate).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge>{meeting.status}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No recent cabinet meetings</p>
                  )}
                </CardContent>
              </GlassCard>

              <GlassCard>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {aiLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : aiRecommendations && aiRecommendations.length > 0 ? (
                    <div className="space-y-3">
                      {aiRecommendations.slice(0, 3).map((rec: any) => (
                        <div key={rec.id} className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium">{rec.title}</p>
                            <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                              {rec.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{rec.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No current recommendations</p>
                  )}
                </CardContent>
              </GlassCard>
            </div>
          </TabsContent>

          <TabsContent value="cabinet" className="space-y-6">
            <GlassCard>
              <CardHeader>
                <CardTitle>Cabinet Meetings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Cabinet meeting management features coming soon.</p>
              </CardContent>
            </GlassCard>
          </TabsContent>

          <TabsContent value="policies" className="space-y-6">
            <GlassCard>
              <CardHeader>
                <CardTitle>Economic Policies</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Policy management features coming soon.</p>
              </CardContent>
            </GlassCard>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <GlassCard>
              <CardHeader>
                <CardTitle>Security Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Security management features coming soon.</p>
              </CardContent>
            </GlassCard>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <GlassCard>
              <CardHeader>
                <CardTitle>AI Advisor</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">AI advisory features coming soon.</p>
              </CardContent>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}