"use client";
// src/components/defense/stability/StabilityMetricsCard.tsx

import React from "react";
import type { ReactNode } from "react";
import {
  Group as Users,
  Shield,
  Activity,
  Heart,
  Eye,
  StatUp,
  StatDown,
  Minus,
} from "iconoir-react";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Progress } from "~/components/ui/progress";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import { getTrendDirection } from "~/hooks/useInternalStability";
import { StabilityHelpDialog } from "./StabilityHelpDialog";

interface StabilityMetrics {
  stabilityScore: number;
  stabilityTrend: string;
  crimeRate: number;
  violentCrimeRate: number;
  propertyCrimeRate: number;
  organizedCrimeLevel: number;
  policingEffectiveness: number;
  justiceSystemEfficiency: number;
  protestFrequency: number;
  riotRisk: number;
  civilDisobedience: number;
  socialCohesion: number;
  ethnicTension: number;
  politicalPolarization: number;
  trustInGovernment: number;
  trustInPolice: number;
  fearOfCrime: number;
}

interface StabilityMetricsCardProps {
  metrics: StabilityMetrics | undefined;
}

const TREND_GLYPH = {
  up: { icon: StatUp, className: "text-emerald-600", label: "Improving" },
  down: { icon: StatDown, className: "text-destructive", label: "Declining" },
  flat: { icon: Minus, className: "text-muted-foreground", label: "Steady" },
} as const;

/** The stability trend as a semantic glyph with an accessible label. */
function TrendGlyph({ trend }: { trend: string }) {
  const glyph = TREND_GLYPH[getTrendDirection(trend)];
  const Icon = glyph.icon;
  return (
    <span title={`Trend: ${glyph.label}`} className="inline-flex">
      <Icon aria-hidden="true" className={cn("h-4 w-4", glyph.className)} />
      <span className="sr-only">Trend: {glyph.label}</span>
    </span>
  );
}

/** Stability score → semantic status text colour (stable / strained / unstable). */
function scoreTone(score: number): string {
  if (score >= 60) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-destructive";
}

/** One labelled percentage with its bar. */
function PercentMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground truncate" title={label}>
          {label}
        </span>
        <span className="text-foreground shrink-0 font-medium tabular-nums">
          <NumberFlowDisplay value={value} format="decimal" decimalPlaces={0} />%
        </span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

function MetricSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section className="border-border/60 space-y-3 border-t pt-4">
      <h4 className="text-foreground flex items-center gap-2 text-sm font-semibold">
        <Icon aria-hidden="true" className="text-muted-foreground h-4 w-4" />
        {title}
      </h4>
      {children}
    </section>
  );
}

export const StabilityMetricsCard = React.memo(function StabilityMetricsCard({
  metrics,
}: StabilityMetricsCardProps) {
  const score = metrics?.stabilityScore ?? 75;

  return (
    <FacetCard depth={1} surface="solid">
      <FacetCardHeader className="p-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
            <Users aria-hidden="true" className="h-4 w-4 text-rose-500" />
            Internal stability
            <StabilityHelpDialog />
          </h3>
          <div className="flex items-center gap-2">
            {metrics && <TrendGlyph trend={metrics.stabilityTrend} />}
            <Badge variant="outline">
              <Activity aria-hidden="true" />
              Auto-generated events
            </Badge>
          </div>
        </div>
      </FacetCardHeader>
      <FacetCardContent className="space-y-4 px-5 pb-5">
        {/* Stability Score */}
        <div>
          <div className="mb-2 flex items-end justify-between">
            <Eyebrow>Overall stability score</Eyebrow>
            <span
              className={cn(
                "font-mono text-2xl font-semibold tabular-nums",
                metrics ? scoreTone(metrics.stabilityScore) : "text-foreground"
              )}
            >
              <NumberFlowDisplay value={score} format="decimal" decimalPlaces={1} />
              <span className="text-muted-foreground text-sm">/100</span>
            </span>
          </div>
          <Progress value={score} className="h-2" />
        </div>

        <MetricSection title="Crime & law enforcement" icon={Shield}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Crime Rate</span>
                <span className="text-foreground font-medium tabular-nums">
                  <NumberFlowDisplay
                    value={metrics?.crimeRate ?? 5}
                    format="decimal"
                    decimalPlaces={1}
                  />{" "}
                  per 100k
                </span>
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>Violent Crime</span>
                <span className="tabular-nums">
                  <NumberFlowDisplay value={metrics?.violentCrimeRate ?? 2} />
                </span>
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>Property Crime</span>
                <span className="tabular-nums">
                  <NumberFlowDisplay value={metrics?.propertyCrimeRate ?? 10} />
                </span>
              </div>
            </div>
            <PercentMetric label="Organized Crime" value={metrics?.organizedCrimeLevel ?? 3} />
            <PercentMetric
              label="Policing Effectiveness"
              value={metrics?.policingEffectiveness ?? 60}
            />
            <PercentMetric
              label="Justice System Efficiency"
              value={metrics?.justiceSystemEfficiency ?? 50}
            />
          </div>
        </MetricSection>

        <MetricSection title="Public order" icon={Activity}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Protest Frequency</span>
              <span className="text-foreground font-medium tabular-nums">
                <NumberFlowDisplay value={metrics?.protestFrequency ?? 5} /> /year
              </span>
            </div>
            <PercentMetric label="Riot Risk" value={metrics?.riotRisk ?? 10} />
            <PercentMetric label="Civil Disobedience" value={metrics?.civilDisobedience ?? 5} />
          </div>
        </MetricSection>

        <MetricSection title="Social cohesion" icon={Heart}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <PercentMetric label="Social Cohesion" value={metrics?.socialCohesion ?? 70} />
            <PercentMetric label="Ethnic Tension" value={metrics?.ethnicTension ?? 20} />
            <PercentMetric
              label="Political Polarization"
              value={metrics?.politicalPolarization ?? 40}
            />
          </div>
        </MetricSection>

        <MetricSection title="Public confidence" icon={Eye}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <PercentMetric label="Trust in Government" value={metrics?.trustInGovernment ?? 50} />
            <PercentMetric label="Trust in Police" value={metrics?.trustInPolice ?? 55} />
            <PercentMetric label="Fear of Crime" value={metrics?.fearOfCrime ?? 35} />
          </div>
        </MetricSection>
      </FacetCardContent>
    </FacetCard>
  );
});
