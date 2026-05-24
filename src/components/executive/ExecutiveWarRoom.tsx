"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Bell, Calendar, FileText } from "lucide-react";
import { api } from "~/trpc/react";
import { useIssueCount, useNationalIssues } from "~/hooks/useNationalIssues";
import { useLocalActions } from "~/hooks/useLocalActions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { IxTime } from "~/lib/ixtime";
import { CommandPanel, type PanelStat } from "./CommandPanel";
import { CommandPanelItem, type PanelItemBadge } from "./CommandPanelItem";

// Lazy-load the full panels for drill-down sheets
const IssuesInbox = dynamic(
  () => import("~/components/national-issues").then((m) => ({ default: m.IssuesInbox })),
  { ssr: false }
);
const MeetingsAndDecisionsPanel = dynamic(
  () =>
    import("./MeetingsAndDecisionsPanel").then((m) => ({ default: m.MeetingsAndDecisionsPanel })),
  { ssr: false }
);
const PoliciesAndStrategyPanel = dynamic(
  () => import("./PoliciesAndStrategyPanel").then((m) => ({ default: m.PoliciesAndStrategyPanel })),
  { ssr: false }
);
const MeetingScheduler = dynamic(
  () =>
    import("~/components/quickactions/MeetingScheduler").then((m) => ({
      default: m.MeetingScheduler,
    })),
  { ssr: false }
);
const PolicyCreatorSheet = dynamic(
  () => import("./PolicyCreatorSheet").then((m) => ({ default: m.PolicyCreatorSheet })),
  { ssr: false }
);

interface ExecutiveWarRoomProps {
  countryId: string;
}

type SheetView = "issues" | "decisions" | "policies" | null;

const SEVERITY_COLORS: Record<string, string> = {
  critical: "red",
  high: "amber",
  medium: "blue",
  low: "slate",
};

const SEVERITY_BADGES: Record<string, PanelItemBadge> = {
  critical: {
    label: "CRITICAL",
    colorClass: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  },
  high: {
    label: "HIGH",
    colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  },
  medium: {
    label: "MED",
    colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  },
  low: {
    label: "LOW",
    colorClass: "bg-slate-100 text-slate-600 dark:bg-slate-950/30 dark:text-slate-400",
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "red",
  high: "amber",
  medium: "blue",
  low: "slate",
};

/**
 * Executive War Room — replaces the old 3-tab system with a simultaneous
 * 3-panel command center. All sections visible at once, like a war room
 * with multiple monitors.
 */
export function ExecutiveWarRoom({ countryId }: ExecutiveWarRoomProps) {
  const [activeSheet, setActiveSheet] = useState<SheetView>(null);
  const [meetingSchedulerOpen, setMeetingSchedulerOpen] = useState(false);
  const [policyCreatorOpen, setPolicyCreatorOpen] = useState(false);

  // ── Issues data ──
  const { activeIssues, urgentCount } = useNationalIssues(countryId);
  const { total: issueCount } = useIssueCount(countryId);

  // ── Meetings data ──
  const { data: serverMeetings = [], refetch: refetchMeetings } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { getActions } = useLocalActions(countryId);

  const meetings = useMemo(() => {
    const localMeetings = getActions("meeting_scheduled").map((a) => ({
      id: a.id,
      title: a.data.title as string,
      scheduledDate: a.data.scheduledDate as string,
      status: "scheduled",
      actionItems: [] as any[],
      decisions: [] as any[],
      attendances: [] as any[],
      _isLocal: true,
    }));
    return [...serverMeetings, ...localMeetings];
  }, [serverMeetings, getActions]);

  const { upcomingMeetings, actionItems } = useMemo(() => {
    const now = new Date();
    const upcoming = meetings
      .filter((m: any) => new Date(m.scheduledDate) >= now && m.status === "scheduled")
      .sort(
        (a: any, b: any) =>
          new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
      );

    const actions: any[] = [];
    meetings.forEach((m: any) => {
      m.actionItems?.forEach((a: any) => {
        const isOverdue = a.dueDate && new Date(a.dueDate) < now && a.status !== "completed";
        if (a.status !== "completed") {
          actions.push({ ...a, meetingTitle: m.title, isOverdue });
        }
      });
    });
    actions.sort((a, b) => (a.isOverdue ? -1 : 0) - (b.isOverdue ? -1 : 0));

    return { upcomingMeetings: upcoming, actionItems: actions };
  }, [meetings]);

  // ── Policies data ──
  const { data: serverPolicies = [], refetch: refetchPolicies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const policies = useMemo(() => {
    const localPolicies = getActions("policy_created").map((a) => ({
      id: a.id,
      name: a.data.title as string,
      title: a.data.title as string,
      category: a.data.category as string,
      priority: a.data.priority as string,
      status: "draft",
      _isLocal: true,
    }));
    return [...serverPolicies, ...localPolicies];
  }, [serverPolicies, getActions]);

  const { activePolicies, draftPolicies } = useMemo(
    () => ({
      activePolicies: policies.filter((p: any) => p.status === "active"),
      draftPolicies: policies.filter((p: any) => p.status === "draft"),
    }),
    [policies]
  );

  // ── Computed stats ──
  const overdueCount = actionItems.filter((a) => a.isOverdue).length;

  const issueStats: PanelStat[] = [
    { label: "pending", value: issueCount },
    ...(urgentCount > 0 ? [{ label: "urgent", value: urgentCount }] : []),
  ];

  const decisionStats: PanelStat[] = [
    { label: "upcoming", value: upcomingMeetings.length },
    ...(actionItems.length > 0 ? [{ label: "actions", value: actionItems.length }] : []),
    ...(overdueCount > 0 ? [{ label: "overdue", value: overdueCount }] : []),
  ];

  const policyStats: PanelStat[] = [
    { label: "active", value: activePolicies.length },
    ...(draftPolicies.length > 0 ? [{ label: "draft", value: draftPolicies.length }] : []),
  ];

  // ── Helpers ──
  const formatDeadline = (deadlineIxTime: number | null) => {
    if (!deadlineIxTime) return null;
    const now = IxTime.getCurrentIxTime();
    const hoursLeft = Math.floor((deadlineIxTime - now) / 3600);
    const daysLeft = Math.floor(hoursLeft / 24);
    if (hoursLeft < 0) return { text: "EXPIRED", color: "text-red-600" };
    if (daysLeft < 1) return { text: `${hoursLeft}h left`, color: "text-red-600" };
    if (daysLeft < 3) return { text: `${daysLeft}d left`, color: "text-amber-600" };
    return { text: `${daysLeft}d left`, color: "text-muted-foreground" };
  };

  const formatMeetingDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <>
      {/* War Room Grid */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        {/* ── ISSUES COMMAND ── */}
        <CommandPanel
          title="Issues Command"
          icon={Bell}
          accentColor="amber"
          stats={issueStats}
          footerLabel="View All Issues"
          onFooter={() => setActiveSheet("issues")}
          totalCount={issueCount}
          emptyIcon={Bell}
          emptyMessage="No pending issues — all clear"
        >
          {activeIssues.slice(0, 4).map((issue) => {
            const deadline = formatDeadline(issue.deadlineIxTime);
            const isCritical = issue.severity === "critical";
            return (
              <CommandPanelItem
                key={issue.id}
                accentColor={SEVERITY_COLORS[issue.severity] ?? "slate"}
                title={issue.title}
                subtitle={issue.domain}
                badges={SEVERITY_BADGES[issue.severity] ? [SEVERITY_BADGES[issue.severity]!] : []}
                trailingText={deadline?.text}
                trailingColor={deadline?.color}
                pulse={isCritical}
              />
            );
          })}
        </CommandPanel>

        {/* ── DECISION CENTER ── */}
        <CommandPanel
          title="Decision Center"
          icon={Calendar}
          accentColor="blue"
          stats={decisionStats}
          ctaLabel="Schedule"
          onCta={() => setMeetingSchedulerOpen(true)}
          footerLabel="View All"
          onFooter={() => setActiveSheet("decisions")}
          totalCount={meetings.length}
          emptyIcon={Calendar}
          emptyMessage="No meetings or actions"
        >
          {/* Show upcoming meetings first, then action items */}
          {upcomingMeetings.slice(0, 2).map((meeting: any) => (
            <CommandPanelItem
              key={meeting.id}
              accentColor="blue"
              title={meeting.title}
              subtitle={`${meeting.attendances?.length ?? 0} attendees · ${meeting.decisions?.length ?? 0} decisions`}
              trailingText={formatMeetingDate(meeting.scheduledDate)}
              trailingColor={
                formatMeetingDate(meeting.scheduledDate) === "Today"
                  ? "text-blue-600 font-semibold"
                  : undefined
              }
              badges={
                meeting._isLocal
                  ? [
                      {
                        label: "LOCAL",
                        colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/30",
                      },
                    ]
                  : []
              }
            />
          ))}
          {actionItems.slice(0, 3 - Math.min(upcomingMeetings.length, 2)).map((action: any) => (
            <CommandPanelItem
              key={action.id}
              accentColor={action.isOverdue ? "red" : "amber"}
              title={action.title}
              subtitle={`From: ${action.meetingTitle}`}
              pulse={action.isOverdue}
              badges={
                action.isOverdue
                  ? [
                      {
                        label: "OVERDUE",
                        colorClass: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
                      },
                    ]
                  : [
                      {
                        label: "PENDING",
                        colorClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30",
                      },
                    ]
              }
            />
          ))}
        </CommandPanel>

        {/* ── POLICY STRATEGY ── */}
        <CommandPanel
          title="Policy Strategy"
          icon={FileText}
          accentColor="indigo"
          stats={policyStats}
          ctaLabel="New Policy"
          onCta={() => setPolicyCreatorOpen(true)}
          footerLabel="View All"
          onFooter={() => setActiveSheet("policies")}
          totalCount={policies.length}
          emptyIcon={FileText}
          emptyMessage="No policies yet"
        >
          {/* Show active policies first, then drafts */}
          {activePolicies.slice(0, 3).map((policy: any) => (
            <CommandPanelItem
              key={policy.id}
              accentColor={PRIORITY_COLORS[policy.priority?.toLowerCase()] ?? "indigo"}
              title={policy.name ?? policy.title ?? "Untitled"}
              subtitle={(policy.category ?? policy.policyType ?? "general").toUpperCase()}
              badges={[
                {
                  label: "ACTIVE",
                  colorClass:
                    "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
                },
              ]}
            />
          ))}
          {draftPolicies.slice(0, Math.max(0, 4 - activePolicies.length)).map((policy: any) => (
            <CommandPanelItem
              key={policy.id}
              accentColor="slate"
              title={policy.name ?? policy.title ?? "Untitled"}
              subtitle={(policy.category ?? policy.policyType ?? "general").toUpperCase()}
              badges={[
                {
                  label: "DRAFT",
                  colorClass:
                    "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
                },
              ]}
            />
          ))}
        </CommandPanel>
      </div>

      {/* ── Drill-Down Sheets ── */}
      <Sheet open={activeSheet === "issues"} onOpenChange={(open) => !open && setActiveSheet(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>All National Issues</SheetTitle>
            <SheetDescription>Complete issues inbox with response actions</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <IssuesInbox countryId={countryId} variant="full" />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={activeSheet === "decisions"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Meetings & Decisions</SheetTitle>
            <SheetDescription>All meetings, decisions, and action items</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <MeetingsAndDecisionsPanel countryId={countryId} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={activeSheet === "policies"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>All Policies</SheetTitle>
            <SheetDescription>Active, draft, and archived policies</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <PoliciesAndStrategyPanel countryId={countryId} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Action Sheets ── */}
      <MeetingScheduler
        countryId={countryId}
        open={meetingSchedulerOpen}
        onOpenChange={(open) => {
          setMeetingSchedulerOpen(open);
          if (!open) void refetchMeetings();
        }}
      />

      <PolicyCreatorSheet
        countryId={countryId}
        open={policyCreatorOpen}
        onOpenChange={(open) => {
          setPolicyCreatorOpen(open);
          if (!open) void refetchPolicies();
        }}
      />
    </>
  );
}
