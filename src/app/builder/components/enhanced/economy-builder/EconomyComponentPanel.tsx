"use client";

import React from "react";
import { BuilderErrorBoundary } from "../../../components/BuilderErrorBoundary";
import {
  AtomicEconomicComponentSelector,
  type EconomicComponentType,
} from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
import type { ComponentType } from "~/lib/enums";
import { Card, CardContent } from "~/components/ui/card";

interface EconomyComponentPanelProps {
  selectedComponents: EconomicComponentType[];
  onComponentChange: (components: EconomicComponentType[]) => void;
  governmentComponents?: ComponentType[];
}

export function EconomyComponentPanel({
  selectedComponents,
  onComponentChange,
  governmentComponents = [],
}: EconomyComponentPanelProps) {
  return (
    <div className="space-y-6">
      <BuilderErrorBoundary>
        <Card className="border-green/20">
          <CardContent className="space-y-6 p-6">
            {/* Standalone hides the selector's own h2 header; name the tab panel (h3 list, h4 cards). */}
            <h2 className="sr-only">Economic components</h2>
            <AtomicEconomicComponentSelector
              selectedComponents={selectedComponents}
              onComponentChange={onComponentChange}
              maxComponents={15}
              governmentComponents={governmentComponents}
              hideSelectedList={true}
              standalone={true}
            />
          </CardContent>
        </Card>
      </BuilderErrorBoundary>
    </div>
  );
}
