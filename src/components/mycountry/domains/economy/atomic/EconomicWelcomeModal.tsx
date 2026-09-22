"use client";

/**
 * EconomicWelcomeModal — First-visit welcome screen for Atomic Economic Builder.
 * Backed by shared DomainWelcomeModal primitive.
 */

import React from "react";
import {
  StatsReport as BarChart3,
  Industry as Factory,
  Flash as Zap,
  Page as FileText,
  StatUp as TrendingUp,
} from "iconoir-react";
import { DomainWelcomeModal, type DomainTip } from "~/components/shared/atomic-picker";

const ECONOMIC_TIPS: DomainTip[] = [
  {
    icon: BarChart3,
    title: "Choose your economic model",
    description:
      "Pick any baseline philosophy, from free markets and social democracy to central planning or state capitalism. Your model establishes how much control the state holds over private enterprise and commerce.",
  },
  {
    icon: Factory,
    title: "Pick up to 15 components",
    description:
      "Shape production, labor, trade, and natural resources however you like. Focus heavily on a single powerhouse export sector or build a balanced domestic economy. The mix is entirely yours.",
  },
  {
    icon: Zap,
    title: "Government synergies",
    description:
      "Your choices in Step 3 Government connect directly with economic policies. Complementary choices boost productivity and investment, but unconventional pairings are fully supported if you want an unorthodox state.",
    badge: "Synergies",
  },
  {
    icon: FileText,
    title: "Optional templates",
    description:
      "Load pre-tuned archetypes like Nordic Social Democracy or Export Tiger from the search bar as a baseline, or start from scratch and tailor every policy manually.",
    badge: "Templates",
  },
  {
    icon: TrendingUp,
    title: "Balance your treasury",
    description:
      "Run a lean surplus, heavy public investments, or aggressive deficit spending. Each component displays its setup cost and annual upkeep so you can steer your nation's finances as you see fit.",
    badge: "Treasury",
  },
];

export interface EconomicWelcomeModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EconomicWelcomeModal({ open, onOpenChange }: EconomicWelcomeModalProps) {
  return (
    <DomainWelcomeModal
      open={open}
      onOpenChange={onOpenChange}
      storageKey="economic-builder-welcome-seen"
      version="1.0"
      title="Economy builder guide"
      subtitle="How market models, trade rules, and cross-domain synergies work"
      tips={ECONOMIC_TIPS}
      theme="emerald"
    />
  );
}
