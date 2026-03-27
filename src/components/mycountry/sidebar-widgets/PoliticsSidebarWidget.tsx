"use client";

import { useMemo } from "react";
import { ScrollText, Users, Landmark, BarChart3, CheckCircle } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

interface PoliticsSidebarWidgetProps {
  countryId: string;
}

interface LogEntry {
  id: string;
  icon: typeof Users;
  iconColor: string;
  text: string;
  time: Date;
}

/**
 * Political Log — shows a timeline of recent political actions:
 * parties created, elections held, legislature configured.
 */
export function PoliticsSidebarWidget({ countryId }: PoliticsSidebarWidgetProps) {
  const { data: parties } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 },
  );
  const { data: elections } = api.elections.getElections.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 },
  );
  const { data: legislature } = api.elections.getLegislature.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 },
  );

  const log = useMemo((): LogEntry[] => {
    const entries: LogEntry[] = [];

    // Legislature configured
    if (legislature && legislature.totalSeats > 0) {
      entries.push({
        id: "legislature",
        icon: Landmark,
        iconColor: "text-indigo-500",
        text: `Legislature: ${legislature.totalSeats} seats configured`,
        time: new Date((legislature as any).updatedAt ?? (legislature as any).createdAt ?? Date.now()),
      });
    }

    // Parties created
    parties?.forEach((p: any) => {
      entries.push({
        id: `party-${p.id}`,
        icon: Users,
        iconColor: "text-purple-500",
        text: `Party: ${p.name} (${p.ideology?.replace(/_/g, " ")})`,
        time: new Date(p.createdAt),
      });
    });

    // Elections
    elections?.forEach((e: any) => {
      const isCompleted = e.status === "COMPLETED" || e.status === "completed";
      entries.push({
        id: `election-${e.id}`,
        icon: isCompleted ? CheckCircle : BarChart3,
        iconColor: isCompleted ? "text-green-500" : "text-violet-500",
        text: isCompleted ? `Completed: ${e.name ?? "Election"}` : `Scheduled: ${e.name ?? "Election"}`,
        time: new Date(e.updatedAt ?? e.createdAt),
      });
    });

    return entries
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 5);
  }, [parties, elections, legislature]);

  return (
    <div className="glass-hierarchy-child rounded-xl border border-indigo-500/15 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-xs font-semibold">Political Log</span>
        </div>
        <Badge variant="outline" className="border-indigo-500/30 px-1.5 py-0 text-[0.65rem] text-indigo-600 dark:text-indigo-400">
          {log.length}
        </Badge>
      </div>
      <div className="space-y-1.5">
        {log.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-3">No political activity yet</p>
        )}
        {log.map((entry) => (
          <div key={entry.id} className="flex items-start gap-2 py-1">
            <entry.icon className={`h-3 w-3 mt-0.5 flex-shrink-0 ${entry.iconColor}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-snug line-clamp-1">{entry.text}</p>
              <span className="text-[10px] text-muted-foreground">{getTimeAgo(entry.time)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
