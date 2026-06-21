"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Bell, Calendar, FileText, HelpCircle } from "lucide-react";
import { api } from "~/trpc/react";
import { useIssueCount, useNationalIssues } from "~/hooks/useNationalIssues";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { IxTime } from "~/lib/ixtime";
import { CommandPanel, type PanelStat } from "./CommandPanel";
import { Button } from "~/components/ui/button";
import { CommandPanelItem, type PanelItemBadge } from "./CommandPanelItem";
import { CountryChangeLogTimeline } from "./CountryChangeLogTimeline";

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
const IssueDetailModal = dynamic(
  () =>
    import("~/components/national-issues/IssueDetailModal").then((m) => ({
      default: m.IssueDetailModal,
    })),
  { ssr: false }
);
const MeetingDetailModal = dynamic(
  () => import("./MeetingDetailModal").then((m) => ({ default: m.MeetingDetailModal })),
  { ssr: false }
);
const PolicyDetailSheet = dynamic(
  () => import("./PolicyDetailSheet").then((m) => ({ default: m.PolicyDetailSheet })),
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
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [helpTopic, setHelpTopic] = useState<"issues" | "decisions" | "policies" | null>(null);

  // ── Country Name Summary ──
  const { data: countrySummary } = api.countries.getMapSummary.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // ── Issues data ──
  const { activeIssues, urgentCount, selectedIssue, isResponding, respond, openIssue, closeIssue } =
    useNationalIssues(countryId);
  const { total: issueCount } = useIssueCount(countryId);

  // ── Meetings data ──
  const { data: serverMeetings = [], refetch: refetchMeetings } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const meetings = serverMeetings;

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

  const policies = serverPolicies;

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
          emptyTitle="All clear"
          emptyDescription="No pending national issues right now. A good moment to enact a new policy or schedule a cabinet meeting."
          onHelp={() => setHelpTopic("issues")}
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
                onClick={() => openIssue(issue.id)}
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
          emptyTitle="Your schedule is clear"
          emptyDescription="Schedule your first cabinet meeting to align your cabinet and start a record of decisions."
          onHelp={() => setHelpTopic("decisions")}
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
              onClick={() => setSelectedMeetingId(meeting.id)}
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
              onClick={() => setSelectedMeetingId(action.meetingId)}
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
          emptyTitle="No policies yet"
          emptyDescription="Create your nation's first policy to shape the economy, society, and governance."
          onHelp={() => setHelpTopic("policies")}
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
              onClick={!policy._isLocal ? () => setSelectedPolicyId(policy.id) : undefined}
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
              onClick={!policy._isLocal ? () => setSelectedPolicyId(policy.id) : undefined}
            />
          ))}
        </CommandPanel>
      </div>

      {/* ── Ledger Timeline ── */}
      <CountryChangeLogTimeline
        countryId={countryId}
        countryName={countrySummary?.name ?? "Government"}
      />

      {/* ── Drill-Down Sheets ── */}
      <Dialog
        open={activeSheet === "issues"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <DialogContent className="max-w-2xl" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle>All National Issues</DialogTitle>
            <DialogDescription>Complete issues inbox with response actions</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <IssuesInbox countryId={countryId} variant="full" />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeSheet === "decisions"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <DialogContent className="max-w-2xl" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle>Meetings & Decisions</DialogTitle>
            <DialogDescription>All meetings, decisions, and action items</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <MeetingsAndDecisionsPanel countryId={countryId} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeSheet === "policies"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <DialogContent className="max-w-2xl" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle>All Policies</DialogTitle>
            <DialogDescription>Active, draft, and archived policies</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <PoliciesAndStrategyPanel countryId={countryId} />
          </div>
        </DialogContent>
      </Dialog>

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

      {/* ── Detail Sheets ── */}
      <IssueDetailModal
        issue={selectedIssue ?? null}
        isOpen={!!selectedIssue}
        onClose={closeIssue}
        onRespond={respond}
        isResponding={isResponding}
      />

      <MeetingDetailModal
        meetingId={selectedMeetingId}
        onClose={() => setSelectedMeetingId(null)}
      />

      <PolicyDetailSheet
        policyId={selectedPolicyId}
        onClose={() => setSelectedPolicyId(null)}
        countryId={countryId}
        onPolicyChanged={() => {
          void refetchPolicies();
        }}
      />

      {/* ── Help Dialog ── */}
      <Dialog open={helpTopic !== null} onOpenChange={(open) => !open && setHelpTopic(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-amber-500" />
              {helpTopic === "issues" && "Issues Command Help"}
              {helpTopic === "decisions" && "Decision Center Help"}
              {helpTopic === "policies" && "Policy Strategy Help"}
            </DialogTitle>
            <DialogDescription>
              Learn about the executive systems of your country.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 space-y-4 text-sm leading-relaxed">
            {helpTopic === "issues" && (
              <>
                <p>
                  As the ruler, you must respond to various <strong>National Issues</strong> and
                  crises that arise dynamically based on your country's attributes and previous
                  actions.
                </p>
                <div className="rounded-r-md border-l-2 border-amber-500 bg-amber-500/5 p-3">
                  <h4 className="mb-1 text-xs font-semibold text-amber-500">
                    CRITICAL CRISES & DEADLINES
                  </h4>
                  <p className="text-muted-foreground text-xs">
                    Urgent issues have deadlines. If they expire before you choose a response, they
                    will auto-resolve—often with unfavorable outcomes.
                  </p>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium">Making Decisions</h4>
                  <p className="text-muted-foreground text-xs">
                    Review the previews of how each option will impact Approval, Economic health,
                    stability, and diplomatic relations. Committing to a choice resolves the issue
                    and records the outcome.
                  </p>
                </div>
              </>
            )}

            {helpTopic === "decisions" && (
              <>
                <p>
                  The <strong>Decision Center</strong> coordinates collaboration and action across
                  government departments.
                </p>
                <div className="rounded-r-md border-l-2 border-blue-500 bg-blue-500/5 p-3">
                  <h4 className="mb-1 text-xs font-semibold text-blue-400">CABINET MEETINGS</h4>
                  <p className="text-muted-foreground text-xs">
                    Schedule meetings with ministers, set agendas, record decisions, and invite
                    officials to represent departments.
                  </p>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium">Action Items</h4>
                  <p className="text-muted-foreground text-xs">
                    Action items are tasks assigned to cabinet officials or departments during
                    meetings. Resolve pending and overdue tasks to maintain government
                    effectiveness.
                  </p>
                </div>
              </>
            )}

            {helpTopic === "policies" && (
              <>
                <p>
                  <strong>Policy Strategy</strong> governs the long-term laws, systems, and economic
                  reforms of your nation.
                </p>
                <div className="rounded-r-md border-l-2 border-indigo-500 bg-indigo-500/5 p-3">
                  <h4 className="mb-1 text-xs font-semibold text-indigo-400">
                    ACTIVE VS DRAFT STATUS
                  </h4>
                  <p className="text-muted-foreground text-xs">
                    Draft policies can be reviewed. Activating a policy incurs an upfront
                    implementation cost and ongoing maintenance fees, but starts applying policy
                    effects to the nation.
                  </p>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium">Economic Adjustments</h4>
                  <p className="text-muted-foreground text-xs">
                    Active policies exert continuous multipliers on economic components (GDP,
                    employment, inflation, tax revenue), steering the long-term national simulation.
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button size="sm" onClick={() => setHelpTopic(null)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
