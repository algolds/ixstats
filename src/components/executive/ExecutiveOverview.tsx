"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Calendar,
  FileText,
  Target,
  Layers,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StrategicPlanningModal } from "~/components/modals/StrategicPlanningModal";
import { SectionHelpIcon } from "~/components/ui/help-icon";

interface ExecutiveOverviewProps {
  countryId: string;
}

export function ExecutiveOverview({ countryId }: ExecutiveOverviewProps) {
  const router = useRouter();
  const [strategyModalOpen, setStrategyModalOpen] = useState(false);

  // Fetch country data
  const { data: country } = api.countries.getByIdBasic.useQuery(
    { id: countryId },
    { enabled: !!countryId }
  );

  // Fetch recent meetings
  const { data: meetings = [] } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Fetch recent policies
  const { data: policies = [] } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Get upcoming meetings (next 5)
  const upcomingMeetings = meetings
    .filter((m: any) => m.status === "SCHEDULED" || m.status === "scheduled")
    .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
    .slice(0, 5);

  // Get active policies (last 5)
  const activePolicies = policies
    .filter((p: any) => p.status === "active")
    .sort((a: any, b: any) => new Date(b.createdAt ?? b.effectiveDate).getTime() - new Date(a.createdAt ?? a.effectiveDate).getTime())
    .slice(0, 5);

  // Get pending decisions from meetings
  const pendingDecisions = meetings
    .filter((m: any) => m.status === "COMPLETED" && (!m.decisions || m.decisions.length === 0))
    .length;

  const executiveMetrics = [
    {
      label: "Upcoming Meetings",
      value: upcomingMeetings.length,
      icon: Calendar,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
    },
    {
      label: "Active Policies",
      value: activePolicies.length,
      icon: FileText,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
    },
    {
      label: "Pending Decisions",
      value: pendingDecisions,
      icon: AlertCircle,
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
    },
    {
      label: "Strategic Plans",
      value: 0, // TODO: Connect to strategic planning system
      icon: Target,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
    },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Executive Metrics Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {executiveMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.label} className="glass-hierarchy-child">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-muted-foreground text-sm font-medium">{metric.label}</p>
                      <p className="mt-2 text-3xl font-bold">{metric.value}</p>
                    </div>
                    <div className={`rounded-lg p-3 ${metric.bgColor}`}>
                      <Icon className={`h-6 w-6 ${metric.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center">
              Quick Actions
              <SectionHelpIcon
                title="Quick Actions"
                content="Fast access to common executive tasks. Use these shortcuts to quickly schedule meetings, create policies, plan strategically, or record important decisions without navigating through multiple tabs."
              />
            </CardTitle>
            <CardDescription>Common executive tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => router.push("/mycountry/executive?tab=meetings")}
              >
                <Calendar className="h-4 w-4" />
                Schedule Meeting
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => router.push("/mycountry/executive?tab=policies")}
              >
                <FileText className="h-4 w-4" />
                Create Policy
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => setStrategyModalOpen(true)}
              >
                <Target className="h-4 w-4" />
                Strategic Planning
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => router.push("/mycountry/executive?tab=decisions")}
              >
                <Layers className="h-4 w-4" />
                Record Decision
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Upcoming Meetings */}
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Upcoming Meetings
                  <SectionHelpIcon
                    title="Upcoming Meetings"
                    content="Your next scheduled executive meetings. Meetings are opportunities to discuss strategy, review progress, and make collective decisions. Click 'Schedule Meeting' to create new meetings with specific agendas and attendees."
                  />
                </CardTitle>
                <Badge variant="secondary">{upcomingMeetings.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingMeetings.length > 0 ? (
                <div className="space-y-3">
                  {upcomingMeetings.map((meeting: any) => (
                    <div
                      key={meeting.id}
                      className="border-border/40 bg-muted/40 rounded-lg border p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{meeting.title}</p>
                          <p className="text-muted-foreground text-sm">
                            {new Date(meeting.scheduledDate).toLocaleDateString()} at{" "}
                            {new Date(meeting.scheduledDate).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <Clock className="text-muted-foreground h-4 w-4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  No upcoming meetings scheduled
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Policies */}
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  Active Policies
                  <SectionHelpIcon
                    title="Active Policies"
                    content="Currently active executive policies. Policies represent official decisions and guidelines that shape your nation's governance. They can affect economic growth, social welfare, diplomatic relations, and more. Create new policies through the Policies tab to implement changes across your country."
                  />
                </CardTitle>
                <Badge variant="secondary">{activePolicies.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {activePolicies.length > 0 ? (
                <div className="space-y-3">
                  {activePolicies.map((policy: any) => (
                    <div
                      key={policy.id}
                      className="border-border/40 bg-muted/40 rounded-lg border p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{policy.title}</p>
                          <p className="text-muted-foreground text-sm">
                            {policy.category?.toUpperCase() || "GENERAL"}
                          </p>
                        </div>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  No active policies
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Executive Summary */}
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Executive Summary
              <SectionHelpIcon
                title="Executive Summary"
                content="High-level overview of your executive operations. This section highlights important items requiring attention, such as pending decisions from completed meetings, and provides a snapshot of your executive system's health."
              />
            </CardTitle>
            <CardDescription>Key insights and recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingDecisions > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-900 dark:text-amber-100">
                        {pendingDecisions} meeting{pendingDecisions !== 1 ? "s" : ""} awaiting
                        decisions
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Review completed meetings and record executive decisions and action items
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      Executive operations running smoothly
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      All executive systems are operational and functioning as expected
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Strategic Planning Modal */}
      <StrategicPlanningModal
        isOpen={strategyModalOpen}
        onClose={() => setStrategyModalOpen(false)}
        countryId={countryId}
        countryName={country?.name || "Your Country"}
      />
    </>
  );
}
