"use client";

import { Crown, Calendar, FileText, Layers, Bell } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { useIssueCount } from "~/hooks/useNationalIssues";

interface ExecutiveSidebarWidgetProps {
  countryId: string;
}

export function ExecutiveSidebarWidget({ countryId }: ExecutiveSidebarWidgetProps) {
  const { data: meetings } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const activeMeetings = meetings?.filter((m) => m.status === "in_progress").length ?? 0;
  const totalMeetings = meetings?.length ?? 0;
  const activePolicies = policies?.filter((p) => p.status === "active").length ?? 0;
  const pendingPolicies = policies?.filter((p) => p.status === "draft").length ?? 0;
  const pendingActions = meetings?.flatMap((m) => m.actionItems).filter((a) => a.status === "pending").length ?? 0;
  const { total: issueCount, urgent: urgentIssueCount } = useIssueCount(countryId);

  const stats = [
    { icon: Bell, label: "Issues", value: `${issueCount} pending`, sub: urgentIssueCount > 0 ? `${urgentIssueCount} urgent` : "all routine", color: issueCount > 0 ? (urgentIssueCount > 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400") : "text-green-600 dark:text-green-400", bg: issueCount > 0 ? (urgentIssueCount > 0 ? "bg-red-50 dark:bg-red-950/50" : "bg-amber-50 dark:bg-amber-950/50") : "bg-green-50 dark:bg-green-950/50" },
    { icon: Calendar, label: "Meetings", value: `${activeMeetings} active`, sub: `${totalMeetings} total`, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50" },
    { icon: FileText, label: "Policies", value: `${activePolicies} active`, sub: `${pendingPolicies} pending`, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50" },
    { icon: Layers, label: "Actions", value: `${pendingActions} pending`, sub: "require attention", color: pendingActions > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400", bg: pendingActions > 0 ? "bg-orange-50 dark:bg-orange-950/50" : "bg-green-50 dark:bg-green-950/50" },
  ];

  return (
    <div className="glass-hierarchy-child rounded-xl border border-amber-500/15 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-semibold">Executive Status</span>
        </div>
        <Badge variant="outline" className="border-amber-500/30 px-1.5 py-0 text-[0.65rem] text-amber-600 dark:text-amber-400">
          LIVE
        </Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
