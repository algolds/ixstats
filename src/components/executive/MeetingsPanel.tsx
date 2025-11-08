"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Calendar, Plus, Users, Clock, Layers, CheckCircle, XCircle } from "lucide-react";
import { api } from "~/trpc/react";
import { MeetingScheduler } from "~/components/quickactions/MeetingScheduler";
import { SectionHelpIcon } from "~/components/ui/help-icon";

interface MeetingsPanelProps {
  countryId: string;
}

export function MeetingsPanel({ countryId }: MeetingsPanelProps) {
  const [meetingSchedulerOpen, setMeetingSchedulerOpen] = useState(false);

  // Fetch meetings
  const { data: meetings = [], refetch: refetchMeetings } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Categorize meetings
  const { upcoming, past, cancelled } = useMemo(() => {
    const now = new Date();
    return {
      upcoming: meetings
        .filter((m: any) => new Date(m.scheduledDate) >= now && m.status === "SCHEDULED")
        .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()),
      past: meetings
        .filter((m: any) => m.status === "COMPLETED" || (new Date(m.scheduledDate) < now && m.status === "SCHEDULED"))
        .sort((a: any, b: any) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()),
      cancelled: meetings.filter((m: any) => m.status === "CANCELLED"),
    };
  }, [meetings]);

  const getStatusBadge = (meeting: any) => {
    const status = meeting.status?.toUpperCase() || "SCHEDULED";

    if (status === "COMPLETED") {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          COMPLETED
        </Badge>
      );
    }

    if (status === "CANCELLED") {
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

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const MeetingCard = ({ meeting }: { meeting: any }) => {
    const { date, time } = formatDateTime(meeting.scheduledDate);

    return (
      <div className="border-border/40 bg-muted/40 rounded-lg border p-4 transition-all hover:shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-950/20">
              <Calendar className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <div className="text-foreground font-semibold">{meeting.title}</div>
              <div className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {time}
                </span>
                <span>• {meeting.duration ?? 60} min</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            {getStatusBadge(meeting)}
            {(meeting.attendances?.length ?? 0) > 0 && (
              <div className="text-muted-foreground flex items-center gap-1 text-sm">
                <Users className="h-3 w-3" />
                {meeting.attendances?.length ?? 0} participants
              </div>
            )}
            {(meeting.agendaItems?.length ?? 0) > 0 && (
              <div className="text-muted-foreground flex items-center gap-1 text-sm">
                <Layers className="h-3 w-3" />
                {meeting.agendaItems?.length ?? 0} agenda items
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Meeting Scheduler Modal */}
      <MeetingScheduler
        countryId={countryId}
        open={meetingSchedulerOpen}
        onOpenChange={(open) => {
          setMeetingSchedulerOpen(open);
          if (!open) {
            void refetchMeetings();
          }
        }}
      />

      <div className="space-y-6">
        {/* Header Card */}
        <Card className="glass-hierarchy-child border-border">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Executive Meeting Management
                <SectionHelpIcon
                  title="Meeting Management"
                  content="Organize and track executive meetings for your nation's leadership. Meetings help coordinate policy decisions, review progress on strategic initiatives, and ensure alignment across your government. Schedule meetings with specific agendas, invite participants, and record outcomes to maintain institutional memory."
                />
              </CardTitle>
              <CardDescription>
                Schedule cabinet meetings, manage agendas, and track decisions
              </CardDescription>
            </div>
            <Button onClick={() => setMeetingSchedulerOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Schedule Meeting
            </Button>
          </CardHeader>
        </Card>

        {/* Meeting Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="glass-hierarchy-child">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Upcoming</p>
                  <p className="mt-2 text-3xl font-bold">{upcoming.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-hierarchy-child">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Completed</p>
                  <p className="mt-2 text-3xl font-bold">{past.length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-hierarchy-child">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Total</p>
                  <p className="mt-2 text-3xl font-bold">{meetings.length}</p>
                </div>
                <Layers className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Meetings */}
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Upcoming Meetings
              <SectionHelpIcon
                title="Upcoming Meetings"
                content="Your scheduled meetings for the future. Each meeting can include agenda items, participant lists, and estimated duration. Click on a meeting to view details, modify agendas, or manage attendees. Completed meetings should have their decisions and outcomes recorded in the Decisions tab."
              />
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
              <div className="border-border/50 text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center text-sm">
                <Calendar className="text-muted-foreground/70 h-8 w-8" />
                <p>No upcoming meetings scheduled.</p>
                <Button variant="outline" onClick={() => setMeetingSchedulerOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Schedule first meeting
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past Meetings */}
        {past.length > 0 && (
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Past Meetings
                <SectionHelpIcon
                  title="Past Meetings"
                  content="Historical record of completed and expired meetings. Review past meeting agendas, participant lists, and any recorded decisions. This archive helps track the evolution of your executive policies and provides institutional knowledge for your government."
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {past.slice(0, 10).map((meeting: any) => (
                  <MeetingCard key={meeting.id} meeting={meeting} />
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
      </div>
    </>
  );
}
