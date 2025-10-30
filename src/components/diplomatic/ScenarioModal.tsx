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
import { RiFlashlightLine } from "react-icons/ri";

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

export const ScenarioModal = React.memo<ScenarioModalProps>(
  ({ open, onOpenChange, scenario, onSelectResponse }) => {
    if (!scenario) return null;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
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
              <h4 className="text-foreground mb-4 text-lg font-bold">{scenario.title}</h4>
              <div className="prose prose-invert max-w-none">
                <p className="whitespace-pre-line text-[--intel-silver]">{scenario.narrative}</p>
              </div>
            </div>

            {/* Response Options */}
            {scenario.responseOptions && scenario.responseOptions.length > 0 && (
              <div className="space-y-4">
                <h5 className="text-foreground font-semibold">How will you respond?</h5>
                {scenario.responseOptions.map((option: ResponseOption, index: number) => (
                  <div
                    key={option.id || index}
                    className="glass-hierarchy-child cursor-pointer rounded-lg border border-white/10 p-4 transition-colors hover:border-cyan-500/30"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h6 className="text-foreground font-medium">{option.label}</h6>
                        <p className="mt-1 text-sm text-[--intel-silver]">{option.description}</p>
                      </div>
                      <button
                        onClick={() => onSelectResponse?.(option)}
                        className="flex items-center gap-2 rounded-lg bg-cyan-500/20 px-3 py-1.5 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/30"
                      >
                        Select
                      </button>
                    </div>

                    {/* Skill Requirements */}
                    {option.requirements && option.requirements.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {option.requirements.map((req, reqIdx: number) => (
                          <span
                            key={reqIdx}
                            className="rounded bg-purple-500/20 px-2 py-1 text-xs text-purple-400"
                          >
                            {req.skill} {req.level}+
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Predicted Outcomes */}
                    {option.predictedOutcomes?.immediate && (
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded bg-white/5 p-2">
                          <div className="text-lg font-bold text-[--intel-gold]">
                            {(option.predictedOutcomes.immediate.culturalImpact ?? 0) > 0
                              ? "+"
                              : ""}
                            {option.predictedOutcomes.immediate.culturalImpact ?? 0}
                          </div>
                          <div className="text-xs text-[--intel-silver]">Cultural</div>
                        </div>
                        <div className="rounded bg-white/5 p-2">
                          <div className="text-lg font-bold text-blue-400">
                            {(option.predictedOutcomes.immediate.diplomaticChange ?? 0) > 0
                              ? "+"
                              : ""}
                            {option.predictedOutcomes.immediate.diplomaticChange ?? 0}
                          </div>
                          <div className="text-xs text-[--intel-silver]">Diplomatic</div>
                        </div>
                        <div className="rounded bg-white/5 p-2">
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
  }
);

ScenarioModal.displayName = "ScenarioModal";
