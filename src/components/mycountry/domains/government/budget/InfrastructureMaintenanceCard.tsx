"use client";

import React, { memo } from "react";
import {
  Shield,
  Dashboard as Gauge,
  Coins,
  KeyCommand as Command,
  WarningTriangle as AlertTriangle,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { Card } from "~/components/ui/card";

/** Network condition → semantic status colour (badge text, figure text, funding bar). */
const CONDITION_THEMES = {
  optimal: {
    badge: "border-green/30 text-green",
    text: "text-green",
    bar: "bg-green",
  },
  adequate: {
    badge: "text-label-secondary",
    text: "text-label",
    bar: "bg-label-tertiary",
  },
  deteriorating: {
    badge: "border-yellow/30 text-yellow",
    text: "text-yellow",
    bar: "bg-yellow",
  },
  failing: {
    badge: "border-destructive/30 text-destructive",
    text: "text-destructive",
    bar: "bg-destructive",
  },
} as const;

interface InfrastructureMaintenanceCardProps {
  countryId: string;
  onDeclareDirective?: (directiveGoal: string) => void;
}

function Delta({ value }: { value: number }) {
  return (
    <span
      className={cn("text-title-2 tabular-nums", value >= 0 ? "text-green" : "text-destructive")}
    >
      {value >= 0 ? "+" : ""}
      {(value * 100).toFixed(2)}%
    </span>
  );
}

export const InfrastructureMaintenanceCard = memo(function InfrastructureMaintenanceCard({
  countryId,
  onDeclareDirective,
}: InfrastructureMaintenanceCardProps) {
  const { data: profile, isLoading } = api.transport.getNationalMobilityProfile.useQuery(
    { countryId },
    { staleTime: 30_000, enabled: !!countryId }
  );

  if (isLoading) {
    return <Skeleton className="rounded-card h-40 w-full" />;
  }

  if (!profile || profile.totalOperationalKm === 0) {
    return null;
  }

  const { degradation, totalOperationalKm } = profile;
  // The maintenance budget is served to the nation's owner only.
  if (degradation.fundingRatio == null || degradation.budgetedMaintenance == null) return null;
  const fundingPercent = Math.min(150, Math.round(degradation.fundingRatio * 100));

  const isCritical =
    degradation.condition === "failing" || degradation.condition === "deteriorating";
  const theme = CONDITION_THEMES[degradation.condition] ?? CONDITION_THEMES.adequate;
  const StatusIcon = isCritical ? AlertTriangle : Shield;

  return (
    <Card className={cn("p-5", isCritical && "border-yellow/40")}>
      {/* Header */}
      <div className="border-separator flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <StatusIcon
            aria-hidden="true"
            className={cn("h-4 w-4 shrink-0", isCritical ? "text-yellow" : "text-label-secondary")}
          />
          <div className="min-w-0">
            <h3 className="text-label text-headline">
              Infrastructure maintenance & speed retention
            </h3>
            <span className="text-label-secondary text-footnote">
              Physical network condition across {totalOperationalKm.toLocaleString()} operational
              kilometers
            </span>
          </div>
        </div>

        <Badge variant="outline" className={cn("capitalize", theme.badge)}>
          {degradation.conditionLabel} Condition
        </Badge>
      </div>

      {/* Progress & Budget Ratio */}
      <div className="mt-4 space-y-2">
        <div className="text-footnote flex flex-wrap items-center justify-between gap-2">
          <span className="text-label-secondary text-footnote flex items-center gap-2">
            <Coins aria-hidden="true" className="h-3.5 w-3.5" /> Budgeted vs. Required Annual
            Maintenance
          </span>
          <span className="text-label text-caption font-semibold tabular-nums">
            {degradation.budgetedMaintenance.toFixed(3)}B /{" "}
            {degradation.requiredMaintenance.toFixed(3)}B
            <span className="text-label-secondary ml-2 font-normal">
              ({fundingPercent}% funded)
            </span>
          </span>
        </div>

        <div className="bg-fill-3 h-2 w-full overflow-hidden rounded-full">
          <div
            className={cn("h-full rounded-full", theme.bar)}
            style={{ width: `${Math.min(100, fundingPercent)}%` }}
          />
        </div>
      </div>

      {/* 3-Metric Impact Row */}
      <dl className="divide-separator border-separator mt-4 grid grid-cols-1 divide-y border-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="py-3 sm:pr-3">
          <dt className="flex items-center gap-1">
            <Gauge aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />
            <span className="text-stat-label text-label-secondary">Network speed factor</span>
          </dt>
          <dd className="mt-2 flex items-baseline gap-2">
            <span className={cn("text-title-2 tabular-nums", theme.text)}>
              {degradation.speedDegradationFactor.toFixed(2)}×
            </span>
            {degradation.speedPenaltyPercent > 0 && (
              <span className="text-destructive text-footnote tabular-nums">
                (-{degradation.speedPenaltyPercent}%)
              </span>
            )}
          </dd>
          <dd className="text-label-secondary text-footnote mt-0.5">
            {degradation.speedPenaltyPercent === 0
              ? "Full design velocity"
              : "Transit delay penalty"}
          </dd>
        </div>

        <div className="py-3 sm:px-3">
          <dt>
            <span className="text-stat-label text-label-secondary">GDP modifier impact</span>
          </dt>
          <dd className="mt-2">
            <Delta value={degradation.gdpModifierDelta} />
          </dd>
          <dd className="text-label-secondary text-footnote mt-0.5">Annual growth dividend</dd>
        </div>

        <div className="py-3 sm:pl-3">
          <dt>
            <span className="text-stat-label text-label-secondary">Trade efficiency</span>
          </dt>
          <dd className="mt-2">
            <Delta value={degradation.tradeModifierDelta} />
          </dd>
          <dd className="text-label-secondary text-footnote mt-0.5">Supply-chain throughput</dd>
        </div>
      </dl>

      {/* Description & Action */}
      <div className="text-footnote mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-label-secondary text-footnote max-w-xl leading-relaxed">
          {degradation.description}
        </p>

        {onDeclareDirective && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDeclareDirective("Emergency Transport Infrastructure Rehabilitation")}
          >
            <Command aria-hidden="true" className="text-yellow h-3.5 w-3.5" />
            Rehabilitation Directive
          </Button>
        )}
      </div>
    </Card>
  );
});
