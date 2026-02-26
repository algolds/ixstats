"use client";

import { Brain, Shield, AlertTriangle, Globe, FileText } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

interface IntelligenceSidebarWidgetProps {
  countryId: string;
}

export function IntelligenceSidebarWidget({ countryId }: IntelligenceSidebarWidgetProps) {
  const { data: defenseOverview } = api.security.getDefenseOverview.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: intelligenceOverview } = api.unifiedIntelligence.getOverview.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: embassies } = api.diplomatic.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: keyFindings } = api.unifiedIntelligence.getKeyFindings.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const securityScore = defenseOverview?.overallScore ?? 0;
  const securityLevel = defenseOverview?.securityLevel?.replace("_", " ") ?? "Unknown";
  const criticalAlerts = intelligenceOverview?.alerts?.critical ?? 0;
  const totalAlerts = intelligenceOverview?.alerts?.total ?? 0;
  const activeEmbassies = embassies?.filter((e: any) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
  const findingsCount = keyFindings?.findings.length ?? 0;

  const stats = [
    { icon: Shield, label: "Security", value: `${securityScore}/100`, sub: securityLevel, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/50" },
    { icon: AlertTriangle, label: "Alerts", value: `${criticalAlerts} critical`, sub: `${totalAlerts} total`, color: criticalAlerts > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400", bg: criticalAlerts > 0 ? "bg-red-50 dark:bg-red-950/50" : "bg-green-50 dark:bg-green-950/50" },
    { icon: Globe, label: "Network", value: `${activeEmbassies} active`, sub: "embassies", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/50" },
    { icon: FileText, label: "Findings", value: `${findingsCount}`, sub: "auto-generated", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/50" },
  ];

  return (
    <div className="glass-hierarchy-child rounded-xl border border-blue-500/15 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-xs font-semibold">Intelligence Status</span>
        </div>
        <Badge variant="outline" className="border-blue-500/30 px-1.5 py-0 text-[0.65rem] text-blue-600 dark:text-blue-400">
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
