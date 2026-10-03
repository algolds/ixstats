"use client";
// src/components/defense/command/ReadinessOverviewCard.tsx

import React from "react";
import { Archery as Target, HelpCircle, InfoCircle as Info } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Toggle } from "~/components/ui/toggle";
import { Progress } from "~/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

export interface DefconLevelInfo {
  level: number;
  label: string;
  status: string;
  costMod: string;
  readinessMod: string;
  cls: string;
}

/** `cls` is the status colour for the level's badge: calm → critical, semantic only. */
export const DEFCON_LEVELS: DefconLevelInfo[] = [
  {
    level: 5,
    label: "DEFCON 5",
    status: "Peacetime",
    costMod: "-10% Maint",
    readinessMod: "Baseline",
    cls: "border-green/30 text-green",
  },
  {
    level: 4,
    label: "DEFCON 4",
    status: "Nominal",
    costMod: "Base Maint",
    readinessMod: "+5% Alert",
    cls: "border-separator text-label-secondary",
  },
  {
    level: 3,
    label: "DEFCON 3",
    status: "Elevated",
    costMod: "+15% Maint",
    readinessMod: "+12% Alert",
    cls: "border-yellow/30 text-yellow",
  },
  {
    level: 2,
    label: "DEFCON 2",
    status: "High Alert",
    costMod: "+30% Maint",
    readinessMod: "+20% Alert",
    cls: "border-orange/30 text-orange",
  },
  {
    level: 1,
    label: "DEFCON 1",
    status: "Maximum",
    costMod: "+50% Maint",
    readinessMod: "+35% Alert",
    cls: "border-destructive/30 text-destructive",
  },
];

export const PROJECTION_GOALS = [
  { id: "territorial", label: "Territorial defense", desc: "Homeland borders" },
  { id: "regional", label: "Regional deterrence", desc: "Frontier & littoral zones" },
  { id: "expeditionary", label: "Expeditionary", desc: "Deploy task forces abroad" },
  { id: "global", label: "Global reach", desc: "Sustained global theater presence" },
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

/** Normalises a 0–1 or 0–100 score to a 0–100 percentage. */
function toPercent(value: number): number {
  return value > 1 ? value : value * 100;
}

export const ReadinessOverviewCard = React.memo(function ReadinessOverviewCard({
  averageReadiness,
  averageTechnology,
  averageMorale,
}: ReadinessOverviewCardProps) {
  const [defcon, setDefcon] = React.useState<number>(4);
  const [projection, setProjection] = React.useState<string>("regional");
  const defconLabelId = React.useId();
  const projectionLabelId = React.useId();

  const activeDefcon = DEFCON_LEVELS.find((d) => d.level === defcon) || DEFCON_LEVELS[1]!;

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
            const pct = toPercent(m.value);
            return (
              <div key={m.label} className="min-w-0 space-y-2">
                <span
                  className="text-stat-label text-label-secondary block truncate"
                  title={m.title}
                >
                  {m.label}
                </span>
                <div className="text-label text-title-3 tabular-nums">
                  {Math.min(100, Math.max(0, Math.round(pct)))}%
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })}
        </div>

        {/* Strategic defense posture: DEFCON level and force projection goal */}
        <div className="border-separator space-y-4 border-t pt-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span id={defconLabelId} className="text-stat-label text-label-secondary">
                DEFCON alert status
              </span>
              <Badge variant="outline" className={cn("tabular-nums", activeDefcon.cls)}>
                {activeDefcon.status} · {activeDefcon.readinessMod} · {activeDefcon.costMod}
              </Badge>
            </div>
            <div
              role="radiogroup"
              aria-labelledby={defconLabelId}
              className="grid grid-cols-5 gap-1"
            >
              {DEFCON_LEVELS.map((d) => (
                <Toggle
                  key={d.level}
                  role="radio"
                  aria-checked={defcon === d.level}
                  aria-pressed={undefined}
                  variant="outline"
                  size="sm"
                  pressed={defcon === d.level}
                  onPressedChange={() => setDefcon(d.level)}
                  className="min-w-0 tabular-nums"
                  title={`${d.label}: ${d.status} (${d.costMod}, ${d.readinessMod})`}
                >
                  {/* Five columns in the rail are too narrow for the status words; the
                      selected level's status is shown in the badge instead. */}
                  {d.level}
                </Toggle>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <Eyebrow id={projectionLabelId}>Force projection goal</Eyebrow>
              <span className="text-label text-caption">
                {PROJECTION_GOALS.find((p) => p.id === projection)?.label}
              </span>
            </div>
            <div
              role="radiogroup"
              aria-labelledby={projectionLabelId}
              className="grid grid-cols-2 gap-1"
            >
              {PROJECTION_GOALS.map((p) => (
                <Toggle
                  key={p.id}
                  role="radio"
                  aria-checked={projection === p.id}
                  aria-pressed={undefined}
                  variant="outline"
                  pressed={projection === p.id}
                  onPressedChange={() => setProjection(p.id)}
                  className="h-auto min-w-0 flex-col items-start gap-0 px-2 py-2 text-left"
                  title={p.desc}
                >
                  <span className="text-caption w-full truncate font-semibold">{p.label}</span>
                  <span className="text-label-secondary text-footnote w-full truncate font-normal">
                    {p.desc}
                  </span>
                </Toggle>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
