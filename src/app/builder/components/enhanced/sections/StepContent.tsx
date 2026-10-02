"use client";

import React, { memo } from "react";
import { CutoutCard, CutoutCardContent } from "~/components/ui/cutout-card";

interface StepContentProps {
  children: React.ReactNode;
}

/**
 * StepContent — the shell that frames the active builder/editor section: the v2 CutoutCard
 * (c5c6b382, 28px with the dot texture at .03), opaque so the section heroes inside it can be
 * glass without nesting glass. Section forms render their own cards inside it.
 */
export const StepContent = memo(function StepContent({ children }: StepContentProps) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <CutoutCard variant="card" trackPointerHover={false}>
        <CutoutCardContent className="relative p-6 sm:p-8">{children}</CutoutCardContent>
      </CutoutCard>
    </div>
  );
});
