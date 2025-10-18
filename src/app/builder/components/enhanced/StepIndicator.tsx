// Enhanced step indicator component with minimize/expand functionality
// Extracted from AtomicBuilderPageEnhanced.tsx for modularity

"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { cn } from '~/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { stepConfig, type BuilderStep } from './builderConfig';

interface StepIndicatorProps {
  currentStep: BuilderStep;
  completedSteps: BuilderStep[];
  onStepClick: (step: BuilderStep) => void;
}

export function StepIndicator({
  currentStep,
  completedSteps,
  onStepClick
}: StepIndicatorProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const steps = Object.entries(stepConfig) as [BuilderStep, typeof stepConfig[BuilderStep]][];
  const currentIndex = steps.findIndex(([step]) => step === currentStep);

  // Auto-minimize after initial animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMinimized(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <TooltipProvider>
      <motion.div
        className="relative w-full mx-auto mb-6"
        animate={{
          maxWidth: isMinimized ? '400px' : '1024px',
          marginBottom: isMinimized ? '1.5rem' : '3rem'
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        onMouseEnter={() => setIsMinimized(false)}
        onMouseLeave={() => setIsMinimized(true)}
      >
        {/* Progress Line */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              className="absolute top-8 left-0 right-0 h-0.5 bg-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-500 to-yellow-600"
                initial={{ width: '0%' }}
                animate={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Indicators */}
        <div className={cn(
          "relative flex",
          isMinimized ? "justify-center gap-2" : "justify-between"
        )}>
          {steps.map(([step, config], index) => {
            const isCompleted = completedSteps.includes(step);
            const isCurrent = currentStep === step;
            const isAccessible = index <= currentIndex || completedSteps.includes(step);
            const Icon = config.icon;

            return (
              <Tooltip key={step}>
                <TooltipTrigger asChild>
                  <motion.button
                    className={cn(
                      "relative flex flex-col items-center group",
                      isAccessible ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                    )}
                    onClick={() => isAccessible && onStepClick(step)}
                    whileHover={isAccessible ? { scale: 1.05 } : {}}
                    whileTap={isAccessible ? { scale: 0.95 } : {}}
                    animate={{
                      width: isMinimized ? '40px' : 'auto'
                    }}
                  >
                    {/* Step Circle */}
                    <motion.div
                      className={cn(
                        "relative z-10 flex items-center justify-center rounded-full border-2 transition-all duration-300",
                        isCurrent && `bg-gradient-to-br ${config.color} border-transparent text-white shadow-lg shadow-amber-500/25`,
                        isCompleted && !isCurrent && "bg-green-500/10 border-green-500 text-green-600",
                        !isCurrent && !isCompleted && "bg-background border-muted-foreground/30 text-muted-foreground"
                      )}
                      animate={{
                        width: isMinimized ? '40px' : '64px',
                        height: isMinimized ? '40px' : '64px',
                        ...(isCurrent && !isMinimized ? {
                          boxShadow: [
                            "0 0 0 0px rgba(251, 191, 36, 0.2)",
                            "0 0 0 10px rgba(251, 191, 36, 0)",
                          ]
                        } : {})
                      }}
                      transition={isCurrent && !isMinimized ? {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeOut"
                      } : { duration: 0.3 }}
                    >
                      {isCompleted && !isCurrent ? (
                        <CheckCircle className={cn(isMinimized ? "h-4 w-4" : "h-6 w-6")} />
                      ) : (
                        <Icon className={cn(isMinimized ? "h-4 w-4" : "h-6 w-6")} />
                      )}
                    </motion.div>

                    {/* Step Label */}
                    <AnimatePresence>
                      {!isMinimized && (
                        <motion.div
                          className="mt-3 text-center"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <div className={cn(
                            "text-sm font-semibold transition-colors whitespace-nowrap",
                            isCurrent && "text-amber-600",
                            isCompleted && !isCurrent && "text-green-600",
                            !isCurrent && !isCompleted && "text-muted-foreground"
                          )}>
                            {config.title}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                            {config.description}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Completion Badge */}
                    {isCompleted && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 z-20"
                      >
                        <div className={cn(
                          "bg-green-500 rounded-full flex items-center justify-center",
                          isMinimized ? "w-3 h-3" : "w-5 h-5"
                        )}>
                          <CheckCircle className={cn(isMinimized ? "h-2 w-2" : "h-3 w-3", "text-white")} />
                        </div>
                      </motion.div>
                    )}
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium">{config.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{config.tip}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
