"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { AtomicEconomicComponentSelector } from "~/components/economy/atoms/AtomicEconomicComponents";
import {
  EconomicEffectiveness,
  EconomicImpactPreview,
} from "~/components/economy/atoms/AtomicEconomicUI";
import type { EconomicComponentType } from "~/components/economy/atoms/AtomicEconomicComponents";

interface ComponentSelectionStepProps {
  selectedComponents: EconomicComponentType[];
  maxComponents?: number;
  onComponentToggle: (components: EconomicComponentType[]) => void;
}

export function ComponentSelectionStep({
  selectedComponents,
  maxComponents = 12,
  onComponentToggle,
}: ComponentSelectionStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-2xl font-semibold">Economic Atomic Components</h2>
        <Badge variant="outline">
          {selectedComponents.length} / {maxComponents} selected
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Your Economic Building Blocks</CardTitle>
          <CardDescription>
            Choose up to {maxComponents} atomic components that best represent your nation's
            economic structure. These components will integrate with your government and tax
            systems.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AtomicEconomicComponentSelector
            selectedComponents={selectedComponents}
            onComponentChange={onComponentToggle}
            maxComponents={maxComponents}
          />
        </CardContent>
      </Card>

      {selectedComponents.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Economic Effectiveness Analysis</CardTitle>
              <CardDescription>
                Projected effectiveness and synergies of your selected components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EconomicEffectiveness selectedComponents={selectedComponents} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Economic Impact Preview</CardTitle>
              <CardDescription>Estimated impact on key economic indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <EconomicImpactPreview selectedComponents={selectedComponents} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
