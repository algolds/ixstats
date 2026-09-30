"use client";

import { ArrowRight, ArrowUp, StatsReport, Check } from "iconoir-react";

import React from "react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Progress } from "~/components/ui/progress";
import { FacetCard } from "~/components/ui/facet-container";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";

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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StatsReport className="text-muted-foreground h-5 w-5" />
              Exchange Impact Analysis
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown of cultural and diplomatic impact
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <FacetCard surface="solid" className="rounded-xl p-5">
              <h4 className="text-foreground mb-4 text-sm font-semibold">
                Relationship State Evolution
              </h4>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="text-foreground mb-1 text-2xl font-semibold">
                    {impact.currentState || "Neutral"}
                  </div>
                  <Eyebrow>Before</Eyebrow>
                </div>
                <ArrowRight className="text-muted-foreground h-6 w-6" />
                <div className="text-center">
                  <div className="text-foreground mb-1 text-2xl font-semibold">
                    {impact.newState || "Friendly"}
                  </div>
                  <Eyebrow>After</Eyebrow>
                </div>
              </div>
              {impact.stateChanged && (
                <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-500">
                  <Check className="h-4 w-4" />
                  Relationship state improved (
                  {Math.round((impact.transitionProbability || 0) * 100)}% probability)
                </p>
              )}
            </FacetCard>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Cultural bonus", value: impact.culturalBonusDelta || 0 },
                { label: "Diplomatic bonus", value: impact.diplomaticBonusDelta || 0 },
              ].map((m) => (
                <FacetCard key={m.label} surface="solid" className="rounded-xl p-4">
                  <Eyebrow className="flex items-center gap-1.5">
                    <ArrowUp className="h-3.5 w-3.5" />
                    {m.label}
                  </Eyebrow>
                  <div className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
                    +{m.value}
                  </div>
                </FacetCard>
              ))}
            </div>

            {impact.longTermEffects && (
              <FacetCard surface="solid" className="rounded-xl p-5">
                <h4 className="text-foreground mb-4 text-sm font-semibold">Long-term Effects</h4>
                <div className="space-y-4">
                  {[
                    {
                      label: "Cultural Ties Strength",
                      value: impact.longTermEffects.culturalTiesStrength,
                    },
                    { label: "Soft Power Gain", value: impact.longTermEffects.softPowerGain },
                    {
                      label: "People-to-People Bonds",
                      value: impact.longTermEffects.peopleTopeopleBonds,
                    },
                  ]
                    .filter((e): e is { label: string; value: number } => e.value !== undefined)
                    .map((effect) => (
                      <div key={effect.label}>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{effect.label}</span>
                          <span className="text-foreground font-medium tabular-nums">
                            {effect.value}%
                          </span>
                        </div>
                        <Progress value={effect.value} className="h-2" />
                      </div>
                    ))}
                </div>
              </FacetCard>
            )}

            {impact.reasoning && Array.isArray(impact.reasoning) && impact.reasoning.length > 0 && (
              <FacetCard surface="solid" className="rounded-xl p-5">
                <h4 className="text-foreground mb-4 text-sm font-semibold">Impact Analysis</h4>
                <ul className="space-y-2">
                  {impact.reasoning.map((reason, idx) => (
                    <li key={idx} className="text-muted-foreground flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </FacetCard>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

ImpactVisualizationModal.displayName = "ImpactVisualizationModal";
