"use client";

import React, { memo } from "react";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";

interface StepContentProps {
  children: React.ReactNode;
}

/**
 * StepContent - the Facet shell (depth 1) that frames the active builder/editor section.
 * Section forms render their own cards inside it.
 */
export const StepContent = memo(function StepContent({ children }: StepContentProps) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <FacetCard
        depth={1}
        texture="dots"
        textureOpacity={0.03}
        className="overflow-hidden rounded-2xl"
      >
        <FacetCardContent className="p-6 sm:p-8">{children}</FacetCardContent>
      </FacetCard>
    </div>
  );
});
