"use client";

import React from "react";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { BuilderErrorBoundary } from "../../../components/BuilderErrorBoundary";
import {
  AtomicEconomicComponentSelector,
  type EconomicComponentType,
} from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
import type { ComponentType } from "~/lib/enums";

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
        <FacetCard
          depth="base"
          theme="emerald"
          className="border-emerald-500/20"
          texture="chevron"
          textureOpacity={0.04}
          interactive="none"
        >
          <FacetCardContent className="space-y-6 p-6">
            <AtomicEconomicComponentSelector
              selectedComponents={selectedComponents}
              onComponentChange={onComponentChange}
              maxComponents={15}
              governmentComponents={governmentComponents}
              hideSelectedList={true}
              standalone={true}
            />
          </FacetCardContent>
        </FacetCard>
      </BuilderErrorBoundary>
    </div>
  );
}

