"use client";

import React from "react";
import { Sparkle, X } from "lucide-react";
import { PreText } from "~/components/ui/pretext";
import { motion } from "motion/react";
import type { DIViewProps } from "~/components/halo/types";

export function TemplateView({ onClose }: DIViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
      className="flex w-full flex-col p-4 text-left"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-blue-400">
          <Sparkle className="h-4 w-4" />
          <PreText className="text-inherit" whiteSpace="nowrap">
            Template Plugin View
          </PreText>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground hover:bg-accent/15 flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        This is a starter template for building custom Halo plugins and modal views. Customize this view with domain-specific cards, controls, and workflows.
      </p>
    </motion.div>
  );
}
