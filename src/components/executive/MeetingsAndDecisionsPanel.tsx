"use client";

import { useState, useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Calendar,
  Plus,
  Clock,
  Layers,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Users,
} from "lucide-react";
import { api } from "~/trpc/react";
import { MeetingScheduler } from "~/components/quickactions/MeetingScheduler";
import { IxTimeDate } from "~/components/ui/ix-time-date";
import { ExecutiveItemCard } from "./ExecutiveItemCard";

interface MeetingsAndDecisionsPanelProps {
  countryId: string;
}

export function MeetingsAndDecisionsPanel({ countryId }: MeetingsAndDecisionsPanelProps) {
  const [meetingSchedulerOpen, setMeetingSchedulerOpen] = useState(false);
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());
  const [showPast, setShowPast] = useState(false);
  const { data: meetings = [], refetch: refetchMeetings } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    return {
      upcoming: meetings
        .filter((m: any) => new Date(m.scheduledDate) >= now && m.status === "scheduled")
        .sort(
          (a: any, b: any) =>
            new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
        ),
      past: meetings
        .filter(
          (m: any) =>
            m.status === "completed" ||
            (new Date(m.scheduledDate) < now && m.status === "scheduled")
        )
        .sort(
          (a: any, b: any) =>
            new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
        ),
    };
  }, [meetings]);

  // Extract action items requiring attention
  const actionItems = useMemo(() => {
    const actions: any[] = [];
    const now = new Date();
    meetings.forEach((meeting: any) => {
      if (meeting.actionItems) {
        meeting.actionItems.forEach((action: any) => {
          const isOverdue =
            action.dueDate && new Date(action.dueDate) < now && action.status !== "completed";
          actions.push({ ...action, meetingTitle: meeting.title, isOverdue });
        });
      }
    });
    return {
      attention: actions
        .filter((a) => a.isOverdue || a.status === "pending" || a.status === "in_progress")
        .sort((a, b) => (a.isOverdue ? -1 : 0) - (b.isOverdue ? -1 : 0)),
    };
  }, [meetings]);

  const toggleMeeting = (id: string) => {
    setExpandedMeetings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return {
          label: "COMPLETED",
          colorClass: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
        };
      case "cancelled":
        return {
          label: "CANCELLED",
          colorClass: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
        };
      case "in_progress":
        return {
          label: "IN PROGRESS",
          colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
        };
      default:
        return {
          label: "SCHEDULED",
          colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
        };
    }
  };

  return (
    <>
      <MeetingScheduler
        countryId={countryId}
        open={meetingSchedulerOpen}
        onOpenChange={(open) => {
          setMeetingSchedulerOpen(open);
          if (!open) void refetchMeetings();
        }}
      />

      <div className="mt-3 space-y-3">
        {/* Overdue Alert */}
        {actionItems.attention.filter((a) => a.isOverdue).length > 0 && (
          <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-800 dark:bg-red-950/20">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <div>
              <p className="text-xs font-medium text-red-900 dark:text-red-100">
                {actionItems.attention.filter((a) => a.isOverdue).length} overdue action item
                {actionItems.attention.filter((a) => a.isOverdue).length !== 1 ? "s" : ""} require
                attention
              </p>
            </div>
          </div>
        )}

        {/* Upcoming Meetings */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Upcoming Meetings
            </h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMeetingSchedulerOpen(true)}
              className="h-6 gap-1 px-2 text-xs"
            >
              <Plus className="h-3 w-3" /> Schedule
            </Button>
          </div>
          {upcoming.length > 0 ? (
            <div className="space-y-2">
              {upcoming.slice(0, 5).map((meeting: any) => (
                <ExecutiveItemCard
                  key={meeting.id}
                  accentColor="blue"
                  icon={Calendar}
                  title={meeting.title}
                  subtitle={
                    <span className="flex flex-wrap items-center gap-1.5">
                      <IxTimeDate
                        date={meeting.scheduledDate}
                        ixTime={meeting.scheduledIxTime}
                        format="datetime"
                        accentColor="amber"
                      />
                      <span className="text-muted-foreground">•</span>
                      <span>{meeting.duration ?? 60} min</span>
                    </span>
                  }
                  badges={[getStatusBadge(meeting.status)]}
                  isLocal={meeting._isLocal}
                  metrics={[
                    ...(meeting.attendances?.length > 0
                      ? [{ icon: Users, label: "Attendees", value: meeting.attendances.length }]
                      : []),
                    ...(meeting.decisions?.length > 0
                      ? [{ icon: Layers, label: "Decisions", value: meeting.decisions.length }]
                      : []),
                    ...(meeting.actionItems?.length > 0
                      ? [
                          {
                            icon: AlertTriangle,
                            label: "Actions",
                            value: meeting.actionItems.length,
                          },
                        ]
                      : []),
                  ]}
                />
              ))}
              {upcoming.length > 5 && (
                <p className="text-muted-foreground pt-1 text-center text-xs">
                  +{upcoming.length - 5} more upcoming
                </p>
              )}
            </div>
          ) : (
            <div className="border-border/50 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
              <Calendar className="text-muted-foreground/50 h-6 w-6" />
              <p className="text-muted-foreground text-xs">No upcoming meetings</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMeetingSchedulerOpen(true)}
                className="h-7 gap-1.5 text-xs"
              >
                <Plus className="h-3 w-3" /> Schedule first meeting
              </Button>
            </div>
          )}
        </div>

        {/* Action Items Requiring Attention */}
        {actionItems.attention.length > 0 && (
          <div>
            <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
              Action Items
            </h4>
            <div className="space-y-2">
              {actionItems.attention.slice(0, 5).map((action: any) => (
                <ExecutiveItemCard
                  key={action.id}
                  accentColor={
                    action.isOverdue ? "red" : action.status === "in_progress" ? "blue" : "amber"
                  }
                  icon={
                    action.isOverdue
                      ? AlertTriangle
                      : action.status === "in_progress"
                        ? Clock
                        : Layers
                  }
                  title={action.title}
                  subtitle={
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span>From: {action.meetingTitle}</span>
                      {action.dueDate && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span className={action.isOverdue ? "font-medium text-red-600" : ""}>
                            Due: <IxTimeDate date={action.dueDate} accentColor="amber" />
                          </span>
                        </>
                      )}
                    </span>
                  }
                  badges={[
                    ...(action.isOverdue
                      ? [
                          {
                            label: "OVERDUE",
                            colorClass:
                              "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
                          },
                        ]
                      : []),
                    {
                      label: action.status === "in_progress" ? "IN PROGRESS" : "PENDING",
                      colorClass:
                        action.status === "in_progress"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
                    },
                  ]}
                />
              ))}
              {actionItems.attention.length > 5 && (
                <p className="text-muted-foreground pt-1 text-center text-xs">
                  +{actionItems.attention.length - 5} more items
                </p>
              )}
            </div>
          </div>
        )}

        {/* Past Meetings (collapsed by default) */}
        {past.length > 0 && (
          <div>
            <button
              onClick={() => setShowPast(!showPast)}
              className="text-muted-foreground hover:text-foreground mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider uppercase transition-colors"
            >
              {showPast ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Past Meetings
              <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                {past.length}
              </Badge>
            </button>
            {showPast && (
              <div className="space-y-2">
                {past.slice(0, 5).map((meeting: any) => {
                  const isExpanded = expandedMeetings.has(meeting.id);
                  const hasDetails =
                    (meeting.decisions?.length ?? 0) > 0 || (meeting.actionItems?.length ?? 0) > 0;

                  return (
                    <ExecutiveItemCard
                      key={meeting.id}
                      accentColor="green"
                      icon={CheckCircle}
                      title={meeting.title}
                      subtitle={
                        <IxTimeDate
                          date={meeting.scheduledDate}
                          ixTime={meeting.scheduledIxTime}
                          format="datetime"
                          accentColor="amber"
                        />
                      }
                      badges={[getStatusBadge(meeting.status)]}
                      isLocal={meeting._isLocal}
                      onClick={hasDetails ? () => toggleMeeting(meeting.id) : undefined}
                      metrics={[
                        ...(meeting.decisions?.length > 0
                          ? [{ icon: Layers, label: "Decisions", value: meeting.decisions.length }]
                          : []),
                        ...(meeting.actionItems?.length > 0
                          ? [
                              {
                                icon: AlertTriangle,
                                label: "Actions",
                                value: meeting.actionItems.length,
                              },
                            ]
                          : []),
                      ]}
                    >
                      {/* Expanded decisions/actions */}
                      {isExpanded && hasDetails && (
                        <div className="border-border/40 mt-2.5 space-y-2 border-t pt-2">
                          {meeting.decisions?.map((d: any) => (
                            <div
                              key={d.id}
                              className="bg-muted/50 rounded-md px-2.5 py-1.5 text-xs"
                            >
                              <span className="font-medium">{d.title}</span>
                              {d.description && (
                                <span className="text-muted-foreground ml-1">
                                  — {d.description}
                                </span>
                              )}
                            </div>
                          ))}
                          {meeting.actionItems?.map((a: any) => {
                            const isOverdue =
                              a.dueDate &&
                              new Date(a.dueDate) < new Date() &&
                              a.status !== "completed";
                            return (
                              <div
                                key={a.id}
                                className={`bg-muted/50 flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs ${isOverdue ? "border border-red-200 dark:border-red-800" : ""}`}
                              >
                                <span className="font-medium">{a.title}</span>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  {isOverdue && (
                                    <Badge variant="destructive" className="px-1 py-0 text-[9px]">
                                      OVERDUE
                                    </Badge>
                                  )}
                                  <Badge
                                    variant="secondary"
                                    className={`px-1 py-0 text-[9px] ${
                                      a.status === "completed"
                                        ? "bg-green-100 text-green-700 dark:bg-green-950/30"
                                        : a.status === "in_progress"
                                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/30"
                                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30"
                                    }`}
                                  >
                                    {a.status === "completed"
                                      ? "DONE"
                                      : a.status === "in_progress"
                                        ? "IN PROGRESS"
                                        : "PENDING"}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </ExecutiveItemCard>
                  );
                })}
                {past.length > 5 && (
                  <p className="text-muted-foreground pt-1 text-center text-xs">
                    Showing 5 of {past.length} past meetings
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
