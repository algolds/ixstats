"use client";

// src/app/labs/onoma/components/nav/onoma-tabs.tsx
// Tab definitions, color schemas, and Game-Icon badges for Onoma navigation

import React from "react";
import type { OnomaSection, StudioSubTab } from "~/lib/onoma/types";
import { CategoryIcon } from "~/components/cards/icons";
import { ArrowLeft, Languages } from "lucide-react";

export const SECTION_TITLES: Record<OnomaSection, string> = {
  overview: "Overview",
  places: "Places",
  people: "People",
  military: "Military",
  organizations: "Organizations",
  culture: "Culture",
  history: "History",
  batch: "Batch",
  compare: "Compare",
  marketplace: "Marketplace",
  etymology: "Etymology",
  syntax: "Syntax",
  writing: "Writing System",
  loanwords: "Loanwords",
  linguistics: "Linguistics",
  studio: "Studio",
  bank: "Stash",
  settings: "Settings",
};

export const studioSubTabLabel = (t: StudioSubTab): string =>
  t === "workshop"
    ? "Model Workshop"
    : t === "visualizer"
      ? "Path Visualizer"
      : t === "namesets"
        ? "Name Sets"
        : t === "phonology"
          ? "IPA Studio"
          : t === "batch"
            ? "Batch Generator"
            : "Lexicon Dictionary";

export const SECTION_COLORS: Record<OnomaSection, string> = {
  overview: "#0091ff",
  places: "#10b981",
  people: "#a855f7",
  military: "#ef4444",
  organizations: "#f59e0b",
  culture: "#06b6d4",
  history: "#f59e0b",
  batch: "#10b981",
  compare: "#8b5cf6",
  marketplace: "#f97316",
  etymology: "#a855f7",
  syntax: "#d946ef",
  writing: "#10b981",
  loanwords: "#06b6d4",
  linguistics: "#8b5cf6",
  studio: "#ec4899",
  bank: "#6366f1",
  settings: "#0091ff",
};

// Game-Icons Adapters (Cards Vector Silhouettes, CC BY 3.0)
export const ScienceGameIcon = (props: { className?: string }) => (
  <CategoryIcon category="SCIENCE" treatment="seal" size="xs" {...props} />
);
export const GeographyGameIcon = (props: { className?: string }) => (
  <CategoryIcon category="GEOGRAPHY" treatment="seal" size="xs" {...props} />
);
export const PeopleGameIcon = (props: { className?: string }) => (
  <CategoryIcon category="PEOPLE" treatment="seal" size="xs" {...props} />
);
export const GovernmentGameIcon = (props: { className?: string }) => (
  <CategoryIcon category="GOVERNMENT" treatment="seal" size="xs" {...props} />
);
export const CultureGameIcon = (props: { className?: string }) => (
  <CategoryIcon category="CULTURE" treatment="seal" size="xs" {...props} />
);
export const EconomyGameIcon = (props: { className?: string }) => (
  <CategoryIcon category="ECONOMY" treatment="seal" size="xs" {...props} />
);
export const HistoryGameIcon = (props: { className?: string }) => (
  <CategoryIcon category="HISTORY" treatment="seal" size="xs" {...props} />
);
export const SpecialGameIcon = (props: { className?: string }) => (
  <CategoryIcon category="SPECIAL" treatment="seal" size="xs" {...props} />
);
export const DiplomacyGameIcon = (props: { className?: string }) => (
  <CategoryIcon category="DIPLOMACY" treatment="seal" size="xs" {...props} />
);
export const NationGameIcon = (props: { className?: string }) => (
  <CategoryIcon category="NATION" treatment="seal" size="xs" {...props} />
);

export const ONOMA_TABS = [
  {
    id: "overview",
    label: "Overview",
    icon: ScienceGameIcon,
    themeColor: "#0091ff",
    glowClassName: "bg-[#0091ff]/20 dark:bg-[#0091ff]/10",
    activeIndicatorClassName:
      "bg-[#0091ff]/5 border-[#0091ff]/20 text-[#0091ff] dark:text-[#33a7ff] shadow-[inset_0_1px_0_rgba(0,145,255,0.15)]",
    activeTextClassName: "text-[#0091ff] dark:text-[#33a7ff]",
    activeIconClassName: "text-[#0091ff] dark:text-[#33a7ff]",
  },
  {
    id: "places",
    label: "Places",
    icon: GeographyGameIcon,
    themeColor: "#10b981",
    glowClassName: "bg-emerald-500/20 dark:bg-emerald-500/10",
    activeIndicatorClassName:
      "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-[inset_0_1px_0_rgba(16,185,129,0.15)]",
    activeTextClassName: "text-emerald-600 dark:text-emerald-400",
    activeIconClassName: "text-emerald-500 dark:text-emerald-400",
  },
  {
    id: "people",
    label: "People",
    icon: PeopleGameIcon,
    themeColor: "#a855f7",
    glowClassName: "bg-purple-500/20 dark:bg-purple-500/10",
    activeIndicatorClassName:
      "bg-purple-500/5 border-purple-500/20 text-purple-600 dark:text-purple-400 shadow-[inset_0_1px_0_rgba(168,85,247,0.15)]",
    activeTextClassName: "text-purple-600 dark:text-purple-400",
    activeIconClassName: "text-purple-500 dark:text-purple-400",
  },
  {
    id: "organizations",
    label: "Organizations",
    icon: GovernmentGameIcon,
    themeColor: "#f59e0b",
    glowClassName: "bg-amber-500/20 dark:bg-amber-500/10",
    activeIndicatorClassName:
      "bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-[inset_0_1px_0_rgba(245,158,11,0.15)]",
    activeTextClassName: "text-amber-600 dark:text-amber-400",
    activeIconClassName: "text-amber-500 dark:text-amber-400",
  },
  {
    id: "culture",
    label: "Culture",
    icon: CultureGameIcon,
    themeColor: "#06b6d4",
    glowClassName: "bg-cyan-500/20 dark:bg-cyan-500/10",
    activeIndicatorClassName:
      "bg-cyan-500/5 border-cyan-500/20 text-cyan-600 dark:text-cyan-400 shadow-[inset_0_1px_0_rgba(6,182,212,0.15)]",
    activeTextClassName: "text-cyan-600 dark:text-cyan-400",
    activeIconClassName: "text-cyan-500 dark:text-cyan-400",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    icon: EconomyGameIcon,
    themeColor: "#f97316",
    glowClassName: "bg-orange-500/20 dark:bg-orange-500/10",
    activeIndicatorClassName:
      "bg-orange-500/5 border-orange-500/20 text-orange-600 dark:text-orange-400 shadow-[inset_0_1px_0_rgba(249,115,22,0.15)]",
    activeTextClassName: "text-orange-600 dark:text-orange-400",
    activeIconClassName: "text-orange-500 dark:text-orange-400",
  },
];

export const getStudioTabs = (lexiconCount: number) => [
  {
    id: "exit-studio",
    label: "Exit Studio",
    icon: ArrowLeft,
    themeColor: "#ec4899",
    glowClassName: "bg-pink-500/10 dark:bg-pink-500/5",
    activeIndicatorClassName:
      "bg-pink-500/5 border-pink-500/20 text-pink-600 dark:text-pink-400",
    activeTextClassName: "text-pink-600 dark:text-pink-400",
    activeIconClassName: "text-pink-500 dark:text-pink-400",
  },
  {
    id: "workshop",
    label: "Model Workshop",
    icon: ScienceGameIcon,
    themeColor: "#0091ff",
    glowClassName: "bg-[#0091ff]/20 dark:bg-[#0091ff]/10",
    activeIndicatorClassName:
      "bg-[#0091ff]/5 border-[#0091ff]/20 text-[#0091ff] dark:text-[#33a7ff] shadow-[inset_0_1px_0_rgba(0,145,255,0.15)]",
    activeTextClassName: "text-[#0091ff] dark:text-[#33a7ff]",
    activeIconClassName: "text-[#0091ff] dark:text-[#33a7ff]",
  },
  {
    id: "visualizer",
    label: "Path Visualizer",
    icon: SpecialGameIcon,
    themeColor: "#0091ff",
    glowClassName: "bg-[#0091ff]/20 dark:bg-[#0091ff]/10",
    activeIndicatorClassName:
      "bg-[#0091ff]/5 border-[#0091ff]/20 text-[#0091ff] dark:text-[#33a7ff] shadow-[inset_0_1px_0_rgba(0,145,255,0.15)]",
    activeTextClassName: "text-[#0091ff] dark:text-[#33a7ff]",
    activeIconClassName: "text-[#0091ff] dark:text-[#33a7ff]",
  },
  {
    id: "namesets",
    label: "Name Sets",
    icon: NationGameIcon,
    themeColor: "#8b5cf6",
    glowClassName: "bg-violet-500/20 dark:bg-violet-500/10",
    activeIndicatorClassName:
      "bg-violet-500/5 border-violet-500/20 text-violet-600 dark:text-violet-400 shadow-[inset_0_1px_0_rgba(139,92,246,0.15)]",
    activeTextClassName: "text-violet-600 dark:text-violet-400",
    activeIconClassName: "text-violet-500 dark:text-violet-400",
  },
  {
    id: "lexicon",
    label: lexiconCount > 0 ? `Lexicon Dictionary (${lexiconCount})` : "Lexicon Dictionary",
    icon: CultureGameIcon,
    themeColor: "#10b981",
    glowClassName: "bg-emerald-500/20 dark:bg-emerald-500/10",
    activeIndicatorClassName:
      "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-[inset_0_1px_0_rgba(16,185,129,0.15)]",
    activeTextClassName: "text-emerald-600 dark:text-emerald-400",
    activeIconClassName: "text-emerald-500 dark:text-emerald-400",
  },
  {
    id: "phonology",
    label: "IPA Studio",
    icon: DiplomacyGameIcon,
    themeColor: "#8b5cf6",
    glowClassName: "bg-violet-500/20 dark:bg-violet-500/10",
    activeIndicatorClassName:
      "bg-violet-500/5 border-violet-500/20 text-violet-600 dark:text-violet-400 shadow-[inset_0_1px_0_rgba(139,92,246,0.15)]",
    activeTextClassName: "text-violet-600 dark:text-violet-400",
    activeIconClassName: "text-violet-500 dark:text-violet-400",
  },
  {
    id: "shifts",
    label: "Sound Shifts",
    icon: HistoryGameIcon,
    themeColor: "#ec4899",
    glowClassName: "bg-pink-500/20 dark:bg-pink-500/10",
    activeIndicatorClassName:
      "bg-pink-500/5 border-pink-500/20 text-pink-600 dark:text-pink-400 shadow-[inset_0_1px_0_rgba(236,72,153,0.15)]",
    activeTextClassName: "text-pink-600 dark:text-pink-400",
    activeIconClassName: "text-pink-500 dark:text-pink-400",
  },
  {
    id: "batch",
    label: "Batch Generator",
    icon: EconomyGameIcon,
    themeColor: "#10b981",
    glowClassName: "bg-emerald-500/20 dark:bg-emerald-500/10",
    activeIndicatorClassName:
      "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-[inset_0_1px_0_rgba(16,185,129,0.15)]",
    activeTextClassName: "text-emerald-600 dark:text-emerald-400",
    activeIconClassName: "text-emerald-500 dark:text-emerald-400",
  },
  {
    id: "linguistics",
    label: "Linguistics Suite",
    icon: Languages,
    themeColor: "#8b5cf6",
    glowClassName: "bg-violet-500/20 dark:bg-violet-500/10",
    activeIndicatorClassName:
      "bg-violet-500/5 border-violet-500/20 text-violet-600 dark:text-violet-400 shadow-[inset_0_1px_0_rgba(139,92,246,0.15)]",
    activeTextClassName: "text-violet-600 dark:text-violet-400",
    activeIconClassName: "text-violet-500 dark:text-violet-400",
  },
];
