"use client";

import React from "react";
import { motion } from "motion/react";
import { NavArrowRight as ChevronRight } from "iconoir-react";

interface CollapsibleSectionProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/** Clean Apple disclosure section: hairline header row, animated body without folder-tab borders. */
export function CollapsibleSection({
  icon: Icon,
  title,
  isExpanded,
  onToggle,
  children,
}: CollapsibleSectionProps): React.JSX.Element {
  return (
    <div className="border-separator/60 flex flex-col border-t pt-2 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="focus-visible:outline-tint hover:bg-fill-4 rounded-control text-headline flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 px-2 py-2 text-left transition-colors focus-visible:outline-2"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="text-label-secondary size-4 shrink-0" />
          <span className="text-label truncate">{title}</span>
        </span>
        <motion.span
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.25 }}
          className="text-label-secondary shrink-0"
        >
          <ChevronRight className="size-4" />
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isExpanded ? "auto" : 0, opacity: isExpanded ? 1 : 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.25 }}
        className="overflow-hidden"
      >
        <div className="space-y-4 px-2 pt-2 pb-3">{children}</div>
      </motion.div>
    </div>
  );
}
