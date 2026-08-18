"use client";

import { api } from "~/trpc/react";
import { useState, useCallback, memo } from "react";
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
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertTriangle,
  X,
  Sliders,
  Calendar,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { IxTime } from "~/lib/ixtime";
import { IxTimeDate } from "~/components/ui/ix-time-date";
import { useNotify } from "~/hooks/useNotify";
import { ParadoxFlavorCard } from "~/components/narrator/ParadoxFlavorCard";

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
  isAutoResolveDefault?: boolean;
  isRisky?: boolean;
  partyAlignment?: string;
  brokerAlignment?: string;
  costMessage?: string;
}

interface IssueDetailModalProps {
  issue: {
    id: string;
    title: string;
    description: string;
    longDescription: string | null;
    domain: string;
    severity: string;
    urgency: number;
    status: string;
    deadlineIxTime: number | null;
    createdIxTime: number;
    responseOptions: string;
    chosenOptionId: string | null;
    chosenOptionLabel: string | null;
    consequenceLog: string | null;
    ixCreditsAwarded: number;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onRespond?: (issueId: string, optionId: string) => Promise<any>;
  onDismiss?: (issueId: string) => Promise<any>;
  isResponding?: boolean;
  countryId?: string;
  onDraftPolicy?: (issue: any) => void;
  onScheduleMeeting?: (issue: any) => void;
}

const DOMAIN_CONFIG: Record<string, { icon: typeof TrendingUp; label: string }> = {
  economic: { icon: TrendingUp, label: "Economic" },
  political: { icon: Landmark, label: "Political" },
  social: { icon: Users, label: "Social" },
  military: { icon: Shield, label: "Military" },
  diplomatic: { icon: Globe, label: "Diplomatic" },
  infrastructure: { icon: Building, label: "Infrastructure" },
  environmental: { icon: Leaf, label: "Environmental" },
};

const IMPACT_ICONS: Record<string, { icon: typeof ArrowUp; color: string }> = {
  positive: { icon: ArrowUp, color: "text-green-400" },
  moderate_positive: { icon: ArrowUp, color: "text-green-400" },
  minor_positive: { icon: ArrowUp, color: "text-green-400/70" },
  negligible: { icon: Minus, color: "text-slate-400" },
  minor_negative: { icon: ArrowDown, color: "text-red-400/70" },
  moderate_negative: { icon: ArrowDown, color: "text-red-400" },
  significant_negative: { icon: ArrowDown, color: "text-red-500" },
  negative: { icon: ArrowDown, color: "text-red-400" },
};

function IssueDetailModalInner({
  issue,
  isOpen,
  onClose,
  onRespond,
  onDismiss,
  isResponding,
  countryId,
  onDraftPolicy,
  onScheduleMeeting,
}: IssueDetailModalProps) {
  const [confirmingOptionId, setConfirmingOptionId] = useState<string | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);
  const [localOutcome, setLocalOutcome] = useState<string | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);
  const notify = useNotify();

  // Statecraft recon (S1.D): cabinet research that reveals the hard numbers with fog.
  const reconQuery = api.nationalIssues.getReconReveal.useQuery(
    { issueId: issue?.id ?? "" },
    { enabled: !!issue?.id && isOpen, refetchInterval: 30000 }
  );
  const commissionRecon = api.nationalIssues.commissionRecon.useMutation({
    onSuccess: () => {
      void reconQuery.refetch();
      notify.success("Cabinet research commissioned — findings will land shortly.");
    },
    onError: (e: { message: string }) => notify.error("Could not commission research", e.message),
  });

  const { data: activePolicies = [] } = api.policies.getPolicies.useQuery(
    { countryId: countryId!, status: "active" },
    { enabled: !!countryId && isOpen }
  );

  const handleRespond = useCallback(
    async (optionId: string) => {
      if (!issue) return;

      // Find the selected option for its outcome text
      let options: ResponseOption[] = [];
      try {
        options = JSON.parse(issue.responseOptions) as ResponseOption[];
      } catch {
        /* */
      }
      const selected = options.find((o) => o.id === optionId);

      if (!onRespond) {
        notify.error("Unable to submit a response right now. Please try again.");
        return;
      }

      // Server is the source of truth — only show the outcome once it persists.
      try {
        await onRespond(issue.id, optionId);
        setLocalOutcome(selected?.outcomeText ?? "Decision recorded.");
        setShowOutcome(true);
        setConfirmingOptionId(null);
      } catch (err: any) {
        notify.error("Failed to submit response", err?.message);
        setConfirmingOptionId(null);
      }
    },
    [issue, onRespond, notify]
  );

  const handleClose = useCallback(() => {
    setConfirmingOptionId(null);
    setShowOutcome(false);
    onClose();
  }, [onClose]);

  const handleDismiss = useCallback(async () => {
    if (!issue || !onDismiss) return;
    setIsDismissing(true);
    try {
      await onDismiss(issue.id);
      notify.success("Issue delegated to civil service.");
      handleClose();
    } catch (err: any) {
      notify.error("Failed to delegate issue", err?.message);
    } finally {
      setIsDismissing(false);
    }
  }, [issue, onDismiss, notify, handleClose]);

  if (!issue) return null;

  let options: ResponseOption[] = [];
  try {
    options = JSON.parse(issue.responseOptions) as ResponseOption[];
  } catch {
    // Invalid JSON
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
    if (daysRemaining <= 0) {
      timeRemainingText = "DEADLINE EXPIRED";
      isUrgent = true;
    } else if (daysRemaining < 3) {
      timeRemainingText = `${Math.ceil(daysRemaining)} days remaining`;
      isUrgent = true;
    } else {
      timeRemainingText = `${Math.ceil(daysRemaining)} days remaining`;
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <DomainIcon className="text-muted-foreground h-5 w-5" />
            <Badge variant="outline" className="text-xs">
              {domain.label}
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs ${
                issue.severity === "critical" || issue.severity === "CRITICAL"
                  ? "border-red-500/30 bg-red-500/20 text-red-400"
                  : issue.severity === "high" || issue.severity === "HIGH"
                    ? "border-amber-500/30 bg-amber-500/20 text-amber-400"
                    : "border-blue-500/30 bg-blue-500/20 text-blue-400"
              }`}
            >
              {issue.severity.toUpperCase()}
            </Badge>
            {hasDeadline && !isResolved && (
              <span
                className={`flex items-center gap-1 text-xs ${isUrgent ? "text-red-400" : "text-muted-foreground"}`}
              >
                {isUrgent ? <Flame className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                <IxTimeDate
                  date={new Date()}
                  ixTime={issue.deadlineIxTime!}
                  format="relative"
                  accentColor="amber"
                  className="border-none"
                />
                <span className="ml-0.5">({timeRemainingText})</span>
              </span>
            )}
          </div>
          <DialogTitle className="text-lg">{issue.title}</DialogTitle>
        </DialogHeader>

        {/* Narrative */}
        <div className="mt-2 space-y-3">
          <ParadoxFlavorCard
            id={issue.id}
            type="issue"
            title={issue.title}
            description={issue.description}
            countryId={countryId}
          />
          <p className="text-muted-foreground text-sm leading-relaxed">{issue.description}</p>
          {issue.longDescription && (
            <div className="text-muted-foreground border-l-2 border-white/10 pl-3 text-sm leading-relaxed whitespace-pre-line">
              {issue.longDescription}
            </div>
          )}
        </div>

        {/* Outcome Display (after response) */}
        {(isResolved || showOutcome) && (issue.consequenceLog || localOutcome) && (
          <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <span className="text-sm font-medium text-green-400">
                {issue.status === "auto_resolved" ? "Auto-Resolved" : "Decision Made"}
              </span>
              {issue.ixCreditsAwarded > 0 && (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/20 text-xs text-amber-400"
                >
                  +{issue.ixCreditsAwarded} IxC
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm whitespace-pre-line">
              {issue.consequenceLog || localOutcome}
            </p>
          </div>
        )}

        {!isResolved && (onDraftPolicy || onScheduleMeeting) && (
          <div className="border-border/40 mt-4 border-t pt-4">
            <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
              Executive Actions
            </h3>
            <div className="flex gap-2.5">
              {onDraftPolicy && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDraftPolicy(issue)}
                  className="h-9 flex-1 gap-2 border-indigo-500/20 text-xs text-indigo-300 hover:bg-indigo-500/10"
                >
                  <Sliders className="h-4 w-4" />
                  Draft Policy to Resolve
                </Button>
              )}
              {onScheduleMeeting && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onScheduleMeeting(issue)}
                  className="h-9 flex-1 gap-2 border-blue-500/20 text-xs text-blue-300 hover:bg-blue-500/10"
                >
                  <Calendar className="h-4 w-4" />
                  Schedule Cabinet Meeting
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Statecraft: Cabinet Research (recon) — reveals the hard numbers with fog */}
        {!isResolved &&
          !showOutcome &&
          reconQuery.data &&
          reconQuery.data.status !== "disabled" && (
            <div className="mt-4 space-y-2 rounded-lg border border-sky-500/20 bg-sky-500/[0.03] p-3">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Sliders className="h-4 w-4 text-sky-400" />
                Cabinet Research
              </h3>
              {reconQuery.data.status === "none" && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-muted-foreground text-xs">
                    Commission a meeting to reveal the hard projected effects behind each option.
                    Costs administrative Capacity.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={commissionRecon.isPending}
                    onClick={() => issue && commissionRecon.mutate({ issueId: issue.id })}
                  >
                    Commission
                  </Button>
                </div>
              )}
              {reconQuery.data.status === "pending" && (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
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
                  {reconQuery.data.options.map((o) => (
                    <div
                      key={o.optionId}
                      className="rounded border border-white/5 bg-white/[0.02] p-2"
                    >
                      <p className="text-foreground/90 mb-1 text-xs font-semibold">{o.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {o.reveals.length === 0 && (
                          <span className="text-muted-foreground/60 text-[10px]">
                            No measurable effects.
                          </span>
                        )}
                        {o.reveals.map((r, i) => {
                          const field = r.targetField
                            .replace(/([A-Z])/g, " $1")
                            .replace(/^./, (c) => c.toUpperCase());
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
                              className={`rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] ${cls}`}
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
                    Greyed = your government can&apos;t assess it · &ldquo;?&rdquo; = may be
                    inaccurate.
                  </p>
                </div>
              )}
            </div>
          )}

        {/* Response Options (only if not resolved) */}
        {!isResolved && !showOutcome && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Your Response
              </h3>
              {onDismiss &&
                !hasDeadline &&
                issue.severity !== "critical" &&
                issue.severity !== "CRITICAL" &&
                issue.severity !== "high" &&
                issue.severity !== "HIGH" &&
                issue.urgency <= 70 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-muted-foreground h-7 border-white/10 text-xs hover:text-white"
                    onClick={handleDismiss}
                    disabled={isDismissing}
                  >
                    {isDismissing ? "Delegating..." : "Delegate (-15 CivCap)"}
                  </Button>
                )}
            </div>

            {options.map((option) => {
              const isConfirming = confirmingOptionId === option.id;
              const requiredPolicyKey = (option as any).requiredPolicyKey;

              const isPolicyActive =
                !requiredPolicyKey ||
                activePolicies.some((p) => {
                  const nameMatch =
                    p.name.toLowerCase() === requiredPolicyKey.toLowerCase().replace(/-/g, " ");
                  let effectsMatch = false;
                  if (p.calculatedEffects) {
                    try {
                      const parsed = JSON.parse(p.calculatedEffects);
                      effectsMatch = parsed?.decretalKey === requiredPolicyKey;
                    } catch {}
                  }
                  return nameMatch || effectsMatch;
                });

              return (
                <div
                  key={option.id}
                  className={`rounded-lg border p-3 transition-all ${
                    isConfirming
                      ? option.isRisky
                        ? "border-red-500/50 bg-red-500/10"
                        : "border-amber-500/50 bg-amber-500/10"
                      : option.isRisky
                        ? "border-red-500/20 bg-red-500/5 hover:border-red-500/40 hover:bg-red-500/10"
                        : "border-white/10 hover:border-white/20 hover:bg-white/5"
                  } ${!isPolicyActive ? "opacity-75" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4
                        className={`mb-1 text-sm font-medium ${!isPolicyActive ? "text-muted-foreground" : ""} ${option.isRisky ? "text-red-400" : ""}`}
                      >
                        {option.label}
                      </h4>
                      <p className="text-muted-foreground mb-2 text-xs">{option.description}</p>

                      {/* Effect previews */}
                      <div className="flex flex-wrap gap-2">
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

                      {/* Alignment and Cost indicators */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {option.partyAlignment && (
                          <Badge
                            variant="secondary"
                            className="border-none bg-blue-500/10 text-[9px] font-semibold text-blue-400 hover:bg-blue-500/20"
                          >
                            ⚖️ Aligns: {option.partyAlignment}
                          </Badge>
                        )}
                        {option.brokerAlignment && (
                          <Badge
                            variant="secondary"
                            className="border-none bg-purple-500/10 text-[9px] font-semibold text-purple-400 hover:bg-purple-500/20"
                          >
                            💼 Aligns: {option.brokerAlignment}
                          </Badge>
                        )}
                        {option.costMessage && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 bg-amber-500/10 text-[9px] font-semibold text-amber-400"
                          >
                            ⚡ Cost: {option.costMessage}
                          </Badge>
                        )}
                      </div>

                      {/* Risky Warning */}
                      {option.isRisky && (
                        <div className="mt-2 flex items-start gap-1.5 rounded border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-400">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse text-red-400" />
                          <div>
                            <span className="text-[10px] font-semibold tracking-wider uppercase">
                              Risky Choice:
                            </span>
                            <p className="mt-0.5 text-[11px] leading-snug">
                              Taking this gamble carries a risk of negative outcomes, military
                              operations, or stability backlash.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Policy Requirement Warning */}
                      {requiredPolicyKey && !isPolicyActive && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-400">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                          <span>
                            Requires Active Policy:{" "}
                            {requiredPolicyKey
                              .split("-")
                              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                              .join(" ")}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      {isConfirming ? (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => setConfirmingOptionId(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            className={`h-7 px-3 text-xs text-white ${option.isRisky ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}
                            onClick={() => handleRespond(option.id)}
                            disabled={(isResponding ?? false) || !isPolicyActive}
                          >
                            {isResponding ? "..." : "Confirm"}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-7 text-xs ${option.isRisky ? "border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300" : ""}`}
                          onClick={() => setConfirmingOptionId(option.id)}
                          disabled={!isPolicyActive}
                        >
                          Choose
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
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
  if (isNumeric && value != null) {
    const isPositive = value > 0;
    const Icon = isPositive ? ArrowUp : value < 0 ? ArrowDown : Minus;
    const color = isPositive ? "text-green-400" : value < 0 ? "text-red-400" : "text-slate-400";

    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] ${color}`}>
        <Icon className="h-2.5 w-2.5" />
        {label} {value > 0 ? "+" : ""}
        {value}
      </span>
    );
  }

  if (impact) {
    const config = IMPACT_ICONS[impact] ?? IMPACT_ICONS.negligible!;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] ${config.color}`}>
        <Icon className="h-2.5 w-2.5" />
        {label}
      </span>
    );
  }

  return null;
}

export const IssueDetailModal = memo(IssueDetailModalInner);
