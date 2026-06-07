"use client";

import { useMemo } from "react";
import { AlertTriangle, Brain, FileText, ScrollText } from "lucide-react";
import { api } from "~/trpc/react";
import {
  SectionContextWidget,
  type ContextStat,
  type ContextActivityEntry,
} from "~/components/mycountry/primitives";

interface IntelligenceSidebarWidgetProps {
  countryId: string;
}

/**
 * Intelligence context widget — a thin adapter that feeds the unified
 * SectionContextWidget with quick stats (security score / active alerts /
 * key findings) and a recent-activity log (alerts, briefings, findings).
 */
export function IntelligenceSidebarWidget({ countryId }: IntelligenceSidebarWidgetProps) {
  const { data: defenseOverview } = api.security.getDefenseOverview.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: intelligenceOverview } = api.intelCore.getOverview.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: keyFindings } = api.intelCore.getKeyFindings.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const stats = useMemo<ContextStat[]>(() => {
    const securityScore = Math.round(defenseOverview?.overallScore ?? 0);
    const totalAlerts = intelligenceOverview?.alerts?.total ?? 0;
    const findingsCount = keyFindings?.findings.length ?? 0;
    return [
      { label: "Security", value: `${securityScore}`, accentText: true },
      { label: "Alerts", value: totalAlerts, accentText: true },
      { label: "Findings", value: findingsCount, accentText: true },
    ];
  }, [defenseOverview, intelligenceOverview, keyFindings]);

  const activity = useMemo<ContextActivityEntry[]>(() => {
    const entries: ContextActivityEntry[] = [];

    intelligenceOverview?.alerts?.items?.forEach((alert: any) => {
      const critical = alert.severity === "CRITICAL" || alert.severity === "critical";
      entries.push({
        id: `alert-${alert.id}`,
        icon: AlertTriangle,
        iconColor: critical ? "text-red-500" : "text-yellow-500",
        text: `${alert.title ?? "Alert"} — ${String(alert.severity ?? "").toLowerCase() || "monitoring"}`,
        time: new Date(alert.detectedAt),
      });
    });

    intelligenceOverview?.briefings?.items?.forEach((b: any) => {
      entries.push({
        id: `briefing-${b.id}`,
        icon: ScrollText,
        iconColor: "text-blue-500",
        text: `Briefing: ${b.title ?? "Untitled"}`,
        time: new Date(b.generatedAt),
      });
    });

    keyFindings?.findings.forEach((f: any) => {
      const critical = f.severity === "critical";
      entries.push({
        id: `finding-${f.id}`,
        icon: FileText,
        iconColor: critical
          ? "text-red-500"
          : f.severity === "warning"
            ? "text-orange-500"
            : "text-purple-500",
        text: f.title ?? "Finding",
        time: new Date(f.timestamp),
      });
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5);
  }, [intelligenceOverview, keyFindings]);

  return (
    <SectionContextWidget
      accent="blue"
      title="Intel Log"
      icon={Brain}
      stats={stats}
      activity={activity}
      emptyMessage="No intelligence activity yet"
    />
  );
}
