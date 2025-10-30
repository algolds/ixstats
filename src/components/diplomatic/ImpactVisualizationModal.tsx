"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import {
  RiLineChartLine,
  RiArrowRightLine,
  RiCheckLine,
  RiArrowUpLine,
  RiLightbulbLine,
} from "react-icons/ri";

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
            <DialogTitle className="flex items-center gap-2 text-xl">
              <RiLineChartLine className="h-6 w-6 text-orange-400" />
              Exchange Impact Analysis
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown of cultural and diplomatic impact
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Relationship State Changes */}
            <div className="glass-hierarchy-child rounded-lg p-6">
              <h4 className="text-foreground mb-4 font-semibold">Relationship State Evolution</h4>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="mb-1 text-3xl font-bold text-yellow-400">
                    {impact.currentState || "Neutral"}
                  </div>
                  <div className="text-xs text-[--intel-silver]">Before</div>
                </div>
                <RiArrowRightLine className="h-8 w-8 text-[--intel-silver]" />
                <div className="text-center">
                  <div className="mb-1 text-3xl font-bold text-green-400">
                    {impact.newState || "Friendly"}
                  </div>
                  <div className="text-xs text-[--intel-silver]">After</div>
                </div>
              </div>
              {impact.stateChanged && (
                <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center">
                  <RiCheckLine className="mx-auto mb-1 h-5 w-5 text-green-400" />
                  <p className="text-sm font-medium text-green-400">
                    Relationship state improved! (
                    {Math.round((impact.transitionProbability || 0) * 100)}% probability)
                  </p>
                </div>
              )}
            </div>

            {/* Impact Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-hierarchy-child rounded-lg p-4">
                <div className="mb-2 flex items-center gap-2">
                  <RiArrowUpLine className="h-4 w-4 text-[--intel-gold]" />
                  <span className="text-foreground text-sm font-medium">Cultural Bonus</span>
                </div>
                <div className="text-2xl font-bold text-[--intel-gold]">
                  +{impact.culturalBonusDelta || 0}
                </div>
              </div>
              <div className="glass-hierarchy-child rounded-lg p-4">
                <div className="mb-2 flex items-center gap-2">
                  <RiArrowUpLine className="h-4 w-4 text-blue-400" />
                  <span className="text-foreground text-sm font-medium">Diplomatic Bonus</span>
                </div>
                <div className="text-2xl font-bold text-blue-400">
                  +{impact.diplomaticBonusDelta || 0}
                </div>
              </div>
            </div>

            {/* Long-term Effects */}
            {impact.longTermEffects && (
              <div className="glass-hierarchy-child rounded-lg p-6">
                <h4 className="text-foreground mb-4 font-semibold">Long-term Effects</h4>
                <div className="space-y-4">
                  {impact.longTermEffects.culturalTiesStrength !== undefined && (
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-[--intel-silver]">Cultural Ties Strength</span>
                        <span className="font-medium text-purple-400">
                          {impact.longTermEffects.culturalTiesStrength}%
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-white/10">
                        <div
                          className="h-3 rounded-full bg-purple-400"
                          style={{ width: `${impact.longTermEffects.culturalTiesStrength}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {impact.longTermEffects.softPowerGain !== undefined && (
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-[--intel-silver]">Soft Power Gain</span>
                        <span className="font-medium text-cyan-400">
                          {impact.longTermEffects.softPowerGain}%
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-white/10">
                        <div
                          className="h-3 rounded-full bg-cyan-400"
                          style={{ width: `${impact.longTermEffects.softPowerGain}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {impact.longTermEffects.peopleTopeopleBonds !== undefined && (
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-[--intel-silver]">People-to-People Bonds</span>
                        <span className="font-medium text-pink-400">
                          {impact.longTermEffects.peopleTopeopleBonds}%
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-white/10">
                        <div
                          className="h-3 rounded-full bg-pink-400"
                          style={{ width: `${impact.longTermEffects.peopleTopeopleBonds}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reasoning */}
            {impact.reasoning && Array.isArray(impact.reasoning) && impact.reasoning.length > 0 && (
              <div className="rounded-lg bg-white/5 p-4">
                <h5 className="text-foreground mb-3 flex items-center gap-2 font-semibold">
                  <RiLightbulbLine className="h-4 w-4 text-yellow-400" />
                  Analysis Factors
                </h5>
                <ul className="space-y-2">
                  {impact.reasoning.map((reason: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-[--intel-silver]">
                      <RiCheckLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

ImpactVisualizationModal.displayName = "ImpactVisualizationModal";
