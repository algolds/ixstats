import React from "react";
import { Dollar as DollarSign, StatUp as TrendingUp, Crown, Industry as Factory, Coins, City as Building2, CheckSquare as Vote, Globe as Globe2, Heart, ModernTv as Mountain, SeaWaves as Waves, SunLight as Sun, Flash as Zap } from "iconoir-react";
import {
  archetypeCategories,
  enhancedArchetypes as baseArchetypes,
  archetypeConfig,
  // oxlint-disable-next-line eslint/no-unused-vars
  getSelectableArchetypes as baseGetSelectableArchetypes,
  validateArchetypeSelection,
} from "~/lib/archetypes/catalog";
import type {
  ArchetypeCategory,
  EnhancedArchetype as BaseEnhancedArchetype,
  ArchetypeConfig,
} from "~/lib/archetypes/types";
import type { RealCountryData } from "../lib/economy-data-service";

export type { ArchetypeCategory, ArchetypeConfig, RealCountryData };

export interface EnhancedArchetype extends Omit<BaseEnhancedArchetype, "iconName"> {
  icon: React.ComponentType<{ className?: string }>;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  DollarSign,
  TrendingUp,
  Factory,
  Coins,
  Vote,
  Building2,
  Crown,
  Globe2,
  Heart,
  Waves,
  Mountain,
  Sun,
  Zap,
};

export const enhancedArchetypes: EnhancedArchetype[] = baseArchetypes.map((a) => ({
  ...a,
  icon: (a.iconName && ICON_MAP[a.iconName]) || Zap,
}));

export const getArchetypesByCategory = (category: string): EnhancedArchetype[] => {
  return enhancedArchetypes.filter((archetype) => archetype.category === category);
};

export const getSelectableArchetypes = (): EnhancedArchetype[] => {
  return enhancedArchetypes.filter((archetype) => archetype.isSelectable);
};

export { archetypeCategories, archetypeConfig, validateArchetypeSelection };
