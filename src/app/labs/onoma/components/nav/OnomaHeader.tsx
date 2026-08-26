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
  ArrowLeft,
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
  lastActiveTab,
  // oxlint-disable-next-line eslint/no-unused-vars
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
  const studioTabs = React.useMemo(() => getStudioTabs(), []);
  const exploreTabs = React.useMemo(() => getExploreTabs(), []);

  const isUtilitySection = activeSection === "bank" || activeSection === "settings";

  const activePillar: OnomaProductPillar =
    activeSection === "studio"
      ? "studio"
      : activeSection === "explore"
        ? "explore"
        : "create";

  const returnLabel = React.useMemo(() => {
    if (lastActiveTab === "studio") return "Studio";
    if (lastActiveTab === "explore") return "Explore";
    if (lastActiveTab === "places") return "Places";
    if (lastActiveTab === "people") return "People";
    if (lastActiveTab === "organizations") return "Factions";
    if (lastActiveTab === "culture") return "Culture";
    return "Generator";
  }, [lastActiveTab]);

  const handleReturn = () => {
    if (lastActiveTab === "studio") {
      onNavigateStudio(activeSubTab || "workshop");
    } else if (lastActiveTab === "explore") {
      onNavigateExplore(activeExploreSubTab || "phonology");
    } else {
      onNavigate(lastActiveTab || "overview");
    }
  };

  return (
    <div className="space-y-3 border-b border-border/40 pb-3.5">
      {/* Top Utility Bar (Wordmark, Pronunciation, Subtitle/Description, Guide, Stash, Settings) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Left: Brand Lockup with Subtitle stacked directly underneath */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate("overview")}
              className="group/brand inline-flex items-center cursor-pointer transition-transform duration-100 active:scale-[0.97] focus:outline-none select-none"
              title="Onoma — Overview"
            >
              <OnomaBrandLogo
                variant="wordmark"
                className="h-6 sm:h-6.5 w-auto text-foreground transition-colors duration-150 group-hover/brand:text-onoma-primary"
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
                  className="group/audio inline-flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-muted-foreground/80 hover:text-foreground border border-border/50 bg-secondary/30 hover:bg-secondary/60 hover:border-border/80 transition-all duration-150 select-none active:scale-[0.95] focus:outline-none rounded-full px-2 py-0.5"
                >
                  <span className="tracking-wide">/ˈɒnəmə/</span>
                  <span className="relative inline-flex items-center justify-center">
                    {!hasInteractedPronunciation && (
                      <motion.span
                        className="absolute -inset-1 rounded-full bg-onoma-primary/40 pointer-events-none"
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
                          "relative h-3 w-3 transition-transform duration-200",
                          !hasInteractedPronunciation
                            ? "text-onoma-primary"
                            : "opacity-60 group-hover/audio:scale-110 group-hover/audio:opacity-100 group-hover/audio:text-onoma-primary"
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

          {/* Subtitle & Manifesto Description (Directly Under Logo) */}
          <div className="flex items-center gap-1.5 select-none pl-0.5 leading-tight">
            <span className="font-semibold text-[11px] text-foreground tracking-tight whitespace-nowrap">
              Linguistic Engine
            </span>
            <span className="text-muted-foreground/40 font-mono text-[10px]">·</span>
            <span className="text-muted-foreground font-normal text-[11px] truncate">
              Build the language behind your world.
            </span>
          </div>
        </div>

        {/* Right: Quick Utilities (Glyphs Dev, Guide, Stash, Settings) */}
        <div className="flex items-center justify-end gap-1.5 shrink-0 self-end sm:self-center">
          {process.env.NODE_ENV === "development" && (
            <Link
              href="/labs/onoma/glyphs"
              title="Open Onoma Glyphs Catalog (Dev Tools)"
              className="border-border/40 bg-secondary/25 text-muted-foreground hover:border-onoma-primary/30 hover:bg-onoma-primary/10 hover:text-onoma-primary flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all duration-100 active:scale-[0.96]"
            >
              <Code className="h-3.5 w-3.5 text-onoma-primary" />
              <span className="hidden sm:inline font-mono">Glyphs</span>
            </Link>
          )}

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
              "flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all duration-100 active:scale-[0.96]",
              activeSection === "bank"
                ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold"
                : "border-border/40 bg-secondary/25 text-muted-foreground hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400"
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
              "flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all duration-100 active:scale-[0.96]",
              activeSection === "settings"
                ? "border-onoma-primary/40 bg-onoma-primary/10 text-onoma-primary dark:text-onoma-primary-light font-bold"
                : "border-border/40 bg-secondary/25 text-muted-foreground hover:border-onoma-primary/30 hover:bg-onoma-primary/10 hover:text-onoma-primary"
            )}
            title="Configure Conlang & Voice Settings"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* Dynamic Navigation Container: Contextual Action Breadcrumb for Stash/Settings, or Full 2-Tier Console */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-100/70 p-1.5 shadow-2xs dark:border-zinc-800/80 dark:bg-zinc-900/50 backdrop-blur-md transition-all duration-300">
        <AnimatePresence mode="wait" initial={false}>
          {isUtilitySection ? (
            <motion.div
              key="utility-breadcrumb"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 3, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -2, scale: 0.995 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1.5 py-0.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Left: 1-Click Return Button */}
                <button
                  onClick={handleReturn}
                  className="border-zinc-300/80 dark:border-zinc-700/80 bg-background/80 hover:bg-onoma-primary/10 hover:border-onoma-primary/40 text-foreground hover:text-onoma-primary flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-2xs transition-all duration-100 cursor-pointer active:scale-[0.96] shrink-0"
                  title={`Return to ${returnLabel}`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to {returnLabel}</span>
                </button>

                {/* Center: Title & Manifesto Subtitle */}
                <div className="flex flex-col min-w-0 select-none border-l border-border/50 pl-2.5 py-0.5">
                  {activeSection === "bank" ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Bookmark className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="text-xs sm:text-sm font-bold text-foreground tracking-tight">
                          My Stash
                        </span>
                      </div>
                      <span className="hidden sm:inline text-muted-foreground/40 font-mono text-xs">·</span>
                      <span className="text-[11px] sm:text-xs text-muted-foreground truncate">
                        Manage your saved names and custom dictionaries.
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Settings className="h-3.5 w-3.5 text-onoma-primary" />
                        <span className="text-xs sm:text-sm font-bold text-foreground tracking-tight">
                          Onoma Preferences & Sandbox
                        </span>
                      </div>
                      <span className="hidden sm:inline text-muted-foreground/40 font-mono text-xs">·</span>
                      <span className="text-[11px] sm:text-xs text-muted-foreground truncate">
                        Customize playback parameters, preview voices, and manage conlang dictionaries stored in this browser.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Docked Help Button (Hidden on Settings) */}
              {activeSection !== "settings" && (
                <button
                  onClick={onOpenHelp}
                  title="Open Contextual Help"
                  className="border-zinc-300/80 dark:border-zinc-700/80 bg-background/60 hover:bg-onoma-primary/10 hover:border-onoma-primary/40 text-muted-foreground hover:text-onoma-primary flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold shadow-2xs transition-all duration-100 cursor-pointer active:scale-[0.96] shrink-0 self-end sm:self-auto"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Help</span>
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="pillar-console"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 3, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -2, scale: 0.995 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="space-y-1.5"
            >
              {/* 1. Master 3-Pillar Navigation Tabs (CREATE · STUDIO · EXPLORE) */}
              <FacetTabs
                tabs={ONOMA_PILLAR_TABS}
                activeTab={activePillar}
                onChange={(id) => {
                  if (id === "create") onNavigate(lastActiveTab || "overview");
                  else if (id === "studio") onNavigateStudio(activeSubTab || "workshop");
                  else if (id === "explore") onNavigateExplore(activeExploreSubTab || "phonology");
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
                    className="flex items-center gap-1.5"
                  >
                    <div className="flex-1 min-w-0">
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
                    </div>

                    {/* Connected Contextual Help Button on the Active Tab Shelf */}
                    <button
                      onClick={onOpenHelp}
                      title="Open Contextual Help & System Reference"
                      className="border-zinc-300/80 dark:border-zinc-700/80 bg-background/60 hover:bg-onoma-primary/10 hover:border-onoma-primary/40 text-muted-foreground hover:text-onoma-primary flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Help</span>
                    </button>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default OnomaHeader;
