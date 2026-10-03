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
  Xmark as X,
  CalendarRotate as CalendarClock,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { useNotify } from "~/hooks/useNotify";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { Card } from "~/components/ui/card";

const DOMAIN_CONFIG: Record<string, { icon: typeof TrendingUp; label: string }> = {
  economic: { icon: TrendingUp, label: "Economic" },
  political: { icon: Landmark, label: "Political" },
  social: { icon: Users, label: "Social" },
  military: { icon: Shield, label: "Military" },
  diplomatic: { icon: Globe, label: "Diplomatic" },
  infrastructure: { icon: Building, label: "Infrastructure" },
  environmental: { icon: Leaf, label: "Environmental" },
};

interface ReconRevealItem {
  targetField: string;
  value?: number | null;
  operation?: string;
  state?: "greyed" | "questioned" | "revealed" | string;
  reason?: string | null;
}

interface ReconOptionItem {
  optionId: string;
  label: string;
  reveals: ReconRevealItem[];
}

interface ResponseOption {
  id: string;
  label: string;
  description: string;
  previewEffects: {
    publicApproval?: number;
    economicImpact?: string;
    stabilityImpact?: string;
    diplomaticImpact?: string;
  };
  outcomeText: string;
  isRisky?: boolean;
  partyAlignment?: string;
  brokerAlignment?: string;
  costMessage?: string;
  requiredPolicyKey?: string;
  recommendedDirective?: string;
}

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

const DAY_MS = 24 * 60 * 60 * 1000;

function parseOptions(raw: string | null | undefined): ResponseOption[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ResponseOption[];
  } catch {
    return [];
  }
}

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
}: {
  issue: Issue;
  isResolved: boolean;
  currentIxTime: number;
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
  const daysRemaining = showDeadline ? (issue.deadlineIxTime! - currentIxTime) / DAY_MS : 0;
  const isUrgent = daysRemaining < 3;

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
        {showDeadline && (
          <Badge variant={isUrgent ? "destructive" : "outline"}>
            {isUrgent ? <Flame /> : <Clock />}
            {daysRemaining <= 0 ? "DEADLINE EXPIRED" : `${Math.ceil(daysRemaining)} days remaining`}
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

      <p className="text-label-secondary text-body leading-relaxed">{issue.description}</p>
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
          {issue.status === "auto_resolved" ? "Auto-Resolved" : "Decision Made"}
        </span>
        {issue.ixCreditsAwarded > 0 && (
          <Badge variant="warning">
            +{issue.ixCreditsAwarded}
            <IxCreditsSymbol className="h-3 w-3 shrink-0" />
          </Badge>
        )}
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
  isCommissioning,
  onCommission,
}: {
  recon: ReconData;
  currentIxTime: number;
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
          Your team is researching. Findings arrive in{" "}
          {Math.max(1, Math.ceil(((recon.readyIxTime ?? 0) - currentIxTime) / DAY_MS))} day(s).
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

function OptionCard({
  option,
  isConfirming,
  isPending,
  onChoose,
  onCancel,
  onConfirm,
}: {
  option: ResponseOption;
  isConfirming: boolean;
  isPending: boolean;
  onChoose: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { previewEffects, isRisky } = option;
  const approval = previewEffects.publicApproval;
  const impacts = [
    ["Economy", previewEffects.economicImpact],
    ["Stability", previewEffects.stabilityImpact],
    ["Diplomacy", previewEffects.diplomaticImpact],
  ] as const;

  return (
    <Card
      className={cn(
        "rounded-row flex items-start justify-between gap-3 p-4 transition-[border-color,box-shadow] duration-150",
        isConfirming
          ? isRisky
            ? "border-destructive ring-destructive/40 ring-1"
            : "border-ring ring-tint ring-1"
          : isRisky
            ? "border-destructive/40"
            : "hover:border-ring/60"
      )}
    >
      <div className="min-w-0 flex-1">
        <h4 className={cn("text-headline mb-1", isRisky ? "text-destructive" : "text-label")}>
          {option.label}
        </h4>
        <p className="text-label-secondary text-footnote mb-2">{option.description}</p>

        <div className="text-footnote flex flex-wrap gap-2">
          {approval != null && approval !== 0 && (
            <EffectBadge label="Approval" value={approval} isNumeric />
          )}
          {impacts.map(
            ([label, impact]) => impact && <EffectBadge key={label} label={label} impact={impact} />
          )}
        </div>

        {option.recommendedDirective && (
          <p className="text-label-secondary bg-fill-3 rounded-control text-footnote mt-2 flex items-center gap-2 px-3 py-2">
            <Command className="h-3 w-3 shrink-0" />
            <span className="line-clamp-2">
              Recommended directive: &ldquo;{option.recommendedDirective}&rdquo;
            </span>
          </p>
        )}

        {isRisky && (
          <p className="text-destructive text-footnote mt-2 flex items-start gap-2 leading-snug">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Risky choice: it may backfire or hurt stability.
          </p>
        )}
      </div>

      <div className="shrink-0">
        {isConfirming ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onCancel}
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isRisky ? "destructive" : "default"}
              onClick={onConfirm}
              disabled={isPending}
            >
              {isPending ? "Confirming…" : "Confirm"}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={isRisky ? "text-destructive" : undefined}
            onClick={onChoose}
          >
            Choose
          </Button>
        )}
      </div>
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

  const respondM = api.nationalIssues.respond.useMutation({
    onSuccess: async (res: { recommendedDirective?: string }) => {
      setShowOutcome(true);
      setConfirmingOptionId(null);
      setLocalDirective(res?.recommendedDirective);
      await utils.nationalIssues.getIssue.invalidate();
      await utils.nationalIssues.getMyIssues.invalidate();
      await utils.nationalIssues.getPendingCount.invalidate();
    },
    onError: (e: { message?: string }) => notify.error("Failed to submit response", e?.message),
  });
  const dismissM = api.nationalIssues.dismiss.useMutation({
    onSuccess: () => {
      notify.success("Issue delegated to civil service.");
      invalidateIssues();
      onClose?.();
    },
    onError: (e: { message?: string }) => notify.error("Failed to delegate issue", e?.message),
  });
  const scheduleMeetingM = api.quickActions.createMeeting.useMutation({
    onSuccess: () => {
      notify.success("Cabinet Meeting scheduled on your Executive Agenda for next week.");
      void utils.nationalIssues.getMyIssues.invalidate();
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
  const currentIxTime = IxTime.getCurrentIxTime();
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
      <IssueHero issue={issue} isResolved={isResolved} currentIxTime={currentIxTime} />

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
              <span className="text-label-secondary text-footnote">4 action pathways</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <PathwayButton
                icon={Users}
                label="Delegate"
                sub={canDismiss ? "-15 CivCap" : "Unavailable"}
                onClick={() => dismissM.mutate({ id: issue.id })}
                disabled={!canDismiss || dismissM.isPending}
              />
              <PathwayButton
                icon={Sliders}
                label="Resolve brief"
                sub="Base 3 Options"
                onClick={() =>
                  document
                    .getElementById("issue-brief-options")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
              <PathwayButton
                icon={CalendarClock}
                label={scheduleMeetingM.isPending ? "Scheduling…" : "Set Meeting"}
                sub="+7d Agenda"
                onClick={handleSetMeeting}
                disabled={scheduleMeetingM.isPending}
              />
              <PathwayButton
                icon={Command}
                label="Make Directive"
                sub="Custom Tune"
                accent
                onClick={() => {
                  onClose?.();
                  onDeclare?.(issue.title);
                }}
              />
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

const IMPACT_TONE: Record<string, string> = {
  positive: "text-green",
  moderate_positive: "text-green",
  minor_positive: "text-green/80",
  negligible: "text-label-secondary",
  minor_negative: "text-destructive/80",
  moderate_negative: "text-destructive",
  significant_negative: "text-destructive",
  negative: "text-destructive",
};

function EffectBadge({
  label,
  value,
  impact,
  isNumeric,
}: {
  label: string;
  value?: number;
  impact?: string;
  isNumeric?: boolean;
}) {
  const isNumber = isNumeric && value != null;
  if (!isNumber && !impact) return null;

  const tone = isNumber
    ? value > 0
      ? "text-green"
      : value < 0
        ? "text-destructive"
        : "text-label-secondary"
    : (IMPACT_TONE[impact!] ?? "text-label-secondary");

  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold", tone)}>
      {isNumber ? `${value > 0 ? "+" : ""}${value} ${label}` : label}
    </span>
  );
}
