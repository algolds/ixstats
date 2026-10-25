"use client";
// src/components/defense/command/ReadinessOverviewCard.tsx

import React from "react";
import { Archery as Target, HelpCircle, InfoCircle as Info } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

/** Personnel-weighted shares (0 to 100) of the branches' derived readiness, equipment quality and training. */
interface ReadinessOverviewCardProps {
  averageReadiness: number;
  averageQuality: number;
  averageTraining: number;
}

export const ReadinessOverviewCard = React.memo(function ReadinessOverviewCard({
  averageReadiness,
  averageQuality,
  averageTraining,
}: ReadinessOverviewCardProps) {
  // Derived on the realm clock from the defense budget; never typed.
  const metrics = [
    { label: "Readiness", title: "Overall readiness", value: averageReadiness },
    { label: "Quality", title: "Equipment quality", value: averageQuality },
    { label: "Training", title: "Training proficiency", value: averageTraining },
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
                    The weakest of personnel fill, equipment on hand, equipment condition and
                    training, softened a little. It multiplies your combat power.
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Equipment quality</h4>
                  <p className="text-label-secondary">
                    How your equipment compares with the newest designs in your realm. Old designs
                    lose about 3% a year; research keeps your industry close to the frontier.
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Training proficiency</h4>
                  <p className="text-label-secondary">
                    Rises over months when operations and maintenance money pays for training, and
                    fades with a nine-month half-life when it does not.
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Improving readiness</h4>
                  <ul className="text-label-secondary list-inside list-disc space-y-1">
                    <li>Give operations and maintenance enough of the defense budget</li>
                    <li>Keep enough equipment for your personnel, and enough crews for it</li>
                    <li>Order newer designs and fund research</li>
                    <li>Run training exercises</li>
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
                <span className="text-caption text-label-secondary block truncate" title={m.title}>
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
