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
  NavArrowRight,
} from "iconoir-react";
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
import { FOCUS_RING, IconTile, PRESSABLE, TONE, type Tone } from "./surface-kit";

/** Canon-feed category → label, glyph and tone (`cls` is the matching icon-tile class). */
export const CATEGORY_STYLE: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: Tone; cls: string }
> = {
  diplomatic: { label: "Diplomacy", icon: Globe2, tone: "diplomacy", cls: TONE.diplomacy.tile },
  diplomacy: { label: "Diplomacy", icon: Globe2, tone: "diplomacy", cls: TONE.diplomacy.tile },
  military: { label: "Defense", icon: Shield, tone: "defense", cls: TONE.defense.tile },
  defense: { label: "Defense", icon: Shield, tone: "defense", cls: TONE.defense.tile },
  security: { label: "Defense", icon: Shield, tone: "defense", cls: TONE.defense.tile },
  governance: { label: "Politics", icon: Landmark, tone: "politics", cls: TONE.politics.tile },
  economic: { label: "Economy", icon: TrendingUp, tone: "economy", cls: TONE.economy.tile },
  economy: { label: "Economy", icon: TrendingUp, tone: "economy", cls: TONE.economy.tile },
  social: { label: "Social", icon: Heart, tone: "info", cls: TONE.info.tile },
  intent: { label: "Directive", icon: Command, tone: "accent", cls: TONE.accent.tile },
  crisis: { label: "Crisis", icon: AlertTriangle, tone: "critical", cls: TONE.critical.tile },
  ledger: { label: "Ledger", icon: Scale, tone: "neutral", cls: TONE.neutral.tile },
};

interface CountryPeekData {
  stabilityMetrics?: { stabilityScore?: number | null } | null;
  calculatedStats?: { gdpGrowth?: number | null } | null;
  adjustedGdpGrowth?: number | null;
}

/** GDP growth as a signed percentage, or null when the country has no growth figure. */
export function formatGrowthPeek(country: CountryPeekData | null | undefined): string | null {
  const raw = country?.calculatedStats?.gdpGrowth ?? country?.adjustedGdpGrowth;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const pct = Math.abs(raw) > 1 ? raw : raw * 100;
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
}

/**
 * The four domain destinations. `getPeek` only ever reports real data; when a figure is
 * missing it falls back to a plain description of what the domain holds, never a number.
 */
export const DOMAIN_TILES: {
  id: MyCountrySection;
  title: string;
  drillKind: Exclude<V2Drill, { kind: "intent" } | null>;
  icon: React.ComponentType<{ className?: string }>;
  graphic: React.ComponentType<{ className?: string }>;
  tone: Tone;
  badgeCls: string;
  getPeek: (country: CountryPeekData | null | undefined) => string;
}[] = [
  {
    id: "diplomacy",
    title: "Diplomacy",
    drillKind: { kind: "relations" },
    icon: Globe,
    graphic: DiplomacyGraphic,
    tone: "diplomacy",
    badgeCls: TONE.diplomacy.tile,
    getPeek: () => "Relations, embassies and alliances",
  },
  {
    id: "defense",
    title: "Defense",
    drillKind: { kind: "defense" },
    icon: HistoricShieldAlt,
    graphic: DefenseGraphic,
    tone: "defense",
    badgeCls: TONE.defense.tile,
    getPeek: () => "Forces, readiness and threats",
  },
  {
    id: "politics",
    title: "Politics",
    drillKind: { kind: "politics" },
    icon: Scale,
    graphic: PoliticsGraphic,
    tone: "politics",
    badgeCls: TONE.politics.tile,
    getPeek: (c) => {
      const score = c?.stabilityMetrics?.stabilityScore;
      return typeof score === "number" && Number.isFinite(score)
        ? `Stability ${Math.round(score)}%`
        : "Cabinet, parties and bills";
    },
  },
  {
    id: "economy",
    title: "Economy & Budget",
    drillKind: { kind: "economy" },
    icon: TrendingUp,
    graphic: EconomyGraphic,
    tone: "economy",
    badgeCls: TONE.economy.tile,
    getPeek: (c) => {
      const growth = formatGrowthPeek(c);
      return growth ? `GDP growth ${growth}` : "Budget, tax and trade";
    },
  },
];

/** One domain destination: icon tile, title, a real-data peek and a disclosure chevron. */
export function DomainTileButton({
  tile,
  peek,
  badge,
  onSelect,
}: {
  tile: (typeof DOMAIN_TILES)[number];
  peek: string;
  badge?: React.ReactNode;
  onSelect: () => void;
}) {
  const Icon = tile.icon;
  return (
    <button
      type="button"
      onClick={() => {
        soundEffects.press();
        onSelect();
      }}
      className={cn(
        "group bg-muted/40 hover:bg-muted/70 flex min-h-14 w-full items-center gap-3 rounded-2xl p-3 text-left",
        PRESSABLE,
        FOCUS_RING
      )}
    >
      <IconTile icon={Icon} tone={tile.tone} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
          <span className="truncate">{tile.title}</span>
          {badge}
        </span>
        <span className="text-muted-foreground truncate text-xs tabular-nums">{peek}</span>
      </span>
      <NavArrowRight
        aria-hidden="true"
        className="text-muted-foreground/60 group-hover:text-muted-foreground h-4 w-4 shrink-0 transition-[color,transform] duration-150 group-hover:translate-x-0.5"
      />
    </button>
  );
}

export const DomainActionTiles = React.memo(function DomainActionTiles({
  onOpenDrill,
  onNavigate,
}: {
  onOpenDrill?: (drill: Exclude<V2Drill, { kind: "intent" } | null>) => void;
  onNavigate?: (section: MyCountrySection) => void;
}) {
  const { country } = useCountryData();

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {DOMAIN_TILES.map((tile) => (
        <DomainTileButton
          key={tile.id}
          tile={tile}
          peek={tile.getPeek(country as CountryPeekData | null | undefined)}
          onSelect={() => {
            if (onNavigate) onNavigate(tile.id);
            else onOpenDrill?.(tile.drillKind);
          }}
        />
      ))}
    </div>
  );
});

export const ExecutiveActionCards = DomainActionTiles;
