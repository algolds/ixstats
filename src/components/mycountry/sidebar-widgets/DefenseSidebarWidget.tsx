"use client";

import { useMemo } from "react";
import { AlertTriangle, ShieldAlert, Sword, Target } from "lucide-react";
import { api } from "~/trpc/react";
import {
  SectionContextWidget,
  type ContextStat,
  type ContextActivityEntry,
} from "~/components/mycountry/primitives";

interface DefenseSidebarWidgetProps {
  countryId: string;
}

/**
 * Defense context widget — a thin adapter that feeds the unified
 * SectionContextWidget with quick stats (branches / avg readiness / active
 * threats) and a recent-activity log (military branches + security threats).
 */
export function DefenseSidebarWidget({ countryId }: DefenseSidebarWidgetProps) {
  const { data: assessment } = api.security.getSecurityAssessment.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: branches } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const stats = useMemo<ContextStat[]>(() => {
    const branchCount = branches?.length ?? 0;
    const avgReadiness =
      branchCount > 0
        ? Math.round(
            branches!.reduce((sum: number, b: any) => sum + (b.readinessLevel ?? 0), 0) /
              branchCount
          )
        : 0;
    const activeThreats = assessment?.activeThreats?.length ?? assessment?.activeThreatCount ?? 0;
    return [
      { label: "Branches", value: branchCount, accentText: true },
      { label: "Readiness", value: `${avgReadiness}%`, accentText: true },
      { label: "Threats", value: activeThreats, accentText: true },
    ];
  }, [assessment, branches]);

  const activity = useMemo<ContextActivityEntry[]>(() => {
    const entries: ContextActivityEntry[] = [];

    branches?.forEach((b: any) => {
      const readiness = b.readinessLevel ?? 0;
      entries.push({
        id: `branch-${b.id}`,
        icon: Sword,
        iconColor: readiness >= 70 ? "text-green-500" : "text-red-500",
        text: `${b.name ?? "Military branch"} — ${Math.round(readiness)}% ready`,
        time: new Date(b.updatedAt ?? b.createdAt),
      });
    });

    assessment?.activeThreats?.forEach((t: any) => {
      const critical = t.severity === "critical" || t.severity === "existential";
      entries.push({
        id: `threat-${t.id}`,
        icon: critical ? AlertTriangle : ShieldAlert,
        iconColor: critical ? "text-red-500" : "text-orange-500",
        text: `${t.threatName ?? "Threat"} — ${t.severity ?? "monitoring"}`,
        time: new Date(t.lastUpdated ?? t.detectedAt ?? t.createdAt),
      });
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5);
  }, [assessment, branches]);

  return (
    <SectionContextWidget
      accent="red"
      title="Defense Log"
      icon={Target}
      stats={stats}
      activity={activity}
      emptyMessage="No defense activity yet"
    />
  );
}
