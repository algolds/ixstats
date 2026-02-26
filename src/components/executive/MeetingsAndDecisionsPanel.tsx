"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Calendar,
  Plus,
  Clock,
  Layers,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  HardDrive,
} from "lucide-react";
import { api } from "~/trpc/react";
import { MeetingScheduler } from "~/components/quickactions/MeetingScheduler";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { IxTimeDate } from "~/components/ui/ix-time-date";
import { useLocalActions } from "~/hooks/useLocalActions";

interface MeetingsAndDecisionsPanelProps {
  countryId: string;
}

export function MeetingsAndDecisionsPanel({ countryId }: MeetingsAndDecisionsPanelProps) {
  const [meetingSchedulerOpen, setMeetingSchedulerOpen] = useState(false);
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());
  const { getActions } = useLocalActions(countryId);

  // Single query for all meeting data (previously duplicated between MeetingsPanel and DecisionsPanel)
  const { data: serverMeetings = [], refetch: refetchMeetings } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: !!countryId },
  );

  // Merge server meetings with locally-saved meetings
  const meetings = useMemo(() => {
    const localMeetings = getActions("meeting_scheduled").map((a) => ({
      id: a.id,
      title: a.data.title as string,
      description: a.data.description as string,
      scheduledDate: a.data.scheduledDate as string,
      scheduledIxTime: a.data.scheduledIxTime as number | undefined,
      duration: a.data.duration as number,
      status: "scheduled",
      actionItems: [],
      decisions: [],
      attendances: [],
      _isLocal: true,
    }));
    return [...serverMeetings, ...localMeetings];
  }, [serverMeetings, getActions]);

  // Categorize meetings
  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    return {
      upcoming: meetings
        .filter((m: any) => new Date(m.scheduledDate) >= now && m.status === "scheduled")
        .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()),
      past: meetings
        .filter((m: any) => m.status === "completed" || (new Date(m.scheduledDate) < now && m.status === "scheduled"))
        .sort((a: any, b: any) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()),
    };
  }, [meetings]);

  // Extract and categorize action items from all meetings
  const { pending, inProgress, completed, overdue } = useMemo(() => {
    const actions: any[] = [];
    const now = new Date();

    meetings.forEach((meeting: any) => {
      if (meeting.actionItems) {
        meeting.actionItems.forEach((action: any) => {
          actions.push({ ...action, meetingTitle: meeting.title, meetingDate: meeting.scheduledDate });
        });
      }
    });

    const pendingItems = actions.filter((a: any) => a.status === "pending");
    const inProgressItems = actions.filter((a: any) => a.status === "in_progress");
    const completedItems = actions.filter((a: any) => a.status === "completed");
    const overdueItems = actions.filter(
      (a: any) => a.dueDate && new Date(a.dueDate) < now && a.status !== "completed",
    );

    return {
      pending: pendingItems,
      inProgress: inProgressItems,
      completed: completedItems,
      overdue: overdueItems,
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

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const getStatusBadge = (meeting: any) => {
    const status = meeting.status?.toLowerCase() ?? "scheduled";
    if (status === "completed") {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          COMPLETED
        </Badge>
      );
    }
    if (status === "cancelled") {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          CANCELLED
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        SCHEDULED
      </Badge>
    );
  };

  const getActionStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return (
          <Badge variant="secondary" className="bg-green-50 text-green-700 dark:bg-green-950/20">
            <CheckCircle className="mr-1 h-3 w-3" />
            COMPLETED
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-950/20">
            <Clock className="mr-1 h-3 w-3" />
            IN PROGRESS
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20">
            <AlertTriangle className="mr-1 h-3 w-3" />
            PENDING
          </Badge>
        );
    }
  };

  const MeetingCard = ({ meeting, showDecisions = false }: { meeting: any; showDecisions?: boolean }) => {
    const isExpanded = expandedMeetings.has(meeting.id);
    const meetingDecisions = meeting.decisions ?? [];
    const meetingActions = meeting.actionItems ?? [];
    const hasDetails = showDecisions && (meetingDecisions.length > 0 || meetingActions.length > 0);

    return (
      <div className="border-border/40 bg-muted/40 rounded-lg border transition-all hover:shadow-sm">
        <div
          className={`flex items-center justify-between gap-2 p-3 ${hasDetails ? "cursor-pointer" : ""}`}
          onClick={hasDetails ? () => toggleMeeting(meeting.id) : undefined}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-purple-500" />
              <span className="truncate text-sm font-semibold">{meeting.title}</span>
              {getStatusBadge(meeting)}
              {meeting._isLocal && (
                <Badge variant="outline" className="gap-1 border-blue-500/30 text-[10px] text-blue-600 dark:text-blue-400">
                  <HardDrive className="h-2.5 w-2.5" />
                  LOCAL
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
              <IxTimeDate date={meeting.scheduledDate} ixTime={meeting.scheduledIxTime} format="datetime" accentColor="amber" />
              <span>•</span>
              <span>{meeting.duration ?? 60} min</span>
              {(meeting.attendances?.length ?? 0) > 0 && (
                <><span>•</span><span>{meeting.attendances?.length} attendees</span></>
              )}
              {meetingDecisions.length > 0 && (
                <><span>•</span><span>{meetingDecisions.length} decisions</span></>
              )}
              {meetingActions.length > 0 && (
                <><span>•</span><span>{meetingActions.length} actions</span></>
              )}
            </div>
          </div>
          {hasDetails && (
            isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
        </div>

        {/* Expandable decisions/actions for past meetings */}
        {hasDetails && isExpanded && (
          <div className="border-t border-border/30 px-3 pb-3 pt-2 space-y-2">
            {meetingDecisions.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Decisions
                </div>
                <div className="space-y-1.5">
                  {meetingDecisions.map((d: any) => (
                    <div key={d.id} className="bg-background/50 rounded-md px-2.5 py-1.5 text-xs">
                      <span className="font-medium">{d.title}</span>
                      {d.description && <span className="text-muted-foreground ml-1">— {d.description}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {meetingActions.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Action Items
                </div>
                <div className="space-y-1.5">
                  {meetingActions.map((a: any) => {
                    const isOverdue = a.dueDate && new Date(a.dueDate) < new Date() && a.status !== "completed";
                    return (
                      <div key={a.id} className={`bg-background/50 rounded-md px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 ${isOverdue ? "border border-red-200 dark:border-red-800" : ""}`}>
                        <span className="font-medium">{a.title}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isOverdue && <Badge variant="destructive" className="text-[10px] px-1 py-0">OVERDUE</Badge>}
                          {getActionStatusBadge(a.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const ActionItemCard = ({ action }: { action: any }) => {
    const isOverdue = action.dueDate && new Date(action.dueDate) < new Date() && action.status !== "completed";

    return (
      <div className={`border-border/40 bg-muted/40 rounded-lg border p-3 transition-all hover:shadow-sm ${isOverdue ? "border-red-300 dark:border-red-800" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{action.title}</span>
              {getActionStatusBadge(action.status)}
              {isOverdue && <Badge variant="destructive" className="text-xs">OVERDUE</Badge>}
            </div>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span>{action.meetingTitle}</span>
              {action.dueDate && (
                <>
                  <span>•</span>
                  <span className={isOverdue ? "text-red-600 font-medium" : ""}>Due: <IxTimeDate date={action.dueDate} accentColor="amber" /></span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
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

      <div className="space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-semibold">Meetings & Decisions</h3>
            <SectionHelpIcon
              title="Meetings & Decisions"
              content="Manage executive meetings and track decisions and action items that result from them. Schedule meetings with agendas, record outcomes, and follow through on commitments. Past meetings can be expanded to see their associated decisions and action items."
            />
          </div>
          <Button size="sm" onClick={() => setMeetingSchedulerOpen(true)} className="gap-1.5">
            <Plus className="h-3 w-3" />
            Schedule Meeting
          </Button>
        </div>

        {/* Combined Stats Strip */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
          <div className="glass-hierarchy-child rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950/20">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" />
              <span className="text-muted-foreground text-xs font-medium">Upcoming</span>
            </div>
            <div className="mt-0.5 text-lg font-bold">{upcoming.length}</div>
          </div>
          <div className="glass-hierarchy-child rounded-lg bg-green-50 p-2.5 dark:bg-green-950/20">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
              <span className="text-muted-foreground text-xs font-medium">Completed</span>
            </div>
            <div className="mt-0.5 text-lg font-bold">{past.length}</div>
          </div>
          <div className="glass-hierarchy-child rounded-lg bg-purple-50 p-2.5 dark:bg-purple-950/20">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 flex-shrink-0 text-purple-600" />
              <span className="text-muted-foreground text-xs font-medium">Total</span>
            </div>
            <div className="mt-0.5 text-lg font-bold">{meetings.length}</div>
          </div>
          <div className="glass-hierarchy-child rounded-lg bg-yellow-50 p-2.5 dark:bg-yellow-950/20">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-yellow-600" />
              <span className="text-muted-foreground text-xs font-medium">Pending</span>
            </div>
            <div className="mt-0.5 text-lg font-bold">{pending.length}</div>
          </div>
          <div className="glass-hierarchy-child rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950/20">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" />
              <span className="text-muted-foreground text-xs font-medium">In Progress</span>
            </div>
            <div className="mt-0.5 text-lg font-bold">{inProgress.length}</div>
          </div>
          <div className="glass-hierarchy-child rounded-lg bg-red-50 p-2.5 dark:bg-red-950/20">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-red-600" />
              <span className="text-muted-foreground text-xs font-medium">Overdue</span>
            </div>
            <div className="mt-0.5 text-lg font-bold">{overdue.length}</div>
          </div>
        </div>

        {/* Overdue Alert */}
        {overdue.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div>
                <p className="font-medium text-red-900 dark:text-red-100">
                  {overdue.length} action item{overdue.length !== 1 ? "s" : ""} overdue
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  These items require immediate attention from the assigned officials
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Meetings */}
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Upcoming Meetings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length > 0 ? (
              <div className="space-y-3">
                {upcoming.map((meeting: any) => (
                  <MeetingCard key={meeting.id} meeting={meeting} />
                ))}
              </div>
            ) : (
              <div className="border-border/50 text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm">
                <Calendar className="text-muted-foreground/70 h-6 w-6" />
                <p>No upcoming meetings scheduled.</p>
                <Button variant="outline" onClick={() => setMeetingSchedulerOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Schedule first meeting
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past Meetings (with expandable decisions) */}
        {past.length > 0 && (
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Past Meetings
                <SectionHelpIcon
                  title="Past Meetings"
                  content="Click on a past meeting to expand and see its decisions and action items inline."
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {past.slice(0, 10).map((meeting: any) => (
                  <MeetingCard key={meeting.id} meeting={meeting} showDecisions />
                ))}
                {past.length > 10 && (
                  <div className="text-muted-foreground pt-2 text-center text-sm">
                    Showing 10 of {past.length} past meetings
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Items by Status */}
        {(pending.length > 0 || overdue.length > 0) && (
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Pending Action Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...overdue, ...pending.filter((item: any) => !overdue.includes(item))]
                  .slice(0, 10)
                  .map((action: any) => (
                    <ActionItemCard key={action.id} action={action} />
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {inProgress.length > 0 && (
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inProgress.slice(0, 10).map((action: any) => (
                  <ActionItemCard key={action.id} action={action} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {completed.length > 0 && (
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Completed Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {completed.slice(0, 5).map((action: any) => (
                  <ActionItemCard key={action.id} action={action} />
                ))}
                {completed.length > 5 && (
                  <div className="text-muted-foreground pt-2 text-center text-sm">
                    Showing 5 of {completed.length} completed actions
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
