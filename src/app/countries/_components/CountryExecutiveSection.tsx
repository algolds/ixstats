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
  Clock,
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

  // Get unified intelligence data for this country
  const { data: cabinetMeetings, isLoading: meetingsLoading } =
    api.unifiedIntelligence.getCabinetMeetings.useQuery(
      { countryId: countryId },
      { enabled: !!countryId }
    );
  const { data: economicPolicies, isLoading: policiesLoading } =
    api.unifiedIntelligence.getEconomicPolicies.useQuery(
      { countryId: countryId },
      { enabled: !!countryId }
    );
  const { data: strategicPlans, isLoading: plansLoading } =
    api.unifiedIntelligence.getStrategicPlans.useQuery(
      { countryId: countryId },
      { enabled: !!countryId }
    );
  const { data: securityThreats, isLoading: threatsLoading } =
    api.unifiedIntelligence.getSecurityThreats.useQuery(
      { countryId: countryId },
      { enabled: !!countryId }
    );
  const { data: realTimeMetrics, isLoading: metricsLoading } =
    api.unifiedIntelligence.getRealTimeMetrics.useQuery(
      { countryId: countryId },
      { enabled: !!countryId }
    );
  const { data: aiRecommendations, isLoading: aiLoading } =
    api.unifiedIntelligence.getAIRecommendations.useQuery(
      { countryId: countryId },
      { enabled: !!countryId }
    );

  const isLoading =
    meetingsLoading ||
    policiesLoading ||
    plansLoading ||
    threatsLoading ||
    metricsLoading ||
    aiLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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

  const upcomingMeetings =
    cabinetMeetings
      ?.filter(
        (meeting: CabinetMeeting) =>
          new Date(meeting.scheduledDate) > new Date() && meeting.status === "scheduled"
      )
      .slice(0, 3) || [];

  const activePolicies =
    economicPolicies
      ?.filter((policy: any) => policy.status === "approved" || policy.status === "implemented")
      .slice(0, 3) || [];

  const activePlans =
    strategicPlans?.filter((plan: any) => plan.status === "active").slice(0, 3) || [];

  const activeThreats =
    securityThreats?.filter((threat: any) => threat.status === "active").slice(0, 3) || [];

  const highPriorityRecommendations =
    aiRecommendations?.filter((rec: any) => rec.priority === "high").slice(0, 3) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Executive Command Center</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                  <div
                    key={meeting.id}
                    className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/20"
                  >
                    <h4 className="mb-1 font-semibold text-blue-900 dark:text-blue-300">
                      {(meeting as any).title || "Cabinet Meeting"}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400">
                      <Clock className="h-4 w-4" />
                      {new Date(meeting.scheduledDate).toLocaleString()}
                    </div>
                    {(meeting as any).agenda && (meeting as any).agenda.length > 0 && (
                      <p className="mt-1 text-xs text-blue-600 dark:text-blue-500">
                        {(meeting as any).agenda.length} agenda items
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" />
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
                  <div
                    key={policy.id}
                    className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/20"
                  >
                    <div className="mb-1 flex items-start justify-between">
                      <h4 className="font-semibold text-green-900 dark:text-green-300">
                        {policy.title || "Economic Policy"}
                      </h4>
                      <Badge variant="outline" className="border-green-400 text-green-700">
                        {policy.category || "General"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      {policy.status || "Active"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
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
                  <div
                    key={plan.id}
                    className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950/20"
                  >
                    <div className="mb-1 flex items-start justify-between">
                      <h4 className="font-semibold text-purple-900 dark:text-purple-300">
                        {plan.title || "Strategic Plan"}
                      </h4>
                      <Badge
                        variant="outline"
                        className={
                          plan.priority === "critical"
                            ? "border-red-400 text-red-700"
                            : plan.priority === "high"
                              ? "border-orange-400 text-orange-700"
                              : plan.priority === "medium"
                                ? "border-yellow-400 text-yellow-700"
                                : "border-green-400 text-green-700"
                        }
                      >
                        {plan.priority || "medium"}
                      </Badge>
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-400">
                      {(plan.timeframe || "ongoing").replace("_", " ")} •{" "}
                      {plan.objectives?.length || 0} objectives
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <Target className="mx-auto mb-4 h-12 w-12 opacity-50" />
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
                  <div
                    key={threat.id}
                    className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/20"
                  >
                    <div className="mb-1 flex items-start justify-between">
                      <h4 className="font-semibold text-red-900 dark:text-red-300">
                        {threat.title || "Security Threat"}
                      </h4>
                      <Badge
                        variant="destructive"
                        className={
                          threat.severity === "critical"
                            ? "bg-red-600"
                            : threat.severity === "high"
                              ? "bg-orange-600"
                              : threat.severity === "medium"
                                ? "bg-yellow-600"
                                : "bg-blue-600"
                        }
                      >
                        {threat.severity || "medium"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      {threat.category || "General"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <Shield className="mx-auto mb-4 h-12 w-12 text-green-500 opacity-50" />
                <p className="text-sm text-green-600">No active threats</p>
                <p className="text-muted-foreground text-xs">Security status: Clear</p>
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
                  <div
                    key={rec.id}
                    className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-800 dark:bg-cyan-950/20"
                  >
                    <h4 className="mb-1 font-semibold text-cyan-900 dark:text-cyan-300">
                      {rec.title || "AI Recommendation"}
                    </h4>
                    <p className="mb-2 text-sm text-cyan-700 dark:text-cyan-400">
                      {rec.description || "No description available"}
                    </p>
                    <div className="flex items-center justify-between text-xs text-cyan-600 dark:text-cyan-500">
                      <span>{rec.category || "General"}</span>
                      <Badge variant="outline" className="border-red-400 text-red-700">
                        {rec.priority || "high"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
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
                  className="h-auto w-full justify-start px-3 py-2 text-left transition-all duration-200 hover:scale-105"
                  size="sm"
                >
                  <Calendar className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Schedule Meeting</span>
                </Button>
              </CabinetMeetingModal>
              <Button
                variant="outline"
                className="h-auto w-full justify-start px-3 py-2 text-left transition-all duration-200 hover:scale-105"
                size="sm"
                onClick={() => setShowPolicyCreator(true)}
              >
                <FileText className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">Create Policy</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto w-full justify-start px-3 py-2 text-left transition-all duration-200 hover:scale-105"
                size="sm"
                onClick={() => setShowDefenseModal(true)}
              >
                <Shield className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">Defense & Security</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto w-full justify-start px-3 py-2 text-left transition-all duration-200 hover:scale-105"
                size="sm"
                onClick={() => window.open("/eci", "_blank")}
              >
                <Target className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">Strategic Plan</span>
              </Button>
              <TrendRiskAnalyticsModal countryId={countryId}>
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start px-3 py-2 text-left transition-all duration-200 hover:scale-105"
                  size="sm"
                >
                  <TrendingUp className="mr-2 h-4 w-4 flex-shrink-0" />
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
          This is your executive command summary. Use the quick actions above or access the full ECI
          for comprehensive management tools.
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
