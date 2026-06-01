"use client";

import React, { memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useBuilderContext } from "../context/BuilderStateContext";
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
  const { builderState } = useBuilderContext();

  // Link card transitions to both main step navigation and active tab/sub-tab selections
  const navKey = `${builderState.step}-${builderState.activeCoreTab}-${builderState.activeIdentitySubTab || ""}-${builderState.activeGovernmentTab || ""}-${builderState.activeEconomicsTab || ""}`;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={navKey}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-6xl"
      >
        <CutoutCard
          className="overflow-hidden rounded-[24px] border-border/30 bg-card/75 backdrop-blur-md"
          texture="dots"
          textureOpacity={0.03}
          trackPointerHover={false}
        >
          <CutoutCardContent className="bg-transparent p-6 sm:p-8">{children}</CutoutCardContent>
        </CutoutCard>
      </motion.div>
    </AnimatePresence>
  );
});
