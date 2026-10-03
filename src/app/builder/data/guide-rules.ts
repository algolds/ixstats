import type { BuilderSection } from "../lib/builder-theme";
import React from "react";
import {
  Component as Blocks,
  Crown,
  Flash as Zap,
  Shield,
  StatUp as TrendingUp,
  Industry,
  Calculator,
  Group as Users,
  Globe,
  Coins,
  Sparks,
  Bookmark,
  TriangleFlag as Flag,
  Compass,
  Check,
  Eye,
} from "iconoir-react";

interface GuideRuleItem {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge?: string;
}

export const GUIDE_RULES: Record<BuilderSection, GuideRuleItem[]> = {
  foundation: [
    {
      icon: Globe,
      title: "Real starting numbers",
      description:
        "A real country's population and GDP per capita become your starting values, so the numbers are realistic from day one.",
      badge: "Real baseline",
    },
    {
      icon: Sparks,
      title: "Pick the scale first",
      description:
        "Choose a country whose size and population are close to what you want, then adjust the government and economy in the later steps.",
      badge: "Scale",
    },
    {
      icon: Shield,
      title: "Everything can change later",
      description:
        "A template is only a starting point. Tax rates, government components, lore and the flag can all be edited afterward.",
      badge: "Editable",
    },
  ],
  identity: [
    {
      icon: Bookmark,
      title: "Names",
      description:
        "Set the common name and the official name. They appear on treaties, passports and reports.",
      badge: "Names",
    },
    {
      icon: Flag,
      title: "Flag and coat of arms",
      description:
        "Upload or select a flag and coat of arms. They appear on the map and on passports.",
      badge: "Symbols",
    },
    {
      icon: Compass,
      title: "Ideological alignment",
      description:
        "Set your nation's position on the civil, economic and sovereignty axes. It sets your default diplomatic standing.",
      badge: "Alignment",
    },
  ],
  government: [
    {
      icon: Blocks,
      title: "Pick up to 15 components",
      description:
        "Components cover power structures, courts, public services and more. None is mandatory, so build the system you want.",
      badge: "Max 15",
    },
    {
      icon: Crown,
      title: "Set your priorities",
      description:
        "Spread authority across many components or concentrate it in a few, depending on the kind of state you want.",
      badge: "Branches",
    },
    {
      icon: Zap,
      title: "Combine components",
      description:
        "Components that reinforce each other add a synergy bonus to your effectiveness score. Rule of law and an independent judiciary are one example.",
      badge: "Synergies",
    },
    {
      icon: Shield,
      title: "Conflicts",
      description:
        "Opposing components add friction and lower your net effectiveness. You can still keep them.",
      badge: "Friction",
    },
    {
      icon: TrendingUp,
      title: "Costs and upkeep",
      description:
        "The metrics bar updates as you pick components. It shows net effectiveness, setup cost and yearly upkeep.",
      badge: "Budget",
    },
  ],
  economics: [
    {
      icon: Industry,
      title: "Sector distribution",
      description:
        "Set the weight of agriculture, industry, services and technology. A diverse mix is more resilient to trade shocks.",
      badge: "Sectors",
    },
    {
      icon: Calculator,
      title: "Taxes and revenue",
      description:
        "Set tax rates on personal income, corporate profit and resource extraction to balance government spending.",
      badge: "Fiscal",
    },
    {
      icon: Users,
      title: "Labor",
      description:
        "Set workforce participation, minimum wage and unionization. They affect productivity and consumer spending.",
      badge: "Labor",
    },
    {
      icon: Coins,
      title: "Currency and reserves",
      description:
        "Set the currency, its backing and the reserve composition. They affect exchange rate stability.",
      badge: "Monetary",
    },
  ],
  preview: [
    {
      icon: Eye,
      title: "Check your choices",
      description:
        "Review the government components, sector outputs and budget before you create the nation.",
      badge: "Review",
    },
    {
      icon: Zap,
      title: "Basic institutions",
      description:
        "Make sure you have executive and judicial authorities so your nation can handle policy directives and diplomatic events.",
      badge: "Readiness",
    },
  ],
  import: [
    {
      icon: Globe,
      title: "Infobox extraction",
      description:
        "Lore, demographics and economic indicators are read from the country's wiki infobox.",
      badge: "Import",
    },
    {
      icon: Check,
      title: "Review the data",
      description:
        "Check the extracted statistics against the builder's components and sectors. Every field can be edited.",
      badge: "Review",
    },
  ],
};
