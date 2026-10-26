"use client";

import React, { useState, useMemo } from "react";
import {
  StatUp as TrendingUp,
  Bank as Landmark,
  Group as Users,
  Shield,
  Globe,
  Building,
  Leaf,
  Clock,
  FireFlame as Flame,
  WarningTriangle as AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  KeyCommand as Command,
  ControlSlider as Sliders,
  CalendarRotate as CalendarClock,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import { useClockNow, useNationClock } from "~/hooks/useNationClock";
import { useNotify } from "~/hooks/useNotify";
import { Card } from "~/components/ui/card";
import type { RealmClockReader } from "~/lib/realms/realm-clock";
import {
  deadlineBadgeOf,
  parseOptions,
  reconArrivalOf,
  type ReconOptionItem,
  type ReconRevealItem,
} from "~/lib/national-issues/issue-brief";
import { OptionCard } from "./IssueOptionCard";

const DOMAIN_CONFIG: Record<string, { icon: typeof TrendingUp; label: string }> = {
  economic: { icon: TrendingUp, label: "Economic" },
  political: { icon: Landmark, label: "Political" },
  social: { icon: Users, label: "Social" },
  military: { icon: Shield, label: "Military" },
  diplomatic: { icon: Globe, label: "Diplomatic" },
  infrastructure: { icon: Building, label: "Infrastructure" },
  environmental: { icon: Leaf, label: "Environmental" },
};

/**
 * A national issue brief. Renders inside the drill sheet with recon, respond and dismiss, and a
 * post-resolve "Declare Directive" button that pre-fills the composer.
 */
interface IssueDetailBriefProps {
  issueId: string;
  onDeclare?: (prefilledGoal?: string) => void;
  onClose?: () => void;
}

type Issue = NonNullable<RouterOutputs["nationalIssues"]["getIssue"]>;
type ReconData = NonNullable<RouterOutputs["nationalIssues"]["getReconReveal"]>;

function formatReveal(r: ReconRevealItem): string {
  if (r.value == null) return "—";
  if (r.operation === "multiply") return `×${r.value}`;
  if (r.operation === "set") return `=${r.value}`;
  return `${r.operation === "subtract" ? "-" : "+"}${Math.abs(r.value)}`;
}

const REVEAL_TONE: Record<string, string> = {
  greyed: "text-label-tertiary",
  questioned: "text-yellow",
};

function IssueHero({
  issue,
  isResolved,
  currentIxTime,
  clock,
}: {
  issue: Issue;
  isResolved: boolean;
  currentIxTime: number | null;
  clock: RealmClockReader | null;
}) {
  const domain = DOMAIN_CONFIG[issue.domain] ?? DOMAIN_CONFIG.economic!;
  const DomainIcon = domain.icon;
  const severity = issue.severity.toLowerCase();
  const severityTone =
    severity === "critical"
      ? "text-destructive"
      : severity === "high"
        ? "text-yellow"
        : "text-label-secondary";

  const showDeadline = issue.deadlineIxTime != null && !isResolved;
  const deadline = showDeadline
    ? deadlineBadgeOf(issue.deadlineIxTime!, currentIxTime, clock)
    : null;

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          <DomainIcon />
          {domain.label}
        </Badge>
        <Badge variant="outline" className={cn("capitalize", severityTone)}>
          {severity}
        </Badge>
        {deadline && (
          <Badge variant={deadline.urgent ? "destructive" : "outline"}>
            {deadline.urgent ? <Flame /> : <Clock />}
            {deadline.text}
          </Badge>
        )}
      </div>

      <div>
        <h2 className="text-label text-title-3">{issue.title}</h2>
        {issue.intentId && (
          <Badge variant="default" className="mt-2">
            <Command />
            Linked to an active directive
          </Badge>
        )}
      </div>

      {issue.description && (
        <p className="text-label-secondary text-body leading-relaxed">{issue.description}</p>
      )}
      {issue.longDescription && (
        <div className="text-label-secondary border-separator text-footnote border-l-2 pl-3 leading-relaxed whitespace-pre-line">
          {issue.longDescription}
        </div>
      )}
    </Card>
  );
}

function OutcomeCard({
  issue,
  directive,
  onDeclare,
  onClose,
}: {
  issue: Issue;
  directive: string | undefined;
  onDeclare: IssueDetailBriefProps["onDeclare"];
  onClose: IssueDetailBriefProps["onClose"];
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle className="text-green h-4 w-4" />
        <span className="text-label text-headline">
          {issue.status === "auto_resolved" ? "Auto-resolved" : "Decision made"}
        </span>
      </div>
      {issue.consequenceLog && (
        <p className="text-label-secondary text-footnote leading-relaxed whitespace-pre-line">
          {issue.consequenceLog}
        </p>
      )}

      {/* Post-resolve CTA: the surface's one primary (MyCountry gold) action */}
      {directive && onDeclare && (
        <Button
          type="button"
          onClick={() => {
            onClose?.();
            onDeclare(directive);
          }}
          className="mt-1"
        >
          <Command aria-hidden="true" className="h-4 w-4" />
          Declare Directive
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      )}
    </Card>
  );
}

function ReconPanel({
  recon,
  currentIxTime,
  clock,
  isCommissioning,
  onCommission,
}: {
  recon: ReconData;
  currentIxTime: number | null;
  clock: RealmClockReader | null;
  isCommissioning: boolean;
  onCommission: () => void;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <h3 className="text-label text-headline flex items-center gap-2">
        <Sliders className="text-label-secondary h-4 w-4" />
        Cabinet research
      </h3>
      {recon.status === "none" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-label-secondary text-footnote leading-relaxed">
            Commission a meeting to reveal the hard projected effects behind each option. Costs
            administrative capacity.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={onCommission}
            disabled={isCommissioning}
          >
            {isCommissioning ? "Commissioning…" : "Commission"}
          </Button>
        </div>
      )}
      {recon.status === "pending" && (
        <p className="text-label-secondary text-footnote flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          Your team is researching. {reconArrivalOf(recon.readyIxTime, currentIxTime, clock)}
        </p>
      )}
      {recon.status === "ready" && (
        <div className="space-y-2">
          {(recon.options as ReconOptionItem[]).map((o) => (
            <div key={o.optionId} className="bg-fill-3 rounded-control p-2">
              <p className="text-label text-caption mb-1 font-semibold">{o.label}</p>
              <div className="flex flex-wrap gap-2">
                {o.reveals.length === 0 && (
                  <span className="text-label-secondary text-footnote">No measurable effects.</span>
                )}
                {o.reveals.map((r, i) => (
                  <span
                    key={i}
                    title={r.reason ?? undefined}
                    className={cn(
                      "bg-surface text-footnote rounded-control-sm px-2 py-0.5",
                      REVEAL_TONE[r.state ?? ""] ?? "text-green"
                    )}
                  >
                    {r.targetField.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}
                    : {formatReveal(r)}
                    {r.state === "questioned" ? " ?" : ""}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <p className="text-label-secondary text-footnote">
            Greyed = your government can&apos;t assess it · &ldquo;?&rdquo; = may be inaccurate.
          </p>
        </div>
      )}
    </Card>
  );
}

const hasCriticalSeverity = (severity: string) =>
  ["critical", "high"].includes(severity.toLowerCase());

export function IssueDetailBrief({ issueId, onDeclare, onClose }: IssueDetailBriefProps) {
  const notify = useNotify();
  const [confirmingOptionId, setConfirmingOptionId] = useState<string | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);
  const [localDirective, setLocalDirective] = useState<string | undefined>(undefined);
  const clock = useNationClock();
  const currentIxTime = useClockNow(clock);

  const utils = api.useUtils();
  const issueQuery = api.nationalIssues.getIssue.useQuery({ id: issueId }, { enabled: !!issueId });
  const reconQuery = api.nationalIssues.getReconReveal.useQuery(
    { issueId },
    { enabled: !!issueId, refetchInterval: 30000 }
  );
  const invalidateIssues = () => {
    void utils.nationalIssues.getMyIssues.invalidate();
    void utils.nationalIssues.getPendingCount.invalidate();
  };
  // A decision writes approval, stability, effects, the ledger and directive progress.
  const invalidateConsequences = () => {
    void utils.countries.getByIdWithEconomicData.invalidate();
    void utils.countries.getActivityRingsData.invalidate();
    void utils.mycountry.getCanonFeed.invalidate();
    void utils.intent.getTree.invalidate();
    void utils.intent.getLinkedIssues.invalidate();
  };

  const respondM = api.nationalIssues.respond.useMutation({
    onSuccess: async (res: { recommendedDirective?: string }) => {
      setShowOutcome(true);
      setConfirmingOptionId(null);
      setLocalDirective(res?.recommendedDirective);
      invalidateConsequences();
      await utils.nationalIssues.getIssue.invalidate();
      invalidateIssues();
    },
    onError: (e: { message?: string }) => notify.error("Failed to submit response", e?.message),
  });
  const dismissM = api.nationalIssues.dismiss.useMutation({
    onSuccess: () => {
      notify.success("Issue delegated to the civil service.");
      invalidateIssues();
      // Delegating spends executive bandwidth.
      void utils.policies.getPolicyReconContext.invalidate();
      onClose?.();
    },
    onError: (e: { message?: string }) => notify.error("Failed to delegate issue", e?.message),
  });
  const scheduleMeetingM = api.quickActions.createMeeting.useMutation({
    onSuccess: () => {
      notify.success(
        "Cabinet meeting scheduled for next week. It is in Politics, under Cabinet meetings."
      );
      void utils.meetings.getMeetings.invalidate();
      onClose?.();
    },
    onError: (e: { message?: string }) => notify.error("Failed to schedule meeting", e?.message),
  });
  const commissionRecon = api.nationalIssues.commissionRecon.useMutation({
    onSuccess: () => {
      void reconQuery.refetch();
      notify.success("Cabinet research commissioned.");
    },
    onError: (e: { message?: string }) => notify.error("Could not commission research", e?.message),
  });

  const issue = issueQuery.data;
  const options = useMemo(() => parseOptions(issue?.responseOptions), [issue?.responseOptions]);

  if (issueQuery.isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading issue">
        <Skeleton className="rounded-row h-40" />
        <Skeleton className="rounded-row h-24" />
        <Skeleton className="rounded-row h-24" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="text-label-secondary text-body py-8 text-center">
        This issue could not be loaded.
      </div>
    );
  }

  const isResolved = issue.status === "responded" || issue.status === "auto_resolved";
  const isOpen = !isResolved && !showOutcome;
  const canDismiss =
    isOpen &&
    issue.deadlineIxTime == null &&
    !hasCriticalSeverity(issue.severity) &&
    issue.urgency <= 70;
  const chosenDirective =
    localDirective ?? options.find((o) => o.id === issue.chosenOptionId)?.recommendedDirective;
  const recon = reconQuery.data;

  const handleSetMeeting = () => {
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    scheduleMeetingM.mutate({
      countryId: issue.countryId,
      userId: issue.countryId,
      meeting: {
        title: `Cabinet Meeting: ${issue.title}`,
        description: `Cabinet meeting to address the national issue '${issue.title}'.`,
        scheduledDate: nextWeekDate,
        duration: 60,
        agendaItems: [
          {
            title: issue.title,
            description: issue.description || undefined,
            category: issue.domain,
          },
        ],
      },
    });
  };

  return (
    <div className="space-y-5 pb-4">
      <IssueHero
        issue={issue}
        isResolved={isResolved}
        currentIxTime={currentIxTime}
        clock={clock}
      />

      {!isOpen && (issue.consequenceLog || options.length > 0) && (
        <OutcomeCard
          issue={issue}
          directive={chosenDirective}
          onDeclare={onDeclare}
          onClose={onClose}
        />
      )}

      {isOpen && recon && recon.status !== "disabled" && (
        <ReconPanel
          recon={recon}
          currentIxTime={currentIxTime}
          clock={clock}
          isCommissioning={commissionRecon.isPending}
          onCommission={() => commissionRecon.mutate({ issueId: issue.id })}
        />
      )}

      {isOpen && (
        <div className="space-y-3">
          <Card className="space-y-3 p-4">
            <div className="border-separator flex items-center justify-between gap-2 border-b pb-2">
              <Eyebrow className="flex items-center gap-2">
                <AlertTriangle className="text-yellow h-3.5 w-3.5" />
                Executive issue resolution
              </Eyebrow>
            </div>

            <div
              className={cn(
                "grid grid-cols-2 gap-2",
                onDeclare ? "sm:grid-cols-4" : "sm:grid-cols-3"
              )}
            >
              <PathwayButton
                icon={Users}
                label="Delegate"
                sub={canDismiss ? "−15 bandwidth" : "Unavailable"}
                onClick={() => dismissM.mutate({ id: issue.id })}
                disabled={!canDismiss || dismissM.isPending}
              />
              <PathwayButton
                icon={Sliders}
                label="Resolve brief"
                sub={`${options.length} option${options.length === 1 ? "" : "s"}`}
                onClick={() =>
                  document
                    .getElementById("issue-brief-options")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
              <PathwayButton
                icon={CalendarClock}
                label={scheduleMeetingM.isPending ? "Scheduling…" : "Set meeting"}
                sub="Next week"
                onClick={handleSetMeeting}
                disabled={scheduleMeetingM.isPending}
              />
              {onDeclare && (
                <PathwayButton
                  icon={Command}
                  label="Make Directive"
                  sub="Draft your own"
                  accent
                  onClick={() => {
                    onClose?.();
                    onDeclare(issue.title);
                  }}
                />
              )}
            </div>
          </Card>

          <div id="issue-brief-options" className="space-y-2 pt-1">
            {options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                isConfirming={confirmingOptionId === option.id}
                isPending={respondM.isPending}
                onChoose={() => setConfirmingOptionId(option.id)}
                onCancel={() => setConfirmingOptionId(null)}
                onConfirm={() => respondM.mutate({ issueId: issue.id, optionId: option.id })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** One of the four resolution pathways: a tactile tile with a label and its cost line. */
function PathwayButton({
  icon: Icon,
  label,
  sub,
  onClick,
  disabled,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="default"
      onClick={onClick}
      disabled={disabled}
      className="h-auto flex-col justify-center gap-1 p-2 whitespace-normal disabled:opacity-50"
    >
      <Icon className={cn("h-4 w-4", accent ? "text-yellow" : "text-label-secondary")} />
      <span className="text-label text-caption font-semibold">{label}</span>
      <span className="text-label-secondary text-footnote tabular-nums">{sub}</span>
    </Button>
  );
}
