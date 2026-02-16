"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import { useState } from "react";
import { StrategicPlanningModal } from "~/components/modals/StrategicPlanningModal";
import { MeetingScheduler } from "~/components/quickactions/MeetingScheduler";
import { PolicyCreator } from "~/components/quickactions/PolicyCreator";
import { SectionHelpIcon } from "~/components/ui/help-icon";

interface ExecutiveOverviewProps {
  countryId: string;
  onTabChange?: (tab: string) => void;
}

export function ExecutiveOverview({ countryId, onTabChange }: ExecutiveOverviewProps) {
  const [strategyModalOpen, setStrategyModalOpen] = useState(false);
  const [meetingSchedulerOpen, setMeetingSchedulerOpen] = useState(false);
  const [policyCreatorOpen, setPolicyCreatorOpen] = useState(false);

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
      <div className="space-y-4">
        {/* Executive Metrics Strip */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {executiveMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className={`glass-hierarchy-child rounded-lg p-2.5 ${metric.bgColor}`}>
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${metric.color}`} />
                  <span className="text-muted-foreground text-xs font-medium">{metric.label}</span>
                </div>
                <div className="mt-0.5 text-lg font-bold">{metric.value}</div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setMeetingSchedulerOpen(true)}
          >
            <Calendar className="h-3.5 w-3.5" />
            Schedule Meeting
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setPolicyCreatorOpen(true)}
          >
            <FileText className="h-3.5 w-3.5" />
            Create Policy
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setStrategyModalOpen(true)}
          >
            <Target className="h-3.5 w-3.5" />
            Strategic Planning
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onTabChange?.("decisions")}
          >
            <Layers className="h-3.5 w-3.5" />
            Record Decision
          </Button>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Upcoming Meetings */}
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
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
                      className="border-border/40 bg-muted/40 rounded-lg border p-3 transition-all hover:shadow-sm"
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
                <div className="text-muted-foreground py-6 text-center">
                  <Calendar className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
                  <p className="text-sm">No upcoming meetings scheduled</p>
                  <p className="text-muted-foreground/80 mt-1 text-xs">Schedule a meeting to coordinate executive decisions</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Policies */}
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600" />
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
                      className="border-border/40 bg-muted/40 rounded-lg border p-3 transition-all hover:shadow-sm"
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
                <div className="text-muted-foreground py-6 text-center">
                  <FileText className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
                  <p className="text-sm">No active policies</p>
                  <p className="text-muted-foreground/80 mt-1 text-xs">Create a policy to shape your nation&apos;s governance</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Executive Summary */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold">Executive Summary</h3>
            <SectionHelpIcon
              title="Executive Summary"
              content="High-level overview of your executive operations. This section highlights important items requiring attention, such as pending decisions from completed meetings, and provides a snapshot of your executive system's health."
            />
          </div>

          {pendingDecisions > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    {pendingDecisions} meeting{pendingDecisions !== 1 ? "s" : ""} awaiting
                    decisions
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Review completed meetings and record executive decisions and action items
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/20">
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Executive operations running smoothly
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  All executive systems are operational and functioning as expected
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Planning Modal */}
      <StrategicPlanningModal
        isOpen={strategyModalOpen}
        onClose={() => setStrategyModalOpen(false)}
        countryId={countryId}
        countryName={country?.name || "Your Country"}
      />

      {/* Meeting Scheduler Modal */}
      <MeetingScheduler
        countryId={countryId}
        open={meetingSchedulerOpen}
        onOpenChange={setMeetingSchedulerOpen}
      />

      {/* Policy Creator Modal */}
      <PolicyCreator
        countryId={countryId}
        open={policyCreatorOpen}
        onOpenChange={setPolicyCreatorOpen}
      />
    </>
  );
}
