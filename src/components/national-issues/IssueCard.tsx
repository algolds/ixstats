"use client";

import { memo } from "react";
import {
  TrendingUp,
  Landmark,
  Users,
  Shield,
  Globe,
  Building,
  Leaf,
  AlertTriangle,
  Clock,
  Flame,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { IxTime } from "~/lib/ixtime";

interface IssueCardProps {
  issue: {
    id: string;
    title: string;
    description: string;
    domain: string;
    severity: string;
    urgency: number;
    status: string;
    deadlineIxTime: number | null;
    createdIxTime: number;
    createdAt: string | Date;
  };
  onView: (id: string) => void;
  onDismiss?: (id: string) => void;
  variant?: "compact" | "full";
}

const DOMAIN_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; label: string }> = {
  economic: {
    icon: TrendingUp,
    color: "text-emerald-500",
    label: "Economic",
  },
  political: {
    icon: Landmark,
    color: "text-purple-500",
    label: "Political",
  },
  social: { icon: Users, color: "text-blue-500", label: "Social" },
  military: { icon: Shield, color: "text-red-500", label: "Military" },
  diplomatic: {
    icon: Globe,
    color: "text-cyan-500",
    label: "Diplomatic",
  },
  infrastructure: {
    icon: Building,
    color: "text-amber-500",
    label: "Infrastructure",
  },
  environmental: {
    icon: Leaf,
    color: "text-green-500",
    label: "Environmental",
  },
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-l-red-500 bg-red-500/5",
  CRITICAL: "border-l-red-500 bg-red-500/5",
  high: "border-l-amber-500 bg-amber-500/5",
  HIGH: "border-l-amber-500 bg-amber-500/5",
  medium: "border-l-blue-500 bg-blue-500/5",
  MEDIUM: "border-l-blue-500 bg-blue-500/5",
  low: "border-l-slate-400 bg-slate-400/5",
  LOW: "border-l-slate-400 bg-slate-400/5",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  HIGH: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  medium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  MEDIUM: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  LOW: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

function IssueCardInner({ issue, onView, onDismiss, variant = "full" }: IssueCardProps) {
  const domainConfig = DOMAIN_CONFIG[issue.domain] ?? DOMAIN_CONFIG.economic!;
  const DomainIcon = domainConfig.icon;
  const severityStyle = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.medium!;
  const badgeStyle = SEVERITY_BADGE[issue.severity] ?? SEVERITY_BADGE.medium!;

  const hasDeadline = issue.deadlineIxTime != null;
  let timeRemainingText = "";
  let isUrgent = false;
  if (hasDeadline) {
    const deadlineReal = IxTime.convertFromIxTime(issue.deadlineIxTime!);
    const nowReal = Date.now();
    const remaining = deadlineReal - nowReal;
    const daysRemaining = remaining / (24 * 60 * 60 * 1000);
    if (daysRemaining <= 0) {
      timeRemainingText = "EXPIRED";
      isUrgent = true;
    } else if (daysRemaining < 3) {
      timeRemainingText = `${Math.ceil(daysRemaining)}d left`;
      isUrgent = true;
    } else {
      timeRemainingText = `${Math.ceil(daysRemaining)}d left`;
    }
  }

  const isNew = issue.status === "pending";

  return (
    <div
      onClick={() => onView(issue.id)}
      className={`group w-full cursor-pointer rounded-lg border border-l-4 border-white/10 p-3 text-left transition-all hover:border-white/20 hover:bg-white/5 ${severityStyle}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-full bg-white/10 p-1.5 ${domainConfig.color}`}>
          <DomainIcon className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h4 className="truncate text-sm font-medium transition-colors group-hover:text-foreground">
              {issue.title}
            </h4>
            {isNew && (
              <Badge
                variant="outline"
                className="shrink-0 border-amber-500/30 bg-amber-500/20 px-1.5 py-0 text-[10px] text-amber-400"
              >
                NEW
              </Badge>
            )}
          </div>

          {variant === "full" && (
            <p className="text-muted-foreground mb-2 line-clamp-2 text-xs">{issue.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`px-1.5 py-0 text-[10px] ${badgeStyle}`}>
              {issue.severity.toUpperCase()}
            </Badge>
            <span className={`text-[10px] ${domainConfig.color}`}>{domainConfig.label}</span>

            {hasDeadline && (
              <span
                className={`flex items-center gap-1 text-[10px] ${isUrgent ? "text-red-400" : "text-muted-foreground"}`}
              >
                {isUrgent ? <Flame className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {timeRemainingText}
              </span>
            )}

            {onDismiss && !hasDeadline && issue.severity !== "critical" && issue.severity !== "CRITICAL" && issue.severity !== "high" && issue.severity !== "HIGH" && issue.urgency <= 70 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(issue.id);
                }}
                className="ml-auto rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:bg-white/10 hover:border-white/30 transition-all cursor-pointer"
              >
                Delegate (-15 CivCap)
              </button>
            )}
          </div>
        </div>

        {(issue.severity === "critical" || issue.severity === "CRITICAL") && (
          <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse text-red-400" />
        )}
      </div>
    </div>
  );
}

export const IssueCard = memo(IssueCardInner);
