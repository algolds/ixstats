// src/components/defense/command/ReadinessOverviewCard.tsx
"use client";

import React from "react";
import {
  Shield,
  Group as Users,
  Archery as Target,
  Activity,
  HelpCircle,
  InfoCircle as Info,
} from "iconoir-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
// oxlint-disable-next-line eslint/no-unused-vars
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

interface Branch {
  id: string;
  name: string;
  readinessLevel: number;
  technologyLevel: number;
  morale: number;
  annualBudget: number;
}

interface ReadinessOverviewCardProps {
  averageReadiness: number;
  averageTechnology: number;
  averageMorale: number;
  branches: Branch[] | undefined;
}

export const ReadinessOverviewCard = React.memo(function ReadinessOverviewCard({
  averageReadiness,
  averageTechnology,
  averageMorale,
  // oxlint-disable-next-line eslint/no-unused-vars
  branches,
}: ReadinessOverviewCardProps) {
  return (
    <Card className="facet-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-red-600" />
          Strategic Readiness Overview
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <HelpCircle className="text-muted-foreground hover:text-primary h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-red-600" />
                  Strategic Readiness Metrics
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="mb-2 font-semibold">Overall Readiness</h4>
                  <p className="text-muted-foreground">
                    Measures the ability of your forces to deploy and conduct operations
                    immediately. Factors include equipment availability, personnel training, and
                    supply stockpiles.
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Technology Level</h4>
                  <p className="text-muted-foreground">
                    Reflects the sophistication of your military equipment and systems. Higher
                    technology levels provide tactical advantages but require more maintenance and
                    training.
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Force Morale</h4>
                  <p className="text-muted-foreground">
                    Indicates the motivation and esprit de corps of your military personnel. High
                    morale improves combat effectiveness and reduces desertion rates.
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold">Improving Readiness</h4>
                  <ul className="text-muted-foreground list-inside list-disc space-y-1">
                    <li>Increase operations & maintenance budget for better equipment upkeep</li>
                    <li>Invest in training programs to improve personnel competency</li>
                    <li>Modernize equipment through procurement to boost technology levels</li>
                    <li>Maintain competitive salaries and benefits to sustain morale</li>
                    <li>Conduct regular exercises to maintain operational readiness</li>
                  </ul>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
        <CardDescription>Aggregate readiness metrics across all branches</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
              <Shield className="h-3.5 w-3.5 shrink-0 text-red-400" />
              <span className="truncate">Overall Readiness</span>
            </div>
            <div className="text-foreground font-mono text-xl font-bold tabular-nums">
              {Math.min(
                100,
                Math.max(
                  0,
                  Math.round(averageReadiness > 1 ? averageReadiness : averageReadiness * 100)
                )
              )}
              %
            </div>
            <Progress
              value={averageReadiness > 1 ? averageReadiness : averageReadiness * 100}
              className="h-1.5"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
              <Activity className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
              <span className="truncate">Technology Level</span>
            </div>
            <div className="text-foreground font-mono text-xl font-bold tabular-nums">
              {Math.min(
                100,
                Math.max(
                  0,
                  Math.round(averageTechnology > 1 ? averageTechnology : averageTechnology * 100)
                )
              )}
              %
            </div>
            <Progress
              value={averageTechnology > 1 ? averageTechnology : averageTechnology * 100}
              className="h-1.5"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
              <Users className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="truncate">Force Morale</span>
            </div>
            <div className="text-foreground font-mono text-xl font-bold tabular-nums">
              {Math.min(
                100,
                Math.max(0, Math.round(averageMorale > 1 ? averageMorale : averageMorale * 100))
              )}
              %
            </div>
            <Progress
              value={averageMorale > 1 ? averageMorale : averageMorale * 100}
              className="h-1.5"
            />
          </div>
        </div>

        {/* Strategic Defense Posture Summary */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs">
            <div>
              <p className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
                Defense Alert Level
              </p>
              <p className="mt-0.5 text-xs font-bold tracking-tight text-emerald-400">
                DEFCON 4 — NOMINAL
              </p>
            </div>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold text-emerald-400">
              🛡️
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs">
            <div>
              <p className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
                Force Projection
              </p>
              <p className="mt-0.5 text-xs font-bold tracking-tight text-cyan-400">
                REGIONAL DETERRENCE
              </p>
            </div>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 text-[10px] font-bold text-cyan-400">
              🎯
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
