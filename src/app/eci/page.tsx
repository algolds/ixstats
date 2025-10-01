"use client";
export const dynamic = 'force-dynamic';

import { useState, Suspense, useEffect } from "react";
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
  Building,
  Clock,
  Plus,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  Send,
  AlertCircle,
  Database
} from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { createUrl } from "~/lib/url-utils";

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
  useEffect(() => {
    document.title = "Economic Intelligence Center - IxStats";
  }, []);

  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  // Get user profile to check country assignment
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id }
  );

  // Get country data if user has a country
  const { data: countryData, isLoading: countryLoading } = api.countries.getByIdWithEconomicData.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  // Get ECI-specific data
  const { data: realTimeMetrics, isLoading: metricsLoading } = api.eci.getRealTimeMetrics.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  const { data: cabinetMeetings, isLoading: meetingsLoading } = api.eci.getCabinetMeetings.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  const { data: economicPolicies, isLoading: policiesLoading } = api.eci.getEconomicPolicies.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  const { data: securityThreats, isLoading: threatsLoading } = api.eci.getSecurityThreats.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  const { data: aiRecommendations, isLoading: aiLoading } = api.eci.getAIRecommendations.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  // Redirect to setup if no country
  if (isLoaded && user && !profileLoading && userProfile && !userProfile.countryId) {
    router.push(createUrl('/setup'));
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Upcoming Meetings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold">Economic Policy Review</h4>
                        <Badge>Tomorrow</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Quarterly review of GDP growth targets and fiscal policy adjustments
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        10:00 AM - 12:00 PM
                      </div>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold">Security Assessment</h4>
                        <Badge variant="outline">Next Week</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Defense budget allocation and strategic threat analysis
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        2:00 PM - 4:00 PM
                      </div>
                    </div>
                  </div>
                </CardContent>
              </GlassCard>
              
              <GlassCard>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Meeting Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <button className="w-full p-3 border border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-center gap-2">
                        <Plus className="h-4 w-4" />
                        <span>Schedule New Meeting</span>
                      </div>
                    </button>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button className="p-2 border rounded hover:bg-muted/50 transition-colors text-sm">
                        View Calendar
                      </button>
                      <button className="p-2 border rounded hover:bg-muted/50 transition-colors text-sm">
                        Meeting History
                      </button>
                    </div>
                  </div>
                </CardContent>
              </GlassCard>
            </div>
            
            <GlassCard>
              <CardHeader>
                <CardTitle>Recent Decisions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="font-medium">Infrastructure Investment Approved</p>
                      <p className="text-sm text-muted-foreground">Allocated $2.3B for highway modernization project</p>
                      <p className="text-xs text-muted-foreground mt-1">Decided 3 days ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="font-medium">Education Reform Initiative</p>
                      <p className="text-sm text-muted-foreground">New curriculum standards for STEM education</p>
                      <p className="text-xs text-muted-foreground mt-1">Decided 1 week ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="font-medium">Trade Agreement Review</p>
                      <p className="text-sm text-muted-foreground">Bilateral trade terms with neighboring countries</p>
                      <p className="text-xs text-muted-foreground mt-1">Decided 2 weeks ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </GlassCard>
          </TabsContent>

          <TabsContent value="policies" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Active Policies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-green-600">Stimulus Package</h4>
                        <Badge className="bg-green-100 text-green-700">Active</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Infrastructure investment and tax incentives to boost economic growth
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>GDP Impact:</span>
                          <span className="text-green-600 font-medium">+2.3%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Duration:</span>
                          <span>18 months remaining</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-blue-600">Education Investment</h4>
                        <Badge className="bg-blue-100 text-blue-700">Active</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Increased funding for schools and vocational training programs
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Productivity Impact:</span>
                          <span className="text-blue-600 font-medium">+1.8%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Duration:</span>
                          <span>24 months remaining</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </GlassCard>
              
              <GlassCard>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Policy Tools
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <button className="w-full p-3 border border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-center gap-2">
                        <Plus className="h-4 w-4" />
                        <span>Create New Policy</span>
                      </div>
                    </button>
                    
                    <div className="grid grid-cols-1 gap-2">
                      <button className="p-3 border rounded hover:bg-muted/50 transition-colors text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Policy Impact Simulator
                      </button>
                      <button className="p-3 border rounded hover:bg-muted/50 transition-colors text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Policy Templates
                      </button>
                      <button className="p-3 border rounded hover:bg-muted/50 transition-colors text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Policy History
                      </button>
                    </div>
                  </div>
                </CardContent>
              </GlassCard>
            </div>
            
            <GlassCard>
              <CardHeader>
                <CardTitle>Policy Performance Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600 mb-1">+4.2%</div>
                    <div className="text-sm text-muted-foreground">Overall Economic Impact</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span className="text-xs text-green-600">vs last quarter</span>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600 mb-1">87%</div>
                    <div className="text-sm text-muted-foreground">Policy Success Rate</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <CheckCircle className="h-3 w-3 text-blue-600" />
                      <span className="text-xs text-blue-600">Above target</span>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-600 mb-1">12</div>
                    <div className="text-sm text-muted-foreground">Active Policies</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Settings className="h-3 w-3 text-orange-600" />
                      <span className="text-xs text-orange-600">Well balanced</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </GlassCard>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Threat Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold">Overall Security Level</h4>
                        <Badge className="bg-green-100 text-green-700">Stable</Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div className="bg-green-600 h-2 rounded-full w-[78%]"></div>
                      </div>
                      <p className="text-sm text-muted-foreground">78% security confidence</p>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-medium">Border Security</span>
                        </div>
                        <span className="text-sm text-green-600">Secure</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <span className="text-sm font-medium">Cyber Security</span>
                        </div>
                        <span className="text-sm text-yellow-600">Monitoring</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-medium">Internal Stability</span>
                        </div>
                        <span className="text-sm text-green-600">Stable</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </GlassCard>
              
              <GlassCard>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="font-medium text-sm">Security Drill Completed</p>
                        <p className="text-xs text-muted-foreground">National emergency response exercise</p>
                        <p className="text-xs text-muted-foreground">2 hours ago</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="font-medium text-sm">Border Patrol Update</p>
                        <p className="text-xs text-muted-foreground">All checkpoints reporting normal</p>
                        <p className="text-xs text-muted-foreground">6 hours ago</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="font-medium text-sm">Cyber Threat Detected</p>
                        <p className="text-xs text-muted-foreground">Low-level intrusion attempt blocked</p>
                        <p className="text-xs text-muted-foreground">1 day ago</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </GlassCard>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard>
                <CardHeader>
                  <CardTitle>Defense Spending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 border rounded">
                      <span className="text-sm">Personnel</span>
                      <div className="text-right">
                        <div className="text-sm font-medium">$2.4B</div>
                        <div className="text-xs text-muted-foreground">45%</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 border rounded">
                      <span className="text-sm">Equipment</span>
                      <div className="text-right">
                        <div className="text-sm font-medium">$1.8B</div>
                        <div className="text-xs text-muted-foreground">34%</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 border rounded">
                      <span className="text-sm">Research & Development</span>
                      <div className="text-right">
                        <div className="text-sm font-medium">$0.7B</div>
                        <div className="text-xs text-muted-foreground">13%</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 border rounded">
                      <span className="text-sm">Operations</span>
                      <div className="text-right">
                        <div className="text-sm font-medium">$0.4B</div>
                        <div className="text-xs text-muted-foreground">8%</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </GlassCard>
              
              <GlassCard>
                <CardHeader>
                  <CardTitle>Security Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <button className="w-full p-3 border border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Issue Security Alert</span>
                      </div>
                    </button>
                    
                    <div className="grid grid-cols-1 gap-2">
                      <button className="p-3 border rounded hover:bg-muted/50 transition-colors text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        View Security Reports
                      </button>
                      <button className="p-3 border rounded hover:bg-muted/50 transition-colors text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Personnel Management
                      </button>
                      <button className="p-3 border rounded hover:bg-muted/50 transition-colors text-sm flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Security Protocols
                      </button>
                    </div>
                  </div>
                </CardContent>
              </GlassCard>
            </div>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Strategic Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-blue-50/50">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-blue-900 mb-2">Economic Growth Opportunity</h4>
                          <p className="text-sm text-blue-700 mb-3">
                            AI analysis suggests implementing targeted infrastructure spending could increase GDP growth by 1.4% over 18 months.
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-700">High Impact</Badge>
                            <span className="text-xs text-blue-600">Confidence: 87%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg bg-green-50/50">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-900 mb-2">Policy Optimization</h4>
                          <p className="text-sm text-green-700 mb-3">
                            Current education policies are performing above expectations. Consider expanding similar programs to other sectors.
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-700">Optimize</Badge>
                            <span className="text-xs text-green-600">Confidence: 92%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg bg-orange-50/50">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-orange-900 mb-2">Risk Mitigation</h4>
                          <p className="text-sm text-orange-700 mb-3">
                            Elevated unemployment in manufacturing sector detected. Recommend retraining programs to prevent social unrest.
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-orange-100 text-orange-700">Monitor</Badge>
                            <span className="text-xs text-orange-600">Confidence: 74%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </GlassCard>
              
              <GlassCard>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    AI Assistant
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                          <Brain className="h-3 w-3 text-primary-foreground" />
                        </div>
                        <span className="text-sm font-medium">AI Advisor</span>
                      </div>
                      <p className="text-sm">
                        I've analyzed your country's performance data. Would you like me to explain the economic growth recommendations in more detail, or shall we explore policy alternatives?
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <button className="w-full p-3 text-left border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="text-sm font-medium">Explain economic recommendations</div>
                        <div className="text-xs text-muted-foreground">Get detailed analysis of growth strategies</div>
                      </button>
                      
                      <button className="w-full p-3 text-left border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="text-sm font-medium">Compare with similar countries</div>
                        <div className="text-xs text-muted-foreground">Benchmark against peer nations</div>
                      </button>
                      
                      <button className="w-full p-3 text-left border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="text-sm font-medium">Simulate policy changes</div>
                        <div className="text-xs text-muted-foreground">Model potential outcomes</div>
                      </button>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <div className="flex gap-2">
                        <input 
                          placeholder="Ask AI Advisor anything..."
                          className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
                        />
                        <button className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </GlassCard>
            </div>
            
            <GlassCard>
              <CardHeader>
                <CardTitle>AI Analytics Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600 mb-1">23</div>
                    <div className="text-sm text-muted-foreground">Active Insights</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Brain className="h-3 w-3 text-blue-600" />
                      <span className="text-xs text-blue-600">Generated today</span>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600 mb-1">89%</div>
                    <div className="text-sm text-muted-foreground">Prediction Accuracy</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span className="text-xs text-green-600">Last 30 days</span>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600 mb-1">7</div>
                    <div className="text-sm text-muted-foreground">Recommendations</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3 text-purple-600" />
                      <span className="text-xs text-purple-600">Pending review</span>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-600 mb-1">342</div>
                    <div className="text-sm text-muted-foreground">Data Points</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Database className="h-3 w-3 text-orange-600" />
                      <span className="text-xs text-orange-600">Analyzed hourly</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}