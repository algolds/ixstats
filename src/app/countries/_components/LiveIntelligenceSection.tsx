"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { 
  Brain,
  Activity,
  Bell,
  BarChart3,
  Users,
  DollarSign,
  Globe,
  Building2,
  Building,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  Zap,
  Eye,
  Calendar
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { FocusCards, createDefaultFocusCards } from "~/app/mycountry/new/components/FocusCards";
import { HealthRing } from "~/components/ui/health-ring";

interface LiveIntelligenceSectionProps {
  countryId: string;
}

interface IntelligenceBriefing {
  id: string;
  category: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidenceScore: number;
  summary: string;
  details: string[];
  timestamp: number;
  source: string;
}

interface ApiAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  urgent: boolean;
}

interface Notification {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  timestamp: number;
  category: string;
  actionRequired: boolean;
  relatedData?: any;
}

// Helper function to convert API alerts to component Alert type
function convertApiAlert(apiAlert: ApiAlert): Alert {
  return {
    id: apiAlert.id,
    type: apiAlert.type === 'error' ? 'error' : 
          apiAlert.type === 'warning' ? 'warning' :
          apiAlert.type === 'success' ? 'success' : 'info',
    title: apiAlert.title,
    message: apiAlert.message,
    urgent: apiAlert.urgent,
  };
}

export function LiveIntelligenceSection({ countryId }: LiveIntelligenceSectionProps) {
  // Get live intelligence data
  const { data: briefings, isLoading: briefingsLoading } = api.countries.getIntelligenceBriefings.useQuery(
    { countryId, timeframe: 'week' }
  );

  const { data: focusCardsData, isLoading: focusLoading } = api.countries.getFocusCardsData.useQuery(
    { countryId }
  );

  const { data: activityRingsData, isLoading: activityLoading } = api.countries.getActivityRingsData.useQuery(
    { countryId }
  );

  const { data: notifications, isLoading: notificationsLoading } = api.countries.getNotifications.useQuery(
    { countryId, limit: 10 }
  );

  const isLoading = briefingsLoading || focusLoading || activityLoading || notificationsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Transform data for components
  const focusCards = focusCardsData ? createDefaultFocusCards({
    economic: {
      healthScore: focusCardsData.economic.healthScore,
      gdpPerCapita: focusCardsData.economic.gdpPerCapita,
      growthRate: focusCardsData.economic.growthRate,
      economicTier: focusCardsData.economic.economicTier,
      alerts: focusCardsData.economic.alerts.map(convertApiAlert),
    },
    population: {
      healthScore: focusCardsData.population.healthScore,
      population: focusCardsData.population.population,
      growthRate: focusCardsData.population.growthRate,
      populationTier: focusCardsData.population.populationTier,
      alerts: focusCardsData.population.alerts.map(convertApiAlert),
    },
    diplomatic: {
      healthScore: focusCardsData.diplomatic.healthScore,
      allies: focusCardsData.diplomatic.allies,
      reputation: focusCardsData.diplomatic.reputation,
      treaties: focusCardsData.diplomatic.treaties,
      alerts: focusCardsData.diplomatic.alerts.map(convertApiAlert),
    },
    government: {
      healthScore: focusCardsData.government.healthScore,
      approval: focusCardsData.government.approval,
      efficiency: focusCardsData.government.efficiency,
      stability: focusCardsData.government.stability,
      alerts: focusCardsData.government.alerts.map(convertApiAlert),
    },
  }) : [];
  // Create activity data matching the countries/[id] page format
  const activityData = activityRingsData ? [
    {
      label: "Economic Health",
      value: activityRingsData.economicVitality || 0,
      color: "#22c55e",
      icon: DollarSign,
    },
    {
      label: "Population Wellbeing",
      value: activityRingsData.populationWellbeing || 0,
      color: "#3b82f6", 
      icon: Users,
    },
    {
      label: "Diplomatic Standing",
      value: activityRingsData.diplomaticStanding || 0,
      color: "#a855f7",
      icon: Shield,
    },
    {
      label: "Government Efficiency",
      value: activityRingsData.governmentalEfficiency || 0,
      color: "#f97316",
      icon: Building,
    },
  ] : [];

  const highPriorityNotifications = notifications?.notifications?.filter(
    (notif: Notification) => notif.priority === 'high' || notif.priority === 'critical'
  ).slice(0, 5) || [];

  const recentBriefings = briefings?.briefings?.slice(0, 3) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Live Intelligence Dashboard</h2>
        <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
          <Eye className="h-3 w-3 mr-1" />
          LIVE DATA
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="focus" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            Focus Areas
          </TabsTrigger>
          <TabsTrigger value="briefings" className="flex items-center gap-1">
            <Brain className="h-4 w-4" />
            Briefings
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1">
            <Bell className="h-4 w-4" />
            Alerts
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab - Activity Rings */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                National Vitality Rings
              </CardTitle>
              <CardDescription>Real-time assessment of key national performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              {activityData.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {activityData.map((ring, index) => (
                    <div key={index} className="flex flex-col items-center text-center">
                      <HealthRing
                        value={Number(ring.value)}
                        size={80}
                        color={ring.color}
                        className="mb-3"
                      />
                      <div className="flex items-center gap-1 mb-1">
                        <ring.icon className="h-4 w-4" style={{ color: ring.color }} />
                        <span className="font-medium text-sm">{ring.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ring.value.toFixed(1)}% performance
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No activity data available</p>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        {/* Focus Areas Tab - Focus Cards */}
        <TabsContent value="focus" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-500" />
                Strategic Focus Areas
              </CardTitle>
              <CardDescription>Intelligence-driven command center for key national sectors</CardDescription>
            </CardHeader>
            <CardContent>
              {focusCards.length > 0 ? (
                <FocusCards 
                  cards={focusCards}
                  layout="grid"
                  expandable={true}
                  interactive={true}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No focus area data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Intelligence Briefings Tab */}
        <TabsContent value="briefings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-cyan-500" />
                Intelligence Briefings
              </CardTitle>
              <CardDescription>
                 Real-time intelligence analysis for the past {briefings?.timeframe || 'week'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentBriefings.length > 0 ? (
                <div className="space-y-4">
                  {recentBriefings.map((briefing: IntelligenceBriefing) => (
                    <Card key={briefing.id} className="border-l-4 border-l-cyan-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{briefing.title}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {briefing.category}
                              </Badge>
                              <Badge 
                                className={
                                  briefing.priority === 'critical' ? 'bg-red-500' :
                                  briefing.priority === 'high' ? 'bg-orange-500' :
                                  briefing.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                }
                              >
                                {briefing.priority}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                {briefing.confidenceScore}% confidence
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(briefing.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm mb-3">{briefing.summary}</p>
                        {briefing.details.length > 0 && (
                          <div className="space-y-1">
                            {briefing.details.map((detail, i) => (
                              <div key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0 text-green-500" />
                                {detail}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <span className="text-xs text-muted-foreground">Source: {briefing.source}</span>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No intelligence briefings available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* High Priority Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  High Priority Alerts
                </CardTitle>
                <CardDescription>Critical and high-priority notifications requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                {highPriorityNotifications.length > 0 ? (
                  <div className="space-y-3">
                    {highPriorityNotifications.map((notif: Notification) => (
                      <Card key={notif.id} className={`border-l-4 ${
                        notif.priority === 'critical' ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20' :
                        'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20'
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-sm">{notif.title}</h4>
                            <Badge 
                              className={
                                notif.priority === 'critical' ? 'bg-red-500' : 'bg-orange-500'
                              }
                            >
                              {notif.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{notif.message}</p>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{notif.category}</span>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              {new Date(notif.timestamp).toLocaleString()}
                            </div>
                          </div>
                          {notif.actionRequired && (
                            <Button variant="outline" size="sm" className="w-full mt-2 h-6 text-xs">
                              Take Action
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                    <p className="text-sm text-green-600">No high priority alerts</p>
                    <p className="text-xs text-muted-foreground">All systems operating normally</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-blue-500" />
                  Recent Notifications
                </CardTitle>
                <CardDescription>Latest system notifications and updates</CardDescription>
              </CardHeader>
              <CardContent>
                {notifications?.notifications && notifications.notifications.length > 0 ? (
                  <div className="space-y-2">
                    {notifications.notifications.slice(0, 6).map((notif: Notification) => (
                      <div key={notif.id} className="p-3 bg-muted/50 rounded-lg border">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="font-medium text-sm">{notif.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {notif.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{notif.message}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{notif.type}</span>
                          <span>{new Date(notif.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                    {notifications.total > 6 && (
                      <div className="text-center">
                        <Button variant="ghost" size="sm" className="text-xs">
                          View All {notifications.total} Notifications
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No recent notifications</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer with data freshness indicator */}
      <Alert>
        <Zap className="h-4 w-4" />
        <AlertDescription>
          Intelligence data is updated in real-time based on current country statistics and economic indicators.
          Last updated: {briefings?.generatedAt ? new Date(briefings.generatedAt).toLocaleString() : 'Loading...'}
        </AlertDescription>
      </Alert>
    </div>
  );
}