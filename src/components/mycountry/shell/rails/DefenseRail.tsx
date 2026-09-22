"use client";

import React, { useMemo } from "react";
import {
  Tournament as Sword,
  WarningTriangle as AlertTriangle,
  ShieldAlert,
  Shield,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { ReadinessOverviewCard } from "~/components/mycountry/domains/defense/command/ReadinessOverviewCard";
import {
  DomainActivityCard,
  type ActivityEntry,
} from "./shared";

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
      averageMorale: Math.round(
        branches!.reduce((s, b) => s + (b.morale ?? 0), 0) / count
      ),
    };
  }, [branches]);

  const activity = useMemo<ActivityEntry[]>(() => {
    const entries: ActivityEntry[] = [];

    branches?.forEach((b) => {
      const readiness = b.readinessLevel ?? 0;
      entries.push({
        id: `branch-${b.id}`,
        icon: Sword,
        iconColor: readiness >= 70 ? "text-green-500" : "text-red-500",
        text: `${b.name ?? "Military branch"} — ${Math.round(readiness)}% ready`,
        time: new Date(b.updatedAt ?? b.createdAt ?? Date.now()),
      });
    });

    assessment?.activeThreats?.forEach((t) => {
      const critical = t.severity === "critical" || t.severity === "existential";
      entries.push({
        id: `threat-${t.id}`,
        icon: critical ? AlertTriangle : ShieldAlert,
        iconColor: critical ? "text-red-500" : "text-amber-500",
        text: `${t.threatName ?? "Threat"} — ${t.severity ?? "monitoring"}`,
        time: new Date(t.lastUpdated ?? t.detectedAt ?? t.createdAt ?? Date.now()),
      });
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [assessment, branches]);

  return (
    <div className="space-y-4">
      {/* Strategic Readiness Overview (Sidebar Snapshot Rail) */}
      <ReadinessOverviewCard
        averageReadiness={averageReadiness}
        averageTechnology={averageTechnology}
        averageMorale={averageMorale}
        branches={branches}
      />

      {/* Military Branches & Readiness Snapshot Card */}
      <FacetCard depth={1} className="bg-card/30 space-y-2.5 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <Sword className="h-3.5 w-3.5 text-red-400" />
            <h4 className="text-foreground text-xs font-bold">Military Branches</h4>
          </div>
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-extrabold text-red-400">
            {branches?.length ?? 0} Active
          </span>
        </div>

        <div className="space-y-1.5">
          {!branches || branches.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-[11px]">
              No active military branches configured.
            </p>
          ) : (
            branches.slice(0, 4).map((b) => {
              const readiness = b.readinessLevel ?? b.readiness ?? 50;
              const personnel = b.personnelCount ?? b.personnel ?? 0;

              return (
                <div
                  key={b.id}
                  className="space-y-1 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs backdrop-blur-md"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-foreground truncate font-semibold">
                      {b.name ?? b.branchType ?? "Military Branch"}
                    </span>
                    <span className="text-[10px] font-bold text-red-400">
                      {Math.round(readiness)}% ready · {(personnel / 1000).toFixed(1)}k personnel
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-amber-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, readiness))}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </FacetCard>

      {/* Threat Vectors Snapshot Card */}
      <FacetCard depth={1} className="bg-card/30 space-y-2.5 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <h4 className="text-foreground text-xs font-bold">Threat Assessments</h4>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-extrabold text-amber-400">
            {assessment?.activeThreats?.length ?? 0} Threats
          </span>
        </div>

        <div className="space-y-1.5">
          {!assessment?.activeThreats || assessment.activeThreats.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-[11px]">
              All threat vectors clear. Defensive alert level nominal.
            </p>
          ) : (
            assessment.activeThreats.slice(0, 3).map((threat) => {
              const critical = threat.severity === "critical" || threat.severity === "existential";

              return (
                <div
                  key={threat.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs backdrop-blur-md"
                >
                  <div className="flex min-w-0 items-center gap-2 pr-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10">
                      {critical ? (
                        <AlertTriangle className="h-3 w-3 text-red-400" />
                      ) : (
                        <ShieldAlert className="h-3 w-3 text-amber-400" />
                      )}
                    </span>
                    <span className="text-foreground truncate text-[11px] font-semibold">
                      {threat.threatName ?? threat.name ?? "Threat Vector"}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase",
                      critical
                        ? "border-red-500/30 bg-red-500/10 text-red-400"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    )}
                  >
                    {threat.severity ?? "Alert"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </FacetCard>

      {/* Defense Log Activity Feed */}
      <DomainActivityCard
        domain="defense"
        title="Defense Log"
        icon={Shield}
        entries={activity}
        emptyMessage="No defense activity yet"
      />
    </div>
  );
}
