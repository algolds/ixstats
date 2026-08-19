"use client";

import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  Landmark,
  Users,
  Shield,
  Globe,
  Building,
  Leaf,
  Clock,
  Flame,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  Command,
  Sliders,
  X,
  Calendar,
  CalendarClock,
} from "lucide-react";
import { motion } from "motion/react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { useNotify } from "~/hooks/useNotify";

const DOMAIN_CONFIG: Record<string, { icon: typeof TrendingUp; label: string }> = {
  economic: { icon: TrendingUp, label: "Economic" },
  political: { icon: Landmark, label: "Political" },
  social: { icon: Users, label: "Social" },
  military: { icon: Shield, label: "Military" },
  diplomatic: { icon: Globe, label: "Diplomatic" },
  infrastructure: { icon: Building, label: "Infrastructure" },
  environmental: { icon: Leaf, label: "Environmental" },
};

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
    onSuccess: async (res: any) => {
      setShowOutcome(true);
      setConfirmingOptionId(null);
      setLocalDirective(res?.recommendedDirective);
      await utils.nationalIssues.getIssue.invalidate();
      await utils.nationalIssues.getMyIssues.invalidate();
      await utils.nationalIssues.getPendingCount.invalidate();
    },
    onError: (e: any) => notify.error("Failed to submit response", e?.message),
  });
  const dismissM = api.nationalIssues.dismiss.useMutation({
    onSuccess: () => {
      notify.success("Issue delegated to civil service.");
      void utils.nationalIssues.getMyIssues.invalidate();
      void utils.nationalIssues.getPendingCount.invalidate();
      onClose?.();
    },
    onError: (e: any) => notify.error("Failed to delegate issue", e?.message),
  });

  const scheduleMeetingM = api.quickActions.createMeeting.useMutation({
    onSuccess: () => {
      notify.success("Cabinet Meeting scheduled on your Executive Agenda for next week.");
      void utils.nationalIssues.getMyIssues.invalidate();
      onClose?.();
    },
    onError: (e: any) => notify.error("Failed to schedule meeting", e?.message),
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
    onError: (e: any) => notify.error("Could not commission research", e?.message),
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
    return <div className="text-muted-foreground py-8 text-center text-sm">Loading issue...</div>;
  }

  if (!issue) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
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

  return (
    <div className="space-y-5 pb-4">
      {/* Issue Hero */}
      <FacetCard depth={1} className="bg-card/40 flex flex-col gap-3 p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border-border/40 bg-muted/20 text-muted-foreground flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase">
            <DomainIcon className="h-3 w-3" />
            {domain.label}
          </span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase",
              issue.severity === "critical" || issue.severity === "CRITICAL"
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : issue.severity === "high" || issue.severity === "HIGH"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-blue-500/30 bg-blue-500/10 text-blue-400"
            )}
          >
            {issue.severity.toUpperCase()}
          </span>
          {hasDeadline && !isResolved && (
            <span
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold",
                isUrgent
                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-border/40 bg-muted/20 text-muted-foreground"
              )}
            >
              {isUrgent ? <Flame className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {timeRemainingText}
            </span>
          )}
        </div>

        <div>
          <h2 className="text-foreground text-xl leading-snug font-extrabold tracking-tight">
            {issue.title}
          </h2>
          {issue.intentId && (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-purple-400">
              <Command className="h-3 w-3" />
              Linked to an active directive
            </span>
          )}
        </div>

        <p className="text-muted-foreground text-xs leading-relaxed font-medium">
          {issue.description}
        </p>
        {issue.longDescription && (
          <div className="text-muted-foreground border-border/40 border-l-2 pl-3 text-xs leading-relaxed font-medium whitespace-pre-line">
            {issue.longDescription}
          </div>
        )}
      </FacetCard>

      {/* Outcome Display (after response) */}
      {(isResolved || showOutcome) && (issue.consequenceLog || options.length > 0) && (
        <FacetCard
          depth={1}
          className="flex flex-col gap-2.5 border-emerald-500/20 bg-emerald-500/5 p-4 backdrop-blur-md"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">
              {issue.status === "auto_resolved" ? "Auto-Resolved" : "Decision Made"}
            </span>
            {issue.ixCreditsAwarded > 0 && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-400">
                +{issue.ixCreditsAwarded} IxC
              </span>
            )}
          </div>
          {issue.consequenceLog && (
            <p className="text-muted-foreground text-xs leading-relaxed font-medium whitespace-pre-line">
              {issue.consequenceLog}
            </p>
          )}

          {/* Post-resolve CTA: Declare Follow-Up Directive */}
          {chosenDirective && onDeclare && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onClose?.();
                onDeclare(chosenDirective);
              }}
              className="mt-1 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs font-extrabold text-amber-800 shadow-xs transition-all hover:bg-amber-500/20 dark:text-amber-300"
            >
              <Command className="h-4 w-4" />
              <span>Declare Follow-Up Directive →</span>
              <ArrowUpRight className="h-4 w-4 opacity-70" />
            </motion.button>
          )}
        </FacetCard>
      )}

      {/* Statecraft Recon */}
      {!isResolved && !showOutcome && reconQuery.data && reconQuery.data.status !== "disabled" && (
        <FacetCard
          depth={1}
          className="flex flex-col gap-2.5 border-sky-500/20 bg-sky-500/[0.03] p-4 backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
            <Sliders className="h-4 w-4" />
            <span>Cabinet Research</span>
          </div>
          {reconQuery.data.status === "none" && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Commission a meeting to reveal the hard projected effects behind each option. Costs
                administrative capacity.
              </p>
              <button
                type="button"
                onClick={() => commissionRecon.mutate({ issueId: issue.id })}
                disabled={commissionRecon.isPending}
                className="shrink-0 cursor-pointer rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[11px] font-bold text-sky-400 transition-all hover:bg-sky-500/20"
              >
                {commissionRecon.isPending ? "..." : "Commission"}
              </button>
            </div>
          )}
          {reconQuery.data.status === "pending" && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
              <Clock className="h-3.5 w-3.5 animate-pulse text-sky-400" />
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
              {reconQuery.data.options.map((o: any) => (
                <div
                  key={o.optionId}
                  className="border-border/40 bg-card/30 rounded-lg border p-2.5"
                >
                  <p className="text-foreground/90 mb-1 text-xs font-semibold">{o.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {o.reveals.length === 0 && (
                      <span className="text-muted-foreground/60 text-[10px]">
                        No measurable effects.
                      </span>
                    )}
                    {o.reveals.map((r: any, i: number) => {
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
                          ? "text-muted-foreground/50"
                          : r.state === "questioned"
                            ? "text-amber-400/90"
                            : "text-emerald-400/90";
                      return (
                        <span
                          key={i}
                          title={r.reason ?? undefined}
                          className={cn("rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px]", cls)}
                        >
                          {field}: {val}
                          {r.state === "questioned" ? " ?" : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-muted-foreground/50 text-[9px]">
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
          <div className="bg-card/60 space-y-2 rounded-2xl border border-white/15 border-t-white/30 p-3.5 shadow-lg backdrop-blur-2xl dark:border-white/10 dark:border-t-white/20 dark:bg-zinc-900/60">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <h4 className="text-muted-foreground flex items-center gap-1.5 text-xs font-extrabold tracking-widest uppercase">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Executive Issue Resolution
              </h4>
              <span className="text-muted-foreground/70 font-mono text-[10px] font-bold">
                4 Action Pathways
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {/* 1a: Delegate */}
              {canDismiss ? (
                <button
                  type="button"
                  onClick={() => dismissM.mutate({ id: issue.id })}
                  disabled={dismissM.isPending}
                  className="bg-muted/20 hover:bg-muted/40 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-white/10 p-2.5 text-center shadow-xs backdrop-blur-md transition-all active:scale-95"
                >
                  <Users className="text-muted-foreground h-4 w-4" />
                  <span className="text-foreground text-[11px] font-bold">Delegate</span>
                  <span className="text-muted-foreground/70 font-mono text-[9px]">-15 CivCap</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="border-border/30 bg-muted/10 flex cursor-not-allowed flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center opacity-50"
                >
                  <Users className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground text-[11px] font-bold">Delegate</span>
                  <span className="text-muted-foreground/50 text-[9px]">Unavailable</span>
                </button>
              )}

              {/* 1b: Resolve in Brief */}
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("issue-brief-options");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-center shadow-xs backdrop-blur-md transition-all hover:bg-cyan-500/20 active:scale-95 dark:border-cyan-400/25 dark:bg-cyan-400/10"
              >
                <Sliders className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                <span className="text-[11px] font-bold text-cyan-950 dark:text-cyan-200">
                  Resolve Brief
                </span>
                <span className="text-[9px] text-cyan-800/70 dark:text-cyan-300/70">
                  Base 3 Options
                </span>
              </button>

              {/* 1c: Set Cabinet Meeting */}
              <button
                type="button"
                onClick={handleSetMeeting}
                disabled={scheduleMeetingM.isPending}
                className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5 text-center shadow-xs backdrop-blur-md transition-all hover:bg-blue-500/20 active:scale-95 dark:border-blue-400/25 dark:bg-blue-400/10"
              >
                <CalendarClock className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                <span className="text-[11px] font-bold text-blue-950 dark:text-blue-200">
                  {scheduleMeetingM.isPending ? "Scheduling..." : "Set Meeting"}
                </span>
                <span className="text-[9px] text-blue-800/70 dark:text-blue-300/70">
                  +7d Agenda
                </span>
              </button>

              {/* 1d: Make Directive */}
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onDeclare?.(issue.title);
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-center shadow-xs backdrop-blur-md transition-all hover:bg-amber-500/20 active:scale-95 dark:border-amber-400/25 dark:bg-amber-400/10"
              >
                <Command className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <span className="text-[11px] font-bold text-amber-950 dark:text-amber-200">
                  Make Directive
                </span>
                <span className="text-[9px] text-amber-800/70 dark:text-amber-300/70">
                  Custom Tune
                </span>
              </button>
            </div>
          </div>

          <div id="issue-brief-options" className="space-y-2.5 pt-1">
            {options.map((option: ResponseOption) => {
              const isConfirming = confirmingOptionId === option.id;
              return (
                <FacetCard
                  key={option.id}
                  depth={1}
                  className={cn(
                    "flex items-start justify-between gap-3 p-4 backdrop-blur-md transition-all",
                    isConfirming
                      ? option.isRisky
                        ? "border-red-500/50 bg-red-500/10"
                        : "border-amber-500/50 bg-amber-500/10"
                      : option.isRisky
                        ? "border-red-500/20 bg-red-500/5 hover:border-red-500/40 hover:bg-red-500/10"
                        : "border-border/40 hover:border-border dark:hover:border-white/20"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <h4
                      className={cn(
                        "mb-1 text-sm font-bold",
                        option.isRisky ? "text-red-400" : "text-foreground"
                      )}
                    >
                      {option.label}
                    </h4>
                    <p className="text-muted-foreground mb-2 text-xs">{option.description}</p>

                    <div className="flex flex-wrap gap-2 text-[10px]">
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
                      <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-500/5 px-2.5 py-1.5 text-[10px] font-semibold text-purple-400/90">
                        <Command className="h-3 w-3 shrink-0" />
                        <span className="line-clamp-2">
                          Recommended directive: &ldquo;{option.recommendedDirective}&rdquo;
                        </span>
                      </div>
                    )}

                    {option.isRisky && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-400">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse" />
                        <span className="text-[10px] leading-snug">
                          Risky choice — carries risk of negative outcomes or stability backlash.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    {isConfirming ? (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmingOptionId(null)}
                          className="border-border/50 text-muted-foreground hover:text-foreground flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            respondM.mutate({ issueId: issue.id, optionId: option.id })
                          }
                          disabled={respondM.isPending}
                          className={cn(
                            "h-7 cursor-pointer rounded-lg px-3 text-xs font-bold text-white transition-all",
                            option.isRisky
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-amber-600 hover:bg-amber-700"
                          )}
                        >
                          {respondM.isPending ? "..." : "Confirm"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingOptionId(option.id)}
                        className={cn(
                          "h-7 cursor-pointer rounded-lg border px-3 text-xs font-bold transition-all",
                          option.isRisky
                            ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                            : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/20"
                        )}
                      >
                        Choose
                      </button>
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
    positive: "text-emerald-400",
    moderate_positive: "text-emerald-400",
    minor_positive: "text-emerald-400/70",
    negligible: "text-muted-foreground",
    minor_negative: "text-red-400/70",
    moderate_negative: "text-red-400",
    significant_negative: "text-red-500",
    negative: "text-red-400",
  };

  if (isNumeric && value != null) {
    const tone =
      value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-muted-foreground";
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
          IMPACT_TONE[impact] ?? "text-muted-foreground"
        )}
      >
        {label}
      </span>
    );
  }

  return null;
}

export const V2IssueDetail = IssueDetailBrief;
