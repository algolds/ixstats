"use client";

import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";
import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Target,
  Calendar,
  Layers,
  Play,
  Pause,
  Sliders,
} from "lucide-react";
import { useNotify } from "~/hooks/useNotify";
import { ParadoxFlavorCard } from "~/components/narrator/ParadoxFlavorCard";
import { PREDEFINED_DECRETALS } from "~/lib/policies/registry";

interface PolicyDetailSheetProps {
  policyId: string | null;
  onClose: () => void;
  countryId: string;
  onPolicyChanged?: () => void;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "N/A";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function EffectBadge({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null || value === 0) return null;
  const isPositive = value > 0;
  const Icon = isPositive ? TrendingUp : value < 0 ? TrendingDown : Minus;
  const colorClass = isPositive
    ? "bg-green-50 text-green-700 dark:bg-green-950/20"
    : "bg-red-50 text-red-700 dark:bg-red-950/20";

  return (
    <div className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${colorClass}`}>
      <Icon className="h-3 w-3" />
      <span className="font-medium">{label}</span>
      <span>
        {isPositive ? "+" : ""}
        {value}%
      </span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-right text-xs font-medium">{value}</span>
    </div>
  );
}

function getActiveSettingsDisplay(
  decretalKey: string | undefined,
  settings: Record<string, number> | undefined
) {
  if (!decretalKey || !settings) return null;

  const decretal = PREDEFINED_DECRETALS[decretalKey];
  if (decretal) {
    return decretal.sliders.map((slider) => {
      const activeValue = settings[slider.key];
      const selectedOption = slider.options.find((opt) => opt.value === activeValue);
      return {
        label: slider.label,
        value: selectedOption ? selectedOption.label : String(activeValue ?? "N/A"),
      };
    });
  }

  // Fallback for custom DB templates
  return Object.entries(settings).map(([key, val]) => {
    let label = key.charAt(0).toUpperCase() + key.slice(1);
    if (key === "funding") label = "Funding Level";

    let valLabel = String(val);
    if (key === "funding") {
      const map: Record<number, string> = {
        1: "Minimal",
        2: "Standard",
        3: "High",
        4: "Extreme",
      };
      valLabel = map[val] ?? String(val);
    }

    return {
      label,
      value: valLabel,
    };
  });
}

export function PolicyDetailSheet({
  policyId,
  onClose,
  countryId: _countryId,
  onPolicyChanged,
}: PolicyDetailSheetProps) {
  const notify = useNotify();
  const isOpen = policyId !== null;

  const { data: policy, isLoading } = api.policies.getPolicy.useQuery(
    { id: policyId! },
    { enabled: !!policyId }
  );

  // Parse policy settings
  let decretalKey: string | undefined;
  let settings: Record<string, number> | undefined;
  let stabilityEffect: number | undefined;

  if (policy?.calculatedEffects) {
    try {
      const parsed = JSON.parse(policy.calculatedEffects);
      if (parsed && typeof parsed === "object" && "decretalKey" in parsed) {
        decretalKey = parsed.decretalKey;
        settings = parsed.settings;
        stabilityEffect = parsed.stabilityEffect;
      }
    } catch (e) {
      // Ignore
    }
  }

  const activatePolicy = api.policies.activatePolicy.useMutation({
    onSuccess: () => {
      notify.success("Policy activated!");
      onPolicyChanged?.();
      onClose();
    },
    onError: (error) => {
      notify.error(`Failed to activate: ${error.message}`);
    },
  });

  const suspendPolicy = api.policies.suspendPolicy.useMutation({
    onSuccess: () => {
      notify.success("Policy suspended.");
      onPolicyChanged?.();
      onClose();
    },
    onError: (error) => {
      notify.error(`Failed to suspend: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string | undefined) => {
    const s = status?.toLowerCase() ?? "draft";
    if (s === "active")
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-950/30">
          <CheckCircle className="mr-1 h-3 w-3" />
          Active
        </Badge>
      );
    if (s === "draft")
      return (
        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30">
          <Clock className="mr-1 h-3 w-3" />
          Draft
        </Badge>
      );
    if (s === "suspended")
      return (
        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950/30">
          <Pause className="mr-1 h-3 w-3" />
          Suspended
        </Badge>
      );
    if (s === "review")
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/30">
          <AlertCircle className="mr-1 h-3 w-3" />
          Under Review
        </Badge>
      );
    return <Badge variant="outline">{s.toUpperCase()}</Badge>;
  };

  const getPriorityBadge = (priority: string | undefined | null) => {
    if (!priority) return null;
    const p = priority.toLowerCase();
    const colorClass =
      p === "critical" || p === "high"
        ? "bg-red-50 text-red-700 dark:bg-red-950/20"
        : p === "medium"
          ? "bg-orange-50 text-orange-700 dark:bg-orange-950/20"
          : "bg-blue-50 text-blue-700 dark:bg-blue-950/20";
    return (
      <Badge variant="secondary" className={`text-xs ${colorClass}`}>
        <AlertCircle className="mr-1 h-3 w-3" />
        {priority.toUpperCase()}
      </Badge>
    );
  };

  // Parse objectives from JSON
  let objectives: string[] = [];
  if (policy?.objectives) {
    try {
      objectives = JSON.parse(policy.objectives as string) as string[];
    } catch {
      objectives = [policy.objectives as string];
    }
  }

  const hasEconomicEffects =
    (policy?.gdpEffect && policy.gdpEffect !== 0) ||
    (policy?.employmentEffect && policy.employmentEffect !== 0) ||
    (policy?.inflationEffect && policy.inflationEffect !== 0) ||
    (policy?.taxRevenueEffect && policy.taxRevenueEffect !== 0);

  const effectLog = (policy as any)?.policyEffectLog ?? [];

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          padding: 0,
          maxHeight: "85vh",
          overflow: "hidden",
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-start gap-2">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
            <span className="line-clamp-2">
              {isLoading ? "Loading..." : (policy?.name ?? "Policy Not Found")}
            </span>
          </DialogTitle>
          {policy && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {getStatusBadge(policy.status)}
              {getPriorityBadge(policy.priority)}
              {policy.category && (
                <Badge variant="outline" className="text-xs">
                  {policy.category.charAt(0).toUpperCase() + policy.category.slice(1)}
                </Badge>
              )}
            </div>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 px-6 py-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : policy ? (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <ParadoxFlavorCard
                id={policy.id}
                type="policy"
                title={policy.name}
                description={policy.description}
                countryId={policy.countryId}
              />

              {/* Description */}
              {policy.description && (
                <div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {policy.description}
                  </p>
                </div>
              )}

              {decretalKey && settings && (
                <div className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                    <Sliders className="h-3.5 w-3.5" />
                    Active Strategy Configurations
                  </h4>
                  <div className="bg-indigo-500/5 border-indigo-500/10 rounded-md border p-3 space-y-2">
                    {getActiveSettingsDisplay(decretalKey, settings)?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{item.label}:</span>
                        <span className="font-semibold text-indigo-400">{item.value}</span>
                      </div>
                    ))}
                    {stabilityEffect !== undefined && stabilityEffect !== 0 && (
                      <div className="flex justify-between text-xs border-t border-indigo-500/10 pt-1.5 mt-1.5">
                        <span className="text-muted-foreground">Stability Impact:</span>
                        <span className={`font-semibold ${stabilityEffect >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {stabilityEffect >= 0 ? "+" : ""}{stabilityEffect.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Info Grid */}
              <div className="space-y-2">
                <InfoRow
                  label="Policy Type"
                  value={
                    policy.policyType
                      ? policy.policyType.charAt(0).toUpperCase() + policy.policyType.slice(1)
                      : "N/A"
                  }
                />
                <InfoRow
                  label="Category"
                  value={
                    policy.category
                      ? policy.category.charAt(0).toUpperCase() + policy.category.slice(1)
                      : "N/A"
                  }
                />
                <InfoRow
                  label="Proposed"
                  value={
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(policy.proposedDate ?? policy.createdAt)}
                    </span>
                  }
                />
                <InfoRow
                  label="Effective"
                  value={
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(policy.effectiveDate)}
                    </span>
                  }
                />
                {(policy.implementationCost != null || policy.maintenanceCost != null) && (
                  <>
                    <InfoRow
                      label="Implementation Cost"
                      value={
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(policy.implementationCost)}
                        </span>
                      }
                    />
                    <InfoRow
                      label="Maintenance Cost"
                      value={
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(policy.maintenanceCost)}
                        </span>
                      }
                    />
                  </>
                )}
                {policy.targetMetrics && (
                  <InfoRow
                    label="Target Metrics"
                    value={
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {policy.targetMetrics}
                      </span>
                    }
                  />
                )}
              </div>

              {/* Objectives */}
              {objectives.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                      <Target className="h-3.5 w-3.5 text-indigo-500" />
                      Objectives
                    </h4>
                    <ul className="space-y-1.5">
                      {objectives.map((obj, i) => (
                        <li
                          key={i}
                          className="text-muted-foreground flex items-start gap-2 text-xs"
                        >
                          <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* Economic Effects */}
              {hasEconomicEffects && (
                <>
                  <Separator />
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                      <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
                      Economic Effects
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <EffectBadge label="GDP" value={policy.gdpEffect} />
                      <EffectBadge label="Employment" value={policy.employmentEffect} />
                      <EffectBadge label="Inflation" value={policy.inflationEffect} />
                      <EffectBadge label="Tax Revenue" value={policy.taxRevenueEffect} />
                    </div>
                  </div>
                </>
              )}

              {/* Effect History */}
              {effectLog.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                      <Layers className="h-3.5 w-3.5 text-indigo-500" />
                      Effect History
                    </h4>
                    <div className="space-y-2">
                      {effectLog.slice(0, 10).map((log: any) => (
                        <div
                          key={log.id}
                          className="border-border/40 bg-muted/30 rounded-md border p-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{log.metricAffected || "General"}</span>
                            <span className="text-muted-foreground">
                              {formatDate(log.appliedAt)}
                            </span>
                          </div>
                          {log.effectValue != null && (
                            <span
                              className={log.effectValue > 0 ? "text-green-600" : "text-red-600"}
                            >
                              {log.effectValue > 0 ? "+" : ""}
                              {log.effectValue}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer with action buttons */}
            <DialogFooter className="border-border/50 border-t px-6 py-4">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              {policy.status === "draft" && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => activatePolicy.mutate({ id: policy.id })}
                  disabled={activatePolicy.isPending}
                >
                  <Play className="h-3 w-3" />
                  {activatePolicy.isPending ? "Activating..." : "Activate Policy"}
                </Button>
              )}
              {policy.status === "active" && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  onClick={() => suspendPolicy.mutate({ id: policy.id })}
                  disabled={suspendPolicy.isPending}
                >
                  <Pause className="h-3 w-3" />
                  {suspendPolicy.isPending ? "Suspending..." : "Suspend Policy"}
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center">
            Policy not found.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
