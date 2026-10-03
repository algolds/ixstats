"use client";

import { memo } from "react";
import {
  StatUp as TrendingUp,
  Bank as Landmark,
  Group as Users,
  Shield,
  Globe,
  Building,
  Leaf,
  WarningTriangle as AlertTriangle,
  Clock,
  FireFlame as Flame,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { IxTime } from "~/lib/ixtime";
import { Button } from "~/components/ui/button";

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
    color: "text-green",
    label: "Economic",
  },
  political: {
    icon: Landmark,
    color: "text-indigo",
    label: "Political",
  },
  social: { icon: Users, color: "text-blue", label: "Social" },
  military: { icon: Shield, color: "text-red", label: "Military" },
  diplomatic: {
    icon: Globe,
    color: "text-cyan",
    label: "Diplomatic",
  },
  infrastructure: {
    icon: Building,
    color: "text-yellow",
    label: "Infrastructure",
  },
  environmental: {
    icon: Leaf,
    color: "text-green",
    label: "Environmental",
  },
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-l-red bg-red/5",
  CRITICAL: "border-l-red bg-red/5",
  high: "border-l-yellow bg-yellow/5",
  HIGH: "border-l-yellow bg-yellow/5",
  medium: "border-l-blue bg-blue/5",
  MEDIUM: "border-l-blue bg-blue/5",
  low: "border-l-separator bg-fill-4",
  LOW: "border-l-separator bg-fill-4",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red/20 text-red-ink border-red/30",
  CRITICAL: "bg-red/20 text-red-ink border-red/30",
  high: "bg-yellow/20 text-yellow-ink border-yellow/30",
  HIGH: "bg-yellow/20 text-yellow-ink border-yellow/30",
  medium: "bg-blue/20 text-blue-ink border-blue/30",
  MEDIUM: "bg-blue/20 text-blue-ink border-blue/30",
  low: "bg-fill-3 text-label-secondary border-separator",
  LOW: "bg-fill-3 text-label-secondary border-separator",
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
    // oxlint-disable-next-line
    const nowReal = Date.now();
    const remaining = deadlineReal - nowReal;
    const daysRemaining = remaining / (24 * 60 * 60 * 1000);
    if (daysRemaining <= 0) {
      timeRemainingText = "Expired";
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
      className={`group rounded-control border-separator hover:border-separator hover:bg-fill-4 w-full cursor-pointer border border-l-4 p-3 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] ${severityStyle}`}
    >
      <div className="flex items-start gap-3">
        <div className={`bg-fill-4 mt-0.5 rounded-full p-2 ${domainConfig.color}`}>
          <DomainIcon className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h4 className="group-hover:text-label text-body truncate font-medium transition-colors">
              {issue.title}
            </h4>
            {isNew && (
              <Badge variant="warning" className="shrink-0">
                New
              </Badge>
            )}
          </div>

          {variant === "full" && (
            <p className="text-label-secondary text-footnote mb-2 line-clamp-2">
              {issue.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`text-footnote px-2 py-0 capitalize ${badgeStyle}`}>
              {issue.severity.toLowerCase()}
            </Badge>
            <span className={`text-footnote ${domainConfig.color}`}>{domainConfig.label}</span>

            {hasDeadline && (
              <span
                className={`text-footnote flex items-center gap-1 ${isUrgent ? "text-red" : "text-label-secondary"}`}
              >
                {isUrgent ? <Flame className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {timeRemainingText}
              </span>
            )}

            {onDismiss &&
              !hasDeadline &&
              issue.severity !== "critical" &&
              issue.severity !== "CRITICAL" &&
              issue.severity !== "high" &&
              issue.severity !== "HIGH" &&
              issue.urgency <= 70 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(issue.id);
                  }}
                  className="ml-auto"
                >
                  Delegate (-15 CivCap)
                </Button>
              )}
          </div>
        </div>

        {(issue.severity === "critical" || issue.severity === "CRITICAL") && (
          <AlertTriangle className="text-red h-4 w-4 shrink-0" />
        )}
      </div>
    </div>
  );
}

export const IssueCard = memo(IssueCardInner);
