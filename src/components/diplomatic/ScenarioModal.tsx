"use client";

import React from "react";
import { cn } from "~/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import {
  RiFlashlightLine,
} from "react-icons/ri";

interface ResponseOption {
  id?: string;
  label: string;
  description: string;
  requirements?: Array<{
    skill: string;
    level: number;
  }>;
  predictedOutcomes?: {
    immediate?: {
      culturalImpact?: number;
      diplomaticChange?: number;
      economicCost?: number;
    };
  };
}

interface Scenario {
  title: string;
  narrative: string;
  responseOptions?: ResponseOption[];
}

interface ScenarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario: Scenario | null;
  onSelectResponse?: (option: ResponseOption) => void;
}

export const ScenarioModal = React.memo<ScenarioModalProps>(({
  open,
  onOpenChange,
  scenario,
  onSelectResponse,
}) => {
  if (!scenario) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <RiFlashlightLine className="h-6 w-6 text-cyan-400" />
            Cultural Exchange Scenario
          </DialogTitle>
          <DialogDescription>
            Interactive scenario with diplomatic choices and outcomes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Scenario Details */}
          <div className="glass-hierarchy-child rounded-lg p-6">
            <h4 className="text-lg font-bold text-foreground mb-4">{scenario.title}</h4>
            <div className="prose prose-invert max-w-none">
              <p className="text-[--intel-silver] whitespace-pre-line">{scenario.narrative}</p>
            </div>
          </div>

          {/* Response Options */}
          {scenario.responseOptions && scenario.responseOptions.length > 0 && (
            <div className="space-y-4">
              <h5 className="font-semibold text-foreground">How will you respond?</h5>
              {scenario.responseOptions.map((option: ResponseOption, index: number) => (
                <div
                  key={option.id || index}
                  className="glass-hierarchy-child rounded-lg p-4 border border-white/10 hover:border-cyan-500/30 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h6 className="font-medium text-foreground">{option.label}</h6>
                      <p className="text-sm text-[--intel-silver] mt-1">{option.description}</p>
                    </div>
                    <button
                      onClick={() => onSelectResponse?.(option)}
                      className="flex items-center gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      Select
                    </button>
                  </div>

                  {/* Skill Requirements */}
                  {option.requirements && option.requirements.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {option.requirements.map((req, reqIdx: number) => (
                        <span
                          key={reqIdx}
                          className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs"
                        >
                          {req.skill} {req.level}+
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Predicted Outcomes */}
                  {option.predictedOutcomes?.immediate && (
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-white/5 rounded p-2">
                        <div className="text-lg font-bold text-[--intel-gold]">
                          {(option.predictedOutcomes.immediate.culturalImpact ?? 0) > 0 ? '+' : ''}
                          {option.predictedOutcomes.immediate.culturalImpact ?? 0}
                        </div>
                        <div className="text-xs text-[--intel-silver]">Cultural</div>
                      </div>
                      <div className="bg-white/5 rounded p-2">
                        <div className="text-lg font-bold text-blue-400">
                          {(option.predictedOutcomes.immediate.diplomaticChange ?? 0) > 0 ? '+' : ''}
                          {option.predictedOutcomes.immediate.diplomaticChange ?? 0}
                        </div>
                        <div className="text-xs text-[--intel-silver]">Diplomatic</div>
                      </div>
                      <div className="bg-white/5 rounded p-2">
                        <div className="text-lg font-bold text-orange-400">
                          {option.predictedOutcomes.immediate.economicCost ?? 0}
                        </div>
                        <div className="text-xs text-[--intel-silver]">Cost</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

ScenarioModal.displayName = 'ScenarioModal';
