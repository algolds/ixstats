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

export interface GuideRuleItem {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge?: string;
  color?: string;
  bg?: string;
}

export const GUIDE_RULES: Record<BuilderSection, GuideRuleItem[]> = {
  foundation: [
    {
      icon: Globe,
      title: "Real starting numbers",
      description:
        "Your starting population and GDP per capita originate from real economic data, giving your state realistic numbers from day one.",
      badge: "Real Baseline",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      icon: Sparks,
      title: "Scale first, model second",
      description:
        "First pick a territory whose physical or demographic scale matches your idea. In subsequent steps, layer on any government or economic model.",
      badge: "Scale First",
      color: "text-cyan-400",
      bg: "bg-cyan-500/10 border-cyan-500/20",
    },
    {
      icon: Shield,
      title: "Everything can change later",
      description:
        "Templates are just a foundation. All parameters, from tax structures and institutional blocks to lore and flag imagery, can be edited anytime.",
      badge: "Full Agency",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
  ],
  identity: [
    {
      icon: Bookmark,
      title: "Name & formal nomenclature",
      description:
        "Define your state's conventional and constitutional names. These names appear across global treaties, passbooks, and administrative reports.",
      badge: "Nomenclature",
      color: "text-indigo-400",
      bg: "bg-indigo-500/10 border-indigo-500/20",
    },
    {
      icon: Flag,
      title: "National heraldry & vexillology",
      description:
        "Upload or select your sovereign flag and coat of arms. These emblems represent your nation across the interactive map and passport manifests.",
      badge: "Symbols",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      icon: Compass,
      title: "Ideological alignment profile",
      description:
        "Set your nation's foundational alignment along civil, economic, and sovereign axes to determine default diplomatic standing.",
      badge: "Ideology",
      color: "text-cyan-400",
      bg: "bg-cyan-500/10 border-cyan-500/20",
    },
  ],
  government: [
    {
      icon: Blocks,
      title: "Select up to 15 components",
      description:
        "Choose building blocks that define your state, from supreme authority and court systems to public services. There are no mandatory picks. Build the exact system of government you envision.",
      badge: "Capacity: 15",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      icon: Crown,
      title: "Shape your priorities",
      description:
        "Components span power structures, legitimacy, legal systems, security, and administration. Distribute authority broadly or concentrate heavily in a few areas to match your nation's identity.",
      badge: "Branches",
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      icon: Zap,
      title: "Combine components",
      description:
        "Components that reinforce each other unlock synergy bonuses to your total effectiveness score. For example, pairing Rule of Law with an Independent Judiciary creates mutual stability.",
      badge: "Synergies",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      icon: Shield,
      title: "Navigate conflicts",
      description:
        "Opposing choices introduce political friction and lower net effectiveness, but you are free to keep them. Whether you want a harmonious consensus or an unstable, contradictory regime is entirely up to you.",
      badge: "Friction",
      color: "text-rose-400",
      bg: "bg-rose-500/10 border-rose-500/20",
    },
    {
      icon: TrendingUp,
      title: "Track costs and upkeep",
      description:
        "The top metrics bar recalculates live as you pick components. It tracks your net effectiveness, upfront setup spend, and ongoing annual upkeep in real time so you can manage institutional power on your own terms.",
      badge: "Budget & Upkeep",
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
    },
  ],
  economics: [
    {
      icon: Industry,
      title: "Sector distribution & balance",
      description:
        "Configure economic weights across Agriculture, Industrial Manufacturing, Commercial Services, and High Technology. Diversification builds resilience against trade shocks.",
      badge: "Sectors",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      icon: Calculator,
      title: "Tax brackets & revenue model",
      description:
        "Establish sovereign tax rates on personal income, corporate enterprise, and natural resource extraction to balance fiscal spending.",
      badge: "Fiscal",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      icon: Users,
      title: "Workforce & labor standards",
      description:
        "Regulate workforce participation, minimum living wages, and unionization laws to support productivity and consumer purchasing power.",
      badge: "Labor",
      color: "text-cyan-400",
      bg: "bg-cyan-500/10 border-cyan-500/20",
    },
    {
      icon: Coins,
      title: "Currency & sovereign reserves",
      description:
        "Establish your monetary backing, currency denomination, and reserve composition to safeguard exchange rate stability.",
      badge: "Monetary",
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
    },
  ],
  preview: [
    {
      icon: Eye,
      title: "Synthesis validation",
      description:
        "Inspect all institutional choices, sector outputs, and budget reconciliations before publishing your nation into the live simulation.",
      badge: "Integrity",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      icon: Zap,
      title: "Simulation readiness",
      description:
        "Confirm that essential executive and judicial authorities are established to handle incoming policy directives and diplomatic events.",
      badge: "Readiness",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
  ],
  import: [
    {
      icon: Globe,
      title: "Wiki infobox extraction",
      description:
        "Import national lore, demographic records, and economic indicators directly from recognized wiki encyclopedias.",
      badge: "Lore Import",
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      icon: Check,
      title: "Data reconciliation",
      description:
        "Review extracted statistics and map them onto the builder's atomic components and economic sectors. You can edit all fields freely.",
      badge: "Reconciliation",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
  ],
};
