"use client";

import React, { memo } from "react";
import { CutoutCard, CutoutCardContent } from "~/components/ui/cutout-card";

interface StepContentProps {
  children: React.ReactNode;
}

/**
 * StepContent - Wrapper for step-specific content
 *
 * Provides:
 * - Animated transitions between steps
 * - Consistent card styling
 * - Step-specific theming
 */
export const StepContent = memo(function StepContent({ children }: StepContentProps) {
  return (
    <div className="mx-auto max-w-6xl">
      <CutoutCard
        className="border-border/30 bg-card/75 overflow-hidden rounded-[24px] backdrop-blur-md"
        texture="dots"
        textureOpacity={0.03}
        trackPointerHover={false}
      >
        <CutoutCardContent className="bg-transparent p-6 sm:p-8">{children}</CutoutCardContent>
      </CutoutCard>
    </div>
  );
});
