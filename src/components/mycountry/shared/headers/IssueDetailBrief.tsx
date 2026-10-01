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
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { useNotify } from "~/hooks/useNotify";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

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
 * v2 issue drill — the modern twin of the legacy IssueDetailModal. Renders inside
 * the right-side drill sheet with recon / respond / dismiss, and a post-resolve
 * "Declare Follow-Up Directive" CTA wired to the composer pre-fill conduit.
 */
export interface IssueDetailBriefProps {
  issueId: string;
  onDeclare?: (prefilledGoal?: string) => void;
  onClose?: () => void;
}

export type V2IssueDetailProps = IssueDetailBriefProps;

export function IssueDetailBrief({ issueId, onDeclare, onClose }: IssueDetailBriefProps) {
  const notify = useNotify();
  const [confirmingOptionId, setConfirmingOptionId] = useState<string | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);

  const utils = api.useUtils();
  const issueQuery = api.nationalIssues.getIssue.useQuery({ id: issueId }, { enabled: !!issueId });
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
      void utils.nationalIssues.getMyIssues.invalidate();
      void utils.nationalIssues.getPendingCount.invalidate();
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

  const reconQuery = api.nationalIssues.getReconReveal.useQuery(
    { issueId },
    { enabled: !!issueId, refetchInterval: 30000 }
  );
  const commissionRecon = api.nationalIssues.commissionRecon.useMutation({
    onSuccess: () => {
      void reconQuery.refetch();
      notify.success("Cabinet research commissioned — findings will land shortly.");
    },
    onError: (e: { message?: string }) => notify.error("Could not commission research", e?.message),
  });

  const [localDirective, setLocalDirective] = useState<string | undefined>(undefined);

  const issue = issueQuery.data;

  const options = useMemo<ResponseOption[]>(() => {
    if (!issue?.responseOptions) return [];
    try {
      return JSON.parse(issue.responseOptions) as ResponseOption[];
    } catch {
      return [];
    }
  }, [issue?.responseOptions]);

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

  const domain = DOMAIN_CONFIG[issue.domain] ?? DOMAIN_CONFIG.economic!;
  const DomainIcon = domain.icon;
  const isResolved = issue.status === "responded" || issue.status === "auto_resolved";
  const hasDeadline = issue.deadlineIxTime != null;
  const currentIxTime = IxTime.getCurrentIxTime();

  let timeRemainingText = "";
  let isUrgent = false;
  if (hasDeadline && !isResolved) {
    const remaining = issue.deadlineIxTime! - currentIxTime;
    const daysRemaining = remaining / (24 * 60 * 60 * 1000);
    timeRemainingText =
      daysRemaining <= 0 ? "DEADLINE EXPIRED" : `${Math.ceil(daysRemaining)} days remaining`;
    isUrgent = daysRemaining <= 0 || daysRemaining < 3;
  }

  const canDismiss =
    !isResolved &&
    !showOutcome &&
    !hasDeadline &&
    issue.severity !== "critical" &&
    issue.severity !== "CRITICAL" &&
    issue.severity !== "high" &&
    issue.severity !== "HIGH" &&
    issue.urgency <= 70;

  const chosenDirective =
    localDirective ??
    options.find((o: ResponseOption) => o.id === issue.chosenOptionId)?.recommendedDirective;

  const handleSetMeeting = () => {
    if (!issue) return;
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    scheduleMeetingM.mutate({
      countryId: issue.countryId,
      userId: issue.countryId,
      meeting: {
        title: `Cabinet Meeting: ${issue.title}`,
        description: `Scheduled cabinet deliberation to address national issue '${issue.title}'. High-information analysis unlocked.`,
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

  const severityTone =
    issue.severity.toLowerCase() === "critical"
      ? "text-destructive"
      : issue.severity.toLowerCase() === "high"
        ? "text-yellow"
        : "text-label-secondary";

  return (
    <div className="space-y-5 pb-4">
      {/* Issue Hero */}
      <FacetCard className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <DomainIcon />
            {domain.label}
          </Badge>
          <Badge variant="outline" className={cn("capitalize", severityTone)}>
            {issue.severity.toLowerCase()}
          </Badge>
          {hasDeadline && !isResolved && (
            <Badge variant={isUrgent ? "destructive" : "outline"}>
              {isUrgent ? <Flame /> : <Clock />}
              {timeRemainingText}
            </Badge>
          )}
        </div>

        <div>
          <h2 className="text-label text-title-3">{issue.title}</h2>
          {issue.intentId && (
            <Badge variant="secondary" className="mt-2">
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
      </FacetCard>

      {/* Outcome Display (after response) */}
      {(isResolved || showOutcome) && (issue.consequenceLog || options.length > 0) && (
        <FacetCard className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle className="text-green h-4 w-4" />
            <span className="text-label text-headline">
              {issue.status === "auto_resolved" ? "Auto-Resolved" : "Decision Made"}
            </span>
            {issue.ixCreditsAwarded > 0 && (
              <Badge variant="yellow">
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
          {chosenDirective && onDeclare && (
            <Button
              type="button"
              onClick={() => {
                onClose?.();
                onDeclare(chosenDirective);
              }}
              className="bg-yellow text-on-yellow hover:bg-yellow/90 mt-1"
            >
              <Command className="h-4 w-4" />
              Declare Follow-Up Directive
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          )}
        </FacetCard>
      )}

      {/* Statecraft Recon */}
      {!isResolved && !showOutcome && reconQuery.data && reconQuery.data.status !== "disabled" && (
        <FacetCard className="flex flex-col gap-2 p-4">
          <h3 className="text-label text-headline flex items-center gap-2">
            <Sliders className="text-label-secondary h-4 w-4" />
            Cabinet Research
          </h3>
          {reconQuery.data.status === "none" && (
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
                onClick={() => commissionRecon.mutate({ issueId: issue.id })}
                disabled={commissionRecon.isPending}
              >
                {commissionRecon.isPending ? "Commissioning…" : "Commission"}
              </Button>
            </div>
          )}
          {reconQuery.data.status === "pending" && (
            <p className="text-label-secondary text-footnote flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Your team is researching — findings land in{" "}
              {Math.max(
                1,
                Math.ceil(
                  ((reconQuery.data.readyIxTime ?? 0) - currentIxTime) / (24 * 60 * 60 * 1000)
                )
              )}{" "}
              day(s).
            </p>
          )}
          {reconQuery.data.status === "ready" && (
            <div className="space-y-2">
              {(reconQuery.data.options as ReconOptionItem[]).map((o: ReconOptionItem) => (
                <div key={o.optionId} className="bg-fill-3 rounded-control p-2">
                  <p className="text-label text-caption mb-1 font-semibold">{o.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {o.reveals.length === 0 && (
                      <span className="text-label-secondary text-footnote">
                        No measurable effects.
                      </span>
                    )}
                    {o.reveals.map((r: ReconRevealItem, i: number) => {
                      const field = r.targetField
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (c: string) => c.toUpperCase());
                      const val =
                        r.value == null
                          ? "—"
                          : r.operation === "multiply"
                            ? `×${r.value}`
                            : r.operation === "set"
                              ? `=${r.value}`
                              : `${r.operation === "subtract" ? "-" : "+"}${Math.abs(r.value)}`;
                      const cls =
                        r.state === "greyed"
                          ? "text-label-tertiary"
                          : r.state === "questioned"
                            ? "text-yellow"
                            : "text-green";
                      return (
                        <span
                          key={i}
                          title={r.reason ?? undefined}
                          className={cn(
                            "bg-surface text-footnote rounded-control-sm px-2 py-0.5",
                            cls
                          )}
                        >
                          {field}: {val}
                          {r.state === "questioned" ? " ?" : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-label-secondary text-footnote">
                Greyed = your government can&apos;t assess it · &ldquo;?&rdquo; = may be inaccurate.
              </p>
            </div>
          )}
        </FacetCard>
      )}

      {/* Response Options & 4-Choice Resolution Lifecycle Hub */}
      {!isResolved && !showOutcome && (
        <div className="space-y-3">
          {/* Unified 4-Branch Lifecycle Action Strip */}
          <FacetCard className="space-y-3 p-4">
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
                label="Resolve Brief"
                sub="Base 3 Options"
                onClick={() => {
                  const el = document.getElementById("issue-brief-options");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
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
          </FacetCard>

          <div id="issue-brief-options" className="space-y-2 pt-1">
            {options.map((option: ResponseOption) => {
              const isConfirming = confirmingOptionId === option.id;
              return (
                <FacetCard
                  key={option.id}
                  className={cn(
                    "rounded-row flex items-start justify-between gap-3 p-4 transition-[border-color,box-shadow] duration-150",
                    isConfirming
                      ? option.isRisky
                        ? "border-destructive ring-destructive/40 ring-1"
                        : "border-ring ring-tint ring-1"
                      : option.isRisky
                        ? "border-destructive/40"
                        : "hover:border-ring/60"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <h4
                      className={cn(
                        "text-headline mb-1",
                        option.isRisky ? "text-destructive" : "text-label"
                      )}
                    >
                      {option.label}
                    </h4>
                    <p className="text-label-secondary text-footnote mb-2">{option.description}</p>

                    <div className="text-footnote flex flex-wrap gap-2">
                      {option.previewEffects.publicApproval != null &&
                        option.previewEffects.publicApproval !== 0 && (
                          <EffectBadge
                            label="Approval"
                            value={option.previewEffects.publicApproval}
                            isNumeric
                          />
                        )}
                      {option.previewEffects.economicImpact && (
                        <EffectBadge
                          label="Economy"
                          impact={option.previewEffects.economicImpact}
                        />
                      )}
                      {option.previewEffects.stabilityImpact && (
                        <EffectBadge
                          label="Stability"
                          impact={option.previewEffects.stabilityImpact}
                        />
                      )}
                      {option.previewEffects.diplomaticImpact && (
                        <EffectBadge
                          label="Diplomacy"
                          impact={option.previewEffects.diplomaticImpact}
                        />
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

                    {option.isRisky && (
                      <p className="text-destructive text-footnote mt-2 flex items-start gap-2 leading-snug">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Risky choice — carries risk of negative outcomes or stability backlash.
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
                          onClick={() => setConfirmingOptionId(null)}
                          aria-label="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={option.isRisky ? "destructive" : "default"}
                          onClick={() =>
                            respondM.mutate({ issueId: issue.id, optionId: option.id })
                          }
                          disabled={respondM.isPending}
                        >
                          {respondM.isPending ? "Confirming…" : "Confirm"}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={option.isRisky ? "text-destructive" : undefined}
                        onClick={() => setConfirmingOptionId(option.id)}
                      >
                        Choose
                      </Button>
                    )}
                  </div>
                </FacetCard>
              );
            })}
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
      variant="bordered"
      size="md"
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

  if (isNumeric && value != null) {
    const tone = value > 0 ? "text-green" : value < 0 ? "text-destructive" : "text-label-secondary";
    return (
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", tone)}>
        {value > 0 ? "+" : ""}
        {value} {label}
      </span>
    );
  }

  if (impact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-semibold",
          IMPACT_TONE[impact] ?? "text-label-secondary"
        )}
      >
        {label}
      </span>
    );
  }

  return null;
}

export const V2IssueDetail = IssueDetailBrief;
