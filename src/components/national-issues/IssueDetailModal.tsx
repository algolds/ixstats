"use client";

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
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { IxTime } from "~/lib/ixtime";
import { IxTimeDate } from "~/components/ui/ix-time-date";
import { useNotify } from "~/hooks/useNotify";

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
  isResponding?: boolean;
  countryId?: string;
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
  isResponding,
}: IssueDetailModalProps) {
  const [confirmingOptionId, setConfirmingOptionId] = useState<string | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);
  const [localOutcome, setLocalOutcome] = useState<string | null>(null);
  const notify = useNotify();

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

        {/* Response Options (only if not resolved) */}
        {!isResolved && !showOutcome && (
          <div className="mt-4 space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Your Response
            </h3>

            {options.map((option) => {
              const isConfirming = confirmingOptionId === option.id;

              return (
                <div
                  key={option.id}
                  className={`rounded-lg border p-3 transition-all ${
                    isConfirming
                      ? "border-amber-500/50 bg-amber-500/10"
                      : "border-white/10 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="mb-1 text-sm font-medium">{option.label}</h4>
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
                            className="h-7 bg-amber-600 px-3 text-xs hover:bg-amber-700"
                            onClick={() => handleRespond(option.id)}
                            disabled={isResponding ?? false}
                          >
                            {isResponding ? "..." : "Confirm"}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setConfirmingOptionId(option.id)}
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
