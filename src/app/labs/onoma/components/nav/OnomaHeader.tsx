"use client";

// src/app/labs/onoma/components/nav/OnomaHeader.tsx
// Onoma page header (Product Model: CREATE · STUDIO · EXPLORE). The wordmark and
// utility buttons sit on the grouped page; the pillar console is a thin material toolbar holding the
// pillar and section tabs (SegmentedControl), or the Stash/Settings return bar.

import React from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { HelpCircle, Bookmark, Settings, SoundHigh, Code, ArrowLeft } from "iconoir-react";
import { FacetMaterial } from "~/components/ui/facet";
import { Button, buttonVariants } from "~/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { tweenFast } from "~/lib/design/motion";
import { OnomaBrandLogo } from "../shared/OnomaBrandLogo";
import type {
  OnomaSection,
  StudioSubTab,
  ExploreSubTab,
  OnomaProductPillar,
} from "~/lib/onoma/types";
import { ONOMA_TABS, ONOMA_PILLAR_TABS, getStudioTabs, getExploreTabs } from "./onoma-tabs";
import { cn } from "~/lib/utils";
import { ActionPill } from "~/components/ui/action-pill";
import { SegmentedControl } from "~/components/ui/segmented-control";

const toOptions = (
  tabs: readonly { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
) => tabs.map(({ id, label, icon: Icon }) => ({ value: id, label, icon: <Icon /> }));

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

/** Cross-fade (+ a small lift) between the console's states. */
function consoleMotion(reduce: boolean | null) {
  return {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 3 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -2 },
    transition: tweenFast,
  };
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
    activeSection === "studio" ? "studio" : activeSection === "explore" ? "explore" : "create";

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

  const helpButton = (
    <Button
      variant="secondary"
      size="sm"
      onClick={onOpenHelp}
      title="Open contextual help and system reference"
      aria-label="Help"
      className="shrink-0"
    >
      <HelpCircle />
      <span className="hidden md:inline">Help</span>
    </Button>
  );

  return (
    <header className="space-y-3">
      {/* Top bar: wordmark + pronunciation + tagline, and the Glyphs / Stash / Settings utilities */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => onNavigate("overview")}
              className="group/brand h-auto px-1 py-1 hover:bg-transparent"
              title="Onoma overview"
              aria-label="Onoma overview"
            >
              <OnomaBrandLogo
                variant="wordmark"
                className="text-label group-hover/brand:text-tint h-6 w-auto transition-colors duration-150"
              />
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <ActionPill
                  onClick={(e) => {
                    e.stopPropagation();
                    playPronunciation();
                  }}
                  aria-label="Play the pronunciation of Onoma"
                  className="group/audio bg-fill-3 hover:bg-fill-2 gap-1 px-2 font-mono"
                >
                  <span>/ˈɒnəmə/</span>
                  <span className="relative inline-flex items-center justify-center">
                    {!hasInteractedPronunciation && !shouldReduceMotion && (
                      <motion.span
                        className="bg-tint/40 pointer-events-none absolute -inset-1 rounded-full"
                        initial={{ scale: 0.8, opacity: 0.8 }}
                        animate={{ scale: [0.8, 1.6, 0.8], opacity: [0.8, 0, 0.8] }}
                        transition={{ duration: 1.2, repeat: 1, ease: "easeOut" }}
                      />
                    )}
                    <SoundHigh
                      className={cn(
                        "relative size-3.5 transition-[color,opacity] duration-150",
                        !hasInteractedPronunciation
                          ? "text-tint"
                          : "group-hover/audio:text-tint opacity-60 group-hover/audio:opacity-100"
                      )}
                    />
                  </span>
                </ActionPill>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start">
                Listen to the Greek pronunciation (“name”)
              </TooltipContent>
            </Tooltip>
          </div>

          <p className="text-footnote flex min-w-0 items-center gap-2 select-none">
            <span className="text-label font-medium whitespace-nowrap">Linguistic engine</span>
            <span className="text-label-tertiary" aria-hidden="true">
              ·
            </span>
            <span className="text-label-secondary truncate">
              Build the language behind your world.
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 self-end sm:self-center">
          {process.env.NODE_ENV === "development" && (
            <Link
              href="/labs/onoma/glyphs"
              title="Open the Onoma glyphs catalog (dev tools)"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <Code className="text-tint" />
              <span className="hidden sm:inline">Glyphs</span>
            </Link>
          )}

          <motion.button
            type="button"
            animate={
              shouldAnimateStash
                ? shouldReduceMotion
                  ? { opacity: [1, 0.6, 1] }
                  : { scale: [1, 1.08, 0.98, 1] }
                : { scale: 1, opacity: 1 }
            }
            transition={{ duration: 0.4, ease: "easeInOut" }}
            onClick={() => onNavigate("bank")}
            aria-pressed={activeSection === "bank"}
            className={buttonVariants({
              variant: activeSection === "bank" ? "secondary" : "secondary",
              size: "sm",
            })}
          >
            <Bookmark />
            <span>Stash</span>
          </motion.button>

          <Button
            variant={activeSection === "settings" ? "secondary" : "secondary"}
            size="sm"
            onClick={() => onNavigate("settings")}
            aria-pressed={activeSection === "settings"}
            title="Configure conlang and voice settings"
          >
            <Settings />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>
      </div>

      {/* Console: the return bar for Stash/Settings, or the pillar + section tabs */}
      <FacetMaterial material="thin" className="rounded-card p-2">
        <AnimatePresence mode="wait" initial={false}>
          {isUtilitySection ? (
            <motion.div
              key="utility-breadcrumb"
              {...consoleMotion(shouldReduceMotion)}
              className="flex flex-col justify-between gap-2 px-1 py-0.5 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReturn}
                  title={`Return to ${returnLabel}`}
                  className="shrink-0"
                >
                  <ArrowLeft />
                  <span>Back to {returnLabel}</span>
                </Button>

                <div className="border-separator flex min-w-0 flex-col border-l py-0.5 pl-3 select-none">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <h2 className="text-headline text-label flex shrink-0 items-center gap-2">
                      {activeSection === "bank" ? (
                        <Bookmark className="text-tint size-4" aria-hidden="true" />
                      ) : (
                        <Settings className="text-tint size-4" aria-hidden="true" />
                      )}
                      {activeSection === "bank" ? "My stash" : "Onoma preferences & sandbox"}
                    </h2>
                    <span className="text-label-tertiary hidden sm:inline" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-footnote text-label-secondary truncate">
                      {activeSection === "bank"
                        ? "Manage your saved names and custom dictionaries."
                        : "Customize playback parameters, preview voices, and manage conlang dictionaries stored in this browser."}
                    </span>
                  </div>
                </div>
              </div>

              {/* Help is hidden on Settings */}
              {activeSection !== "settings" && (
                <div className="self-end sm:self-auto">{helpButton}</div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="pillar-console"
              {...consoleMotion(shouldReduceMotion)}
              className="space-y-2"
            >
              {/* 1. Pillar tabs (Create · Studio · Explore) */}
              <SegmentedControl
                options={toOptions(ONOMA_PILLAR_TABS)}
                value={activePillar}
                onValueChange={(id) => {
                  if (id === "create") onNavigate(lastActiveTab || "overview");
                  else if (id === "studio") onNavigateStudio(activeSubTab || "workshop");
                  else if (id === "explore") onNavigateExplore(activeExploreSubTab || "phonology");
                }}
                size="md"
                aria-label="Onoma workspaces"
                className="w-full"
                asTabs
              />

              {/* 2. The active pillar's sections, with contextual help */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activePillar}
                  {...consoleMotion(shouldReduceMotion)}
                  className="flex items-center gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <SegmentedControl
                      options={toOptions(
                        activePillar === "studio"
                          ? studioTabs
                          : activePillar === "explore"
                            ? exploreTabs
                            : ONOMA_TABS
                      )}
                      value={
                        activePillar === "studio"
                          ? activeSubTab
                          : activePillar === "explore"
                            ? activeExploreSubTab
                            : activeSection
                      }
                      onValueChange={(id) => {
                        if (activePillar === "studio") {
                          onNavigateStudio(id as StudioSubTab);
                        } else if (activePillar === "explore") {
                          onNavigateExplore(id as ExploreSubTab);
                        } else {
                          onNavigate(id as OnomaSection);
                        }
                      }}
                      size="md"
                      aria-label="Sections"
                      className="w-full"
                      asTabs
                    />
                  </div>
                  {helpButton}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </FacetMaterial>
    </header>
  );
}
