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
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

/** Network condition → semantic status colour (badge text, figure text, funding bar). */
const CONDITION_THEMES = {
  optimal: {
    badge: "border-emerald-500/30 text-emerald-600",
    text: "text-emerald-600",
    bar: "bg-emerald-500",
  },
  adequate: {
    badge: "text-muted-foreground",
    text: "text-foreground",
    bar: "bg-foreground/60",
  },
  deteriorating: {
    badge: "border-amber-500/30 text-amber-600",
    text: "text-amber-600",
    bar: "bg-amber-500",
  },
  failing: {
    badge: "border-destructive/30 text-destructive",
    text: "text-destructive",
    bar: "bg-destructive",
  },
} as const;

export interface InfrastructureMaintenanceCardProps {
  countryId: string;
  onDeclareDirective?: (directiveGoal: string) => void;
}

function Delta({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "font-mono text-xl font-semibold tabular-nums",
        value >= 0 ? "text-emerald-600" : "text-destructive"
      )}
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
    return <Skeleton className="h-40 w-full rounded-2xl" />;
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
    <FacetCard depth={1} surface="solid" className={cn("p-5", isCritical && "border-amber-500/40")}>
      {/* Header */}
      <div className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <StatusIcon
            aria-hidden="true"
            className={cn(
              "h-4 w-4 shrink-0",
              isCritical ? "text-amber-600" : "text-muted-foreground"
            )}
          />
          <div className="min-w-0">
            <h3 className="text-foreground text-sm font-semibold">
              Infrastructure maintenance & speed retention
            </h3>
            <span className="text-muted-foreground text-xs">
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
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Coins aria-hidden="true" className="h-3.5 w-3.5" /> Budgeted vs. Required Annual
            Maintenance
          </span>
          <span className="text-foreground font-mono text-xs font-semibold tabular-nums">
            {degradation.budgetedMaintenance.toFixed(3)}B /{" "}
            {degradation.requiredMaintenance.toFixed(3)}B
            <span className="text-muted-foreground ml-1.5 font-normal">
              ({fundingPercent}% funded)
            </span>
          </span>
        </div>

        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
          <div
            className={cn("h-full rounded-full", theme.bar)}
            style={{ width: `${Math.min(100, fundingPercent)}%` }}
          />
        </div>
      </div>

      {/* 3-Metric Impact Row */}
      <dl className="divide-border/60 border-border/60 mt-4 grid grid-cols-1 divide-y border-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="py-3 sm:pr-3">
          <dt className="flex items-center gap-1">
            <Gauge aria-hidden="true" className="text-muted-foreground h-3.5 w-3.5" />
            <Eyebrow>Network speed factor</Eyebrow>
          </dt>
          <dd className="mt-1.5 flex items-baseline gap-1.5">
            <span className={cn("font-mono text-xl font-semibold tabular-nums", theme.text)}>
              {degradation.speedDegradationFactor.toFixed(2)}×
            </span>
            {degradation.speedPenaltyPercent > 0 && (
              <span className="text-destructive font-mono text-xs tabular-nums">
                (-{degradation.speedPenaltyPercent}%)
              </span>
            )}
          </dd>
          <dd className="text-muted-foreground mt-0.5 text-xs">
            {degradation.speedPenaltyPercent === 0
              ? "Full design velocity"
              : "Transit delay penalty"}
          </dd>
        </div>

        <div className="py-3 sm:px-3">
          <dt>
            <Eyebrow>GDP modifier impact</Eyebrow>
          </dt>
          <dd className="mt-1.5">
            <Delta value={degradation.gdpModifierDelta} />
          </dd>
          <dd className="text-muted-foreground mt-0.5 text-xs">Annual growth dividend</dd>
        </div>

        <div className="py-3 sm:pl-3">
          <dt>
            <Eyebrow>Trade efficiency</Eyebrow>
          </dt>
          <dd className="mt-1.5">
            <Delta value={degradation.tradeModifierDelta} />
          </dd>
          <dd className="text-muted-foreground mt-0.5 text-xs">Supply-chain throughput</dd>
        </div>
      </dl>

      {/* Description & Action */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
          {degradation.description}
        </p>

        {onDeclareDirective && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDeclareDirective("Emergency Transport Infrastructure Rehabilitation")}
          >
            <Command aria-hidden="true" className="h-3.5 w-3.5 text-amber-600" />
            Rehabilitation Directive
          </Button>
        )}
      </div>
    </FacetCard>
  );
});
