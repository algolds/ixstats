"use client";

import { ArrowRight, ArrowUp, StatsReport, Check } from "iconoir-react";

import React from "react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Progress } from "~/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { Stat } from "~/components/ui/stat";
import { Card } from "~/components/ui/card";

interface LongTermEffects {
  culturalTiesStrength?: number;
  softPowerGain?: number;
  peopleTopeopleBonds?: number;
}

interface ImpactData {
  impact?: {
    currentState?: string;
    newState?: string;
    stateChanged?: boolean;
    transitionProbability?: number;
    culturalBonusDelta?: number;
    diplomaticBonusDelta?: number;
    longTermEffects?: LongTermEffects;
    reasoning?: string[];
  };
}

interface ImpactVisualizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  impactData: ImpactData | null;
}

export const ImpactVisualizationModal = React.memo<ImpactVisualizationModalProps>(
  ({ open, onOpenChange, impactData }) => {
    if (!impactData?.impact) return null;

    const { impact } = impactData;

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent size="wide" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <StatsReport className="text-label-secondary h-5 w-5" />
              Exchange impact analysis
            </SheetTitle>
            <SheetDescription>
              Detailed breakdown of cultural and diplomatic impact
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            <Card variant="inset" className="p-5">
              <h4 className="text-label text-headline mb-4">Relationship state evolution</h4>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="text-label text-title-1 mb-1">
                    {impact.currentState || "—"}
                  </div>
                  <span className="text-stat-label text-label-secondary">Before</span>
                </div>
                <ArrowRight className="text-label-secondary h-6 w-6" />
                <div className="text-center">
                  <div className="text-label text-title-1 mb-1">
                    {impact.newState || "—"}
                  </div>
                  <Eyebrow>After</Eyebrow>
                </div>
              </div>
              {impact.stateChanged && (
                <p className="text-body text-green mt-4 flex items-center justify-center gap-2 font-medium">
                  <Check className="h-4 w-4" />
                  Relationship state improved (
                  {Math.round((impact.transitionProbability || 0) * 100)}% probability)
                </p>
              )}
            </Card>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Cultural bonus", value: impact.culturalBonusDelta || 0 },
                { label: "Diplomatic bonus", value: impact.diplomaticBonusDelta || 0 },
              ].map((m) => (
                <Card variant="inset" key={m.label} className="p-4">
                  <Stat
                    label={m.label}
                    value={<>+{m.value}</>}
                    icon={<ArrowUp className="size-3.5" />}
                  />
                </Card>
              ))}
            </div>

            {impact.longTermEffects && (
              <Card variant="inset" className="p-5">
                <h4 className="text-label text-headline mb-4">Long-term effects</h4>
                <div className="space-y-4">
                  {[
                    {
                      label: "Cultural ties strength",
                      value: impact.longTermEffects.culturalTiesStrength,
                    },
                    { label: "Soft power gain", value: impact.longTermEffects.softPowerGain },
                    {
                      label: "People-to-People bonds",
                      value: impact.longTermEffects.peopleTopeopleBonds,
                    },
                  ]
                    .filter((e): e is { label: string; value: number } => e.value !== undefined)
                    .map((effect) => (
                      <div key={effect.label}>
                        <div className="text-body mb-2 flex items-center justify-between">
                          <span className="text-label-secondary">{effect.label}</span>
                          <span className="text-label font-medium tabular-nums">
                            {effect.value}%
                          </span>
                        </div>
                        <Progress value={effect.value} className="h-2" />
                      </div>
                    ))}
                </div>
              </Card>
            )}

            {impact.reasoning && Array.isArray(impact.reasoning) && impact.reasoning.length > 0 && (
              <Card variant="inset" className="p-5">
                <h4 className="text-label text-headline mb-4">Impact analysis</h4>
                <ul className="space-y-2">
                  {impact.reasoning.map((reason, idx) => (
                    <li key={idx} className="text-label-secondary text-body flex items-start gap-2">
                      <Check className="text-green mt-0.5 h-4 w-4 shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
);

ImpactVisualizationModal.displayName = "ImpactVisualizationModal";
