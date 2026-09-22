"use client";

import { Flash } from "iconoir-react";

// src/app/labs/onoma/components/nav/onoma-tabs.tsx
// Tab definitions, color schemas, feature descriptions, and Onoma Glyphs for Onoma navigation
// Product Model: CREATE · STUDIO · EXPLORE (Apple SF Symbols × IPA × Linguistic Notation)

import React from "react";
import type { OnomaSection, StudioSubTab, ExploreSubTab } from "~/lib/onoma/types";
import { OnomaGlyph } from "../glyphs/OnomaGlyph";
import type { OnomaGlyphName } from "../glyphs/onoma-glyphs-catalog";

export const SECTION_TITLES: Record<OnomaSection, string> = {
  overview: "Sandbox",
  places: "Places",
  people: "People",
  organizations: "Factions",
  culture: "Culture",
  marketplace: "Language Packs",
  studio: "Studio",
  explore: "Explore",
  bank: "Stash",
  settings: "Settings",
};

export const studioSubTabLabel = (t: StudioSubTab): string => {
  switch (t) {
    case "workshop":
      return "Workshop";
    case "visualizer":
      return "Path Visualizer";
    case "namesets":
      return "Name Sets";
    case "shifts":
      return "Sound Shifts";
    default:
      return "Workshop";
  }
};

export const exploreSubTabLabel = (t: ExploreSubTab): string => {
  switch (t) {
    case "phonology":
      return "Acoustics & IPA";
    case "grammar":
      return "Grammar & Roots";
    case "writing":
      return "Writing Systems";
    case "packs":
      return "Community Packs";
    default:
      return "Acoustics & IPA";
  }
};

export const SECTION_COLORS: Record<OnomaSection, string> = {
  overview: "#0091ff",
  places: "#10b981",
  people: "#6366f1",
  organizations: "#f59e0b",
  culture: "#06b6d4",
  marketplace: "#0091ff",
  studio: "#0091ff",
  explore: "#6366f1",
  bank: "#6366f1",
  settings: "#0091ff",
};

// Onoma Glyph Adapter Helper
const createGlyphAdapter = (name: OnomaGlyphName) => {
  return function GlyphIcon(props: { className?: string }) {
    return <OnomaGlyph name={name} className={props.className} size="sm" />;
  };
};

// Linguistic Glyph Adapters for backward-compatibility with downstream components
export const ScienceGameIcon = (props: { className?: string }) => <Flash {...props} />;
export const GeographyGameIcon = createGlyphAdapter("sound-vowel-quad");
export const PeopleGameIcon = createGlyphAdapter("sound-articulation");
export const GovernmentGameIcon = createGlyphAdapter("struct-syntax");
export const CultureGameIcon = createGlyphAdapter("compose-morphology");
export const EconomyGameIcon = createGlyphAdapter("memory-dataset");
export const HistoryGameIcon = createGlyphAdapter("transform-shift");
export const SpecialGameIcon = createGlyphAdapter("emerge-branch");
export const DiplomacyGameIcon = createGlyphAdapter("sound-acoustic");
export const NationGameIcon = createGlyphAdapter("compose-lexicon");

/**
 * Master Product Pillar tabs (CREATE · STUDIO · EXPLORE) for FacetTabs
 */
export const ONOMA_PILLAR_TABS = [
  {
    id: "create",
    label: "Create",
    icon: createGlyphAdapter("emerge-synthesis"),
    themeColor: "#0091ff",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-onoma-primary/10 border-onoma-primary/30 text-onoma-primary dark:text-onoma-primary-light shadow-xs",
    activeTextClassName: "text-onoma-primary dark:text-onoma-primary-light font-semibold",
    activeIconClassName: "text-onoma-primary dark:text-onoma-primary-light",
  },
  {
    id: "studio",
    label: "Studio",
    icon: createGlyphAdapter("emerge-branch"),
    themeColor: "#0091ff",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-onoma-primary/10 border-onoma-primary/30 text-onoma-primary dark:text-onoma-primary-light shadow-xs",
    activeTextClassName: "text-onoma-primary dark:text-onoma-primary-light font-semibold",
    activeIconClassName: "text-onoma-primary dark:text-onoma-primary-light",
  },
  {
    id: "explore",
    label: "Explore",
    icon: createGlyphAdapter("sound-acoustic"),
    themeColor: "#6366f1",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-xs",
    activeTextClassName: "text-indigo-600 dark:text-indigo-400 font-semibold",
    activeIconClassName: "text-indigo-500 dark:text-indigo-400",
  },
];

/**
 * Domain category tabs displayed in the CREATE pillar alongside the Quick Generator anchor.
 */
export const CREATE_DOMAIN_TABS = [
  {
    id: "places",
    label: "Places",
    notation: "Geography",
    icon: createGlyphAdapter("sound-vowel-quad"),
    themeColor: "#10b981",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shadow-2xs",
    activeTextClassName: "text-emerald-700 dark:text-emerald-300",
    activeIconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "people",
    label: "People",
    notation: "Characters",
    icon: createGlyphAdapter("sound-articulation"),
    themeColor: "#6366f1",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 shadow-2xs",
    activeTextClassName: "text-indigo-700 dark:text-indigo-300",
    activeIconClassName: "text-indigo-600 dark:text-indigo-400",
  },
  {
    id: "organizations",
    label: "Factions",
    notation: "Organizations",
    icon: createGlyphAdapter("struct-syntax"),
    themeColor: "#f59e0b",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 shadow-2xs",
    activeTextClassName: "text-amber-700 dark:text-amber-300",
    activeIconClassName: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "culture",
    label: "Culture",
    notation: "Traditions",
    icon: createGlyphAdapter("compose-morphology"),
    themeColor: "#06b6d4",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300 shadow-2xs",
    activeTextClassName: "text-cyan-700 dark:text-cyan-300",
    activeIconClassName: "text-cyan-600 dark:text-cyan-400",
  },
];

export const ONOMA_TABS = [
  {
    id: "overview",
    label: "Sandbox",
    notation: "Freeform",
    className: "whitespace-nowrap font-medium",
    icon: createGlyphAdapter("emerge-engine"),
    themeColor: "#0091ff",

    glowClassName: "",
    activeIndicatorClassName:
      "bg-onoma-primary/10 border-onoma-primary/30 text-onoma-primary dark:text-onoma-primary-light shadow-2xs",
    activeTextClassName: "text-onoma-primary dark:text-onoma-primary-light",
    activeIconClassName: "text-onoma-primary dark:text-onoma-primary-light",
  },
  ...CREATE_DOMAIN_TABS,
];

/**
 * STUDIO workspace sub-navigation tabs (Construction Engine).
 */
export const getStudioTabs = () => [
  {
    id: "workshop",
    label: "Workshop",
    notation: "Model",
    icon: createGlyphAdapter("emerge-branch"),
    themeColor: "#0091ff",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-onoma-primary/10 border-onoma-primary/30 text-onoma-primary dark:text-onoma-primary-light shadow-2xs",
    activeTextClassName: "text-onoma-primary dark:text-onoma-primary-light",
    activeIconClassName: "text-onoma-primary dark:text-onoma-primary-light",
  },
  {
    id: "visualizer",
    label: "Path Visualizer",
    notation: "Graph",
    icon: createGlyphAdapter("struct-syntax"),
    themeColor: "#0091ff",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-onoma-primary/10 border-onoma-primary/30 text-onoma-primary dark:text-onoma-primary-light shadow-2xs",
    activeTextClassName: "text-onoma-primary dark:text-onoma-primary-light",
    activeIconClassName: "text-onoma-primary dark:text-onoma-primary-light",
  },
  {
    id: "namesets",
    label: "Name Sets",
    notation: "Sets",
    icon: createGlyphAdapter("memory-dataset"),
    themeColor: "#6366f1",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-2xs",
    activeTextClassName: "text-indigo-600 dark:text-indigo-400",
    activeIconClassName: "text-indigo-500 dark:text-indigo-400",
  },
  {
    id: "shifts",
    label: "Sound Shifts",
    notation: "Rules",
    icon: createGlyphAdapter("transform-shift"),
    themeColor: "#0091ff",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-onoma-primary/10 border-onoma-primary/30 text-onoma-primary dark:text-onoma-primary-light shadow-2xs",
    activeTextClassName: "text-onoma-primary dark:text-onoma-primary-light",
    activeIconClassName: "text-onoma-primary dark:text-onoma-primary-light",
  },
];

/**
 * EXPLORE workspace sub-navigation tabs (Language Analysis & Understanding Engine).
 */
export const getExploreTabs = () => [
  {
    id: "phonology",
    label: "Acoustics & IPA",
    notation: "Phonetics",
    icon: createGlyphAdapter("sound-acoustic"),
    themeColor: "#6366f1",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-2xs",
    activeTextClassName: "text-indigo-600 dark:text-indigo-400",
    activeIconClassName: "text-indigo-500 dark:text-indigo-400",
  },
  {
    id: "grammar",
    label: "Grammar & Roots",
    notation: "Grammar",
    icon: createGlyphAdapter("struct-syntax"),
    themeColor: "#6366f1",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-2xs",
    activeTextClassName: "text-indigo-600 dark:text-indigo-400",
    activeIconClassName: "text-indigo-500 dark:text-indigo-400",
  },
  {
    id: "writing",
    label: "Writing Systems",
    notation: "Glyphs",
    icon: createGlyphAdapter("system-writing"),
    themeColor: "#10b981",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-2xs",
    activeTextClassName: "text-emerald-600 dark:text-emerald-400",
    activeIconClassName: "text-emerald-500 dark:text-emerald-400",
  },
  {
    id: "packs",
    label: "Community Packs",
    notation: "Packs",
    icon: createGlyphAdapter("system-pack"),
    themeColor: "#0091ff",
    glowClassName: "",
    activeIndicatorClassName:
      "bg-onoma-primary/10 border-onoma-primary/30 text-onoma-primary dark:text-onoma-primary-light shadow-2xs",
    activeTextClassName: "text-onoma-primary dark:text-onoma-primary-light",
    activeIconClassName: "text-onoma-primary dark:text-onoma-primary-light",
  },
];
