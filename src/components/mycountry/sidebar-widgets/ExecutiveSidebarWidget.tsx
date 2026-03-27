"use client";

import { useMemo } from "react";
import { ScrollText, CheckCircle, FileText, Calendar, Gavel } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

interface ExecutiveSidebarWidgetProps {
  countryId: string;
}

interface LogEntry {
  id: string;
  icon: typeof CheckCircle;
  iconColor: string;
  text: string;
  time: Date;
}

/**
 * Executive Command Log — shows a timeline of your own recent executive
 * actions: policies enacted, meetings completed, issues resolved.
 * A personal record of governance decisions.
 */
export function ExecutiveSidebarWidget({ countryId }: ExecutiveSidebarWidgetProps) {
  const { data: meetings } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 },
  );
  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 },
  );

  const log = useMemo((): LogEntry[] => {
    const entries: LogEntry[] = [];

    // Completed meetings → "Held cabinet session: {title}"
    meetings?.forEach((m: any) => {
      if (m.status === "completed") {
        entries.push({
          id: `meeting-${m.id}`,
          icon: Calendar,
          iconColor: "text-blue-500",
          text: `Held session: ${m.title}`,
          time: new Date(m.scheduledDate ?? m.updatedAt ?? m.createdAt),
        });
      }
    });

    // Active policies → "Enacted: {name}"
    policies?.forEach((p: any) => {
      if (p.status === "active" && p.effectiveDate) {
        entries.push({
          id: `policy-active-${p.id}`,
          icon: Gavel,
          iconColor: "text-green-500",
          text: `Enacted: ${p.name ?? p.title}`,
          time: new Date(p.effectiveDate),
        });
      }
    });

    // Draft policies → "Drafted: {name}"
    policies?.forEach((p: any) => {
      if (p.status === "draft") {
        entries.push({
          id: `policy-draft-${p.id}`,
          icon: FileText,
          iconColor: "text-amber-500",
          text: `Drafted: ${p.name ?? p.title}`,
          time: new Date(p.createdAt),
        });
      }
    });

    // Completed action items → "Completed: {title}"
    meetings?.forEach((m: any) => {
      m.actionItems?.forEach((a: any) => {
        if (a.status === "completed") {
          entries.push({
            id: `action-${a.id}`,
            icon: CheckCircle,
            iconColor: "text-emerald-500",
            text: `Completed: ${a.title}`,
            time: new Date(a.updatedAt ?? a.createdAt),
          });
        }
      });
    });

    // Sort by most recent first, take top 5
    return entries
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 5);
  }, [meetings, policies]);

  return (
    <div className="glass-hierarchy-child rounded-xl border border-amber-500/15 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-semibold">Command Log</span>
        </div>
        <Badge variant="outline" className="border-amber-500/30 px-1.5 py-0 text-[0.65rem] text-amber-600 dark:text-amber-400">
          {log.length}
        </Badge>
      </div>
      <div className="space-y-1.5">
        {log.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-3">
            No executive actions yet
          </p>
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
