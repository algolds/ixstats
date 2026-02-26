"use client";

import { Shield, AlertTriangle, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { formatTimeAgo } from "~/lib/time-utils";
import { cn } from "~/lib/utils";

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-500/10",    text: "text-red-500",    border: "border-red-500/30" },
  high:     { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30" },
  medium:   { bg: "bg-amber-500/10",  text: "text-amber-500",  border: "border-amber-500/30" },
  low:      { bg: "bg-blue-500/10",   text: "text-blue-500",   border: "border-blue-500/30" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:     { label: "Pending",     color: "text-amber-500 border-amber-500/30" },
  in_progress: { label: "In Progress", color: "text-blue-500 border-blue-500/30" },
  monitoring:  { label: "Monitoring",  color: "text-cyan-500 border-cyan-500/30" },
  resolved:    { label: "Resolved",    color: "text-emerald-500 border-emerald-500/30" },
};

interface CrisisEvent {
  id: string;
  title: string;
  severity: string;
  category: string;
  location?: string | null;
  responseStatus: string;
  timestamp: Date | string;
  economicImpact?: number | null;
}

interface CrisisStats {
  activeEvents?: number;
  criticalEvents?: number;
  resolvedEvents?: number;
  totalEconomicImpact?: number;
}

interface CrisisStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  crisisStats: CrisisStats | undefined;
  activeCrises: CrisisEvent[];
}

export function CrisisStatusModal({ isOpen, onClose, crisisStats, activeCrises }: CrisisStatusModalProps) {
  const activeCount = crisisStats?.activeEvents ?? 0;
  const criticalCount = crisisStats?.criticalEvents ?? 0;
  const resolvedCount = crisisStats?.resolvedEvents ?? 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-emerald-500" />
            World Stability
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                activeCount === 0
                  ? "text-emerald-500 border-emerald-500/30"
                  : criticalCount > 0
                    ? "text-red-500 border-red-500/30"
                    : "text-amber-500 border-amber-500/30",
              )}
            >
              {activeCount === 0 ? "Stable" : `${activeCount} active`}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Summary metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
            <div className={cn("text-lg font-bold", activeCount > 0 ? "text-amber-500" : "text-emerald-500")}>
              {activeCount}
            </div>
            <div className="text-[10px] text-muted-foreground">Active</div>
          </div>
          <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
            <div className={cn("text-lg font-bold", criticalCount > 0 ? "text-red-500" : "text-foreground")}>
              {criticalCount}
            </div>
            <div className="text-[10px] text-muted-foreground">Critical</div>
          </div>
          <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
            <div className="text-lg font-bold text-emerald-500">{resolvedCount}</div>
            <div className="text-[10px] text-muted-foreground">Resolved</div>
          </div>
        </div>

        {/* Active crises list */}
        <div className="max-h-[350px] overflow-y-auto space-y-1.5">
          {activeCrises.length === 0 ? (
            <div className="py-8 text-center">
              <Shield className="mx-auto mb-3 h-10 w-10 text-emerald-500/40" />
              <p className="text-sm font-medium text-emerald-500">All Clear</p>
              <p className="text-xs text-muted-foreground mt-1">No active crises worldwide</p>
            </div>
          ) : (
            activeCrises.map((crisis) => {
              const severity = SEVERITY_STYLES[crisis.severity] ?? SEVERITY_STYLES.medium!;
              const status = STATUS_LABELS[crisis.responseStatus] ?? STATUS_LABELS.pending!;
              return (
                <div
                  key={crisis.id}
                  className={cn(
                    "rounded-lg border p-3 transition-colors hover:bg-muted/30",
                    crisis.severity === "critical" ? "border-red-500/30 bg-red-500/5" : "border-border/40",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", severity.bg)}>
                      <AlertTriangle className={cn("h-3 w-3", severity.text)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn("text-[8px] px-1 py-0 uppercase", severity.text, severity.border)}
                        >
                          {crisis.severity}
                        </Badge>
                        <span className="text-xs font-medium leading-snug">{crisis.title}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                        {crisis.location && (
                          <span>{crisis.location}</span>
                        )}
                        <Badge variant="outline" className={cn("text-[8px] px-1 py-0", status.color)}>
                          {status.label}
                        </Badge>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {formatTimeAgo(new Date(crisis.timestamp))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
