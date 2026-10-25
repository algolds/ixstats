"use client";

import React from "react";
import { Activity } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";
import type { CLevel, SubScores } from "~/lib/military/model";
import { SUB_SCORE_KEYS, worstSubScore } from "~/lib/military/defense-console";
import { C_LEVEL_COPY, SUB_SCORE_COPY } from "../defense-copy";
import { formatPercent } from "../forces/force-fields";

interface ReadinessCardProps {
  readiness: number;
  cLevel: CLevel;
  /** Null when there is no force to rate. */
  subScores: SubScores | null;
  title?: string;
}

/** Readiness as a C-level with its four areas; the weakest is named with what lifts it. */
export const ReadinessCard = React.memo(function ReadinessCard({
  readiness,
  cLevel,
  subScores,
  title = "Readiness",
}: ReadinessCardProps) {
  const worst = subScores ? worstSubScore(subScores) : null;
  const level = C_LEVEL_COPY[cLevel];
  return (
    <Card content="data">
      <CardHeader className="p-5 pb-3">
        <CardTitle icon={<Activity />}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-large-title text-label tabular-nums">{cLevel}</span>
          <span className="text-headline text-label">{level.label}</span>
          <span className="text-label-secondary text-callout tabular-nums">
            {formatPercent(readiness)} readiness
          </span>
        </div>
        <p className="text-label-secondary text-footnote">{level.detail}</p>
        {subScores && worst && (
          <ul className="space-y-3" aria-label="Readiness areas">
            {SUB_SCORE_KEYS.map((key) => (
              <SubScoreRow key={key} area={key} value={subScores[key]} worst={key === worst} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
});

function SubScoreRow({
  area,
  value,
  worst,
}: {
  area: (typeof SUB_SCORE_KEYS)[number];
  value: number;
  worst: boolean;
}) {
  const copy = SUB_SCORE_COPY[area];
  return (
    <li data-worst={worst || undefined} className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-callout text-label flex min-w-0 items-center gap-2">
          <span className="truncate">{copy.label}</span>
          <span className="text-label-tertiary text-footnote shrink-0">{copy.analyst}</span>
          {worst && <Badge variant="warning">Weakest</Badge>}
        </span>
        <span className={cn("text-callout tabular-nums", worst ? "text-warning-ink" : "text-label")}>
          {formatPercent(value)}
        </span>
      </div>
      <Progress
        value={value * 100}
        tone={worst ? "warning" : "tint"}
        className="h-1"
        aria-label={copy.label}
      />
      {worst && <p className="text-label-secondary text-footnote">{copy.fix}</p>}
    </li>
  );
}
