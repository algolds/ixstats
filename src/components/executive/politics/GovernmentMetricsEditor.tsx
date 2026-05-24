"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { BarChart2 } from "lucide-react";
import { api } from "~/trpc/react";

interface GovernmentMetricsEditorProps {
  countryId: string;
}

interface MetricConfig {
  key: string;
  label: string;
  description: string;
  /** When true, higher values are unfavorable (red bar) */
  invertedScale?: boolean;
  /** If set, render as "X years" text instead of a progress bar */
  isYears?: boolean;
}

const METRICS: MetricConfig[] = [
  {
    key: "politicalStability",
    label: "Political Stability",
    description: "Affects investment confidence, growth, and crisis frequency.",
  },
  {
    key: "democracyIndex",
    label: "Democracy Index",
    description: "Higher values unlock diplomatic bonuses and reduce sanctions risk.",
  },
  {
    key: "politicalPolarization",
    label: "Political Polarization",
    description: "Ideological divide in the legislature — high values increase gridlock.",
    invertedScale: true,
  },
  {
    key: "governmentEffectiveness",
    label: "Govt. Effectiveness",
    description: "How well the government converts policy decisions into outcomes.",
  },
  {
    key: "ruleOfLaw",
    label: "Rule of Law",
    description: "Strength of legal institutions and judicial independence.",
  },
  {
    key: "corruptionIndex",
    label: "Corruption Index",
    description: "Higher values reduce government effectiveness and foreign investment.",
    invertedScale: true,
  },
  {
    key: "electionCycle",
    label: "Election Cycle",
    description: "Baseline interval between general elections.",
    isYears: true,
  },
];

function barColor(value: number, inverted: boolean): string {
  const effective = inverted ? 100 - value : value;
  if (effective >= 70) return "bg-green-500";
  if (effective >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export function GovernmentMetricsEditor({ countryId }: GovernmentMetricsEditorProps) {
  const { data: govStructure, isLoading } = api.government.getByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const getValue = (key: string): number => {
    if (!govStructure) return 0;
    const map: Record<string, number> = {
      politicalStability: Math.round((govStructure.politicalStability ?? 0.5) * 100),
      democracyIndex: Math.round(govStructure.democracyIndex ?? 50),
      politicalPolarization: Math.round(govStructure.politicalPolarization ?? 30),
      governmentEffectiveness: Math.round(govStructure.governmentEffectiveness ?? 50),
      ruleOfLaw: Math.round(govStructure.ruleOfLaw ?? 50),
      corruptionIndex: Math.round(govStructure.corruptionIndex ?? 30),
      electionCycle: govStructure.electionCycle ?? 4,
    };
    return map[key] ?? 0;
  };

  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-violet-600" />
          Political Metrics
        </CardTitle>
        <CardDescription>
          Live government indices — updated automatically by elections, policies, and events.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground flex items-center justify-center py-6 text-sm">
            Loading metrics…
          </div>
        ) : !govStructure ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No government structure configured yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {METRICS.map((metric) => {
              const value = getValue(metric.key);
              return (
                <div key={metric.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{metric.label}</span>
                    <span className="text-xs font-semibold tabular-nums">
                      {metric.isYears ? `${value} yr` : `${value}`}
                    </span>
                  </div>
                  {!metric.isYears && (
                    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full transition-all ${barColor(value, !!metric.invertedScale)}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  )}
                  <p className="text-muted-foreground text-[10px] leading-tight">
                    {metric.description}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
