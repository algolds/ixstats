"use client";

import { Globe, Building2, Handshake, Sparkles } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

interface DiplomacySidebarWidgetProps {
  countryId: string;
}

export function DiplomacySidebarWidget({ countryId }: DiplomacySidebarWidgetProps) {
  const { data: embassies } = api.diplomatic.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: relations } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const activeEmbassies = embassies?.filter((e) => e.status === "active").length ?? 0;
  const totalRelations = relations?.length ?? 0;
  const avgStrength = totalRelations > 0
    ? Math.round(relations!.reduce((sum, r) => sum + (r.strength ?? 0), 0) / totalRelations)
    : 0;
  const strongRelations = relations?.filter((r) => (r.strength ?? 0) >= 70).length ?? 0;

  const stats = [
    { icon: Building2, label: "Embassies", value: `${activeEmbassies} active`, sub: `${embassies?.length ?? 0} total`, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/50" },
    { icon: Handshake, label: "Relations", value: `${totalRelations} nations`, sub: `avg strength ${avgStrength}%`, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/50" },
    { icon: Sparkles, label: "Strong Ties", value: `${strongRelations} allies`, sub: "strength \u2265 70%", color: strongRelations > 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400", bg: strongRelations > 0 ? "bg-blue-50 dark:bg-blue-950/50" : "bg-slate-50 dark:bg-slate-950/50" },
  ];

  return (
    <div className="glass-hierarchy-child rounded-xl border border-cyan-500/15 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-cyan-500" />
          <span className="text-xs font-semibold">Diplomatic Status</span>
        </div>
        <Badge variant="outline" className="border-cyan-500/30 px-1.5 py-0 text-[0.65rem] text-cyan-600 dark:text-cyan-400">
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
