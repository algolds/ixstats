"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import { 
  Calendar, 
  FileText, 
  Shield, 
  Target, 
  TrendingUp, 
  Users, 
  ExternalLink,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";

interface CountryExecutiveSectionProps {
  countryId: string;
  userId?: string;
}

export function CountryExecutiveSection({ countryId, userId }: CountryExecutiveSectionProps) {
  // Get ECI data for this country
  const { data: cabinetMeetings, isLoading: meetingsLoading } = api.eci.getCabinetMeetings.useQuery(
    { userId: userId || '' },
    { enabled: !!userId }
  );
  const { data: economicPolicies, isLoading: policiesLoading } = api.eci.getEconomicPolicies.useQuery(
    { userId: userId || '' },
    { enabled: !!userId }
  );
  const { data: strategicPlans, isLoading: plansLoading } = api.eci.getStrategicPlans.useQuery(
    { userId: userId || '' },
    { enabled: !!userId }
  );
  const { data: securityThreats, isLoading: threatsLoading } = api.eci.getSecurityThreats.useQuery(
    { userId: userId || '' },
    { enabled: !!userId }
  );
  const { data: realTimeMetrics, isLoading: metricsLoading } = api.eci.getRealTimeMetrics.useQuery(
    { userId: userId || '' },
    { enabled: !!userId }
  );
  const { data: aiRecommendations, isLoading: aiLoading } = api.eci.getAIRecommendations.useQuery(
    { userId: userId || '' },
    { enabled: !!userId }
  );

  const isLoading = meetingsLoading || policiesLoading || plansLoading || threatsLoading || metricsLoading || aiLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const upcomingMeetings = cabinetMeetings?.filter((meeting: any) => 
    new Date(meeting.scheduledDate) > new Date() && meeting.status === 'scheduled'
  ).slice(0, 3) || [];

  const activePolicies = economicPolicies?.filter((policy: any) => 
    policy.status === 'approved' || policy.status === 'implemented'
  ).slice(0, 3) || [];

  const activePlans = strategicPlans?.filter((plan: any) => 
    plan.status === 'active'
  ).slice(0, 3) || [];

  const activeThreats = securityThreats?.filter((threat: any) => 
    threat.status === 'active'
  ).slice(0, 3) || [];

  const highPriorityRecommendations = aiRecommendations?.filter((rec: any) => 
    rec.priority === 'high'
  ).slice(0, 3) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Executive Command Center</h2>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.open('/eci', '_blank')}
        >
          <Activity className="h-4 w-4 mr-2" />
          Open Full ECI
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Real-time Metrics Overview */}
      {realTimeMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              National Performance Metrics
            </CardTitle>
            <CardDescription>Real-time assessment of national health indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="mb-2">
                  <span className="text-2xl font-bold text-purple-600">{realTimeMetrics.social}</span>
                  <span className="text-sm text-muted-foreground ml-1">/100</span>
                </div>
                <Progress value={realTimeMetrics.social} className="mb-2" />
                <p className="text-sm font-medium">Social Harmony</p>
              </div>
              <div className="text-center">
                <div className="mb-2">
                  <span className="text-2xl font-bold text-blue-600">{realTimeMetrics.security}</span>
                  <span className="text-sm text-muted-foreground ml-1">/100</span>
                </div>
                <Progress value={realTimeMetrics.security} className="mb-2" />
                <p className="text-sm font-medium">Security Index</p>
              </div>
              <div className="text-center">
                <div className="mb-2">
                  <span className="text-2xl font-bold text-green-600">{realTimeMetrics.political}</span>
                  <span className="text-sm text-muted-foreground ml-1">/100</span>
                </div>
                <Progress value={realTimeMetrics.political} className="mb-2" />
                <p className="text-sm font-medium">Political Stability</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Upcoming Cabinet Meetings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Upcoming Meetings
            </CardTitle>
            <CardDescription>Scheduled cabinet meetings</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingMeetings.length > 0 ? (
              <div className="space-y-3">
                {upcomingMeetings.map((meeting: any) => (
                  <div key={meeting.id} className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">{meeting.title}</h4>
                    <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400">
                      <Clock className="h-4 w-4" />
                      {new Date(meeting.scheduledDate).toLocaleString()}
                    </div>
                    {meeting.agenda && meeting.agenda.length > 0 && (
                      <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                        {meeting.agenda.length} agenda items
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No upcoming meetings</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Economic Policies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-500" />
              Active Policies
            </CardTitle>
            <CardDescription>Current economic policies</CardDescription>
          </CardHeader>
          <CardContent>
            {activePolicies.length > 0 ? (
              <div className="space-y-3">
                {activePolicies.map((policy: any) => (
                  <div key={policy.id} className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-green-900 dark:text-green-300">{policy.title}</h4>
                      <Badge 
                        variant="outline" 
                        className="text-green-700 border-green-400"
                      >
                        {policy.category}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      {policy.status}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No active policies</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Strategic Plans */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-500" />
              Strategic Plans
            </CardTitle>
            <CardDescription>Active strategic initiatives</CardDescription>
          </CardHeader>
          <CardContent>
            {activePlans.length > 0 ? (
              <div className="space-y-3">
                {activePlans.map((plan: any) => (
                  <div key={plan.id} className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-purple-900 dark:text-purple-300">{plan.title}</h4>
                      <Badge 
                        variant="outline" 
                        className={
                          plan.priority === 'critical' ? 'text-red-700 border-red-400' :
                          plan.priority === 'high' ? 'text-orange-700 border-orange-400' :
                          plan.priority === 'medium' ? 'text-yellow-700 border-yellow-400' :
                          'text-green-700 border-green-400'
                        }
                      >
                        {plan.priority}
                      </Badge>
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-400">
                      {plan.timeframe.replace('_', ' ')} • {plan.objectives?.length || 0} objectives
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No active strategic plans</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Threats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              Security Status
            </CardTitle>
            <CardDescription>Active security threats</CardDescription>
          </CardHeader>
          <CardContent>
            {activeThreats.length > 0 ? (
              <div className="space-y-3">
                {activeThreats.map((threat: any) => (
                  <div key={threat.id} className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-red-900 dark:text-red-300">{threat.title}</h4>
                      <Badge 
                        variant="destructive"
                        className={
                          threat.severity === 'critical' ? 'bg-red-600' :
                          threat.severity === 'high' ? 'bg-orange-600' :
                          threat.severity === 'medium' ? 'bg-yellow-600' : 'bg-blue-600'
                        }
                      >
                        {threat.severity}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      {threat.category}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                <p className="text-sm text-green-600">No active threats</p>
                <p className="text-xs text-muted-foreground">Security status: Clear</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-500" />
              AI Recommendations
            </CardTitle>
            <CardDescription>High priority suggestions</CardDescription>
          </CardHeader>
          <CardContent>
            {highPriorityRecommendations.length > 0 ? (
              <div className="space-y-3">
                {highPriorityRecommendations.map((rec: any) => (
                  <div key={rec.id} className="p-3 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
                    <h4 className="font-semibold text-cyan-900 dark:text-cyan-300 mb-1">{rec.title}</h4>
                    <p className="text-sm text-cyan-700 dark:text-cyan-400 mb-2">{rec.description}</p>
                    <div className="flex justify-between items-center text-xs text-cyan-600 dark:text-cyan-500">
                      <span>{rec.category}</span>
                      <Badge variant="outline" className="text-red-700 border-red-400">
                        {rec.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No high priority recommendations</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common executive tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                size="sm"
                onClick={() => window.open('/eci', '_blank')}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Cabinet Meeting
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                size="sm"
                onClick={() => window.open('/eci', '_blank')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Create Economic Policy
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                size="sm"
                onClick={() => window.open('/eci', '_blank')}
              >
                <Target className="h-4 w-4 mr-2" />
                New Strategic Plan
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                size="sm"
                onClick={() => window.open('/eci', '_blank')}
              >
                <Activity className="h-4 w-4 mr-2" />
                View Full Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertDescription>
          This is your executive command summary. For comprehensive management tools, detailed analytics, and full functionality, visit the{" "}
          <Button variant="link" className="p-0 h-auto" onClick={() => window.open('/eci', '_blank')}>
            Executive Command Interface (ECI) →
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}