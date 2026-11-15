"use client";

import {
  Shield,
  Globe,
  WarningTriangle as AlertTriangle,
  Archery as Crosshair,
} from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { CountryLink } from "~/components/shared/country-actions/CountryLink";
import { Badge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";
import { Progress } from "~/components/ui/progress";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { getQualitativeRating } from "~/lib/qualitative-rating";

interface BorderThreatPanelProps {
  countryId: string;
}

/** Threat level → semantic status colour (outline badge text + progress fill). */
const threatLevelConfig = {
  minimal: {
    label: "Minimal",
    color: "border-success/30 text-success",
    indicator: "bg-success",
  },
  low: {
    label: "Low",
    color: "border-success/30 text-success",
    indicator: "bg-success",
  },
  moderate: {
    label: "Moderate",
    color: "border-warning/30 text-warning",
    indicator: "bg-warning",
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

/** Diplomatic stance → readable label. */
const diplomaticConfig = {
  hostile: { label: "Hostile" },
  tense: { label: "Tense" },
  neutral: { label: "Neutral" },
  friendly: { label: "Friendly" },
  allied: { label: "Allied" },
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

type NeighborThreat = RouterOutputs["security"]["getBorderSecurity"]["neighborThreats"][number];

function ThreatRow({ threat }: { threat: NeighborThreat }) {
  const level =
    threatLevelConfig[threat.threatLevel as keyof typeof threatLevelConfig] ??
    threatLevelConfig.low;
  const diplomatic =
    diplomaticConfig[threat.diplomaticRelations as keyof typeof diplomaticConfig] ??
    diplomaticConfig.neutral;

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Globe aria-hidden="true" className="text-label-secondary h-4 w-4" />
            <h4 className="text-label text-headline">
              <CountryLink
                country={{ id: threat.neighborCountryId, name: threat.neighborName }}
                className="hover:underline"
              >
                {threat.neighborName}
              </CountryLink>
            </h4>
          </div>
          <p className="text-label-secondary text-footnote capitalize">
            {threat.borderType} border
            {threat.diplomaticRelations ? ` · ${diplomatic.label}` : ""}
          </p>
        </div>
        <Badge variant="outline" className={level.color}>
          {level.label}
        </Badge>
      </div>

      <div className="space-y-1">
        <div className="text-footnote flex items-center justify-between">
          <span className="text-label-secondary">Threat score</span>
          <span className="font-medium tabular-nums">{threat.threatScore}/100</span>
        </div>
        <Progress
          value={threat.threatScore}
          className="h-1.5"
          indicatorClassName={level.indicator}
        />
      </div>

      <div className="text-footnote flex items-center justify-between">
        <span className="text-label-secondary flex items-center gap-1.5">
          <Crosshair aria-hidden="true" className="h-3.5 w-3.5" />
          Their share of our combined strength
        </span>
        <span className="font-medium tabular-nums">{threat.militaryThreat}%</span>
      </div>

      {threat.notes && (
        <p className="text-label-secondary border-separator/60 text-footnote border-t pt-2.5 leading-relaxed">
          {threat.notes}
        </p>
      )}
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
    <div className="space-y-3">
      <div>
        <h3 className="text-label text-headline">Border security</h3>
        <p className="text-label-secondary text-footnote">
          Worked out from your map neighbors, their forces, your relations and any conflicts or
          hostile actions between you.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card content="data">
          <CardHeader className="p-4 pb-3">
            <h4 className="text-label text-headline flex items-center gap-2">
              <Shield aria-hidden="true" className="text-label-secondary h-4 w-4" />
              Frontier posture
            </h4>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4">
            <div className="border-separator/60 flex items-center justify-between border-b pb-3">
              <span className="text-caption text-label-secondary">Security level</span>
              <div className="text-right">
                <div className="text-label text-title-2 tabular-nums">
                  {border?.overallSecurityLevel ?? 0}
                  <span className="text-label-secondary text-body font-normal">/100</span>
                </div>
                <Badge variant="outline" className="mt-1 capitalize">
                  {border?.securityStatus ??
                    getQualitativeRating(border?.overallSecurityLevel ?? 0).label}
                </Badge>
              </div>
            </div>

            <div className="divide-separator/60 divide-y">
              <StatItem label="Land neighbors" value={border?.landBorders ?? 0} icon={Globe} />
              <StatItem
                label="Active threats"
                value={border?.activeThreatCount ?? 0}
                icon={AlertTriangle}
              />
            </div>
          </CardContent>
        </Card>

        <Card content="data" padding="none">
          <CardHeader className="border-separator/60 border-b p-4">
            <h4 className="text-label text-headline flex items-center gap-2">
              <AlertTriangle aria-hidden="true" className="text-label-secondary h-4 w-4" />
              Neighbor threats
            </h4>
            <p className="text-label-secondary text-footnote">
              {threats.length === 0
                ? "No land neighbors on the map"
                : `${threats.length} neighbor${threats.length === 1 ? "" : "s"} assessed`}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {threats.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  compact
                  icon={<Globe />}
                  title="No land neighbors"
                  message="Neighbors come from your borders on the map. Draw or link your territory to assess them."
                />
              </div>
            ) : (
              <div className="divide-separator/60 divide-y">
                {threats.map((threat) => (
                  <ThreatRow key={threat.id} threat={threat} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
