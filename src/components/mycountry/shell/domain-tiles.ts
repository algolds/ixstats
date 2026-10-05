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
} from "iconoir-react";
import type { MyCountrySection } from "~/components/mycountry/shell/mycountry-sections";
import type { StatusTone } from "./status-tone";

/** Canon-feed category → label, glyph and status tone (only a crisis is critical). */
export const CATEGORY_STYLE: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: StatusTone;
  }
> = {
  diplomatic: { label: "Diplomacy", icon: Globe2, tone: "neutral" },
  diplomacy: { label: "Diplomacy", icon: Globe2, tone: "neutral" },
  military: { label: "Defense", icon: Shield, tone: "neutral" },
  defense: { label: "Defense", icon: Shield, tone: "neutral" },
  security: { label: "Defense", icon: Shield, tone: "neutral" },
  governance: { label: "Politics", icon: Landmark, tone: "neutral" },
  economic: { label: "Economy", icon: TrendingUp, tone: "neutral" },
  economy: { label: "Economy", icon: TrendingUp, tone: "neutral" },
  social: { label: "Social", icon: Heart, tone: "neutral" },
  intent: { label: "Directive", icon: Command, tone: "accent" },
  crisis: { label: "Crisis", icon: AlertTriangle, tone: "critical" },
  ledger: { label: "Ledger", icon: Scale, tone: "neutral" },
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
 * The four domain destinations, shown as rows on the Overview. `getPeek` only ever reports real
 * data; when a figure is missing it falls back to a plain description of what the domain holds,
 * never a number.
 */
export const DOMAIN_TILES: {
  id: MyCountrySection;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  getPeek: (country: CountryPeekData | null | undefined) => string;
}[] = [
  {
    id: "diplomacy",
    title: "Diplomacy",
    icon: Globe,
    getPeek: () => "Relations, embassies and alliances",
  },
  {
    id: "defense",
    title: "Defense",
    icon: HistoricShieldAlt,
    getPeek: () => "Forces, readiness and threats",
  },
  {
    id: "politics",
    title: "Politics",
    icon: Scale,
    getPeek: (c) => {
      const score = c?.stabilityMetrics?.stabilityScore;
      return typeof score === "number" && Number.isFinite(score)
        ? `Stability ${Math.round(score)}%`
        : "Cabinet, parties and bills";
    },
  },
  {
    id: "economy",
    title: "Economy & budget",
    icon: TrendingUp,
    getPeek: (c) => {
      const growth = formatGrowthPeek(c);
      return growth ? `GDP growth ${growth}` : "Budget, tax and trade";
    },
  },
];
