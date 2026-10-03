"use client";

import {
  Shield,
  Globe,
  WarningTriangle as AlertTriangle,
  Group as Users,
  SeaWaves as Anchor,
  Archery as Crosshair,
  ArrowSeparate as ArrowRightLeft,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

interface BorderThreatPanelProps {
  countryId: string;
}

/** Threat level → semantic status colour (outline badge text + progress fill). */
const threatLevelConfig = {
  minimal: {
    label: "Minimal",
    color: "border-green/30 text-green",
    indicator: "bg-green",
  },
  low: {
    label: "Low",
    color: "border-green/30 text-green",
    indicator: "bg-green",
  },
  moderate: {
    label: "Moderate",
    color: "border-yellow/30 text-yellow",
    indicator: "bg-yellow",
  },
  high: {
    label: "High",
    color: "border-destructive/30 text-destructive",
    indicator: "bg-destructive",
  },
  critical: {
    label: "Critical",
    color: "border-destructive/30 text-destructive",
    indicator: "bg-destructive",
  },
};

/** Diplomatic stance → semantic status colour; neutral/allied stay uncoloured. */
const diplomaticConfig = {
  hostile: { label: "Hostile", color: "border-destructive/30 text-destructive" },
  tense: { label: "Tense", color: "border-yellow/30 text-yellow" },
  neutral: { label: "Neutral", color: "text-label-secondary" },
  friendly: { label: "Friendly", color: "border-green/30 text-green" },
  allied: { label: "Allied", color: "border-green/30 text-green" },
};

function StatItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="text-label-secondary flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4" />
        <span className="text-body">{label}</span>
      </div>
      <span className="text-label text-headline tabular-nums">{value}</span>
    </div>
  );
}

function ThreatRow({
  threat,
}: {
  threat: {
    id: string;
    neighborName: string;
    borderType: string;
    threatLevel: string;
    threatScore: number;
    militaryThreat?: number | null;
    terrorismRisk?: number | null;
    smugglingRisk?: number | null;
    refugeeFlow?: number | null;
    politicalStability?: number | null;
    diplomaticRelations?: string;
    borderLength?: number | null;
    notes?: string | null;
  };
}) {
  const level =
    threatLevelConfig[threat.threatLevel as keyof typeof threatLevelConfig] ??
    threatLevelConfig.low;
  const diplomatic =
    diplomaticConfig[threat.diplomaticRelations as keyof typeof diplomaticConfig] ??
    diplomaticConfig.neutral;

  return (
    <div className="border-separator rounded-control space-y-3 border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe aria-hidden="true" className="text-label-secondary h-4 w-4" />
            <h4 className="text-label text-headline">{threat.neighborName}</h4>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {threat.borderType.replace("_", " ")}
            </Badge>
            {threat.borderLength != null && (
              <span className="text-label-secondary text-footnote">
                {threat.borderLength.toLocaleString()} km
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={level.color}>
            {level.label}
          </Badge>
          {threat.diplomaticRelations && (
            <Badge variant="outline" className={diplomatic.color}>
              {diplomatic.label}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-footnote flex items-center justify-between">
          <span className="text-label-secondary">Threat score</span>
          <span className="font-medium tabular-nums">{threat.threatScore}/100</span>
        </div>
        <Progress
          value={threat.threatScore}
          className="bg-fill-3 h-2"
          indicatorClassName={level.indicator}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricItem label="Military" value={threat.militaryThreat} icon={Crosshair} />
        <MetricItem label="Terrorism" value={threat.terrorismRisk} icon={AlertTriangle} />
        <MetricItem label="Smuggling" value={threat.smugglingRisk} icon={ArrowRightLeft} />
        <MetricItem label="Refugee flow" value={threat.refugeeFlow} icon={Users} />
      </div>

      {threat.politicalStability != null && (
        <div className="text-footnote flex items-center justify-between">
          <span className="text-label-secondary">Political stability</span>
          <span className="font-medium tabular-nums">{threat.politicalStability}/100</span>
        </div>
      )}

      {threat.notes && (
        <p className="text-label-secondary border-separator text-footnote border-t pt-3 leading-relaxed">
          {threat.notes}
        </p>
      )}
    </div>
  );
}

function MetricItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: number | null;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon aria-hidden="true" className="text-label-secondary h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-stat-label text-label-secondary block truncate">{label}</span>
        <div className="text-label text-headline tabular-nums">{value ?? 0}</div>
      </div>
    </div>
  );
}

export function BorderThreatPanel({ countryId }: BorderThreatPanelProps) {
  const { data, isLoading } = api.security.getBorderSecurity.useQuery({ countryId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const border = data;
  const threats = border?.neighborThreats ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-label text-title-3">Border security</h3>
        <p className="text-label-secondary text-body">
          Neighbor threat assessments and frontier readiness
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="p-5 pb-3">
            <h4 className="text-label text-headline flex items-center gap-2">
              <Shield aria-hidden="true" className="text-red h-4 w-4" />
              Border security overview
            </h4>
            <p className="text-label-secondary text-footnote">
              Current frontier posture and coverage
            </p>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5">
            <div className="border-separator flex items-center justify-between border-b pb-4">
              <span className="text-stat-label text-label-secondary">Security level</span>
              <div className="text-right">
                <div className="text-label text-title-1 tabular-nums">
                  {border?.overallSecurityLevel ?? 0}
                  <span className="text-label-secondary text-body font-normal">/100</span>
                </div>
                <Badge variant="outline" className="mt-1 capitalize">
                  {border?.securityStatus ?? "unknown"}
                </Badge>
              </div>
            </div>

            <div className="divide-separator divide-y">
              <StatItem
                label="Border length"
                value={
                  border?.borderLength != null ? `${border.borderLength.toLocaleString()} km` : "—"
                }
                icon={Globe}
              />
              <StatItem label="Land borders" value={border?.landBorders ?? 0} icon={Anchor} />
              <StatItem
                label="Maritime borders"
                value={border?.maritimeBorders ?? 0}
                icon={Anchor}
              />
              <StatItem label="Checkpoints" value={border?.checkpoints ?? 0} icon={Shield} />
              <StatItem
                label="Surveillance systems"
                value={border?.surveillanceSystems ?? 0}
                icon={Crosshair}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-3">
            <h4 className="text-label text-headline flex items-center gap-2">
              <AlertTriangle aria-hidden="true" className="text-red h-4 w-4" />
              Neighbor threats
            </h4>
            <p className="text-label-secondary text-footnote">
              {threats.length === 0
                ? "No assessments recorded"
                : `${threats.length} neighbor${threats.length === 1 ? "" : "s"} assessed`}
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {threats.length === 0 ? (
              <div className="border-separator rounded-control flex flex-col items-center justify-center border border-dashed py-10 text-center">
                <Globe aria-hidden="true" className="text-label-secondary mb-2 h-8 w-8" />
                <p className="text-label text-body font-medium">
                  No neighbor threat assessments recorded yet.
                </p>
                <p className="text-label-secondary text-footnote mt-1 max-w-xs">
                  Intelligence has not assessed any neighboring borders yet.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[420px] pr-3">
                <div className="space-y-3">
                  {threats.map((threat) => (
                    <ThreatRow key={threat.id} threat={threat} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
