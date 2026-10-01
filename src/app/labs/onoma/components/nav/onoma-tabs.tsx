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

/** Active tab styling: every Onoma tab marks selection with the Labs tint (Facet 3 §2.2). */
const TINT_TAB = {
  activeIndicatorClassName: "bg-tint-fill border-tint/30",
  activeTextClassName: "text-tint",
  activeIconClassName: "text-tint",
} as const;

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
    ...TINT_TAB,
  },
  {
    id: "studio",
    label: "Studio",
    icon: createGlyphAdapter("emerge-branch"),
    ...TINT_TAB,
  },
  {
    id: "explore",
    label: "Explore",
    icon: createGlyphAdapter("sound-acoustic"),
    ...TINT_TAB,
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
    ...TINT_TAB,
  },
  {
    id: "people",
    label: "People",
    notation: "Characters",
    icon: createGlyphAdapter("sound-articulation"),
    ...TINT_TAB,
  },
  {
    id: "organizations",
    label: "Factions",
    notation: "Organizations",
    icon: createGlyphAdapter("struct-syntax"),
    ...TINT_TAB,
  },
  {
    id: "culture",
    label: "Culture",
    notation: "Traditions",
    icon: createGlyphAdapter("compose-morphology"),
    ...TINT_TAB,
  },
];

export const ONOMA_TABS = [
  {
    id: "overview",
    label: "Sandbox",
    notation: "Freeform",
    className: "whitespace-nowrap font-medium",
    icon: createGlyphAdapter("emerge-engine"),
    ...TINT_TAB,
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
    ...TINT_TAB,
  },
  {
    id: "visualizer",
    label: "Path Visualizer",
    notation: "Graph",
    icon: createGlyphAdapter("struct-syntax"),
    ...TINT_TAB,
  },
  {
    id: "namesets",
    label: "Name Sets",
    notation: "Sets",
    icon: createGlyphAdapter("memory-dataset"),
    ...TINT_TAB,
  },
  {
    id: "shifts",
    label: "Sound Shifts",
    notation: "Rules",
    icon: createGlyphAdapter("transform-shift"),
    ...TINT_TAB,
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
    ...TINT_TAB,
  },
  {
    id: "grammar",
    label: "Grammar & Roots",
    notation: "Grammar",
    icon: createGlyphAdapter("struct-syntax"),
    ...TINT_TAB,
  },
  {
    id: "writing",
    label: "Writing Systems",
    notation: "Glyphs",
    icon: createGlyphAdapter("system-writing"),
    ...TINT_TAB,
  },
  {
    id: "packs",
    label: "Community Packs",
    notation: "Packs",
    icon: createGlyphAdapter("system-pack"),
    ...TINT_TAB,
  },
];
