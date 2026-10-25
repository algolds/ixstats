"use client";
// src/components/defense/command/ReadinessOverviewCard.tsx

import React from "react";
import { Archery as Target, HelpCircle, InfoCircle as Info } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

interface ReadinessOverviewCardProps {
  averageReadiness: number;
  averageTechnology: number;
  averageMorale: number;
}

export const ReadinessOverviewCard = React.memo(function ReadinessOverviewCard({
  averageReadiness,
  averageTechnology,
  averageMorale,
}: ReadinessOverviewCardProps) {
  // Averages of 0-100 branch levels.
  const metrics = [
    { label: "Readiness", title: "Overall readiness", value: averageReadiness },
    { label: "Technology", title: "Technology level", value: averageTechnology },
    { label: "Morale", title: "Force morale", value: averageMorale },
  ];

  return (
    <Card className="rounded-card">
      <CardHeader className="p-4 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <Target aria-hidden="true" className="text-red h-4 w-4 shrink-0" />
          <h3 className="text-label text-headline min-w-0">Strategic readiness overview</h3>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-8 w-8 shrink-0"
                aria-label="About strategic readiness metrics"
              >
                <HelpCircle className="text-label-secondary h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent size="wide" className="overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Info aria-hidden="true" className="text-label-secondary h-5 w-5" />
                  Strategic readiness metrics
                </SheetTitle>
              </SheetHeader>
              <div className="text-body space-y-4">
                <div>
                  <h4 className="mb-2 font-semibold">Overall readiness</h4>
                  <p className="text-label-secondary">
                    Measures the ability of your forces to deploy and conduct operations
                    immediately. Factors include equipment availability, personnel training, and
                    supply stockpiles.
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Technology level</h4>
                  <p className="text-label-secondary">
                    Reflects the sophistication of your military equipment and systems. Higher
                    technology levels provide tactical advantages but require more maintenance and
                    training.
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Force morale</h4>
                  <p className="text-label-secondary">
                    Indicates the motivation and esprit de corps of your military personnel. High
                    morale improves combat effectiveness and reduces desertion rates.
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Improving readiness</h4>
                  <ul className="text-label-secondary list-inside list-disc space-y-1">
                    <li>Increase operations & maintenance budget for better equipment upkeep</li>
                    <li>Invest in training programs to improve personnel competency</li>
                    <li>Modernize equipment through procurement to boost technology levels</li>
                    <li>Maintain competitive salaries and benefits to sustain morale</li>
                    <li>Conduct regular exercises to maintain operational readiness</li>
                  </ul>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <p className="text-label-secondary text-footnote">
          Aggregate readiness metrics across all branches
        </p>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        <div className="grid grid-cols-3 gap-3">
          {metrics.map((m) => {
            const pct = Math.min(100, Math.max(0, m.value));
            return (
              <div key={m.label} className="min-w-0 space-y-2">
                <span
                  className="text-caption text-label-secondary block truncate"
                  title={m.title}
                >
                  {m.label}
                </span>
                <div className="text-label text-title-3 tabular-nums">{Math.round(pct)}%</div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});
