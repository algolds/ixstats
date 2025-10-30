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

export const ImpactVisualizationModal = React.memo<ImpactVisualizationModalProps>(({
  open,
  onOpenChange,
  impactData,
}) => {
  if (!impactData?.impact) return null;

  const { impact } = impactData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
            <h4 className="font-semibold text-foreground mb-4">Relationship State Evolution</h4>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400 mb-1">
                  {impact.currentState || 'Neutral'}
                </div>
                <div className="text-xs text-[--intel-silver]">Before</div>
              </div>
              <RiArrowRightLine className="h-8 w-8 text-[--intel-silver]" />
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400 mb-1">
                  {impact.newState || 'Friendly'}
                </div>
                <div className="text-xs text-[--intel-silver]">After</div>
              </div>
            </div>
            {impact.stateChanged && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                <RiCheckLine className="h-5 w-5 text-green-400 mx-auto mb-1" />
                <p className="text-sm text-green-400 font-medium">
                  Relationship state improved! ({Math.round((impact.transitionProbability || 0) * 100)}% probability)
                </p>
              </div>
            )}
          </div>

          {/* Impact Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-hierarchy-child rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <RiArrowUpLine className="h-4 w-4 text-[--intel-gold]" />
                <span className="text-sm font-medium text-foreground">Cultural Bonus</span>
              </div>
              <div className="text-2xl font-bold text-[--intel-gold]">
                +{impact.culturalBonusDelta || 0}
              </div>
            </div>
            <div className="glass-hierarchy-child rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <RiArrowUpLine className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-foreground">Diplomatic Bonus</span>
              </div>
              <div className="text-2xl font-bold text-blue-400">
                +{impact.diplomaticBonusDelta || 0}
              </div>
            </div>
          </div>

          {/* Long-term Effects */}
          {impact.longTermEffects && (
            <div className="glass-hierarchy-child rounded-lg p-6">
              <h4 className="font-semibold text-foreground mb-4">Long-term Effects</h4>
              <div className="space-y-4">
                {impact.longTermEffects.culturalTiesStrength !== undefined && (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-[--intel-silver]">Cultural Ties Strength</span>
                      <span className="text-purple-400 font-medium">
                        {impact.longTermEffects.culturalTiesStrength}%
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-3">
                      <div
                        className="bg-purple-400 h-3 rounded-full"
                        style={{ width: `${impact.longTermEffects.culturalTiesStrength}%` }}
                      />
                    </div>
                  </div>
                )}

                {impact.longTermEffects.softPowerGain !== undefined && (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-[--intel-silver]">Soft Power Gain</span>
                      <span className="text-cyan-400 font-medium">
                        {impact.longTermEffects.softPowerGain}%
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-3">
                      <div
                        className="bg-cyan-400 h-3 rounded-full"
                        style={{ width: `${impact.longTermEffects.softPowerGain}%` }}
                      />
                    </div>
                  </div>
                )}

                {impact.longTermEffects.peopleTopeopleBonds !== undefined && (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-[--intel-silver]">People-to-People Bonds</span>
                      <span className="text-pink-400 font-medium">
                        {impact.longTermEffects.peopleTopeopleBonds}%
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-3">
                      <div
                        className="bg-pink-400 h-3 rounded-full"
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
            <div className="bg-white/5 rounded-lg p-4">
              <h5 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <RiLightbulbLine className="h-4 w-4 text-yellow-400" />
                Analysis Factors
              </h5>
              <ul className="space-y-2">
                {impact.reasoning.map((reason: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-[--intel-silver]">
                    <RiCheckLine className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
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
});

ImpactVisualizationModal.displayName = 'ImpactVisualizationModal';
