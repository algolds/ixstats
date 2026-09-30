"use client";

import { Flash } from "iconoir-react";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard } from "~/components/ui/facet-container";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";

export interface ResponseOption {
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

export interface Scenario {
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
            <DialogTitle className="flex items-center gap-2">
              <Flash className="text-muted-foreground h-5 w-5" />
              Cultural Exchange Scenario
            </DialogTitle>
            <DialogDescription>
              Interactive scenario with diplomatic choices and outcomes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <FacetCard surface="solid" className="rounded-xl p-5">
              <h4 className="text-foreground mb-3 text-base font-semibold">{scenario.title}</h4>
              <p className="text-muted-foreground text-sm whitespace-pre-line">
                {scenario.narrative}
              </p>
            </FacetCard>

            {scenario.responseOptions && scenario.responseOptions.length > 0 && (
              <div className="space-y-3">
                <h5 className="text-foreground text-sm font-semibold">How will you respond?</h5>
                {scenario.responseOptions.map((option: ResponseOption, index: number) => {
                  const outcome = option.predictedOutcomes?.immediate;
                  const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;
                  return (
                    <FacetCard key={option.id || index} surface="solid" className="rounded-xl p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h6 className="text-foreground text-sm font-medium">{option.label}</h6>
                          <p className="text-muted-foreground mt-1 text-sm">{option.description}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onSelectResponse?.(option)}
                        >
                          Select
                        </Button>
                      </div>

                      {option.requirements && option.requirements.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {option.requirements.map((req, reqIdx: number) => (
                            <Badge key={reqIdx} variant="outline">
                              {req.skill} {req.level}+
                            </Badge>
                          ))}
                        </div>
                      )}

                      {outcome && (
                        <dl className="grid grid-cols-3 gap-3 text-center">
                          {[
                            { label: "Cultural", value: signed(outcome.culturalImpact ?? 0) },
                            { label: "Diplomatic", value: signed(outcome.diplomaticChange ?? 0) },
                            { label: "Cost", value: String(outcome.economicCost ?? 0) },
                          ].map((m) => (
                            <div key={m.label} className="bg-muted/50 rounded-lg p-2">
                              <dd className="text-foreground text-lg font-semibold tabular-nums">
                                {m.value}
                              </dd>
                              <dt>
                                <Eyebrow>{m.label}</Eyebrow>
                              </dt>
                            </div>
                          ))}
                        </dl>
                      )}
                    </FacetCard>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

ScenarioModal.displayName = "ScenarioModal";
