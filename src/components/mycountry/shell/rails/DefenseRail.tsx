"use client";

import React, { useMemo } from "react";
import {
  Tournament as Sword,
  WarningTriangle as AlertTriangle,
  ShieldAlert,
  Shield,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { ReadinessOverviewCard } from "~/components/mycountry/domains/defense/command/ReadinessOverviewCard";
import {
  DomainActivityCard,
  RailBar,
  RailCard,
  RailCount,
  RailEmpty,
  RailRow,
  STATUS_FILL,
  STATUS_TEXT,
  type ActivityEntry,
  type StatusTone,
} from "./shared";

function readinessTone(readiness: number): StatusTone {
  return readiness >= 70 ? "success" : readiness >= 40 ? "warning" : "critical";
}

interface ThreatItem {
  id: string;
  threatName?: string | null;
  name?: string | null;
  severity?: string | null;
  lastUpdated?: string | Date | null;
  detectedAt?: string | Date | null;
  createdAt?: string | Date | null;
}

interface AssessmentData {
  activeThreats?: ThreatItem[] | null;
}

interface MilitaryBranchRecord {
  id: string;
  name: string;
  branchType?: string | null;
  readinessLevel: number;
  technologyLevel: number;
  morale: number;
  annualBudget: number;
  readiness?: number | null;
  personnelCount?: number | null;
  personnel?: number | null;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
}

/** Defense rail — branches / readiness / threats snapshot + recent security activity. */
export function DefenseRail({ countryId }: { countryId: string }) {
  const { data: assessmentRaw } = api.security.getSecurityAssessment.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: branchesRaw } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const assessment = assessmentRaw as AssessmentData | undefined;
  const branches = branchesRaw as MilitaryBranchRecord[] | undefined;

  const { averageReadiness, averageTechnology, averageMorale } = useMemo(() => {
    const count = branches?.length ?? 0;
    if (count === 0) return { averageReadiness: 0, averageTechnology: 0, averageMorale: 0 };
    return {
      averageReadiness: Math.round(
        branches!.reduce((s, b) => s + (b.readinessLevel ?? 0), 0) / count
      ),
      averageTechnology: Math.round(
        branches!.reduce((s, b) => s + (b.technologyLevel ?? 0), 0) / count
      ),
      averageMorale: Math.round(branches!.reduce((s, b) => s + (b.morale ?? 0), 0) / count),
    };
  }, [branches]);

  const activity = useMemo<ActivityEntry[]>(() => {
    const entries: ActivityEntry[] = [];

    branches?.forEach((b) => {
      const readiness = b.readinessLevel ?? 0;
      entries.push({
        id: `branch-${b.id}`,
        icon: Sword,
        iconColor: STATUS_TEXT[readinessTone(readiness)],
        text: `${b.name ?? "Military branch"} — ${Math.round(readiness)}% ready`,
        time: new Date(b.updatedAt ?? b.createdAt ?? Date.now()),
      });
    });

    assessment?.activeThreats?.forEach((t) => {
      const critical = t.severity === "critical" || t.severity === "existential";
      entries.push({
        id: `threat-${t.id}`,
        icon: critical ? AlertTriangle : ShieldAlert,
        iconColor: critical ? STATUS_TEXT.critical : STATUS_TEXT.warning,
        text: `${t.threatName ?? "Threat"} — ${t.severity ?? "monitoring"}`,
        time: new Date(t.lastUpdated ?? t.detectedAt ?? t.createdAt ?? Date.now()),
      });
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [assessment, branches]);

  return (
    <div className="space-y-6">
      {/* Strategic Readiness Overview (Sidebar Snapshot Rail) */}
      <ReadinessOverviewCard
        averageReadiness={averageReadiness}
        averageTechnology={averageTechnology}
        averageMorale={averageMorale}
        branches={branches}
      />

      {/* Military branches and readiness */}
      <RailCard
        title="Military branches"
        icon={Sword}
        accessory={<RailCount>{branches?.length ?? 0} active</RailCount>}
      >
        {!branches || branches.length === 0 ? (
          <RailEmpty>No active military branches configured.</RailEmpty>
        ) : (
          branches.slice(0, 4).map((b) => {
            const readiness = b.readinessLevel ?? b.readiness ?? 50;
            const personnel = b.personnelCount ?? b.personnel ?? 0;
            const tone = readinessTone(readiness);

            return (
              <RailRow key={b.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-label min-w-0 truncate font-medium">
                    {b.name ?? b.branchType ?? "Military branch"}
                  </span>
                  <span
                    className="text-label shrink-0 tabular-nums"
                    title={`${(personnel / 1000).toFixed(1)}k personnel`}
                  >
                    <span className={STATUS_TEXT[tone]}>{Math.round(readiness)}%</span> ·{" "}
                    {(personnel / 1000).toFixed(1)}k
                  </span>
                </div>
                <RailBar value={readiness} fill={STATUS_FILL[tone]} />
              </RailRow>
            );
          })
        )}
      </RailCard>

      {/* Threat vectors */}
      <RailCard
        title="Threat assessments"
        icon={AlertTriangle}
        accessory={<RailCount>{assessment?.activeThreats?.length ?? 0}</RailCount>}
      >
        {!assessment?.activeThreats || assessment.activeThreats.length === 0 ? (
          <RailEmpty>All threat vectors clear. Defensive alert level nominal.</RailEmpty>
        ) : (
          assessment.activeThreats.slice(0, 3).map((threat) => {
            const critical = threat.severity === "critical" || threat.severity === "existential";
            const ThreatIcon = critical ? AlertTriangle : ShieldAlert;

            return (
              <RailRow key={threat.id} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <ThreatIcon
                    aria-hidden="true"
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      critical ? STATUS_TEXT.critical : STATUS_TEXT.warning
                    )}
                  />
                  <span className="text-label truncate font-medium">
                    {threat.threatName ?? threat.name ?? "Threat vector"}
                  </span>
                </div>
                <Badge
                  variant={critical ? "destructive" : "outline"}
                  className={cn("shrink-0 capitalize", !critical && STATUS_TEXT.warning)}
                >
                  {threat.severity ?? "alert"}
                </Badge>
              </RailRow>
            );
          })
        )}
      </RailCard>

      {/* Defense Log Activity Feed */}
      <DomainActivityCard
        domain="defense"
        title="Defense log"
        icon={Shield}
        entries={activity}
        emptyMessage="No defense activity yet"
      />
    </div>
  );
}
