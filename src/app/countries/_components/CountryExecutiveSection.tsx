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
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { CabinetMeetingModal } from "~/components/modals/CabinetMeetingModal";
import { PolicyCreator } from "~/components/quickactions/PolicyCreator";
import { DefenseModal } from "~/components/quickactions/DefenseModal";
import { TrendRiskAnalyticsModal } from "~/components/modals/TrendRiskAnalyticsModal";

interface CountryExecutiveSectionProps {
  countryId: string;
  userId?: string;
}

interface CabinetMeeting {
  id: string;
  scheduledDate: string;
  status: string;
  // Add other fields as needed
}

export function CountryExecutiveSection({ countryId, userId }: CountryExecutiveSectionProps) {
  const [showPolicyCreator, setShowPolicyCreator] = React.useState(false);
  const [showDefenseModal, setShowDefenseModal] = React.useState(false);

  // Get ECI data for this country
  const { data: cabinetMeetings, isLoading: meetingsLoading } = api.eci.getCabinetMeetings.useQuery(
    { userId: userId || 'disabled' },
    { enabled: !!userId }
  );
  const { data: economicPolicies, isLoading: policiesLoading } = api.eci.getEconomicPolicies.useQuery(
    { userId: userId || 'disabled' },
    { enabled: !!userId }
  );
  const { data: strategicPlans, isLoading: plansLoading } = api.eci.getStrategicPlans.useQuery(
    { userId: userId || 'disabled' },
    { enabled: !!userId }
  );
  const { data: securityThreats, isLoading: threatsLoading } = api.eci.getSecurityThreats.useQuery(
    { userId: userId || 'disabled' },
    { enabled: !!userId }
  );
  const { data: realTimeMetrics, isLoading: metricsLoading } = api.eci.getRealTimeMetrics.useQuery(
    { userId: userId || 'disabled' },
    { enabled: !!userId }
  );
  const { data: aiRecommendations, isLoading: aiLoading } = api.eci.getAIRecommendations.useQuery(
    { userId: userId || 'disabled' },
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

  const upcomingMeetings = cabinetMeetings?.filter((meeting: CabinetMeeting) => 
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Upcoming Cabinet Meetings */}
        <Card className="glass-surface glass-refraction glass-interactive hover:glass-depth-2">
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
                {upcomingMeetings.map((meeting: CabinetMeeting) => (
                  <div key={meeting.id} className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">{(meeting as any).title || 'Cabinet Meeting'}</h4>
                    <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400">
                      <Clock className="h-4 w-4" />
                      {new Date(meeting.scheduledDate).toLocaleString()}
                    </div>
                    {(meeting as any).agenda && (meeting as any).agenda.length > 0 && (
                      <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                        {(meeting as any).agenda.length} agenda items
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
        <Card className="glass-surface glass-refraction glass-interactive hover:glass-depth-2">
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
                      <h4 className="font-semibold text-green-900 dark:text-green-300">{policy.title || 'Economic Policy'}</h4>
                      <Badge 
                        variant="outline" 
                        className="text-green-700 border-green-400"
                      >
                        {policy.category || 'General'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      {policy.status || 'Active'}
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
        <Card className="glass-surface glass-refraction glass-interactive hover:glass-depth-2">
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
                      <h4 className="font-semibold text-purple-900 dark:text-purple-300">{plan.title || 'Strategic Plan'}</h4>
                      <Badge 
                        variant="outline" 
                        className={
                          plan.priority === 'critical' ? 'text-red-700 border-red-400' :
                          plan.priority === 'high' ? 'text-orange-700 border-orange-400' :
                          plan.priority === 'medium' ? 'text-yellow-700 border-yellow-400' :
                          'text-green-700 border-green-400'
                        }
                      >
                        {plan.priority || 'medium'}
                      </Badge>
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-400">
                      {(plan.timeframe || 'ongoing').replace('_', ' ')} • {plan.objectives?.length || 0} objectives
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
        <Card className="glass-surface glass-refraction glass-interactive hover:glass-depth-2">
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
                      <h4 className="font-semibold text-red-900 dark:text-red-300">{threat.title || 'Security Threat'}</h4>
                      <Badge 
                        variant="destructive"
                        className={
                          threat.severity === 'critical' ? 'bg-red-600' :
                          threat.severity === 'high' ? 'bg-orange-600' :
                          threat.severity === 'medium' ? 'bg-yellow-600' : 'bg-blue-600'
                        }
                      >
                        {threat.severity || 'medium'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      {threat.category || 'General'}
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
        <Card className="glass-surface glass-refraction glass-interactive hover:glass-depth-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-500" />
              Recommendations
            </CardTitle>
            <CardDescription>High priority suggestions</CardDescription>
          </CardHeader>
          <CardContent>
            {highPriorityRecommendations.length > 0 ? (
              <div className="space-y-3">
                {highPriorityRecommendations.map((rec: any) => (
                  <div key={rec.id} className="p-3 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
                    <h4 className="font-semibold text-cyan-900 dark:text-cyan-300 mb-1">{rec.title || 'AI Recommendation'}</h4>
                    <p className="text-sm text-cyan-700 dark:text-cyan-400 mb-2">{rec.description || 'No description available'}</p>
                    <div className="flex justify-between items-center text-xs text-cyan-600 dark:text-cyan-500">
                      <span>{rec.category || 'General'}</span>
                      <Badge variant="outline" className="text-red-700 border-red-400">
                        {rec.priority || 'high'}
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
        <Card className="glass-surface glass-refraction glass-interactive hover:glass-depth-2">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common executive tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <CabinetMeetingModal>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-2 px-3 hover:scale-105 transition-all duration-200"
                  size="sm"
                >
                  <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Schedule Meeting</span>
                </Button>
              </CabinetMeetingModal>
              <Button
                variant="outline"
                className="w-full justify-start text-left h-auto py-2 px-3 hover:scale-105 transition-all duration-200"
                size="sm"
                onClick={() => setShowPolicyCreator(true)}
              >
                <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Create Policy</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-left h-auto py-2 px-3 hover:scale-105 transition-all duration-200"
                size="sm"
                onClick={() => setShowDefenseModal(true)}
              >
                <Shield className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Defense & Security</span>
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start text-left h-auto py-2 px-3 hover:scale-105 transition-all duration-200" 
                size="sm"
                onClick={() => window.open('/eci', '_blank')}
              >
                <Target className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Strategic Plan</span>
              </Button>
              <TrendRiskAnalyticsModal countryId={countryId}>
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-left h-auto py-2 px-3 hover:scale-105 transition-all duration-200" 
                  size="sm"
                >
                  <TrendingUp className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Analytics</span>
                </Button>
              </TrendRiskAnalyticsModal>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertDescription>
          This is your executive command summary. Use the quick actions above or access the full ECI for comprehensive management tools.
        </AlertDescription>
      </Alert>

      {/* Policy Creator Modal */}
      {userId && (
        <PolicyCreator
          countryId={countryId}
          open={showPolicyCreator}
          onOpenChange={setShowPolicyCreator}
        />
      )}

      {/* Defense Modal */}
      <DefenseModal
        countryId={countryId}
        open={showDefenseModal}
        onOpenChange={setShowDefenseModal}
      />
    </div>
  );
}