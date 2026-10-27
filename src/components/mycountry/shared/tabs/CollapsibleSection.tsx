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

/** A folder-tab accordion section: the tab button on top, the animated panel below. */
export function CollapsibleSection({
  icon: Icon,
  title,
  isExpanded,
  onToggle,
  children,
}: CollapsibleSectionProps): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <div className="flex">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          className={`focus-visible:ring-tint rounded-t-row text-headline relative z-10 flex min-h-9 cursor-pointer items-center gap-2 border-x border-t px-4 py-2 transition-[color,background-color,border-color] duration-150 outline-none focus-visible:ring-2 ${
            isExpanded
              ? "text-label border-separator bg-surface"
              : "text-label-secondary hover:text-label border-transparent bg-transparent"
          }`}
        >
          <Icon className={`h-3.5 w-3.5 ${isExpanded ? "text-label" : "text-label-secondary"}`} />
          <span>{title}</span>
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.25 }}
            className="ml-1"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </motion.div>
        </button>
      </div>
      <motion.div
        initial={false}
        animate={{ height: isExpanded ? "auto" : 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.25 }}
        className={`bg-surface rounded-tr-row rounded-b-row relative overflow-hidden transition-colors duration-200 ${
          isExpanded ? "border-separator border" : "border border-transparent"
        }`}
      >
        <div className="relative z-10 space-y-4 p-4">{children}</div>
      </motion.div>
    </div>
  );
}
