"use client";

import React from "react";
import {
  KeyCommand as Command,
  Globe,
  Globe as Globe2,
  Shield,
  HistoricShieldAlt,
  Bank as Landmark,
  StatUp as TrendingUp,
  Heart,
  WarningTriangle as AlertTriangle,
  ScaleFrameEnlarge as Scale,
  ArrowUpRight,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { soundEffects } from "~/lib/sound/cuelume";
import type { V2Drill } from "~/components/mycountry/shell/DrillSheets";
import type { MyCountrySection } from "~/components/mycountry/shell/MyCountrySidebarNav";
import {
  DiplomacyGraphic,
  DefenseGraphic,
  PoliticsGraphic,
  EconomyGraphic,
} from "./ActionCardGraphics";

export const CATEGORY_STYLE: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  diplomatic: {
    label: "Diplomacy",
    icon: Globe2,
    cls: "border-cyan-500/40 text-cyan-800 dark:text-cyan-400 bg-cyan-500/10",
  },
  diplomacy: {
    label: "Diplomacy",
    icon: Globe2,
    cls: "border-cyan-500/40 text-cyan-800 dark:text-cyan-400 bg-cyan-500/10",
  },
  military: {
    label: "Defense",
    icon: Shield,
    cls: "border-red-500/40 text-red-800 dark:text-red-400 bg-red-500/10",
  },
  defense: {
    label: "Defense",
    icon: Shield,
    cls: "border-red-500/40 text-red-800 dark:text-red-400 bg-red-500/10",
  },
  security: {
    label: "Defense",
    icon: Shield,
    cls: "border-red-500/40 text-red-800 dark:text-red-400 bg-red-500/10",
  },
  governance: {
    label: "Politics",
    icon: Landmark,
    cls: "border-indigo-500/40 text-indigo-800 dark:text-indigo-400 bg-indigo-500/10",
  },
  economic: {
    label: "Economy",
    icon: TrendingUp,
    cls: "border-emerald-500/40 text-emerald-800 dark:text-emerald-400 bg-emerald-500/10",
  },
  economy: {
    label: "Economy",
    icon: TrendingUp,
    cls: "border-emerald-500/40 text-emerald-800 dark:text-emerald-400 bg-emerald-500/10",
  },
  social: {
    label: "Social",
    icon: Heart,
    cls: "border-blue-500/40 text-blue-800 dark:text-blue-400 bg-blue-500/10",
  },
  intent: {
    label: "Directive",
    icon: Command,
    cls: "border-amber-500/40 text-amber-800 dark:text-amber-400 bg-amber-500/10",
  },
  crisis: {
    label: "Crisis",
    icon: AlertTriangle,
    cls: "border-red-500/40 text-red-800 dark:text-red-400 bg-red-500/10",
  },
  ledger: {
    label: "Ledger",
    icon: Scale,
    cls: "border-blue-500/40 text-blue-800 dark:text-blue-400 bg-blue-500/10",
  },
};

interface CountryPeekData {
  activeEmbassiesCount?: number;
  embassies?: Array<{ id?: string }>;
  diplomaticStance?: string;
  militaryReadiness?: number;
  readiness?: number;
  defensePosture?: string;
  posture?: string;
  currentStability?: number;
  stability?: number;
  gdpGrowth?: number;
  currentGdpGrowth?: number;
}

export const DOMAIN_TILES: {
  id: MyCountrySection;
  title: string;
  drillKind: Exclude<V2Drill, { kind: "intent" } | null>;
  icon: React.ComponentType<{ className?: string }>;
  graphic: React.ComponentType<{ className?: string }>;
  badgeCls: string;
  getPeek: (country: CountryPeekData | null | undefined) => string;
}[] = [
  {
    id: "diplomacy",
    title: "Diplomacy",
    drillKind: { kind: "relations" },
    icon: Globe,
    graphic: DiplomacyGraphic,
    badgeCls: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
    getPeek: (c) =>
      `${c?.activeEmbassiesCount ?? c?.embassies?.length ?? 12} Embassies • ${c?.diplomaticStance ?? "Active Alliance"}`,
  },
  {
    id: "defense",
    title: "Defense",
    drillKind: { kind: "defense" },
    icon: HistoricShieldAlt,
    graphic: DefenseGraphic,
    badgeCls: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    getPeek: (c) =>
      `${c?.militaryReadiness ?? c?.readiness ?? 94}% Readiness • ${c?.defensePosture ?? c?.posture ?? "Defensive"}`,
  },
  {
    id: "politics",
    title: "Politics",
    drillKind: { kind: "politics" },
    icon: Scale,
    graphic: PoliticsGraphic,
    badgeCls: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
    getPeek: (c) => {
      const raw = c?.currentStability ?? c?.stability ?? 0.78;
      return `${Math.round(raw > 1 ? raw : raw * 100)}% Stability • Active Cabinet`;
    },
  },
  {
    id: "economy",
    title: "Economy & Budget",
    drillKind: { kind: "economy" },
    icon: TrendingUp,
    graphic: EconomyGraphic,
    badgeCls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    getPeek: (c) => {
      const raw = c?.gdpGrowth ?? c?.currentGdpGrowth ?? 0.034;
      return `+${(raw > 1 ? raw : raw * 100).toFixed(1)}% Growth • Fiscal Stable`;
    },
  },
];

export const DomainActionTiles = React.memo(function DomainActionTiles({
  onOpenDrill,
  onNavigate,
}: {
  onOpenDrill?: (drill: Exclude<V2Drill, { kind: "intent" } | null>) => void;
  onNavigate?: (section: MyCountrySection) => void;
}) {
  const { country } = useCountryData();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {DOMAIN_TILES.map(
        ({ id, title, icon: Icon, graphic: Graphic, badgeCls, drillKind, getPeek }) => (
          <FacetCard
            key={id}
            depth={1}
            interactive="none"
            onClick={() => {
              soundEffects.press();
              if (onNavigate) {
                onNavigate(id);
              } else if (onOpenDrill) {
                onOpenDrill(drillKind);
              }
            }}
            className="group border-border/70 bg-card/60 hover:border-border hover:bg-card/90 relative flex cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-2xl border p-3 shadow-xs backdrop-blur-md transition-all duration-150 select-none active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
          >
            {/* Subtle Radial-Masked Architectural Watermark */}
            <Graphic />

            {/* Left: Themed Icon Badge + Text */}
            <div className="relative z-10 flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-transform duration-150 group-hover:scale-105",
                  badgeCls
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 text-left">
                <span className="text-foreground truncate text-[13px] leading-tight font-bold tracking-tight">
                  {title}
                </span>
                <span className="text-muted-foreground truncate text-[11px] leading-tight font-medium tracking-tight">
                  {getPeek(country as CountryPeekData | null | undefined)}
                </span>
              </div>
            </div>

            {/* Right: Arrow indicator */}
            <ArrowUpRight className="text-muted-foreground group-hover:text-foreground relative z-10 h-3.5 w-3.5 shrink-0 opacity-60 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
          </FacetCard>
        )
      )}
    </div>
  );
});

export const ExecutiveActionCards = DomainActionTiles;

