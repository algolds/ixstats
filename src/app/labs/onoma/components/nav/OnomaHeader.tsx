"use client";

// Onoma's header: the wordmark beside the current section's title, then one navigation row. The
// workspace switch (Create · Studio · Explore) is the primary control; the active workspace's
// sections sit beside it as a smaller, secondary control. Stash and Settings replace the row with a
// way back.

import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Bookmark, HelpCircle, Settings, SoundHigh } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { ActionPill } from "~/components/ui/action-pill";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { OnomaBrandLogo } from "~/components/onoma/OnomaBrandLogo";
import type {
  ExploreSubTab,
  OnomaProductPillar,
  OnomaSection,
  StudioSubTab,
} from "~/lib/onoma/types";
import {
  ONOMA_PILLAR_TABS,
  ONOMA_TABS,
  SECTION_TITLES,
  exploreSubTabLabel,
  getExploreTabs,
  getStudioTabs,
  studioSubTabLabel,
} from "./onoma-tabs";

const toOptions = (
  tabs: readonly {
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[]
) =>
  tabs.map(({ id, label, icon: Icon }) => ({
    value: id,
    label,
    icon: Icon ? <Icon /> : undefined,
  }));

const STUDIO_TABS = toOptions(getStudioTabs());
const EXPLORE_TABS = toOptions(getExploreTabs());
const CREATE_TABS = toOptions(ONOMA_TABS);
const PILLAR_TABS = toOptions(ONOMA_PILLAR_TABS);

interface OnomaHeaderProps {
  activeSection: OnomaSection;
  activeSubTab: StudioSubTab;
  activeExploreSubTab: ExploreSubTab;
  lastActiveTab: OnomaSection;
  shouldAnimateStash: boolean;
  hasInteractedPronunciation: boolean;
  setHasInteractedPronunciation: (val: boolean) => void;
  playPronunciation: () => void;
  onOpenHelp: () => void;
  onNavigate: (section: OnomaSection) => void;
  onNavigateStudio: (tab: StudioSubTab) => void;
  onNavigateExplore: (tab: ExploreSubTab) => void;
}

/** The page title: the section, or the workspace section in Studio and Explore. */
export function onomaPageTitle(
  section: OnomaSection,
  studioTab: StudioSubTab,
  exploreTab: ExploreSubTab
): string {
  if (section === "studio") return studioSubTabLabel(studioTab);
  if (section === "explore") return exploreSubTabLabel(exploreTab);
  if (section === "bank") return "My stash";
  return SECTION_TITLES[section];
}

const RETURN_LABELS: Partial<Record<OnomaSection, string>> = {
  studio: "Studio",
  explore: "Explore",
  places: "Places",
  people: "People",
  organizations: "Factions",
  culture: "Culture",
};

function Pronunciation({ played, onPlay }: { played: boolean; onPlay: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ActionPill
          onClick={onPlay}
          aria-label="Play the pronunciation of Onoma"
          className="group/audio bg-fill-3 hover:bg-fill-2 gap-1 px-2 font-mono"
        >
          <span>/ˈɒnəmə/</span>
          <SoundHigh
            aria-hidden
            className={
              played
                ? "group-hover/audio:text-tint text-label-secondary size-3.5"
                : "text-tint size-3.5"
            }
          />
        </ActionPill>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start">
        The Greek word for name
      </TooltipContent>
    </Tooltip>
  );
}

export function OnomaHeader({
  activeSection,
  activeSubTab,
  activeExploreSubTab,
  lastActiveTab,
  shouldAnimateStash,
  hasInteractedPronunciation,
  playPronunciation,
  onOpenHelp,
  onNavigate,
  onNavigateStudio,
  onNavigateExplore,
}: OnomaHeaderProps) {
  const shouldReduceMotion = useReducedMotion();
  const isUtilitySection = activeSection === "bank" || activeSection === "settings";
  const activePillar: OnomaProductPillar =
    activeSection === "studio" ? "studio" : activeSection === "explore" ? "explore" : "create";
  const returnLabel = RETURN_LABELS[lastActiveTab] ?? "Sandbox";

  const handleReturn = () => {
    if (lastActiveTab === "studio") onNavigateStudio(activeSubTab || "workshop");
    else if (lastActiveTab === "explore") onNavigateExplore(activeExploreSubTab || "phonology");
    else onNavigate(lastActiveTab || "overview");
  };

  const handlePillar = (id: string) => {
    if (id === "create") onNavigate(lastActiveTab || "overview");
    else if (id === "studio") onNavigateStudio(activeSubTab || "workshop");
    else if (id === "explore") onNavigateExplore(activeExploreSubTab || "phonology");
  };

  const handleSection = (id: string) => {
    if (activePillar === "studio") onNavigateStudio(id as StudioSubTab);
    else if (activePillar === "explore") onNavigateExplore(id as ExploreSubTab);
    else onNavigate(id as OnomaSection);
  };

  const sectionOptions =
    activePillar === "studio"
      ? STUDIO_TABS
      : activePillar === "explore"
        ? EXPLORE_TABS
        : CREATE_TABS;
  const sectionValue =
    activePillar === "studio"
      ? activeSubTab
      : activePillar === "explore"
        ? activeExploreSubTab
        : activeSection;

  return (
    <header className="space-y-4">
      <PageHeader
        title={onomaPageTitle(activeSection, activeSubTab, activeExploreSubTab)}
        bleed
        leading={
          <button
            type="button"
            onClick={() => onNavigate("overview")}
            aria-label="Onoma sandbox"
            className="text-label hover:text-tint focus-visible:outline-tint rounded-control duration-fast transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <OnomaBrandLogo variant="wordmark" className="h-7 w-auto" />
          </button>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Pronunciation played={hasInteractedPronunciation} onPlay={playPronunciation} />
            <span>Build the language behind your world.</span>
          </span>
        }
        actions={
          <>
            <motion.span
              className="inline-flex"
              animate={shouldAnimateStash ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.4 }}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigate("bank")}
                aria-pressed={activeSection === "bank"}
              >
                <Bookmark />
                <span className="hidden sm:inline">Stash</span>
              </Button>
            </motion.span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate("settings")}
              aria-pressed={activeSection === "settings"}
            >
              <Settings />
              <span className="hidden sm:inline">Settings</span>
            </Button>
            {activeSection !== "settings" && (
              <Button variant="secondary" size="sm" onClick={onOpenHelp} aria-label="Help">
                <HelpCircle />
                <span className="hidden md:inline">Help</span>
              </Button>
            )}
          </>
        }
      />

      {isUtilitySection ? (
        <Button variant="ghost" size="sm" onClick={handleReturn}>
          <ArrowLeft />
          Back to {returnLabel}
        </Button>
      ) : (
        <nav aria-label="Onoma" className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <SegmentedControl
            options={PILLAR_TABS}
            value={activePillar}
            onValueChange={handlePillar}
            aria-label="Onoma workspaces"
          />
          <SegmentedControl
            key={activePillar}
            options={sectionOptions}
            value={sectionValue}
            onValueChange={handleSection}
            size="sm"
            aria-label={`${PILLAR_TABS.find((p) => p.value === activePillar)?.label ?? ""} sections`}
            className="max-w-full overflow-x-auto"
          />
        </nav>
      )}
    </header>
  );
}
