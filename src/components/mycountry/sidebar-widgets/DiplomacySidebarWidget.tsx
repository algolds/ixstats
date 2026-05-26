"use client";

import { useMemo } from "react";
import { ScrollText, Building2, Handshake, Scale, Sparkles } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

interface DiplomacySidebarWidgetProps {
  countryId: string;
}

interface LogEntry {
  id: string;
  icon: typeof Building2;
  iconColor: string;
  text: string;
  time: Date;
}

/**
 * Diplomatic Log — shows a timeline of recent diplomatic actions:
 * embassies established, relations formed, foreign policies enacted.
 */
export function DiplomacySidebarWidget({ countryId }: DiplomacySidebarWidgetProps) {
  const { data: embassies } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: relations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: foreignPolicies } = api.diplomaticPolicies.getActiveForeignPolicies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const log = useMemo((): LogEntry[] => {
    const entries: LogEntry[] = [];

    embassies?.forEach((e: any) => {
      entries.push({
        id: `embassy-${e.id}`,
        icon: Building2,
        iconColor: "text-cyan-500",
        text: `Embassy with ${e.country ?? e.guestCountry ?? "Unknown"}`,
        time: new Date(e.establishedAt ?? e.createdAt),
      });
    });

    relations?.forEach((r: any) => {
      const strength = r.strength ?? 0;
      entries.push({
        id: `relation-${r.id}`,
        icon: strength >= 70 ? Sparkles : Handshake,
        iconColor: strength >= 70 ? "text-purple-500" : "text-blue-500",
        text: `${r.targetCountry?.name ?? r.countryB?.name ?? "Unknown"} — ${strength}%`,
        time: new Date(r.updatedAt ?? r.createdAt),
      });
    });

    foreignPolicies?.forEach((fp: any) => {
      if (fp.status === "active") {
        entries.push({
          id: `fp-${fp.id}`,
          icon: Scale,
          iconColor:
            fp.actionType === "free_trade" || fp.actionType === "military_alliance"
              ? "text-green-500"
              : "text-red-500",
          text: `${fp.actionType?.replace(/_/g, " ")} → ${fp.target?.name ?? "Unknown"}`,
          time: new Date(fp.createdAt),
        });
      }
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5);
  }, [embassies, relations, foreignPolicies]);

  return (
    <div className="glass-hierarchy-child rounded-xl border border-cyan-500/15 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-3.5 w-3.5 text-cyan-500" />
          <span className="text-xs font-semibold">Diplomatic Log</span>
        </div>
        <Badge
          variant="outline"
          className="border-cyan-500/30 px-1.5 py-0 text-[0.65rem] text-cyan-600 dark:text-cyan-400"
        >
          {log.length}
        </Badge>
      </div>
      <div className="space-y-1.5">
        {log.length === 0 && (
          <p className="text-muted-foreground py-3 text-center text-[11px]">
            No diplomatic activity yet
          </p>
        )}
        {log.map((entry) => (
          <div key={entry.id} className="flex items-start gap-2 py-1">
            <entry.icon className={`mt-0.5 h-3 w-3 shrink-0 ${entry.iconColor}`} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-[11px] leading-snug">{entry.text}</p>
              <span className="text-muted-foreground text-[10px]">{getTimeAgo(entry.time)}</span>
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
