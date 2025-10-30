"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";

interface BasicViewProps {
  visible: boolean;
  children: React.ReactNode;
  className?: string;
}

interface AdvancedViewProps {
  visible: boolean;
  children: React.ReactNode;
  className?: string;
}

interface ViewTransitionProps {
  showAdvanced: boolean;
  basicContent: React.ReactNode;
  advancedContent: React.ReactNode;
  className?: string;
}

// Basic View Component
export function BasicView({ visible, children, className }: BasicViewProps) {
  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key="basic"
          initial={{ opacity: 0, height: 0, y: -10 }}
          animate={{
            opacity: 1,
            height: "auto",
            y: 0,
            transition: {
              duration: 0.3,
              ease: "easeOut",
              height: { duration: 0.4 },
            },
          }}
          exit={{
            opacity: 0,
            height: 0,
            y: -10,
            transition: {
              duration: 0.2,
              ease: "easeIn",
            },
          }}
          className={cn("overflow-hidden", className)}
        >
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{
              y: 0,
              opacity: 1,
              transition: { delay: 0.1, duration: 0.3 },
            }}
            exit={{
              y: -10,
              opacity: 0,
              transition: { duration: 0.2 },
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Advanced View Component
export function AdvancedView({ visible, children, className }: AdvancedViewProps) {
  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key="advanced"
          initial={{ opacity: 0, height: 0, y: 10 }}
          animate={{
            opacity: 1,
            height: "auto",
            y: 0,
            transition: {
              duration: 0.4,
              ease: "easeOut",
              height: { duration: 0.5 },
            },
          }}
          exit={{
            opacity: 0,
            height: 0,
            y: 10,
            transition: {
              duration: 0.3,
              ease: "easeIn",
            },
          }}
          className={cn("overflow-hidden", className)}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{
              y: 0,
              opacity: 1,
              transition: { delay: 0.15, duration: 0.4 },
            }}
            exit={{
              y: 10,
              opacity: 0,
              transition: { duration: 0.2 },
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Unified View Transition Component
export function ViewTransition({
  showAdvanced,
  basicContent,
  advancedContent,
  className,
}: ViewTransitionProps) {
  return (
    <div className={cn("relative", className)}>
      <BasicView visible={!showAdvanced}>{basicContent}</BasicView>

      <AdvancedView visible={showAdvanced}>{advancedContent}</AdvancedView>
    </div>
  );
}
