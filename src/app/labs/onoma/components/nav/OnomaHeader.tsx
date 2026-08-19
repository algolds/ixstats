"use client";

// src/app/labs/onoma/components/nav/OnomaHeader.tsx
// Unified Apple/Facet navigation toolbar for Onoma Lab (Product Model: CREATE · STUDIO · EXPLORE)
// Features: Prominent Hero Pillar Segmented Controller, Soundwave Pronunciation, and Contextual Tool Strips

import React from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {

  HelpCircle,
  Bookmark,
  Settings,
  SoundHigh,
  Code,
} from "iconoir-react";
import { FacetTabs } from "~/components/ui/facet";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { OnomaBrandLogo } from "../shared/OnomaBrandLogo";
import type { OnomaSection, StudioSubTab, ExploreSubTab, OnomaProductPillar } from "~/lib/onoma/types";
import {
  ONOMA_TABS,
  ONOMA_PILLAR_TABS,
  getStudioTabs,
  getExploreTabs,
} from "./onoma-tabs";
import { cn } from "~/lib/utils";


interface OnomaHeaderProps {
  activeSection: OnomaSection;
  activeSubTab: StudioSubTab;
  activeExploreSubTab: ExploreSubTab;
  lastActiveTab: OnomaSection;
  lexiconCount: number;
  shouldAnimateStash: boolean;
  hasInteractedPronunciation: boolean;
  setHasInteractedPronunciation: (val: boolean) => void;
  playPronunciation: () => void;
  onOpenHelp: () => void;
  onNavigate: (section: OnomaSection) => void;
  onNavigateStudio: (tab: StudioSubTab) => void;
  onNavigateExplore: (tab: ExploreSubTab) => void;
}



export function OnomaHeader({
  activeSection,
  activeSubTab,
  activeExploreSubTab,
  lastActiveTab: _lastActiveTab,
  lexiconCount,
  shouldAnimateStash,
  hasInteractedPronunciation,
  setHasInteractedPronunciation: _setHasInteractedPronunciation,
  playPronunciation,
  onOpenHelp,
  onNavigate,
  onNavigateStudio,
  onNavigateExplore,
}: OnomaHeaderProps) {
  const shouldReduceMotion = useReducedMotion();
  const studioTabs = React.useMemo(() => getStudioTabs(lexiconCount), [lexiconCount]);
  const exploreTabs = React.useMemo(() => getExploreTabs(), []);

  const activePillar: OnomaProductPillar =
    activeSection === "studio"
      ? "studio"
      : activeSection === "explore"
        ? "explore"
        : "create";

  return (
    <div className="space-y-4 border-b border-border/40 pb-4">
      {/* Top Utility Bar (Wordmark, Pronunciation, Subtitle/Description, Guide, Stash, Settings) */}
      <div className="flex items-center justify-between gap-3">
          {/* Left: Brand Lockup with Inline Pronunciation & Subtitle */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <button
                onClick={() => onNavigate("overview")}
                className="group/brand inline-flex items-center cursor-pointer transition-transform duration-150 active:scale-[0.97] focus:outline-none select-none"
                title="Onoma — Overview"
              >
                <OnomaBrandLogo
                  variant="wordmark"
                  className="h-7 sm:h-8 w-auto text-foreground transition-colors group-hover/brand:text-[#0091ff]"
                />
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playPronunciation();
                    }}
                    className="group/audio inline-flex cursor-pointer items-center gap-1.5 font-mono text-xs text-muted-foreground/70 transition-colors duration-150 select-none hover:text-foreground active:scale-[0.95] focus:outline-none px-1 py-0.5"
                  >
                    <span className="tracking-wide">/ˈɒnəmə/</span>
                    <span className="relative inline-flex items-center justify-center">
                      {!hasInteractedPronunciation && (
                        <motion.span
                          className="absolute -inset-1 rounded-full bg-[#0091ff]/40 pointer-events-none"
                          initial={{ scale: 0.8, opacity: 0.8 }}
                          animate={{ scale: [0.8, 1.6, 0.8], opacity: [0.8, 0, 0.8] }}
                          transition={{ duration: 1.2, repeat: 1, ease: "easeOut" }}
                        />
                      )}
                      <motion.span
                        initial={false}
                        animate={
                          !hasInteractedPronunciation
                            ? {
                                scale: [1, 1.25, 1, 1.25, 1],
                                color: ["#0091ff", "#0091ff", "#0091ff", "#0091ff", "currentColor"],
                              }
                            : {}
                        }
                        transition={{ duration: 2.4, times: [0, 0.25, 0.5, 0.75, 1], ease: "easeInOut" }}
                      >
                        <SoundHigh
                          className={cn(
                            "relative h-3.5 w-3.5 transition-transform duration-200",
                            !hasInteractedPronunciation
                              ? "text-[#0091ff]"
                              : "opacity-60 group-hover/audio:scale-110 group-hover/audio:opacity-100 group-hover/audio:text-[#0091ff]"
                          )}
                        />
                      </motion.span>
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="text-xs font-semibold shadow-md backdrop-blur-md">
                  Click to listen to Greek pronunciation (“name”)
                </TooltipContent>
              </Tooltip>
            </div>

          {/* Manifesto Subtitle & Description */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 border-l border-border/50 pl-3 sm:pl-3.5 py-0.5 select-none self-center">
            <span className="font-semibold text-xs sm:text-sm text-foreground tracking-tight whitespace-nowrap">
              Linguistic Engine
            </span>
            <span className="hidden sm:inline text-muted-foreground/40 font-mono text-xs">·</span>
            <span className="text-muted-foreground font-normal text-[11px] sm:text-xs">
              Build the language behind your world.
            </span>
          </div>
        </div>

        {/* Right: Quick Utilities (Glyphs Dev, Guide, Stash, Settings) */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
          <Link
            href="/labs/onoma/glyphs"
            title="Open Onoma Glyphs Catalog (Dev Tools)"
            className="border-border/40 bg-secondary/20 text-muted-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-all hover:border-[#0091ff]/30 hover:bg-[#0091ff]/10 hover:text-[#0091ff] active:scale-95"
          >
            <Code className="h-3.5 w-3.5 text-[#0091ff]" />
            <span className="hidden sm:inline font-mono">Glyphs</span>
          </Link>

          <button
            onClick={onOpenHelp}
            title="Open Brand & System Guide"
            className="border-border/40 bg-secondary/20 text-muted-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-all hover:border-[#0091ff]/30 hover:bg-[#0091ff]/10 hover:text-[#0091ff] active:scale-95"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Guide</span>
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
                ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
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
            onClick={() => onNavigate("settings")}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
              activeSection === "settings"
                ? "border-[#0091ff]/40 bg-[#0091ff]/10 text-[#0091ff] dark:text-[#33a7ff]"
                : "border-border/40 bg-secondary/20 text-muted-foreground hover:border-[#0091ff]/30 hover:bg-[#0091ff]/10 hover:text-[#0091ff]"
            )}
            title="Configure Conlang & Voice Settings"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* Unified Connected Two-Tier Navigation Console (Master Pillar + Contextual Sub-Nav Shelf) */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-100/70 p-1.5 sm:p-2 space-y-1.5 shadow-2xs dark:border-zinc-800/80 dark:bg-zinc-900/50 transition-all duration-300">
        {/* 1. Master 3-Pillar Navigation Tabs (CREATE · STUDIO · EXPLORE) */}
        <FacetTabs
          tabs={ONOMA_PILLAR_TABS}
          activeTab={activePillar}
          onChange={(id) => {
            if (id === "create") onNavigate("overview");
            else if (id === "studio") onNavigate("studio");
            else if (id === "explore") onNavigate("explore");
          }}
          tone="accent"
          size="lg"
          className="w-full"
        />

        {/* 2. Connected Sub-Nav Shelf with Spatial Alignment & Accent Connector Bridge */}
        <div className="relative pt-0.5">
          {/* Subtle Top Specular Line connecting the active pillar to the sub-nav shelf */}
          <div
            className="pointer-events-none absolute -top-1 inset-x-3 h-[1px] opacity-70 transition-all duration-300"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${
                activePillar === "create"
                  ? "#0091ff"
                  : activePillar === "studio"
                    ? "#ec4899"
                    : "#8b5cf6"
              }60 30%, ${
                activePillar === "create"
                  ? "#0091ff"
                  : activePillar === "studio"
                    ? "#ec4899"
                    : "#8b5cf6"
              } 50%, ${
                activePillar === "create"
                  ? "#0091ff"
                  : activePillar === "studio"
                    ? "#ec4899"
                    : "#8b5cf6"
              }60 70%, transparent 100%)`,
            }}
          />

          {/* Contextual Sub-Navigation Strip (Emil Kowalski spring ease-out transition) */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activePillar}
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 3, scale: 0.995 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -2, scale: 0.995 }
              }
              transition={{
                duration: 0.18,
                ease: [0.23, 1, 0.32, 1],
              }}
            >
              <FacetTabs
                tabs={
                  activePillar === "studio"
                    ? studioTabs
                    : activePillar === "explore"
                      ? exploreTabs
                      : ONOMA_TABS
                }
                activeTab={
                  activePillar === "studio"
                    ? activeSubTab
                    : activePillar === "explore"
                      ? activeExploreSubTab
                      : activeSection
                }
                onChange={(id) => {
                  if (activePillar === "studio") {
                    onNavigateStudio(id as StudioSubTab);
                  } else if (activePillar === "explore") {
                    onNavigateExplore(id as ExploreSubTab);
                  } else {
                    onNavigate(id as OnomaSection);
                  }
                }}
                tone="accent"
                size="md"
                className="w-full"
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

