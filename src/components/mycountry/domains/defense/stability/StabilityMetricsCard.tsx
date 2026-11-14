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
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import { getQualitativeRating, levelWord } from "~/lib/qualitative-rating";
import { getTrendDirection } from "~/hooks/useInternalStability";
import { StabilityHelpDialog } from "./StabilityHelpDialog";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

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
  up: { icon: StatUp, className: "text-green", label: "Improving" },
  down: { icon: StatDown, className: "text-destructive", label: "Declining" },
  flat: { icon: Minus, className: "text-label-secondary", label: "Steady" },
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

/** One 0 to 100 level read as a word (Very low to Very high) over its meter: a level, not a percentage. */
function LevelMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="text-body flex items-center justify-between gap-2">
        <span className="text-label-secondary truncate" title={label}>
          {label}
        </span>
        <span className="text-label shrink-0 font-medium">{levelWord(value)}</span>
      </div>
      <Progress value={value} aria-label={label} className="h-1.5" />
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
    <section className="border-separator space-y-3 border-t pt-4">
      <h4 className="text-label text-headline flex items-center gap-2">
        <Icon aria-hidden="true" className="text-label-secondary h-4 w-4" />
        {title}
      </h4>
      {children}
    </section>
  );
}

/** The full metric breakdown, shown once stability data has been recorded. */
function StabilityBody({ metrics }: { metrics: StabilityMetrics }) {
  const rating = getQualitativeRating(metrics.stabilityScore);
  return (
    <>
      <div>
        <div className="mb-2 flex items-end justify-between gap-3">
          <span className="text-caption text-label-secondary">Overall stability</span>
          <span className="flex items-baseline gap-2">
            <span className={cn("text-title-1", rating.color)}>{rating.label}</span>
            <span className="text-label-secondary text-body tabular-nums">
              <NumberFlowDisplay
                value={metrics.stabilityScore}
                format="decimal"
                decimalPlaces={1}
              />
              /100
            </span>
          </span>
        </div>
        <Progress value={metrics.stabilityScore} aria-label="Overall stability" className="h-2" />
      </div>

      <MetricSection title="Crime & law enforcement" icon={Shield}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-body flex items-center justify-between">
              <span className="text-label-secondary">Overall crime rate</span>
              <span className="text-label font-medium tabular-nums">
                <NumberFlowDisplay value={metrics.crimeRate} format="decimal" decimalPlaces={1} />{" "}
                per 100k
              </span>
            </div>
            <div className="text-label-secondary text-footnote flex items-center justify-between">
              <span>Violent crime</span>
              <span className="tabular-nums">
                <NumberFlowDisplay value={metrics.violentCrimeRate} />
              </span>
            </div>
            <div className="text-label-secondary text-footnote flex items-center justify-between">
              <span>Property crime</span>
              <span className="tabular-nums">
                <NumberFlowDisplay value={metrics.propertyCrimeRate} />
              </span>
            </div>
          </div>
          <LevelMetric label="Organized crime" value={metrics.organizedCrimeLevel} />
          <LevelMetric label="Policing effectiveness" value={metrics.policingEffectiveness} />
          <LevelMetric label="Justice system efficiency" value={metrics.justiceSystemEfficiency} />
        </div>
      </MetricSection>

      <MetricSection title="Public order" icon={Activity}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="text-body flex items-center justify-between gap-2">
            <span className="text-label-secondary">Protest frequency</span>
            <span className="text-label font-medium tabular-nums">
              <NumberFlowDisplay value={metrics.protestFrequency} /> /year
            </span>
          </div>
          <LevelMetric label="Riot risk" value={metrics.riotRisk} />
          <LevelMetric label="Civil disobedience" value={metrics.civilDisobedience} />
        </div>
      </MetricSection>

      <MetricSection title="Social cohesion" icon={Heart}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <LevelMetric label="Social cohesion" value={metrics.socialCohesion} />
          <LevelMetric label="Ethnic tension" value={metrics.ethnicTension} />
          <LevelMetric label="Political polarization" value={metrics.politicalPolarization} />
        </div>
      </MetricSection>

      <MetricSection title="Public confidence" icon={Eye}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <LevelMetric label="Trust in government" value={metrics.trustInGovernment} />
          <LevelMetric label="Trust in police" value={metrics.trustInPolice} />
          <LevelMetric label="Fear of crime" value={metrics.fearOfCrime} />
        </div>
      </MetricSection>
    </>
  );
}

export const StabilityMetricsCard = React.memo(function StabilityMetricsCard({
  metrics,
}: StabilityMetricsCardProps) {
  return (
    <Card>
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-label text-title-3 flex items-center gap-2">
            <Users aria-hidden="true" className="text-red h-4 w-4" />
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
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        {metrics ? (
          <StabilityBody metrics={metrics} />
        ) : (
          <p className="text-label-secondary text-body">No stability data recorded yet.</p>
        )}
      </CardContent>
    </Card>
  );
});
