"use client";

import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '~/components/ui/card';
import { cn } from '~/lib/utils';
import { stepConfig } from '../builderConfig';
import type { BuilderStep } from '../builderConfig';
import { useBuilderContext } from '../context/BuilderStateContext';

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
  const currentStepConfig = stepConfig[builderState.step];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={builderState.step}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          className={cn(
            'max-w-6xl mx-auto border-2 shadow-2xl overflow-hidden',
            currentStepConfig.borderColor,
            'bg-gradient-to-br',
            currentStepConfig.bgGradient
          )}
        >
          <CardContent className="p-8">{children}</CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
});
