"use client";
// src/components/defense/command/ReadinessOverviewCard.tsx

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
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";

export interface DefconLevelInfo {
  level: number;
  label: string;
  status: string;
  costMod: string;
  readinessMod: string;
  cls: string;
}

export const DEFCON_LEVELS: DefconLevelInfo[] = [
  { level: 5, label: "DEFCON 5", status: "Peacetime", costMod: "-10% Maint", readinessMod: "Baseline", cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { level: 4, label: "DEFCON 4", status: "Nominal", costMod: "Base Maint", readinessMod: "+5% Alert", cls: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  { level: 3, label: "DEFCON 3", status: "Elevated", costMod: "+15% Maint", readinessMod: "+12% Alert", cls: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  { level: 2, label: "DEFCON 2", status: "High Alert", costMod: "+30% Maint", readinessMod: "+20% Alert", cls: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
  { level: 1, label: "DEFCON 1", status: "Maximum", costMod: "+50% Maint", readinessMod: "+35% Alert", cls: "text-red-400 border-red-500/30 bg-red-500/10" },
];

export const PROJECTION_GOALS = [
  { id: "territorial", label: "Territorial Defense", desc: "Homeland borders" },
  { id: "regional", label: "Regional Deterrence", desc: "Frontier & littoral zones" },
  { id: "expeditionary", label: "Expeditionary", desc: "Deploy task forces abroad" },
  { id: "global", label: "Global Reach", desc: "Sustained global theater presence" },
];

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
  const [defcon, setDefcon] = React.useState<number>(4);
  const [projection, setProjection] = React.useState<string>("regional");

  const activeDefcon = DEFCON_LEVELS.find((d) => d.level === defcon) || DEFCON_LEVELS[1]!;

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

        {/* Strategic Defense Posture & DEFCON Selectors */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 border-t border-white/10 pt-3 sm:grid-cols-2">
          {/* DEFCON Level Selector */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-xs">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                DEFCON Alert Status
              </span>
              <span className={cn("rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-bold", activeDefcon.cls)}>
                {activeDefcon.readinessMod} · {activeDefcon.costMod}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {DEFCON_LEVELS.map((d) => (
                <button
                  key={d.level}
                  type="button"
                  data-cuelume-press="soft"
                  onClick={() => {
                    soundEffects.press();
                    setDefcon(d.level);
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center rounded-lg border py-1.5 transition-all text-center select-none active:scale-95",
                    defcon === d.level
                      ? `${d.cls} font-bold shadow-xs scale-[1.02]`
                      : "border-white/5 bg-white/[0.02] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                  )}
                  title={`${d.label}: ${d.status} (${d.costMod}, ${d.readinessMod})`}
                >
                  <span className="text-[11px] font-mono font-bold leading-tight">{d.level}</span>
                  <span className="text-[8px] font-medium leading-none opacity-80">{d.status}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Force Projection Goal */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-xs">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Force Projection Goal
              </span>
              <span className="text-cyan-400 font-mono text-[9px] font-bold">
                {PROJECTION_GOALS.find((p) => p.id === projection)?.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {PROJECTION_GOALS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-cuelume-press="soft"
                  onClick={() => {
                    soundEffects.press();
                    setProjection(p.id);
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-start rounded-lg border px-2 py-1.5 transition-all select-none active:scale-95",
                    projection === p.id
                      ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-300 font-bold shadow-xs"
                      : "border-white/5 bg-white/[0.02] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                  )}
                  title={p.desc}
                >
                  <span className="text-[10px] font-semibold leading-tight">{p.label}</span>
                  <span className="text-[8px] opacity-70 truncate max-w-full">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
