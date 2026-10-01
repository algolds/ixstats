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
import { focusRing } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import type { V2Drill } from "~/components/mycountry/shell/DrillSheets";
import type { MyCountrySection } from "~/components/mycountry/shell/MyCountrySidebarNav";
import type { StatusTone } from "./status-tone";
import { HUE_BADGE, hueAccentStyle, type DomainHue } from "./domain-hue";
import {
  DiplomacyGraphic,
  DefenseGraphic,
  PoliticsGraphic,
  EconomyGraphic,
} from "./ActionCardGraphics";

/**
 * Canon-feed category → label, glyph, v2 domain hue (c5c6b382 `CATEGORY_STYLE.cls`: Diplomacy
 * cyan, Defense red, Politics indigo, Economy green, Social/Ledger blue, Directive gold, Crisis
 * red) and status tone (only a crisis is critical; a directive is the MyCountry accent).
 */
export const CATEGORY_STYLE: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: StatusTone;
    hue: DomainHue;
  }
> = {
  diplomatic: { label: "Diplomacy", icon: Globe2, tone: "neutral", hue: "cyan" },
  diplomacy: { label: "Diplomacy", icon: Globe2, tone: "neutral", hue: "cyan" },
  military: { label: "Defense", icon: Shield, tone: "neutral", hue: "red" },
  defense: { label: "Defense", icon: Shield, tone: "neutral", hue: "red" },
  security: { label: "Defense", icon: Shield, tone: "neutral", hue: "red" },
  governance: { label: "Politics", icon: Landmark, tone: "neutral", hue: "indigo" },
  economic: { label: "Economy", icon: TrendingUp, tone: "neutral", hue: "green" },
  economy: { label: "Economy", icon: TrendingUp, tone: "neutral", hue: "green" },
  social: { label: "Social", icon: Heart, tone: "neutral", hue: "blue" },
  intent: { label: "Directive", icon: Command, tone: "accent", hue: "yellow" },
  crisis: { label: "Crisis", icon: AlertTriangle, tone: "critical", hue: "red" },
  ledger: { label: "Ledger", icon: Scale, tone: "neutral", hue: "blue" },
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
  /** Fine-stroke watermark behind the tile (`ActionCardGraphics.tsx`). */
  graphic: React.ComponentType<{ className?: string }>;
  /** v2 domain hue (`badgeCls`): icon badge, watermark and hover accent. */
  hue: DomainHue;
  getPeek: (country: CountryPeekData | null | undefined) => string;
}[] = [
  {
    id: "diplomacy",
    title: "Diplomacy",
    drillKind: { kind: "relations" },
    icon: Globe,
    graphic: DiplomacyGraphic,
    hue: "cyan",
    getPeek: () => "Relations, embassies and alliances",
  },
  {
    id: "defense",
    title: "Defense",
    drillKind: { kind: "defense" },
    icon: HistoricShieldAlt,
    graphic: DefenseGraphic,
    hue: "red",
    getPeek: () => "Forces, readiness and threats",
  },
  {
    id: "politics",
    title: "Politics",
    drillKind: { kind: "politics" },
    icon: Scale,
    graphic: PoliticsGraphic,
    hue: "indigo",
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
    hue: "green",
    getPeek: (c) => {
      const growth = formatGrowthPeek(c);
      return growth ? `GDP growth ${growth}` : "Budget, tax and trade";
    },
  },
];

/**
 * One domain destination, restored from c5c6b382: the domain's glyph in its v2 hue badge, title,
 * a real-data peek and the up-right arrow, over the domain's fine-stroke architectural watermark.
 * Hover lifts the tile (`facet-lift`), brightens the watermark and drifts the arrow — keyboard
 * focus shows the same affordances; press scales it (`facet-press`). The domain hue is the tile's
 * Facet accent (badge, watermark, hover border). The tile is opaque (`bg-surface`) so it never
 * stacks blur on the glass command bar it sits in.
 */
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
  const Graphic = tile.graphic;
  return (
    <button
      type="button"
      onClick={onSelect}
      style={hueAccentStyle(tile.hue)}
      className={cn(
        "group rounded-row border-separator bg-surface text-label shadow-card relative flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 overflow-hidden border p-3 text-left select-none",
        "hover:border-facet-accent/40 focus-visible:border-facet-accent/40",
        "facet-press facet-press-subtle facet-lift",
        focusRing
      )}
    >
      <Graphic />
      <span className="relative flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-[scale] duration-150 motion-safe:group-hover:scale-105 motion-safe:group-focus-visible:scale-105",
            HUE_BADGE
          )}
        >
          <Icon className="size-4 shrink-0" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-label text-headline flex items-center gap-2">
            <span className="truncate">{tile.title}</span>
            {badge}
          </span>
          <span className="text-label-secondary text-footnote truncate font-normal tabular-nums">
            {peek}
          </span>
        </span>
      </span>
      <ArrowUpRight
        aria-hidden="true"
        className="text-label-tertiary group-hover:text-label group-focus-visible:text-label relative size-4 shrink-0 transition-[color,translate] duration-150 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-focus-visible:translate-x-0.5 motion-safe:group-focus-visible:-translate-y-0.5"
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
