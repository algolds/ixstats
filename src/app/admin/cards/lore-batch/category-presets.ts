// src/app/admin/cards/lore-batch/category-presets.ts
// Canonical Category Preset Crawlers with synonyms and alternate terms

import React from "react";
import {
  Globe,
  Shield,
  Compass,
  Crown,
  Page as Scroll,
  Bank as Landmark,
  Component as Layers,
  Coins,
  ClockRotateRight as History,
  Building,
  OpenBook as BookOpen,
  Sparks as Sparkles,
} from "iconoir-react";
import { LoreCategory, CATEGORY_SYNONYMS } from "~/lib/cards/category-enums";
import rawCategoryPresets from "./category-presets.json";

export interface CategoryPreset {
  name: string;
  tag: LoreCategory;
  categoryName: string;
  wikiSourceFilter?: string;
  icon: React.ComponentType<{ className?: string }>;
  synonyms: readonly string[];
  terms: string[];
}

const CATEGORY_ICON_MAP: Record<LoreCategory, React.ComponentType<{ className?: string }>> = {
  [LoreCategory.MILITARY]: Shield,
  [LoreCategory.DIPLOMACY]: Scroll,
  [LoreCategory.GEOGRAPHY]: Compass,
  [LoreCategory.RELIGION]: Landmark,
  [LoreCategory.CULTURE]: BookOpen,
  [LoreCategory.GOVERNMENT]: Building,
  [LoreCategory.PEOPLE]: Crown,
  [LoreCategory.ECONOMY]: Coins,
  [LoreCategory.SCIENCE]: Sparkles,
  [LoreCategory.HISTORY]: History,
  [LoreCategory.NATION]: Globe,
  [LoreCategory.SPECIAL]: Sparkles,
  [LoreCategory.NS_IMPORT]: Layers,
};

export const CATEGORY_PRESETS: CategoryPreset[] = (
  rawCategoryPresets as Array<{
    name: string;
    tag: keyof typeof LoreCategory;
    categoryName: string;
    wikiSourceFilter?: string;
    terms: string[];
  }>
).map((p) => {
  const cat = LoreCategory[p.tag] ?? LoreCategory.SPECIAL;
  return {
    name: p.name,
    tag: cat,
    categoryName: p.categoryName,
    wikiSourceFilter: p.wikiSourceFilter ?? "ixwiki",
    icon: CATEGORY_ICON_MAP[cat] ?? Sparkles,
    synonyms: (CATEGORY_SYNONYMS as Record<string, readonly string[]>)[cat] ?? [],
    terms: p.terms,
  };
});
