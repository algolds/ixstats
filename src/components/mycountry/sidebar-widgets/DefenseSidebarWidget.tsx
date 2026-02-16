"use client";

import { Shield, Sword, Target } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

interface DefenseSidebarWidgetProps {
  countryId: string;
}

export function DefenseSidebarWidget({ countryId }: DefenseSidebarWidgetProps) {
  const { data: assessment } = api.security.getSecurityAssessment.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: branches } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const securityScore = assessment?.overallSecurityScore ?? 0;
  const securityLevel = assessment?.securityLevel?.replace("_", " ") ?? "Unknown";
  const branchCount = branches?.length ?? 0;
  const avgReadiness = branchCount > 0
    ? Math.round(branches!.reduce((sum, b) => sum + (b.readinessLevel ?? 0), 0) / branchCount)
    : 0;

  const scoreColor = securityScore >= 75
    ? "text-green-600 dark:text-green-400"
    : securityScore >= 50
      ? "text-blue-600 dark:text-blue-400"
      : "text-orange-600 dark:text-orange-400";
  const scoreBg = securityScore >= 75
    ? "bg-green-50 dark:bg-green-950/50"
    : securityScore >= 50
      ? "bg-blue-50 dark:bg-blue-950/50"
      : "bg-orange-50 dark:bg-orange-950/50";

  const stats = [
    { icon: Shield, label: "Security", value: `${securityScore}/100`, sub: securityLevel, color: scoreColor, bg: scoreBg },
    { icon: Sword, label: "Branches", value: `${branchCount} active`, sub: "military forces", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/50" },
    { icon: Target, label: "Readiness", value: `${avgReadiness}%`, sub: "avg. combat ready", color: avgReadiness >= 70 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400", bg: avgReadiness >= 70 ? "bg-green-50 dark:bg-green-950/50" : "bg-yellow-50 dark:bg-yellow-950/50" },
  ];

  return (
    <div className="glass-hierarchy-child rounded-xl border border-red-500/15 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-red-500" />
          <span className="text-xs font-semibold">Defense Status</span>
        </div>
        <Badge variant="outline" className="border-red-500/30 px-1.5 py-0 text-[0.65rem] text-red-600 dark:text-red-400">
          LIVE
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-lg ${stat.bg} px-3 py-2`}>
            <div className="flex items-center gap-1.5">
              <stat.icon className={`h-3.5 w-3.5 flex-shrink-0 ${stat.color}`} />
              <span className="text-xs font-medium">{stat.label}</span>
            </div>
            <div className={`mt-0.5 text-sm font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-muted-foreground text-xs">{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
