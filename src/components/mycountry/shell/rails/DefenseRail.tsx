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
import { forceTotals } from "~/lib/military/force-structure";
import {
  DomainActivityCard,
  RailBar,
  RailCard,
  RailCount,
  RailEmpty,
  RailRow,
  pushRecorded,
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
  domain: string;
  activeDuty: number;
  reserves: number;
  units: { personnel: number }[];
  assets: { quantity: number }[];
  /** The owner's derived state (readiness, quality, training 0–1); null for other viewers. */
  derived: {
    readiness: number;
    quality: number;
    combatPower: number;
    personnel: number;
    subScores: { training: number };
  } | null;
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

  const { averageReadiness, averageQuality, averageTraining } = useMemo(() => {
    const weighted = (pick: (d: NonNullable<MilitaryBranchRecord["derived"]>) => number) => {
      const rows = (branches ?? []).flatMap((b) => (b.derived ? [b.derived] : []));
      const people = rows.reduce((s, d) => s + d.personnel, 0);
      return people > 0 ? Math.round((rows.reduce((s, d) => s + pick(d) * d.personnel, 0) / people) * 100) : 0;
    };
    return {
      averageReadiness: weighted((d) => d.readiness),
      averageQuality: weighted((d) => d.quality),
      averageTraining: weighted((d) => d.subScores.training),
    };
  }, [branches]);

  const strength = useMemo(() => forceTotals(branches ?? []).strength, [branches]);

  const activity = useMemo<ActivityEntry[]>(() => {
    const entries: ActivityEntry[] = [];

    branches?.forEach((b) => {
      if (!b.derived) return;
      const readiness = b.derived.readiness * 100;
      pushRecorded(
        entries,
        {
          id: `branch-${b.id}`,
          icon: Sword,
          iconColor: STATUS_TEXT[readinessTone(readiness)],
          text: `${b.name ?? "Military branch"}: ${Math.round(readiness)}% ready`,
        },
        b.updatedAt,
        b.createdAt
      );
    });

    assessment?.activeThreats?.forEach((t) => {
      const critical = t.severity === "critical" || t.severity === "existential";
      pushRecorded(
        entries,
        {
          id: `threat-${t.id}`,
          icon: critical ? AlertTriangle : ShieldAlert,
          iconColor: critical ? STATUS_TEXT.critical : STATUS_TEXT.warning,
          text: `${t.threatName ?? "Threat"} · ${t.severity ?? "monitoring"}`,
        },
        t.lastUpdated,
        t.detectedAt,
        t.createdAt
      );
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [assessment, branches]);

  return (
    <div className="space-y-6">
      {/* Strategic Readiness Overview (Sidebar Snapshot Rail) */}
      <ReadinessOverviewCard
        averageReadiness={averageReadiness}
        averageQuality={averageQuality}
        averageTraining={averageTraining}
      />

      {/* Military branches and readiness */}
      <RailCard
        title="Military branches"
        icon={Sword}
        accessory={<RailCount>{branches?.length ?? 0} active</RailCount>}
      >
        {branches && branches.length > 0 && (
          <RailRow className="flex items-center justify-between gap-2">
            <span className="text-label-secondary">Combat strength</span>
            <span className="text-label font-medium tabular-nums">
              {strength === null ? "Not disclosed" : Math.round(strength).toLocaleString("en-US")}
            </span>
          </RailRow>
        )}
        {!branches || branches.length === 0 ? (
          <RailEmpty>No military branches yet. Combat strength is zero.</RailEmpty>
        ) : (
          branches.slice(0, 4).map((b) => {
            const readiness = (b.derived?.readiness ?? 0) * 100;
            const personnel = b.activeDuty;
            const tone = readinessTone(readiness);

            return (
              <RailRow key={b.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-label min-w-0 truncate font-medium">
                    {b.name ?? "Military branch"}
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
