"use client";

import React, { useMemo } from "react";
import {
  Tournament as Sword,
  WarningTriangle as AlertTriangle,
  ShieldAlert,
  Shield,
  Activity,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { CLevel } from "~/lib/military/model";
import { nationalSubScores, worstSubScore } from "~/lib/military/defense-console";
import { useDefenseOverview, type OwnerDefense, type RedactedDefense } from "~/hooks/useDefenseConsole";
import {
  ALERT_COPY,
  C_LEVEL_COPY,
  SUB_SCORE_COPY,
  WARNING_COPY,
} from "~/components/mycountry/domains/defense/defense-copy";
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

const C_LEVEL_TONE: Record<CLevel, StatusTone> = {
  "C-1": "success",
  "C-2": "success",
  "C-3": "warning",
  "C-4": "critical",
};

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

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const isCritical = (t: ThreatItem) => t.severity === "critical" || t.severity === "existential";

function ReadinessRailCard({ owner }: { owner: OwnerDefense }) {
  const subScores = nationalSubScores(owner.branches);
  const tone = C_LEVEL_TONE[owner.cLevel];
  return (
    <RailCard title="Readiness" icon={Activity} accessory={<RailCount>{owner.cLevel}</RailCount>}>
      <RailRow>
        <div className="flex items-center justify-between gap-2">
          <span className="text-label font-medium">{C_LEVEL_COPY[owner.cLevel].label}</span>
          <span className={cn("tabular-nums", STATUS_TEXT[tone])}>{Math.round(owner.readiness * 100)}%</span>
        </div>
        <RailBar value={owner.readiness * 100} fill={STATUS_FILL[tone]} />
      </RailRow>
      {subScores && (
        <RailRow className="flex items-center justify-between gap-2">
          <span className="text-label-secondary">Weakest area</span>
          <span className="text-label">{SUB_SCORE_COPY[worstSubScore(subScores)].label}</span>
        </RailRow>
      )}
      <RailRow className="flex items-center justify-between gap-2">
        <span className="text-label-secondary">Combat power</span>
        <span className="text-label font-medium tabular-nums">{fmt(owner.combatPower)}</span>
      </RailRow>
      <RailRow className="flex items-center justify-between gap-2">
        <span className="text-label-secondary">Alert in effect</span>
        <span className="text-label">{ALERT_COPY[owner.policy.alertInEffect].label}</span>
      </RailRow>
      {owner.warnings.map((w) => (
        <RailRow key={w} className="flex items-start gap-2">
          <AlertTriangle aria-hidden="true" className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", STATUS_TEXT.warning)} />
          <span className="text-label">{WARNING_COPY[w].title}</span>
        </RailRow>
      ))}
    </RailCard>
  );
}

function BranchRows({ owner, redacted }: { owner: OwnerDefense | null; redacted: RedactedDefense | null }) {
  if (owner) {
    if (owner.branches.length === 0) return <RailEmpty>No military branches yet. Combat power is zero.</RailEmpty>;
    return (
      <>
        {owner.branches.slice(0, 5).map((b) => (
          <RailRow key={b.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-label min-w-0 truncate font-medium">{b.name}</span>
              <span className="text-label shrink-0 tabular-nums">
                <span className={STATUS_TEXT[C_LEVEL_TONE[b.cLevel]]}>{b.cLevel}</span> · {fmt(b.personnel)}
              </span>
            </div>
            <RailBar value={b.readiness * 100} fill={STATUS_FILL[C_LEVEL_TONE[b.cLevel]]} />
          </RailRow>
        ))}
      </>
    );
  }
  return (
    <>
      {(redacted?.branches ?? []).slice(0, 5).map((b) => (
        <RailRow key={b.id} className="flex items-center justify-between gap-2">
          <span className="text-label min-w-0 truncate font-medium">{b.name}</span>
          <span className="text-label-secondary shrink-0 tabular-nums">{fmt(b.active)} active</span>
        </RailRow>
      ))}
    </>
  );
}

/** Defense rail: readiness as a C-level and its weakest area, budget warnings, branches, threats and activity. */
export function DefenseRail({ countryId }: { countryId: string }) {
  const { owner, redacted } = useDefenseOverview(countryId);
  const { data: assessmentRaw } = api.security.getSecurityAssessment.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const threats = useMemo(
    () => (assessmentRaw as AssessmentData | undefined)?.activeThreats ?? [],
    [assessmentRaw]
  );

  const activity = useMemo<ActivityEntry[]>(() => {
    const entries: ActivityEntry[] = [];
    threats.forEach((t) => {
      pushRecorded(
        entries,
        {
          id: `threat-${t.id}`,
          icon: isCritical(t) ? AlertTriangle : ShieldAlert,
          iconColor: isCritical(t) ? STATUS_TEXT.critical : STATUS_TEXT.warning,
          text: `${t.threatName ?? "Threat"} · ${t.severity ?? "monitoring"}`,
        },
        t.lastUpdated,
        t.detectedAt,
        t.createdAt
      );
    });
    return entries.sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [threats]);

  return (
    <div className="space-y-6">
      {owner && <ReadinessRailCard owner={owner} />}

      <RailCard
        title="Military branches"
        icon={Sword}
        accessory={<RailCount>{(owner ?? redacted)?.branches.length ?? 0}</RailCount>}
      >
        <BranchRows owner={owner} redacted={redacted} />
      </RailCard>

      <RailCard title="Threat assessments" icon={AlertTriangle} accessory={<RailCount>{threats.length}</RailCount>}>
        {threats.length === 0 ? (
          <RailEmpty>No active threats.</RailEmpty>
        ) : (
          threats.slice(0, 3).map((threat) => {
            const critical = isCritical(threat);
            const ThreatIcon = critical ? AlertTriangle : ShieldAlert;
            return (
              <RailRow key={threat.id} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <ThreatIcon
                    aria-hidden="true"
                    className={cn("h-3.5 w-3.5 shrink-0", critical ? STATUS_TEXT.critical : STATUS_TEXT.warning)}
                  />
                  <span className="text-label truncate font-medium">
                    {threat.threatName ?? threat.name ?? "Threat"}
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
