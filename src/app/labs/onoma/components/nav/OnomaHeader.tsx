"use client";

// src/app/labs/onoma/components/nav/OnomaHeader.tsx
// Unified Apple/Facet navigation toolbar for Onoma Lab

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bookmark,
  HelpCircle,
  Wrench,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import { FacetTabs } from "~/components/ui/facet";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { ONOMA_VERSION } from "~/lib/buildVersion";
import { OnomaBrandLogo } from "../shared/OnomaBrandLogo";
import type { OnomaSection, StudioSubTab } from "~/lib/onoma/types";
import { ONOMA_TABS, getStudioTabs } from "./onoma-tabs";
import { cn } from "~/lib/utils";

interface OnomaHeaderProps {
  activeSection: OnomaSection;
  activeSubTab: StudioSubTab;
  lastActiveTab: OnomaSection;
  lexiconCount: number;
  shouldAnimateStash: boolean;
  hasInteractedPronunciation: boolean;
  setHasInteractedPronunciation: (val: boolean) => void;
  playPronunciation: () => void;
  onOpenHelp: () => void;
  onNavigate: (section: OnomaSection) => void;
  onNavigateStudio: (tab: StudioSubTab) => void;
}

export function OnomaHeader({
  activeSection,
  activeSubTab,
  lastActiveTab,
  lexiconCount,
  shouldAnimateStash,
  hasInteractedPronunciation,
  setHasInteractedPronunciation,
  playPronunciation,
  onOpenHelp,
  onNavigate,
  onNavigateStudio,
}: OnomaHeaderProps) {
  const shouldReduceMotion = useReducedMotion();
  const studioTabs = React.useMemo(() => getStudioTabs(lexiconCount), [lexiconCount]);

  return (
    <div className="space-y-4 border-b border-border/40 pb-4">
      {/* Top Row: Brand & Pronunciation on Left, Utility Actions on Right */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Brand Lockup, Pronunciation & Version Badge */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onNavigate("overview")}
            className="cursor-pointer transition-transform duration-150 active:scale-[0.97] focus:outline-none"
            title="Onoma Linguistic Engine"
          >
            <OnomaBrandLogo
              variant="lockup"
              className="h-8 w-auto text-foreground sm:h-9"
            />
          </button>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={playPronunciation}
                className="border-border/50 bg-secondary/30 text-muted-foreground hover:border-[#0091ff]/30 hover:bg-[#0091ff]/10 hover:text-[#0091ff] relative inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-xs transition-all duration-150 select-none active:scale-[0.94] focus:outline-none"
              >
                <span>/ˈɒnəmə/</span>
                <Volume2 className="h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200 hover:scale-110" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" align="center" className="text-xs font-semibold shadow-md">
              Click to listen to Greek pronunciation (“name”)
            </TooltipContent>
          </Tooltip>

          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-[#0091ff]/20 bg-[#0091ff]/5 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-[#0091ff] uppercase">
            <span className="font-mono">v{ONOMA_VERSION}</span>
            <span className="text-[#0091ff]/40">·</span>
            <span>Linguistic Engine</span>
          </span>
        </div>

        {/* Right: Quick Utilities */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={onOpenHelp}
            title="Open Walkthrough Guide"
            className="border-border/40 bg-secondary/20 text-muted-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-all hover:border-[#0091ff]/30 hover:bg-[#0091ff]/10 hover:text-[#0091ff] active:scale-95"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Help</span>
          </button>

          <motion.button
            animate={
              shouldAnimateStash
                ? shouldReduceMotion
                  ? { opacity: [1, 0.6, 1] }
                  : { scale: [1, 1.15, 0.95, 1.05, 1] }
                : { scale: 1, opacity: 1 }
            }
            transition={{ duration: 0.4, ease: "easeInOut" }}
            onClick={() => onNavigate("bank")}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
              activeSection === "bank"
                ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 shadow-[0_0_10px_rgba(99,102,241,0.15)] dark:text-indigo-400"
                : "border-border/40 bg-secondary/20 text-muted-foreground hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400"
            )}
          >
            <motion.span
              animate={
                shouldAnimateStash && !shouldReduceMotion
                  ? { rotate: [0, -18, 15, -10, 8, 0] }
                  : { rotate: 0 }
              }
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="inline-flex"
            >
              <Bookmark className="h-3.5 w-3.5" />
            </motion.span>
            <span>Stash</span>
          </motion.button>

          <button
            onClick={() => onNavigate("studio")}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
              activeSection === "studio"
                ? "border-pink-500/30 bg-pink-500/10 text-pink-600 shadow-[0_0_10px_rgba(236,72,153,0.15)] dark:text-pink-400"
                : "border-border/40 bg-secondary/20 text-muted-foreground hover:border-pink-500/30 hover:bg-pink-500/10 hover:text-pink-600 dark:hover:text-pink-400"
            )}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>Studio</span>
          </button>

          <button
            onClick={() => onNavigate("settings")}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
              activeSection === "settings"
                ? "border-[#0091ff]/30 bg-[#0091ff]/10 text-[#0091ff] shadow-[0_0_10px_rgba(0,145,255,0.15)] dark:text-[#33a7ff]"
                : "border-border/40 bg-secondary/20 text-muted-foreground hover:border-[#0091ff]/30 hover:bg-[#0091ff]/10 hover:text-[#0091ff] dark:hover:text-[#33a7ff]"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Sliding Navigation Tabs */}
      <FacetTabs
        tabs={activeSection === "studio" ? studioTabs : ONOMA_TABS}
        activeTab={activeSection === "studio" ? activeSubTab : activeSection}
        onChange={(id) => {
          if (activeSection === "studio") {
            if (id === "exit-studio") {
              onNavigate(lastActiveTab);
            } else {
              onNavigateStudio(id as StudioSubTab);
            }
          } else {
            onNavigate(id as OnomaSection);
          }
        }}
        tone="accent"
        size="md"
      />
    </div>
  );
}
